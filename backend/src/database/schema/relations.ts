import { relations } from 'drizzle-orm';
import { users, userProfiles } from './user.schema.js';
import {
  manga,
  genres,
  artists,
  authors,
  groups,
  mangaGenres,
  mangaArtists,
  mangaAuthors,
  mangaGroups,
  chapters,
  chapterImages,
} from './manga.schema.js';
import {
  comments,
  commentLikes,
  ratings,
  follows,
  readingHistory,
  chapterReports,
  stickers,
  stickerSets,
} from './community.schema.js';
import {
  achievements,
  userAchievements,
  pets,
  userPets,
  readingStreaks,
} from './gamification.schema.js';

// ── User relations ──────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  manga: many(manga),
  comments: many(comments),
  commentLikes: many(commentLikes),
  ratings: many(ratings),
  follows: many(follows),
  readingHistory: many(readingHistory),
  chapterReports: many(chapterReports),
  achievements: many(userAchievements),
  pets: many(userPets),
  readingStreak: one(readingStreaks, {
    fields: [users.id],
    references: [readingStreaks.userId],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

// ── Manga relations ─────────────────────────────────────────────
export const mangaRelations = relations(manga, ({ one, many }) => ({
  uploader: one(users, { fields: [manga.userId], references: [users.id] }),
  genres: many(mangaGenres),
  artists: many(mangaArtists),
  authors: many(mangaAuthors),
  groups: many(mangaGroups),
  chapters: many(chapters),
  ratings: many(ratings),
  follows: many(follows),
  readingHistory: many(readingHistory),
}));

export const genresRelations = relations(genres, ({ many }) => ({
  manga: many(mangaGenres),
}));

export const artistsRelations = relations(artists, ({ many }) => ({
  manga: many(mangaArtists),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  manga: many(mangaAuthors),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  manga: many(mangaGroups),
}));

// Pivot relation bridges
export const mangaGenresRelations = relations(mangaGenres, ({ one }) => ({
  manga: one(manga, { fields: [mangaGenres.mangaId], references: [manga.id] }),
  genre: one(genres, {
    fields: [mangaGenres.genreId],
    references: [genres.id],
  }),
}));

export const mangaArtistsRelations = relations(mangaArtists, ({ one }) => ({
  manga: one(manga, { fields: [mangaArtists.mangaId], references: [manga.id] }),
  artist: one(artists, {
    fields: [mangaArtists.artistId],
    references: [artists.id],
  }),
}));

export const mangaAuthorsRelations = relations(mangaAuthors, ({ one }) => ({
  manga: one(manga, { fields: [mangaAuthors.mangaId], references: [manga.id] }),
  author: one(authors, {
    fields: [mangaAuthors.authorId],
    references: [authors.id],
  }),
}));

export const mangaGroupsRelations = relations(mangaGroups, ({ one }) => ({
  manga: one(manga, { fields: [mangaGroups.mangaId], references: [manga.id] }),
  group: one(groups, {
    fields: [mangaGroups.groupId],
    references: [groups.id],
  }),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  manga: one(manga, { fields: [chapters.mangaId], references: [manga.id] }),
  images: many(chapterImages),
  reports: many(chapterReports),
  readingHistory: many(readingHistory),
}));

export const chapterImagesRelations = relations(chapterImages, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterImages.chapterId],
    references: [chapters.id],
  }),
}));

// ── Community relations ─────────────────────────────────────────
export const commentsRelations = relations(comments, ({ one, many }) => ({
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  likes: many(commentLikes),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  user: one(users, { fields: [commentLikes.userId], references: [users.id] }),
  comment: one(comments, {
    fields: [commentLikes.commentId],
    references: [comments.id],
  }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(users, { fields: [ratings.userId], references: [users.id] }),
  manga: one(manga, { fields: [ratings.mangaId], references: [manga.id] }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  user: one(users, { fields: [follows.userId], references: [users.id] }),
  manga: one(manga, { fields: [follows.mangaId], references: [manga.id] }),
}));

export const readingHistoryRelations = relations(readingHistory, ({ one }) => ({
  user: one(users, { fields: [readingHistory.userId], references: [users.id] }),
  manga: one(manga, {
    fields: [readingHistory.mangaId],
    references: [manga.id],
  }),
  chapter: one(chapters, {
    fields: [readingHistory.chapterId],
    references: [chapters.id],
  }),
}));

export const chapterReportsRelations = relations(chapterReports, ({ one }) => ({
  user: one(users, { fields: [chapterReports.userId], references: [users.id] }),
  chapter: one(chapters, {
    fields: [chapterReports.chapterId],
    references: [chapters.id],
  }),
}));

export const stickerSetsRelations = relations(stickerSets, ({ many }) => ({
  stickers: many(stickers),
}));

export const stickersRelations = relations(stickers, ({ one }) => ({
  stickerSet: one(stickerSets, {
    fields: [stickers.stickerSetId],
    references: [stickerSets.id],
  }),
}));

// ── Gamification relations ──────────────────────────────────────
export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(
  userAchievements,
  ({ one }) => ({
    user: one(users, {
      fields: [userAchievements.userId],
      references: [users.id],
    }),
    achievement: one(achievements, {
      fields: [userAchievements.achievementId],
      references: [achievements.id],
    }),
  }),
);

export const petsRelations = relations(pets, ({ many }) => ({
  userPets: many(userPets),
}));

export const userPetsRelations = relations(userPets, ({ one }) => ({
  user: one(users, { fields: [userPets.userId], references: [users.id] }),
  pet: one(pets, { fields: [userPets.petId], references: [pets.id] }),
}));

export const readingStreaksRelations = relations(readingStreaks, ({ one }) => ({
  user: one(users, { fields: [readingStreaks.userId], references: [users.id] }),
}));
