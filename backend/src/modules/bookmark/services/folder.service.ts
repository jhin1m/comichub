import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, count, max } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  bookmarkFolders,
  follows,
  DEFAULT_BOOKMARK_FOLDERS,
} from '../../../database/schema/community.schema.js';
import { slugify } from '../../../common/utils/slug.util.js';
import type { CreateFolderDto } from '../dto/create-folder.dto.js';
import type { UpdateFolderDto } from '../dto/update-folder.dto.js';

@Injectable()
export class FolderService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async ensureDefaultFolders(userId: number): Promise<void> {
    const existing = await this.db
      .select({ id: bookmarkFolders.id })
      .from(bookmarkFolders)
      .where(
        and(
          eq(bookmarkFolders.userId, userId),
          eq(bookmarkFolders.isDefault, true),
        ),
      )
      .limit(1);

    if (existing.length > 0) return;

    await this.db
      .insert(bookmarkFolders)
      .values(
        DEFAULT_BOOKMARK_FOLDERS.map((f) => ({
          userId,
          name: f.name,
          slug: f.slug,
          order: f.order,
          isDefault: true,
        })),
      )
      .onConflictDoNothing();
  }

  async getUserFolders(userId: number) {
    await this.ensureDefaultFolders(userId);

    const rows = await this.db
      .select({
        id: bookmarkFolders.id,
        name: bookmarkFolders.name,
        slug: bookmarkFolders.slug,
        order: bookmarkFolders.order,
        isDefault: bookmarkFolders.isDefault,
        createdAt: bookmarkFolders.createdAt,
        count: count(follows.id),
      })
      .from(bookmarkFolders)
      .leftJoin(follows, eq(follows.folderId, bookmarkFolders.id))
      .where(eq(bookmarkFolders.userId, userId))
      .groupBy(bookmarkFolders.id)
      .orderBy(bookmarkFolders.order, bookmarkFolders.id);

    return rows;
  }

  async createFolder(userId: number, dto: CreateFolderDto) {
    const existing = await this.db
      .select({ id: bookmarkFolders.id })
      .from(bookmarkFolders)
      .where(
        and(
          eq(bookmarkFolders.userId, userId),
          eq(bookmarkFolders.isDefault, false),
        ),
      );

    if (existing.length >= 20) {
      throw new BadRequestException('Maximum 20 custom folders allowed');
    }

    const slug = slugify(dto.name);

    const [maxRow] = await this.db
      .select({ maxOrder: max(bookmarkFolders.order) })
      .from(bookmarkFolders)
      .where(eq(bookmarkFolders.userId, userId));

    const order = (maxRow?.maxOrder ?? -1) + 1;

    try {
      const [folder] = await this.db
        .insert(bookmarkFolders)
        .values({ userId, name: dto.name, slug, order, isDefault: false })
        .returning();

      return folder;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('A folder with this name already exists');
      }
      throw err;
    }
  }

  async updateFolder(userId: number, folderId: number, dto: UpdateFolderDto) {
    const folder = await this.assertOwnsNonDefault(userId, folderId);

    const updates: Partial<typeof bookmarkFolders.$inferInsert> = {};

    if (dto.name !== undefined) {
      updates.name = dto.name;
      updates.slug = slugify(dto.name);
    }
    if (dto.order !== undefined) {
      updates.order = dto.order;
    }

    if (Object.keys(updates).length === 0) return folder;

    const [updated] = await this.db
      .update(bookmarkFolders)
      .set(updates)
      .where(eq(bookmarkFolders.id, folderId))
      .returning();

    return updated;
  }

  async deleteFolder(userId: number, folderId: number): Promise<void> {
    await this.assertOwnsNonDefault(userId, folderId);

    const readingFolder = await this.getReadingFolder(userId);

    await this.db.transaction(async (tx) => {
      if (readingFolder) {
        await tx
          .update(follows)
          .set({ folderId: readingFolder.id })
          .where(eq(follows.folderId, folderId));
      } else {
        await tx
          .update(follows)
          .set({ folderId: null })
          .where(eq(follows.folderId, folderId));
      }

      await tx.delete(bookmarkFolders).where(eq(bookmarkFolders.id, folderId));
    });
  }

  async getReadingFolder(userId: number) {
    const [folder] = await this.db
      .select()
      .from(bookmarkFolders)
      .where(
        and(
          eq(bookmarkFolders.userId, userId),
          eq(bookmarkFolders.slug, 'reading'),
        ),
      )
      .limit(1);

    if (!folder) {
      await this.ensureDefaultFolders(userId);
      const [created] = await this.db
        .select()
        .from(bookmarkFolders)
        .where(
          and(
            eq(bookmarkFolders.userId, userId),
            eq(bookmarkFolders.slug, 'reading'),
          ),
        )
        .limit(1);
      return created ?? null;
    }

    return folder;
  }

  async assertFolderBelongsToUser(userId: number, folderId: number) {
    const [folder] = await this.db
      .select()
      .from(bookmarkFolders)
      .where(
        and(
          eq(bookmarkFolders.id, folderId),
          eq(bookmarkFolders.userId, userId),
        ),
      )
      .limit(1);

    if (!folder) throw new NotFoundException('Folder not found');
    return folder;
  }

  private async assertOwnsNonDefault(userId: number, folderId: number) {
    const folder = await this.assertFolderBelongsToUser(userId, folderId);
    if (folder.isDefault) {
      throw new ForbiddenException('Cannot modify default folders');
    }
    return folder;
  }
}
