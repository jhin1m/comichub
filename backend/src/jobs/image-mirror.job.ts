import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.provider.js';
import type { DrizzleDB } from '../database/drizzle.provider.js';
import { chapterImages, chapters } from '../database/schema/index.js';
import { safeHttpsFetch } from '../common/utils/safe-http.util.js';

const BATCH_SIZE = 50;
const CHAPTER_DELAY_MS = 2000;
const MAX_WIDTH = 1200;
const DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

@Injectable()
export class ImageMirrorJob {
  private readonly logger = new Logger(ImageMirrorJob.name);
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;
  private running = false;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private config: ConfigService,
  ) {
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

  @Cron('*/10 * * * *')
  async mirrorImages(): Promise<void> {
    if (this.config.get<string>('IMAGE_MIRROR_JOB_ENABLED', 'false') !== 'true')
      return;
    if (this.running) {
      this.logger.debug('Mirror job already running, skipping');
      return;
    }
    this.running = true;
    try {
      const unmirrored = await this.db
        .select({
          id: chapterImages.id,
          chapterId: chapterImages.chapterId,
          sourceUrl: chapterImages.sourceUrl,
          pageNumber: chapterImages.pageNumber,
          mangaId: chapters.mangaId,
        })
        .from(chapterImages)
        .innerJoin(chapters, eq(chapters.id, chapterImages.chapterId))
        .where(
          and(
            isNotNull(chapterImages.sourceUrl),
            sql`${chapterImages.imageUrl} = ${chapterImages.sourceUrl}`,
          ),
        )
        .limit(BATCH_SIZE);

      if (!unmirrored.length) return;

      this.logger.log(`Mirroring ${unmirrored.length} images`);
      let mirrored = 0;

      const byChapter = unmirrored.reduce<Map<number, typeof unmirrored>>(
        (map, img) => {
          const group = map.get(img.chapterId) ?? [];
          group.push(img);
          map.set(img.chapterId, group);
          return map;
        },
        new Map(),
      );

      let isFirst = true;
      for (const [chapterId, images] of byChapter) {
        if (!isFirst) {
          await new Promise((r) => setTimeout(r, CHAPTER_DELAY_MS));
        }
        isFirst = false;

        for (const img of images) {
          try {
            const buffer = await this.downloadImage(img.sourceUrl!);
            const optimized = await this.optimizeImage(buffer);
            const key = `manga/${img.mangaId}/chapters/${chapterId}/${img.pageNumber}.webp`;
            await this.uploadToS3(key, optimized);

            const s3Url = `${this.publicUrl}/${key}`;
            await this.db
              .update(chapterImages)
              .set({ imageUrl: s3Url })
              .where(eq(chapterImages.id, img.id));
            mirrored++;
          } catch (err) {
            this.logger.warn(
              `Failed to mirror image ${img.id}: ${(err as Error).message}`,
            );
          }
        }
      }

      this.logger.log(`Mirrored ${mirrored}/${unmirrored.length} images`);
    } catch (err) {
      this.logger.error('Mirror job failed', err);
    } finally {
      this.running = false;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    // SSRF defense (H11): HTTPS-only + private-IP block + manual redirect cap,
    // applied at every hop by safeHttpsFetch. See common/utils/safe-http.util.ts.
    const res = await safeHttpsFetch(url, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      userAgent: `${this.config.get<string>('app.name', 'ComicHub')}/1.0`,
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image: ${contentType}`);
    }

    // C-C2: enforce size during streaming. content-length header is advisory and
    // may be absent (chunked) or spoofed — a malicious origin could omit it and
    // stream multi-GB. Reject header-declared oversize early, and abort mid-stream
    // if accumulated bytes exceed the cap.
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
