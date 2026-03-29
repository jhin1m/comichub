import {
  pgTable,
  pgEnum,
  serial,
  integer,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema.js';

// Enums
export const mangaStatusEnum = pgEnum('manga_status', [
  'ongoing',
  'completed',
  'hiatus',
  'dropped',
  'cancelled',
]);
export const mangaTypeEnum = pgEnum('manga_type', [
  'manga',
  'manhwa',
  'manhua',
  'doujinshi',
]);
export const importSourceEnum = pgEnum('import_source', [
  'mangabaka',
  'comick',
  'weebdex',
]);
export const contentRatingEnum = pgEnum('content_rating', [
  'safe',
  'suggestive',
  'erotica',
  'pornographic',
]);

// Lookup tables — genres, artists, authors, translation groups
export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  group: varchar('group', { length: 20 }).default('genre').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const artists = pgTable('artists', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 280 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const authors = pgTable('authors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 280 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 280 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// manga — main content table with denormalized counters
// Note: lastChapterId has no DB FK (circular dependency with chapters);
//       maintained by application layer to avoid constraint cycle.
export const manga = pgTable(
  'manga',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 500 }).notNull(),
    altTitles: jsonb('alt_titles').$type<string[]>().default([]).notNull(),
    slug: varchar('slug', { length: 520 }).notNull().unique(),
    description: text('description'),
    cover: varchar('cover', { length: 500 }),
    originalLanguage: varchar('original_language', { length: 10 }),
    status: mangaStatusEnum('status').default('ongoing').notNull(),
    type: mangaTypeEnum('type').default('manga').notNull(),
    contentRating: contentRatingEnum('content_rating')
      .default('safe')
      .notNull(),
    nativeTitle: varchar('native_title', { length: 500 }),
    romanizedTitle: varchar('romanized_title', { length: 500 }),
    views: bigint('views', { mode: 'number' }).default(0).notNull(),
    viewsDay: integer('views_day').default(0).notNull(),
    viewsWeek: integer('views_week').default(0).notNull(),
    followersCount: integer('followers_count').default(0).notNull(),
    chaptersCount: integer('chapters_count').default(0).notNull(),
    averageRating: numeric('average_rating', { precision: 3, scale: 1 })
      .default('0.0')
      .notNull(),
    totalRatings: integer('total_ratings').default(0).notNull(),
    isHot: boolean('is_hot').default(false).notNull(),
    isNsfw: boolean('is_nsfw').default(false).notNull(),
    demographic: varchar('demographic', { length: 20 }),
    isReviewed: boolean('is_reviewed').default(false).notNull(),
    year: integer('year'),
    lastChapterId: integer('last_chapter_id'), // app-managed, no FK (circular)
    chapterUpdatedAt: timestamp('chapter_updated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('manga_status_type_idx').on(table.status, table.type),
    index('manga_created_at_idx').on(table.createdAt),
    index('manga_views_idx').on(table.views),
  ],
);

// Pivot tables — many-to-many joins
export const mangaGenres = pgTable(
  'manga_genres',
  {
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    genreId: integer('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('manga_genres_unique_idx').on(table.mangaId, table.genreId),
  ],
);

export const mangaArtists = pgTable(
  'manga_artists',
  {
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    artistId: integer('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('manga_artists_unique_idx').on(table.mangaId, table.artistId),
  ],
);

export const mangaAuthors = pgTable(
  'manga_authors',
  {
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('manga_authors_unique_idx').on(table.mangaId, table.authorId),
  ],
);

export const mangaGroups = pgTable(
  'manga_groups',
  {
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('manga_groups_unique_idx').on(table.mangaId, table.groupId),
  ],
);

// chapter_groups — many-to-many: chapters ↔ scanlation groups
export const chapterGroups = pgTable(
  'chapter_groups',
  {
    chapterId: integer('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('chapter_groups_unique_idx').on(table.chapterId, table.groupId),
    index('chapter_groups_group_id_idx').on(table.groupId),
  ],
);

// chapters — ordered list per manga
export const chapters = pgTable(
  'chapters',
  {
    id: serial('id').primaryKey(),
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    number: numeric('number', { precision: 6, scale: 1 }).notNull(),
    title: varchar('title', { length: 500 }),
    slug: varchar('slug', { length: 520 }).notNull(),
    language: varchar('language', { length: 10 }).default('vi').notNull(),
    volume: varchar('volume', { length: 20 }),
    publishedAt: timestamp('published_at'),
    viewCount: bigint('view_count', { mode: 'number' }).default(0).notNull(),
    order: integer('order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    uniqueIndex('chapters_manga_number_lang_idx').on(
      table.mangaId,
      table.number,
      table.language,
    ),
    uniqueIndex('chapters_manga_slug_idx').on(table.mangaId, table.slug),
    index('chapters_manga_order_idx').on(table.mangaId, table.order),
  ],
);

// chapter_images — individual pages stored in S3
export const chapterImages = pgTable(
  'chapter_images',
  {
    id: serial('id').primaryKey(),
    chapterId: integer('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    imageUrl: varchar('image_url', { length: 1000 }).notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }),
    pageNumber: integer('page_number').notNull(),
    order: integer('order').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('chapter_images_chapter_page_idx').on(
      table.chapterId,
      table.pageNumber,
    ),
    index('chapter_images_chapter_order_idx').on(table.chapterId, table.order),
  ],
);

// manga_sources — tracks external source mapping for manga
export const mangaSources = pgTable(
  'manga_sources',
  {
    id: serial('id').primaryKey(),
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    source: importSourceEnum('source').notNull(),
    externalId: varchar('external_id', { length: 100 }).notNull(),
    externalSlug: varchar('external_slug', { length: 300 }),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('manga_sources_source_ext_id_idx').on(
      table.source,
      table.externalId,
    ),
    index('manga_sources_manga_id_idx').on(table.mangaId),
  ],
);

// chapter_sources — tracks external source mapping for chapters
export const chapterSources = pgTable(
  'chapter_sources',
  {
    id: serial('id').primaryKey(),
    chapterId: integer('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    source: importSourceEnum('source').notNull(),
    externalId: varchar('external_id', { length: 100 }).notNull(),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('chapter_sources_source_ext_id_idx').on(
      table.source,
      table.externalId,
    ),
    index('chapter_sources_chapter_id_idx').on(table.chapterId),
  ],
);

// manga_links — external links (MAL, AniList, etc.)
export const mangaLinks = pgTable(
  'manga_links',
  {
    id: serial('id').primaryKey(),
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 30 }).notNull(), // 'mal', 'anilist', 'kitsu', 'amazon', etc.
    externalId: varchar('external_id', { length: 100 }),
    url: varchar('url', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('manga_links_manga_type_idx').on(table.mangaId, table.type),
  ],
);

export type Manga = typeof manga.$inferSelect;
export type NewManga = typeof manga.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type MangaSource = typeof mangaSources.$inferSelect;
export type NewMangaSource = typeof mangaSources.$inferInsert;
export type ChapterSource = typeof chapterSources.$inferSelect;
export type MangaLink = typeof mangaLinks.$inferSelect;
