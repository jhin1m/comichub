import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ImageMirrorProcessor } from './image-mirror.processor.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';

const { s3SendMock, safeFetchMock } = vi.hoisted(() => ({
  s3SendMock: vi.fn().mockResolvedValue({}),
  safeFetchMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = s3SendMock;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 800 }),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('webp-bytes')),
  })),
}));

vi.mock('../../common/utils/safe-http.util.js', () => ({
  safeHttpsFetch: (...args: unknown[]) => safeFetchMock(...args),
}));

function buildSelectChain(rows: unknown[]): any {
  const chain: any = {};
  ['select', 'from', 'innerJoin', 'where'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: any) => resolve(rows);
  return chain;
}

function buildUpdateChain(): any {
  const chain: any = {};
  ['update', 'set', 'where'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: any) => resolve([]);
  return chain;
}

function fakeImageResponse() {
  const body = new Uint8Array(Buffer.from('rawimage'));
  let pulled = false;
  return {
    ok: true,
    status: 200,
    headers: new Map([
      ['content-type', 'image/jpeg'],
      ['content-length', String(body.byteLength)],
    ]) as any,
    body: {
      getReader: () => ({
        read: () =>
          pulled
            ? Promise.resolve({ done: true, value: undefined })
            : ((pulled = true), Promise.resolve({ done: false, value: body })),
        cancel: () => Promise.resolve(),
      }),
    },
  };
}

describe('ImageMirrorProcessor', () => {
  let processor: ImageMirrorProcessor;
  let mockDb: any;

  beforeEach(async () => {
    s3SendMock.mockClear();
    safeFetchMock.mockReset();
    safeFetchMock.mockImplementation(() =>
      Promise.resolve(fakeImageResponse()),
    );

    mockDb = {
      select: vi.fn(),
      update: vi.fn().mockReturnValue(buildUpdateChain()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageMirrorProcessor,
        { provide: DRIZZLE, useValue: mockDb },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('https://cdn.example'),
            getOrThrow: vi.fn((key: string) => {
              const map: Record<string, string> = {
                's3.region': 'us-east-1',
                's3.bucket': 'test-bucket',
                's3.accessKeyId': 'AKIA',
                's3.secretAccessKey': 'SECRET',
              };
              return map[key] ?? '';
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<ImageMirrorProcessor>(ImageMirrorProcessor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return early when no unmirrored images exist', async () => {
    mockDb.select.mockReturnValue(buildSelectChain([]));

    await processor.process({ data: { chapterId: 1 } } as any);

    expect(safeFetchMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should mirror only unmirrored images (idempotent on retry)', async () => {
    const rows = [
      {
        id: 10,
        chapterId: 1,
        sourceUrl: 'https://src.example/p1.jpg',
        pageNumber: 1,
        mangaId: 7,
      },
    ];

    let call = 0;
    mockDb.select.mockImplementation(() => {
      call++;
      return buildSelectChain(call === 1 ? rows : []);
    });

    await processor.process({ data: { chapterId: 1 } } as any);
    await processor.process({ data: { chapterId: 1 } } as any);

    expect(s3SendMock).toHaveBeenCalledOnce();
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('should continue mirroring remaining images when one fails', async () => {
    const rows = [
      {
        id: 1,
        chapterId: 1,
        groupId: null,
        sourceUrl: 'https://src/p1.jpg',
        pageNumber: 1,
        mangaId: 7,
      },
      {
        id: 2,
        chapterId: 1,
        groupId: null,
        sourceUrl: 'https://src/p2.jpg',
        pageNumber: 2,
        mangaId: 7,
      },
      {
        id: 3,
        chapterId: 1,
        groupId: null,
        sourceUrl: 'https://src/p3.jpg',
        pageNumber: 3,
        mangaId: 7,
      },
    ];
    mockDb.select.mockReturnValue(buildSelectChain(rows));

    safeFetchMock.mockImplementation((url: string) => {
      if (url.includes('p2')) return Promise.reject(new Error('boom'));
      return Promise.resolve(fakeImageResponse());
    });

    await processor.process({ data: { chapterId: 1 } } as any);

    expect(s3SendMock).toHaveBeenCalledTimes(2);
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('should throw when ALL images fail so BullMQ retries the job', async () => {
    const rows = [
      {
        id: 1,
        chapterId: 1,
        groupId: null,
        sourceUrl: 'https://src/p1.jpg',
        pageNumber: 1,
        mangaId: 7,
      },
      {
        id: 2,
        chapterId: 1,
        groupId: null,
        sourceUrl: 'https://src/p2.jpg',
        pageNumber: 2,
        mangaId: 7,
      },
    ];
    mockDb.select.mockReturnValue(buildSelectChain(rows));
    safeFetchMock.mockRejectedValue(new Error('upstream down'));

    await expect(
      processor.process({ data: { chapterId: 1 } } as any),
    ).rejects.toThrow(/All 2 images failed/);
  });

  it('should write S3 URLs that include groupId segment to avoid collisions', async () => {
    const rows = [
      {
        id: 10,
        chapterId: 5,
        groupId: 99,
        sourceUrl: 'https://src.example/p7.jpg',
        pageNumber: 7,
        mangaId: 42,
      },
    ];
    mockDb.select.mockReturnValue(buildSelectChain(rows));

    const updateChain = buildUpdateChain();
    mockDb.update.mockReturnValue(updateChain);

    await processor.process({ data: { chapterId: 5 } } as any);

    expect(updateChain.set).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.example/manga/42/chapters/5/99/7.webp',
    });
  });

  it('should fall back to "default" segment when groupId is null', async () => {
    const rows = [
      {
        id: 11,
        chapterId: 5,
        groupId: null,
        sourceUrl: 'https://src.example/p1.jpg',
        pageNumber: 1,
        mangaId: 42,
      },
    ];
    mockDb.select.mockReturnValue(buildSelectChain(rows));

    const updateChain = buildUpdateChain();
    mockDb.update.mockReturnValue(updateChain);

    await processor.process({ data: { chapterId: 5 } } as any);

    expect(updateChain.set).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.example/manga/42/chapters/5/default/1.webp',
    });
  });
});
