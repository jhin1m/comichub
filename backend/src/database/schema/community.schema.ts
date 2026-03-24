import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema.js';
import { manga, chapters } from './manga.schema.js';

// Enums
export const reportTypeEnum = pgEnum('report_type', [
  'broken_images',
  'wrong_chapter',
  'duplicate',
  'inappropriate',
  'spam',
  'other',
]);
export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'resolved',
  'rejected',
]);

// comments — polymorphic (commentable_type: manga|chapter), supports nesting
export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    commentableType: varchar('commentable_type', { length: 50 }).notNull(),
    commentableId: integer('commentable_id').notNull(),
    // No DB-level FK for self-reference (causes TS circular inference); enforced by app layer
    parentId: integer('parent_id'),
    content: text('content').notNull(),
    likesCount: integer('likes_count').default(0).notNull(),
    dislikesCount: integer('dislikes_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('comments_commentable_idx').on(
      table.commentableType,
      table.commentableId,
    ),
    index('comments_parent_idx').on(table.parentId),
    index('comments_user_idx').on(table.userId),
  ],
);

// comment_likes — deduplicated per user
export const commentLikes = pgTable(
  'comment_likes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    isDislike: boolean('is_dislike').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('comment_likes_unique_idx').on(table.userId, table.commentId),
  ],
);

// ratings — user rates manga 0.5–5.0 (decimal 2,1)
export const ratings = pgTable(
  'ratings',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    score: numeric('score', { precision: 2, scale: 1 }).notNull(),
  },
  (table) => [
    uniqueIndex('ratings_user_manga_idx').on(table.userId, table.mangaId),
    index('ratings_manga_idx').on(table.mangaId),
  ],
);

// follows — user follows manga
export const follows = pgTable(
  'follows',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('follows_user_manga_idx').on(table.userId, table.mangaId),
  ],
);

// reading_history — last chapter read per manga per user
export const readingHistory = pgTable(
  'reading_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mangaId: integer('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    chapterId: integer('chapter_id').references(() => chapters.id, {
      onDelete: 'set null',
    }),
    lastReadAt: timestamp('last_read_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reading_history_user_manga_idx').on(
      table.userId,
      table.mangaId,
    ),
    index('reading_history_user_last_read_idx').on(
      table.userId,
      table.lastReadAt,
    ),
  ],
);

// chapter_reports — user reports broken/wrong chapters
export const chapterReports = pgTable('chapter_reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  chapterId: integer('chapter_id')
    .notNull()
    .references(() => chapters.id, { onDelete: 'cascade' }),
  type: reportTypeEnum('type').notNull(),
  description: text('description'),
  status: reportStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

// sticker_sets + stickers — reaction stickers grouped in sets
export const stickerSets = pgTable('sticker_sets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const stickers = pgTable('stickers', {
  id: serial('id').primaryKey(),
  stickerSetId: integer('sticker_set_id')
    .notNull()
    .references(() => stickerSets.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type ReadingHistory = typeof readingHistory.$inferSelect;
