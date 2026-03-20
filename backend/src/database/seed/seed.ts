import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Seeding database...');

  // Genres
  const genreData = [
    { name: 'Action', slug: 'action' },
    { name: 'Adventure', slug: 'adventure' },
    { name: 'Comedy', slug: 'comedy' },
    { name: 'Drama', slug: 'drama' },
    { name: 'Fantasy', slug: 'fantasy' },
    { name: 'Horror', slug: 'horror' },
    { name: 'Mystery', slug: 'mystery' },
    { name: 'Romance', slug: 'romance' },
    { name: 'Sci-Fi', slug: 'sci-fi' },
    { name: 'Slice of Life', slug: 'slice-of-life' },
    { name: 'Sports', slug: 'sports' },
    { name: 'Supernatural', slug: 'supernatural' },
    { name: 'Thriller', slug: 'thriller' },
    { name: 'Historical', slug: 'historical' },
    { name: 'Isekai', slug: 'isekai' },
    { name: 'Martial Arts', slug: 'martial-arts' },
    { name: 'Mecha', slug: 'mecha' },
    { name: 'School', slug: 'school' },
    { name: 'Shounen', slug: 'shounen' },
    { name: 'Shoujo', slug: 'shoujo' },
    { name: 'Seinen', slug: 'seinen' },
    { name: 'Josei', slug: 'josei' },
  ];

  await db.insert(schema.genres).values(genreData).onConflictDoNothing();
  console.log(`  ✓ ${genreData.length} genres`);

  // Site settings defaults
  const settingsData = [
    { key: 'site_name', value: 'ComicHub' },
    { key: 'site_description', value: 'Read manga, manhwa, manhua online' },
    { key: 'site_logo', value: '' },
    { key: 'posts_per_page', value: '20' },
    { key: 'maintenance_mode', value: 'false' },
  ];

  await db.insert(schema.siteSettings).values(settingsData).onConflictDoNothing();
  console.log(`  ✓ ${settingsData.length} site settings`);

  // Default sticker set
  const [stickerSet] = await db
    .insert(schema.stickerSets)
    .values({ name: 'Default', isActive: true })
    .onConflictDoNothing()
    .returning();

  if (stickerSet) {
    console.log(`  ✓ Default sticker set`);
  }

  console.log('✅ Seeding complete');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => client.end());
