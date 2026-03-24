import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, isNull, and, gt, lt, asc, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  chapters,
  chapterImages,
  manga,
} from '../../../database/schema/index.js';
// slugify import removed — slug generation handled by DB or caller
import { CreateChapterDto } from '../dto/create-chapter.dto.js';
import { UpdateChapterDto } from '../dto/update-chapter.dto.js';
import { NewChapterEvent } from '../../notification/events/new-chapter.event.js';
import type {
  ChapterWithImages,
  ChapterNavigation,
  ChapterListItem,
} from '../types/manga.types.js';

@Injectable()
export class ChapterService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findByManga(mangaId: number): Promise<ChapterListItem[]> {
    return this.db
      .select({
        id: chapters.id,
        number: chapters.number,
        title: chapters.title,
        slug: chapters.slug,
        viewCount: chapters.viewCount,
        order: chapters.order,
        createdAt: chapters.createdAt,
      })
      .from(chapters)
      .where(and(eq(chapters.mangaId, mangaId), isNull(chapters.deletedAt)))
      .orderBy(asc(chapters.order));
  }

  async findOne(id: number): Promise<ChapterWithImages> {
    const [chapter] = await this.db
      .select()
      .from(chapters)
      .where(and(eq(chapters.id, id), isNull(chapters.deletedAt)))
      .limit(1);

    if (!chapter) throw new NotFoundException('Chapter not found');

    const images = await this.db
      .select()
      .from(chapterImages)
      .where(eq(chapterImages.chapterId, id))
      .orderBy(asc(chapterImages.order));

    return { ...chapter, images };
  }

  async getNavigation(id: number): Promise<ChapterNavigation> {
    const [chapter] = await this.db
      .select({
        id: chapters.id,
        mangaId: chapters.mangaId,
        order: chapters.order,
      })
      .from(chapters)
      .where(and(eq(chapters.id, id), isNull(chapters.deletedAt)))
      .limit(1);

    if (!chapter) throw new NotFoundException('Chapter not found');

    const [prevRow] = await this.db
      .select({ id: chapters.id, number: chapters.number, slug: chapters.slug })
      .from(chapters)
      .where(
        and(
          eq(chapters.mangaId, chapter.mangaId),
          isNull(chapters.deletedAt),
          lt(chapters.order, chapter.order),
        ),
      )
      .orderBy(desc(chapters.order))
      .limit(1);

    const [nextRow] = await this.db
      .select({ id: chapters.id, number: chapters.number, slug: chapters.slug })
      .from(chapters)
      .where(
        and(
          eq(chapters.mangaId, chapter.mangaId),
          isNull(chapters.deletedAt),
          gt(chapters.order, chapter.order),
        ),
      )
      .orderBy(asc(chapters.order))
      .limit(1);

    return {
      prev: prevRow ?? null,
      next: nextRow ?? null,
    };
  }

  async create(
    mangaId: number,
    dto: CreateChapterDto,
  ): Promise<ChapterListItem> {
    const [mangaRow] = await this.db
      .select({ id: manga.id, title: manga.title, cover: manga.cover })
      .from(manga)
      .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
      .limit(1);
    if (!mangaRow) throw new NotFoundException('Manga not found');

    const slug = `chapter-${dto.number}`;
    const [existing] = await this.db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.mangaId, mangaId), eq(chapters.slug, slug)))
      .limit(1);
    if (existing)
      throw new ConflictException(`Chapter ${dto.number} already exists`);

    const order = dto.order ?? Math.round(dto.number * 10);

    const [created] = await this.db
      .insert(chapters)
      .values({
        mangaId,
        number: String(dto.number),
        title: dto.title,
        slug,
        order,
      })
      .returning();

    // Update manga chaptersCount and chapterUpdatedAt
    await this.db
      .update(manga)
      .set({
        chaptersCount: this.db.$count(
          chapters,
          and(eq(chapters.mangaId, mangaId), isNull(chapters.deletedAt)),
        ) as unknown as number,
        chapterUpdatedAt: new Date(),
      })
      .where(eq(manga.id, mangaId));

    // Emit event for notifications + cache invalidation
    const event = new NewChapterEvent();
    event.mangaId = mangaId;
    event.mangaTitle = mangaRow.title;
    event.chapterId = created.id;
    event.chapterNumber = dto.number;
    event.mangaCover = mangaRow.cover ?? null;
    this.eventEmitter.emit('chapter.created', event);

    return created as unknown as ChapterListItem;
  }

  async update(id: number, dto: UpdateChapterDto): Promise<ChapterListItem> {
    const existing = await this.findOne(id);

    const updates: Partial<typeof chapters.$inferInsert> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.number !== undefined) {
      updates.number = String(dto.number);
      updates.slug = `chapter-${dto.number}`;
    }
    if (dto.order !== undefined) updates.order = dto.order;

    const [updated] = await this.db
      .update(chapters)
      .set(updates)
      .where(eq(chapters.id, id))
      .returning();

    return { ...existing, ...updated } as unknown as ChapterListItem;
  }

  async remove(id: number): Promise<void> {
    const [chapter] = await this.db
      .select({ id: chapters.id, mangaId: chapters.mangaId })
      .from(chapters)
      .where(and(eq(chapters.id, id), isNull(chapters.deletedAt)))
      .limit(1);
    if (!chapter) throw new NotFoundException('Chapter not found');

    await this.db
      .update(chapters)
      .set({ deletedAt: new Date() })
      .where(eq(chapters.id, id));

    // Update manga chaptersCount after soft-delete
    await this.db
      .update(manga)
      .set({
        chaptersCount: this.db.$count(
          chapters,
          and(eq(chapters.mangaId, chapter.mangaId), isNull(chapters.deletedAt)),
        ) as unknown as number,
      })
      .where(eq(manga.id, chapter.mangaId));
  }
}
