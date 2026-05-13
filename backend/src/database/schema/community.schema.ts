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
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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

// Comment moderation status — drives visibility filter
export const moderationStatusEnum = pgEnum('moderation_status', [
  'pending',
  'approved',
  'flagged',
  'rejected',
]);

// Comment report reasons
export const commentReportReasonEnum = pgEnum('comment_report_reason', [
  'spam',
  'harassment',
  'hate_speech',
  'sexual_content',
  'spoiler',
  'misinformation',
  'other',
]);

// Comment report lifecycle — separate from existing `report_status` to allow `dismissed`
export const commentReportStatusEnum = pgEnum('comment_report_status', [
  'pending',
  'resolved',
  'dismissed',
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
    // Pin: max 3 per (commentableType, commentableId), FIFO. pinnedBy=admin user.
    isPinned: boolean('is_pinned').default(false).notNull(),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    pinnedBy: integer('pinned_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Edited indicator: distinct from updatedAt (which fires on every mutation incl. like/dislike).
    editedAt: timestamp('edited_at', { withTimezone: true }),
    // Mention IDs: parsed from sanitized HTML server-side, validated against users table.
    mentionedUserIds: integer('mentioned_user_ids')
      .array()
      .default(sql`'{}'::int[]`)
      .notNull(),
    // Moderation: defaults to 'approved' so legacy + no-API-key paths auto-pass.
    moderationStatus: moderationStatusEnum('moderation_status')
      .default('approved')
      .notNull(),
    moderationScore: jsonb('moderation_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('comments_commentable_idx').on(
      table.commentableType,
      table.commentableId,
    ),
    index('comments_parent_idx').on(table.parentId),
    index('comments_user_idx').on(table.userId),
    // Pin-first sort: filter by commentable scope, fast lookup of pinned set.
    index('comments_pinned_idx').on(
      table.commentableType,
      table.commentableId,
      table.isPinned,
    ),
    index('comments_moderation_idx').on(table.moderationStatus),
    // GIN for array contains query: "comments where I am mentioned".
    // Concurrent index created in separate no-transaction migration (see 0023).
    index('comments_mentioned_users_idx').using('gin', table.mentionedUserIds),
  ],
);

// comment_revisions — public edit history, cap 10/comment with prune-oldest on insert.
export const commentRevisions = pgTable(
  'comment_revisions',
  {
    id: serial('id').primaryKey(),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }).defaultNow().notNull(),
    // Editor preserved as SET NULL on user delete — anonymize, keep revision content.
    editorId: integer('editor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('comment_revisions_comment_idx').on(table.commentId, table.editedAt),
  ],
);

// comment_reports — user-submitted abuse reports, unique per (comment, reporter).
export const commentReports = pgTable(
  'comment_reports',
  {
    id: serial('id').primaryKey(),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    reporterId: integer('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: commentReportReasonEnum('reason').notNull(),
    details: text('details'),
    status: commentReportStatusEnum('status').default('pending').notNull(),
    resolvedBy: integer('resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Prevent spam: one report per (comment, reporter) regardless of status.
    uniqueIndex('comment_reports_unique_idx').on(
      table.commentId,
      table.reporterId,
    ),
    index('comment_reports_status_idx').on(table.status, table.createdAt),
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

// bookmark_folders — user-owned folders for organizing followed manga
export const bookmarkFolders = pgTable(
  'bookmark_folders',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull(),
    order: integer('order').default(0).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('bookmark_folders_user_slug_idx').on(table.userId, table.slug),
    index('bookmark_folders_user_idx').on(table.userId),
  ],
);

export const DEFAULT_BOOKMARK_FOLDERS = [
  { name: 'Reading', slug: 'reading', order: 0 },
  { name: 'Completed', slug: 'completed', order: 1 },
  { name: 'On-Hold', slug: 'on-hold', order: 2 },
  { name: 'Plan to Read', slug: 'plan-to-read', order: 3 },
  { name: 'Dropped', slug: 'dropped', order: 4 },
] as const;

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
    folderId: integer('folder_id').references(() => bookmarkFolders.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('follows_user_manga_idx').on(table.userId, table.mangaId),
    index('follows_folder_idx').on(table.folderId),
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
export const chapterReports = pgTable(
  'chapter_reports',
  {
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
  },
  (table) => [
    // C3 dedupe — only one pending report per (user, chapter, type).
    uniqueIndex('report_unique_pending_idx')
      .on(table.userId, table.chapterId, table.type)
      .where(sql`status = 'pending'`),
  ],
);

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
export type CommentRevision = typeof commentRevisions.$inferSelect;
export type NewCommentRevision = typeof commentRevisions.$inferInsert;
export type CommentReport = typeof commentReports.$inferSelect;
export type NewCommentReport = typeof commentReports.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
export type BookmarkFolder = typeof bookmarkFolders.$inferSelect;
export type NewBookmarkFolder = typeof bookmarkFolders.$inferInsert;
export type ReadingHistory = typeof readingHistory.$inferSelect;
