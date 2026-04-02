import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.provider.js';
import type { DrizzleDB } from '../database/drizzle.provider.js';
import { chapterImages, chapters } from '../database/schema/index.js';

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
  private region: string;
  private running = false;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private config: ConfigService,
  ) {
    this.region = this.config.getOrThrow<string>('s3.region');
    this.bucket = this.config.getOrThrow<string>('s3.bucket');
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('s3.accessKeyId'),
        secretAccessKey: this.config.getOrThrow<string>('s3.secretAccessKey'),
      },
    });
  }

  @Cron('*/10 * * * *')
  async mirrorImages(): Promise<void> {
    if (this.config.get<string>('IMAGE_MIRROR_JOB_ENABLED', 'false') !== 'true') return;
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

            const s3Url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
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
    // SSRF protection: only allow HTTPS from known image hosts
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error(`Blocked non-HTTPS URL: ${url}`);
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: { 'User-Agent': 'ComicHub/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
    if (contentLength > MAX_DOWNLOAD_BYTES) {
      throw new Error(`Image too large: ${contentLength} bytes`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image: ${contentType}`);
    }
    return Buffer.from(await res.arrayBuffer());
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
