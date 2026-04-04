import {
  pgTable,
  pgEnum,
  serial,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

// users — core auth + profile counters
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  avatar: varchar('avatar', { length: 500 }),
  bannedUntil: timestamp('banned_until'),
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  googleId: varchar('google_id', { length: 255 }).unique(),
  role: userRoleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
  deletedAt: timestamp('deleted_at'),
});

// user_profiles — extended bio/social links
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  bio: text('bio'),
  website: varchar('website', { length: 500 }),
  twitter: varchar('twitter', { length: 255 }),
  discord: varchar('discord', { length: 255 }),
});

export const userContentPreferences = pgTable('user_content_preferences', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  hideNsfw: boolean('hide_nsfw').default(true).notNull(),
  excludedTypes: jsonb('excluded_types')
    .$type<string[]>()
    .default([])
    .notNull(),
  excludedDemographics: jsonb('excluded_demographics')
    .$type<string[]>()
    .default([])
    .notNull(),
  excludedGenreSlugs: jsonb('excluded_genre_slugs')
    .$type<string[]>()
    .default([])
    .notNull(),
  highlightedGenreSlugs: jsonb('highlighted_genre_slugs')
    .$type<string[]>()
    .default([])
    .notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// refresh_tokens — DB fallback when Redis is unavailable
export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type UserContentPreferences = typeof userContentPreferences.$inferSelect;
export type NewUserContentPreferences =
  typeof userContentPreferences.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
