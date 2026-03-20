import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema.js';

// P2 feature — schema defined now, implemented later
export const petRarityEnum = pgEnum('pet_rarity', ['common', 'rare', 'epic', 'legendary']);

// achievements — unlockable via criteria stored as JSON rules
export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  criteria: jsonb('criteria').notNull(),
  xpReward: integer('xp_reward').default(0).notNull(),
  icon: varchar('icon', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userAchievements = pgTable('user_achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: integer('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_achievements_unique_idx').on(table.userId, table.achievementId),
]);

// pets — collectible companions with rarity tiers
export const pets = pgTable('pets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  imageUrl: varchar('image_url', { length: 500 }),
  price: integer('price').default(0).notNull(),
  rarity: petRarityEnum('rarity').default('common').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userPets = pgTable('user_pets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  petId: integer('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }),
  acquiredAt: timestamp('acquired_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_pets_unique_idx').on(table.userId, table.petId),
]);

// reading_streaks — daily reading streak tracking per user
export const readingStreaks = pgTable('reading_streaks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastReadAt: timestamp('last_read_at'),
});

export type Achievement = typeof achievements.$inferSelect;
export type Pet = typeof pets.$inferSelect;
export type ReadingStreak = typeof readingStreaks.$inferSelect;
