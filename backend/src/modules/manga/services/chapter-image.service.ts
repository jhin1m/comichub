import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { chapterImages, chapters } from '../../../database/schema/index.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 1200;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ChapterImageService {
  private s3: S3Client;
  private bucket: string;
  private region: string;

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

  async uploadImages(
    chapterId: number,
    mangaId: number,
    files: Express.Multer.File[],
  ): Promise<{ imageUrl: string; pageNumber: number }[]> {
    if (!files.length) throw new BadRequestException('No files provided');

    const [chapter] = await this.db
      .select({ id: chapters.id })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);
    if (!chapter) throw new NotFoundException('Chapter not found');

    const uploaded: { imageUrl: string; pageNumber: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.validateFile(file);

      const processed = await this.processImage(file.buffer);
      const ext = this.getExtension(file.mimetype);
      const pageNumber = i + 1;
      const key = `manga/${mangaId}/chapters/${chapterId}/${pageNumber}.${ext}`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: processed,
          ContentType: file.mimetype,
        }),
      );

      const imageUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
      uploaded.push({ imageUrl, pageNumber });
    }

    // Persist records (replace existing for same chapter)
    await this.db.delete(chapterImages).where(eq(chapterImages.chapterId, chapterId));

    const records = uploaded.map((img, idx) => ({
      chapterId,
      imageUrl: img.imageUrl,
      pageNumber: img.pageNumber,
      order: idx + 1,
    }));

    await this.db.insert(chapterImages).values(records);
    return uploaded;
  }

  async clearImages(chapterId: number, mangaId: number): Promise<void> {
    const images = await this.db
      .select()
      .from(chapterImages)
      .where(eq(chapterImages.chapterId, chapterId));

    if (images.length) {
      const objects = images.map((img) => ({
        Key: this.extractS3Key(img.imageUrl, mangaId, chapterId),
      }));

      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: objects },
        }),
      );

      await this.db.delete(chapterImages).where(eq(chapterImages.chapterId, chapterId));
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: jpg, png, webp`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File ${file.originalname} exceeds 5MB limit`);
    }
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const meta = await image.metadata();
    if (meta.width && meta.width > MAX_WIDTH) {
      return image.resize(MAX_WIDTH).toBuffer();
    }
    return buffer;
  }

  private getExtension(mimetype: string): string {
    switch (mimetype) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      default: return 'jpg';
    }
  }

  private extractS3Key(imageUrl: string, mangaId: number, chapterId: number): string {
    // Extract key from URL: https://bucket.s3.region.amazonaws.com/KEY
    const url = new URL(imageUrl);
    return url.pathname.slice(1); // remove leading /
  }
}
