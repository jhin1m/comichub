import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  stickerSets,
  stickers,
} from '../../../database/schema/community.schema.js';
import {
  CreateStickerSetDto,
  UpdateStickerSetDto,
  CreateStickerDto,
} from '../dto/sticker.dto.js';

@Injectable()
export class StickerService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async listSets() {
    return this.db
      .select()
      .from(stickerSets)
      .where(eq(stickerSets.isActive, true))
      .orderBy(stickerSets.createdAt);
  }

  async getSet(setId: number) {
    const [set] = await this.db
      .select()
      .from(stickerSets)
      .where(eq(stickerSets.id, setId))
      .limit(1);

    if (!set) throw new NotFoundException('Sticker set not found');

    const items = await this.db
      .select()
      .from(stickers)
      .where(eq(stickers.stickerSetId, setId))
      .orderBy(stickers.order);

    return { ...set, stickers: items };
  }

  async createSet(dto: CreateStickerSetDto) {
    const [set] = await this.db
      .insert(stickerSets)
      .values({
        name: dto.name,
        isActive: dto.isActive ?? true,
      })
      .returning();

    return set;
  }

  async updateSet(setId: number, dto: UpdateStickerSetDto) {
    const [existing] = await this.db
      .select()
      .from(stickerSets)
      .where(eq(stickerSets.id, setId))
      .limit(1);

    if (!existing) throw new NotFoundException('Sticker set not found');

    const updateData: Partial<typeof stickerSets.$inferInsert> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await this.db
      .update(stickerSets)
      .set(updateData)
      .where(eq(stickerSets.id, setId))
      .returning();

    return updated;
  }

  async removeSet(setId: number) {
    const [existing] = await this.db
      .select()
      .from(stickerSets)
      .where(eq(stickerSets.id, setId))
      .limit(1);

    if (!existing) throw new NotFoundException('Sticker set not found');

    await this.db.delete(stickerSets).where(eq(stickerSets.id, setId));
  }

  async addSticker(setId: number, dto: CreateStickerDto) {
    // Ensure parent set exists
    await this.getSet(setId);

    const [sticker] = await this.db
      .insert(stickers)
      .values({
        stickerSetId: setId,
        name: dto.name,
        imageUrl: dto.imageUrl,
        order: dto.order ?? 0,
      })
      .returning();

    return sticker;
  }

  async removeSticker(stickerId: number) {
    const [existing] = await this.db
      .select()
      .from(stickers)
      .where(eq(stickers.id, stickerId))
      .limit(1);

    if (!existing) throw new NotFoundException('Sticker not found');

    await this.db.delete(stickers).where(eq(stickers.id, stickerId));
  }
}
