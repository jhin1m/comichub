import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  genres,
  artists,
  authors,
  groups,
} from '../../../database/schema/index.js';
import { slugify } from '../../../common/utils/slug.util.js';
import { escapeLike } from '../../../common/utils/escape-like.util.js';
import { MemoryCache } from '../../../common/utils/memory-cache.util.js';
import { CreateTaxonomyDto } from '../dto/taxonomy.dto.js';
import type { TaxonomyItem } from '../types/manga.types.js';

type TaxonomyTable =
  | typeof genres
  | typeof artists
  | typeof authors
  | typeof groups;

@Injectable()
export class TaxonomyService {
  private cache = new MemoryCache<unknown>(600_000, 100); // 10 min TTL, 100 max

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private getTable(type: string): TaxonomyTable {
    switch (type) {
      case 'genres':
        return genres;
      case 'artists':
        return artists;
      case 'authors':
        return authors;
      case 'groups':
        return groups;
      default:
        throw new NotFoundException(`Unknown taxonomy type: ${type}`);
    }
  }

  async findAll(type: string): Promise<TaxonomyItem[]> {
    const cacheKey = `all:${type}`;
    const cached = this.cache.get<TaxonomyItem[]>(cacheKey);
    if (cached) return cached;

    const table = this.getTable(type);
    const result = (await this.db
      .select()
      .from(table)
      .orderBy(table.name)) as TaxonomyItem[];
    this.cache.set(cacheKey, result);
    return result;
  }

  async search(type: string, query: string): Promise<TaxonomyItem[]> {
    const table = this.getTable(type);
    return this.db
      .select()
      .from(table)
      .where(ilike(table.name, `%${escapeLike(query)}%`))
      .orderBy(table.name)
      .limit(20) as Promise<TaxonomyItem[]>;
  }

  async findBySlug(type: string, slug: string): Promise<TaxonomyItem> {
    const cacheKey = `slug:${type}:${slug}`;
    const cached = this.cache.get<TaxonomyItem>(cacheKey);
    if (cached) return cached;

    const table = this.getTable(type);
    const [item] = await this.db
      .select()
      .from(table)
      .where(eq(table.slug, slug))
      .limit(1);
    if (!item) throw new NotFoundException(`${type} not found`);
    this.cache.set(cacheKey, item);
    return item as TaxonomyItem;
  }

  async findById(type: string, id: number): Promise<TaxonomyItem> {
    const cacheKey = `id:${type}:${id}`;
    const cached = this.cache.get<TaxonomyItem>(cacheKey);
    if (cached) return cached;

    const table = this.getTable(type);
    const [item] = await this.db
      .select()
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    if (!item) throw new NotFoundException(`${type} not found`);
    this.cache.set(cacheKey, item);
    return item as TaxonomyItem;
  }

  async create(type: string, dto: CreateTaxonomyDto): Promise<TaxonomyItem> {
    const table = this.getTable(type);
    const slug = slugify(dto.name);

    const [existing] = await this.db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, slug))
      .limit(1);
    if (existing)
      throw new ConflictException(`${type} with this name already exists`);

    const [created] = await this.db
      .insert(table)
      .values({ name: dto.name, slug })
      .returning();
    this.cache.invalidateBySubstring(`:${type}`);
    return created as TaxonomyItem;
  }

  async update(
    type: string,
    id: number,
    dto: CreateTaxonomyDto,
  ): Promise<TaxonomyItem> {
    const table = this.getTable(type);
    await this.findById(type, id);

    const slug = slugify(dto.name);
    const [updated] = await this.db
      .update(table)
      .set({ name: dto.name, slug })
      .where(eq(table.id, id))
      .returning();
    this.cache.invalidateBySubstring(`:${type}`);
    return updated as TaxonomyItem;
  }

  async remove(type: string, id: number): Promise<void> {
    const table = this.getTable(type);
    await this.findById(type, id);
    await this.db.delete(table).where(eq(table.id, id));
    this.cache.invalidateBySubstring(`:${type}`);
  }
}
