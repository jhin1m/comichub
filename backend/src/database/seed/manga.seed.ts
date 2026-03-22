import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index.js';

export type SeededManga = { id: number; slug: string };

const artistsData = [
  { name: 'Eiichiro Oda', slug: 'eiichiro-oda' },
  { name: 'Masashi Kishimoto', slug: 'masashi-kishimoto' },
  { name: 'Hajime Isayama', slug: 'hajime-isayama' },
  { name: 'Tite Kubo', slug: 'tite-kubo' },
  { name: 'Akira Toriyama', slug: 'akira-toriyama' },
  { name: 'Kentaro Miura', slug: 'kentaro-miura' },
  { name: 'Yoshihiro Togashi', slug: 'yoshihiro-togashi' },
  { name: 'Naoki Urasawa', slug: 'naoki-urasawa' },
];

const authorsData = [
  { name: 'Eiichiro Oda', slug: 'eiichiro-oda-auth' },
  { name: 'Masashi Kishimoto', slug: 'masashi-kishimoto-auth' },
  { name: 'Hajime Isayama', slug: 'hajime-isayama-auth' },
  { name: 'Tite Kubo', slug: 'tite-kubo-auth' },
  { name: 'Akira Toriyama', slug: 'akira-toriyama-auth' },
  { name: 'Kentaro Miura', slug: 'kentaro-miura-auth' },
  { name: 'Yoshihiro Togashi', slug: 'yoshihiro-togashi-auth' },
  { name: 'Naoki Urasawa', slug: 'naoki-urasawa-auth' },
];

// [title, slug, type, status, description, genreNames, artistIdx, authorIdx]
const mangaDefs = [
  [
    'One Piece',
    'one-piece',
    'manga',
    'ongoing',
    'Luffy dreams of becoming King of the Pirates.',
    ['Action', 'Adventure', 'Comedy'],
    0,
    0,
  ],
  [
    'Naruto',
    'naruto',
    'manga',
    'completed',
    'A young ninja seeks recognition and the title of Hokage.',
    ['Action', 'Shounen', 'Fantasy'],
    1,
    1,
  ],
  [
    'Attack on Titan',
    'attack-on-titan',
    'manga',
    'completed',
    'Humanity fights for survival against Titans.',
    ['Action', 'Mystery', 'Drama'],
    2,
    2,
  ],
  [
    'Bleach',
    'bleach',
    'manga',
    'completed',
    'Ichigo gains Soul Reaper powers and defends the living world.',
    ['Action', 'Supernatural', 'Shounen'],
    3,
    3,
  ],
  [
    'Dragon Ball',
    'dragon-ball',
    'manga',
    'completed',
    'Son Goku adventures from childhood through adulthood.',
    ['Action', 'Adventure', 'Comedy'],
    4,
    4,
  ],
  [
    'Berserk',
    'berserk',
    'manga',
    'hiatus',
    'Guts, a lone mercenary, battles demons in a dark fantasy world.',
    ['Action', 'Horror', 'Fantasy'],
    5,
    5,
  ],
  [
    'Hunter x Hunter',
    'hunter-x-hunter',
    'manga',
    'hiatus',
    'Gon seeks his father, the world-class Hunter Ging.',
    ['Action', 'Adventure', 'Fantasy'],
    6,
    6,
  ],
  [
    'Vinland Saga',
    'vinland-saga',
    'manga',
    'ongoing',
    'A Viking warrior seeks vengeance across medieval Europe.',
    ['Historical', 'Action', 'Drama'],
    7,
    7,
  ],
  [
    'Demon Slayer',
    'demon-slayer',
    'manga',
    'completed',
    'Tanjiro fights demons to cure his sister Nezuko.',
    ['Action', 'Supernatural', 'Shounen'],
    0,
    0,
  ],
  [
    'Jujutsu Kaisen',
    'jujutsu-kaisen',
    'manga',
    'ongoing',
    'Yuji Itadori joins a secret school to fight Curses.',
    ['Action', 'Supernatural', 'Shounen'],
    1,
    1,
  ],
] as const;

export async function seedManga(
  db: PostgresJsDatabase<typeof schema>,
  uploadUserId: number,
): Promise<SeededManga[]> {
  const artists = await db
    .insert(schema.artists)
    .values(artistsData)
    .onConflictDoNothing()
    .returning({ id: schema.artists.id });

  const authors = await db
    .insert(schema.authors)
    .values(authorsData)
    .onConflictDoNothing()
    .returning({ id: schema.authors.id });

  const allGenres = await db.select().from(schema.genres);
  const genreMap = new Map(allGenres.map((g) => [g.name, g.id]));

  console.log(`  ✓ ${artists.length} artists, ${authors.length} authors`);

  const insertedManga: SeededManga[] = [];

  for (const [
    title,
    slug,
    type,
    status,
    description,
    genreNames,
    artistIdx,
    authorIdx,
  ] of mangaDefs) {
    const [m] = await db
      .insert(schema.manga)
      .values({
        userId: uploadUserId,
        title,
        slug,
        description,
        type: type as 'manga' | 'manhwa' | 'manhua' | 'doujinshi',
        status: status as 'ongoing' | 'completed' | 'hiatus' | 'dropped',
        cover: `https://picsum.photos/seed/${slug}-cover/400/600`,
        views: Math.floor(Math.random() * 100000) + 1000,
        viewsDay: Math.floor(Math.random() * 500),
        viewsWeek: Math.floor(Math.random() * 3000),
        followersCount: Math.floor(Math.random() * 5000),
        chaptersCount: 3,
        isHot: Math.random() > 0.6,
        isReviewed: true,
      })
      .onConflictDoNothing()
      .returning({ id: schema.manga.id, slug: schema.manga.slug });

    if (!m) continue;
    insertedManga.push(m);

    // Pivot: genres
    const genrePivots = (genreNames as readonly string[])
      .map((gn) => genreMap.get(gn))
      .filter((id): id is number => id !== undefined)
      .map((genreId) => ({ mangaId: m.id, genreId }));
    if (genrePivots.length) {
      await db
        .insert(schema.mangaGenres)
        .values(genrePivots)
        .onConflictDoNothing();
    }

    // Pivot: artist + author
    if (artists[artistIdx]) {
      await db
        .insert(schema.mangaArtists)
        .values({ mangaId: m.id, artistId: artists[artistIdx].id })
        .onConflictDoNothing();
    }
    if (authors[authorIdx]) {
      await db
        .insert(schema.mangaAuthors)
        .values({ mangaId: m.id, authorId: authors[authorIdx].id })
        .onConflictDoNothing();
    }
  }

  console.log(`  ✓ ${insertedManga.length} manga`);
  return insertedManga;
}
