/**
 * Data migration: Create default bookmark folders for existing users with follows,
 * then assign all existing follows to the "Reading" folder.
 *
 * Run: npx tsx src/database/migrate-follows-to-folders.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import {
  follows,
  bookmarkFolders,
  DEFAULT_BOOKMARK_FOLDERS,
} from './schema/community.schema.js';

const BATCH_SIZE = 100;

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  // Get all user IDs that have at least one follow
  const usersWithFollows = await db
    .selectDistinct({ userId: follows.userId })
    .from(follows);

  const userIds = usersWithFollows.map((r) => r.userId);
  console.log(`Found ${userIds.length} users with follows`);

  if (userIds.length === 0) {
    console.log('No users to migrate');
    await client.end();
    return;
  }

  // Process in batches
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(userIds.length / BATCH_SIZE)}`,
    );

    // Insert default folders for each user (ON CONFLICT DO NOTHING for idempotency)
    const folderValues = batch.flatMap((userId) =>
      DEFAULT_BOOKMARK_FOLDERS.map((f) => ({
        userId,
        name: f.name,
        slug: f.slug,
        order: f.order,
        isDefault: true,
      })),
    );

    await db
      .insert(bookmarkFolders)
      .values(folderValues)
      .onConflictDoNothing({
        target: [bookmarkFolders.userId, bookmarkFolders.slug],
      });

    // Get the "Reading" folder IDs for these users
    const readingFolders = await db
      .select({ id: bookmarkFolders.id, userId: bookmarkFolders.userId })
      .from(bookmarkFolders)
      .where(
        sql`${bookmarkFolders.userId} = ANY(${batch}) AND ${bookmarkFolders.slug} = 'reading'`,
      );

    // Update follows for each user to point to their Reading folder
    for (const folder of readingFolders) {
      await db
        .update(follows)
        .set({ folderId: folder.id })
        .where(
          sql`${follows.userId} = ${folder.userId} AND ${follows.folderId} IS NULL`,
        );
    }
  }

  console.log('Migration complete!');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
