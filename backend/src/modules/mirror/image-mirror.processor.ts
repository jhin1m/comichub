import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import type { Job } from 'bullmq';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { chapterImages, chapters } from '../../database/schema/index.js';
import { safeHttpsFetch } from '../../common/utils/safe-http.util.js';

const MAX_WIDTH = 1200;
const DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const WORKER_CONCURRENCY = 4;

export interface MirrorJobData {
  chapterId: number;
}

@Processor('mirror', { concurrency: WORKER_CONCURRENCY })
export class ImageMirrorProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageMirrorProcessor.name);
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private config: ConfigService,
  ) {
    super();
    const region = this.config.getOrThrow<string>('s3.region');
    this.bucket = this.config.getOrThrow<string>('s3.bucket');
    this.publicUrl =
      this.config.get<string>('s3.publicUrl', '') ||
      `https://${this.bucket}.s3.${region}.amazonaws.com`;
    this.s3 = new S3Client({
      region,
      endpoint: this.config.get<string>('s3.endpoint') || undefined,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('s3.accessKeyId'),
        secretAccessKey: this.config.getOrThrow<string>('s3.secretAccessKey'),
      },
    });
  }

  async process(job: Job<MirrorJobData>): Promise<void> {
    const { chapterId } = job.data;

    const unmirrored = await this.db
      .select({
        id: chapterImages.id,
        chapterId: chapterImages.chapterId,
        groupId: chapterImages.groupId,
        sourceUrl: chapterImages.sourceUrl,
        pageNumber: chapterImages.pageNumber,
        mangaId: chapters.mangaId,
      })
      .from(chapterImages)
      .innerJoin(chapters, eq(chapters.id, chapterImages.chapterId))
      .where(
        and(
          eq(chapterImages.chapterId, chapterId),
          isNotNull(chapterImages.sourceUrl),
          sql`${chapterImages.imageUrl} = ${chapterImages.sourceUrl}`,
        ),
      );

    if (!unmirrored.length) return;

    this.logger.log(`Mirror chapter ${chapterId}: ${unmirrored.length} images`);
    let mirrored = 0;
    let failed = 0;

    for (const img of unmirrored) {
      try {
        const buffer = await this.downloadImage(img.sourceUrl!);
        const optimized = await this.optimizeImage(buffer);
        // groupId in key: schema unique is (chapterId, pageNumber, groupId), so
        // two scanlation groups can publish the same page; flatten that into
        // the storage path or the second upload silently overwrites the first.
        const groupSeg = img.groupId ?? 'default';
        const key = `manga/${img.mangaId}/chapters/${chapterId}/${groupSeg}/${img.pageNumber}.webp`;
        await this.uploadToS3(key, optimized);

        const s3Url = `${this.publicUrl}/${key}`;
        await this.db
          .update(chapterImages)
          .set({ imageUrl: s3Url })
          .where(eq(chapterImages.id, img.id));
        mirrored++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `Failed to mirror image ${img.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Mirrored ${mirrored}/${unmirrored.length} for chapter ${chapterId}`,
    );

    // Surface failure so BullMQ retry policy fires for transient errors.
    // Successful images already have imageUrl updated, so retry is idempotent
    // (next run's WHERE imageUrl = sourceUrl filters them out).
    if (failed > 0 && mirrored === 0) {
      throw new Error(
        `All ${failed} images failed for chapter ${chapterId}; triggering retry`,
      );
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    // SSRF defense: HTTPS-only + private-IP block + manual redirect cap.
    const res = await safeHttpsFetch(url, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      userAgent: `${this.config.get<string>('app.name', 'ComicHub')}/1.0`,
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image: ${contentType}`);
    }

    // content-length is advisory; enforce both header guard and stream cap.
    const declared = parseInt(res.headers.get('content-length') ?? '0', 10);
    if (declared > MAX_DOWNLOAD_BYTES) {
      throw new Error(`Image too large: ${declared} bytes`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Download failed: no response body');

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new Error(
          `Image exceeds ${MAX_DOWNLOAD_BYTES} bytes during stream`,
        );
      }
      chunks.push(value);
    }
    return Buffer.concat(
      chunks.map((c) => Buffer.from(c)),
      received,
    );
  }

  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const meta = await image.metadata();
    if (meta.width && meta.width > MAX_WIDTH) {
      return image.resize(MAX_WIDTH).webp({ quality: 85 }).toBuffer();
    }
    return image.webp({ quality: 85 }).toBuffer();
  }

  private async uploadToS3(key: string, buffer: Buffer): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/webp',
      }),
    );
  }
}
