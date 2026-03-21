import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChapterImageService } from './chapter-image.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = vi.fn().mockResolvedValue({});
  },
  PutObjectCommand: class {
    constructor(public args: any) {}
  },
  DeleteObjectsCommand: class {
    constructor(public args: any) {}
  },
}));

vi.mock('sharp', () => {
  const sharpChain = {
    metadata: vi.fn().mockResolvedValue({ width: 800 }),
    resize: vi.fn(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed')),
  };
  sharpChain.resize.mockReturnValue(sharpChain);
  return { default: vi.fn().mockReturnValue(sharpChain) };
});

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  ['select', 'from', 'where', 'limit', 'insert', 'values', 'delete'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'page.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('img'),
    encoding: '7bit',
    destination: '',
    filename: 'page.jpg',
    path: '',
    stream: null as any,
    ...overrides,
  };
}

describe('ChapterImageService', () => {
  let service: ChapterImageService;
  let mockDb: any;
  let mockConfig: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockConfig = {
      getOrThrow: vi.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          's3.region': 'ap-southeast-1',
          's3.bucket': 'test-bucket',
          's3.accessKeyId': 'AKID',
          's3.secretAccessKey': 'secret',
        };
        return map[key] ?? '';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChapterImageService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ChapterImageService>(ChapterImageService);
  });

  afterEach(() => { vi.clearAllMocks(); });

  // ─── uploadImages ─────────────────────────────────────────────────

  describe('uploadImages()', () => {
    it('should throw BadRequestException when no files provided', async () => {
      await expect(service.uploadImages(1, 1, [])).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when chapter not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(
        service.uploadImages(999, 1, [makeFile()]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid mime type', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));

      await expect(
        service.uploadImages(1, 1, [makeFile({ mimetype: 'image/gif' })]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file exceeds 5MB', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));

      await expect(
        service.uploadImages(1, 1, [makeFile({ size: 6 * 1024 * 1024 })]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload and return image records on success', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));
      mockDb.delete.mockReturnValue(buildChain([]));
      mockDb.insert.mockReturnValue(buildChain([]));

      const result = await service.uploadImages(1, 1, [
        makeFile({ mimetype: 'image/jpeg' }),
        makeFile({ mimetype: 'image/png', originalname: 'page2.png' }),
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].pageNumber).toBe(1);
      expect(result[1].pageNumber).toBe(2);
      expect(result[0].imageUrl).toContain('test-bucket');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should support webp mime type', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));
      mockDb.delete.mockReturnValue(buildChain([]));
      mockDb.insert.mockReturnValue(buildChain([]));

      const result = await service.uploadImages(1, 1, [makeFile({ mimetype: 'image/webp' })]);
      expect(result[0].imageUrl).toContain('.webp');
    });
  });

  // ─── clearImages ──────────────────────────────────────────────────

  describe('clearImages()', () => {
    it('should do nothing when no images exist', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.clearImages(1, 1)).resolves.not.toThrow();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('should delete S3 objects and DB records when images exist', async () => {
      const images = [
        { id: 1, imageUrl: 'https://test-bucket.s3.ap-southeast-1.amazonaws.com/manga/1/chapters/1/1.jpg' },
      ];
      mockDb.select.mockReturnValue(buildChain(images));
      mockDb.delete.mockReturnValue(buildChain([]));

      // override s3 send on service instance
      const s3 = (service as any).s3;
      s3.send = vi.fn().mockResolvedValue({});

      await expect(service.clearImages(1, 1)).resolves.not.toThrow();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
