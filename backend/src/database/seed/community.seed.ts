import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index.js';
import type { SeededUser } from './users.seed.js';
import type { SeededManga } from './manga.seed.js';
import type { SeededChapter } from './chapters.seed.js';

const SCORES = ['1.0', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];
const REPORT_TYPES = ['broken_images', 'wrong_chapter', 'other'] as const;

const MANGA_COMMENTS = [
  'This manga is absolutely incredible! The art style is stunning.',
  'Been following this for years, never disappoints.',
  'The story pacing is a bit slow but the characters are great.',
  'One of the best series I have ever read. Highly recommend!',
  'The world-building in this is on another level.',
];

const CHAPTER_COMMENTS = [
  'This chapter was insane! Did not see that plot twist coming.',
  'The artwork this chapter is peak — every panel is beautiful.',
  'Finally an update! Worth the wait.',
  'Getting better every chapter. Love the character development.',
];

const REPLIES = [
  'Totally agree with you!',
  'I had the same reaction when I read it.',
  'You should check the previous arc for context.',
];

export async function seedCommunity(
  db: PostgresJsDatabase<typeof schema>,
  users: SeededUser[],
  mangaList: SeededManga[],
  chapters: SeededChapter[],
): Promise<void> {
  // Ratings
  const ratingsData = mangaList.flatMap((m, mi) =>
    users.slice(1).map((u, ui) => ({
      userId: u.id,
      mangaId: m.id,
      score: SCORES[(mi + ui) % SCORES.length],
    })),
  );
  await db.insert(schema.ratings).values(ratingsData).onConflictDoNothing();
  console.log(`  ✓ ${ratingsData.length} ratings`);

  // Follows
  const followsData = mangaList.flatMap((m, mi) =>
    users.slice(1, (mi % 4) + 2).map((u) => ({
      userId: u.id,
      mangaId: m.id,
    })),
  );
  await db.insert(schema.follows).values(followsData).onConflictDoNothing();
  console.log(`  ✓ ${followsData.length} follows`);

  // Reading history (one per user per manga, pointing to a chapter)
  const historyData = mangaList.flatMap((m) => {
    const mangaChapters = chapters.filter((c) => c.mangaId === m.id);
    if (!mangaChapters.length) return [];
    return users.slice(1, 4).map((u, i) => ({
      userId: u.id,
      mangaId: m.id,
      chapterId: mangaChapters[i % mangaChapters.length].id,
    }));
  });
  await db
    .insert(schema.readingHistory)
    .values(historyData)
    .onConflictDoNothing();
  console.log(`  ✓ ${historyData.length} reading history entries`);

  // Reading streaks
  const streaksData = users.slice(1).map((u, i) => ({
    userId: u.id,
    currentStreak: (i + 1) * 3,
    longestStreak: (i + 1) * 5 + 2,
    lastReadAt: new Date(Date.now() - i * 86_400_000),
  }));
  await db
    .insert(schema.readingStreaks)
    .values(streaksData)
    .onConflictDoNothing();
  console.log(`  ✓ ${streaksData.length} reading streaks`);

  // Chapter reports
  const reportsData = chapters.slice(0, 5).map((ch, i) => ({
    userId: users[(i % (users.length - 1)) + 1].id,
    chapterId: ch.id,
    type: REPORT_TYPES[i % REPORT_TYPES.length],
    description: 'Some images are not loading properly.',
    status: 'pending' as const,
  }));
  await db
    .insert(schema.chapterReports)
    .values(reportsData)
    .onConflictDoNothing();
  console.log(`  ✓ ${reportsData.length} chapter reports`);

  // Comments on manga
  const mangaComments = await db
    .insert(schema.comments)
    .values(
      mangaList.slice(0, 5).flatMap((m, mi) =>
        users.slice(1, 4).map((u, ui) => ({
          userId: u.id,
          commentableType: 'manga',
          commentableId: m.id,
          content: MANGA_COMMENTS[(mi + ui) % MANGA_COMMENTS.length],
        })),
      ),
    )
    .onConflictDoNothing()
    .returning({ id: schema.comments.id });

  // Replies to first 3 manga comments
  const replyData = mangaComments.slice(0, 3).map((c, i) => ({
    userId: users[((i + 2) % (users.length - 1)) + 1].id,
    commentableType: 'manga',
    commentableId: mangaList[0].id,
    parentId: c.id,
    content: REPLIES[i % REPLIES.length],
  }));
  if (replyData.length) {
    await db.insert(schema.comments).values(replyData).onConflictDoNothing();
  }

  // Comments on chapters
  const chapterComments = await db
    .insert(schema.comments)
    .values(
      chapters.slice(0, 6).flatMap((ch, ci) =>
        users.slice(1, 3).map((u, ui) => ({
          userId: u.id,
          commentableType: 'chapter',
          commentableId: ch.id,
          content: CHAPTER_COMMENTS[(ci + ui) % CHAPTER_COMMENTS.length],
        })),
      ),
    )
    .onConflictDoNothing()
    .returning({ id: schema.comments.id });

  const totalComments =
    mangaComments.length + replyData.length + chapterComments.length;
  console.log(`  ✓ ${totalComments} comments`);

  // Comment likes
  const allCommentIds = [...mangaComments, ...chapterComments].map((c) => c.id);
  const likesData = allCommentIds
    .slice(0, 10)
    .flatMap((cid, ci) =>
      users
        .slice(1, (ci % 3) + 2)
        .map((u) => ({ userId: u.id, commentId: cid })),
    );
  await db.insert(schema.commentLikes).values(likesData).onConflictDoNothing();
  console.log(`  ✓ ${likesData.length} comment likes`);
}
