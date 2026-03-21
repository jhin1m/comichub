/**
 * Test data factories — produce consistent fixture objects for tests.
 * All IDs are deterministic so tests can assert on specific values.
 */

export const factory = {
  user(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 1,
      uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'Test User',
      email: 'user@test.com',
      password: '$2a$12$hashedpassword',
      role: 'user',
      avatarUrl: null,
      bio: null,
      bannedUntil: null,
      deletedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  },

  manga(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 1,
      title: 'Test Manga',
      slug: 'test-manga',
      description: 'A test manga description',
      cover: 'https://example.com/cover.jpg',
      status: 'ongoing',
      type: 'manga',
      views: 0,
      followersCount: 0,
      averageRating: '0',
      ratingCount: 0,
      deletedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  },

  chapter(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 1,
      mangaId: 1,
      number: '1',
      title: 'Chapter 1',
      slug: 'chapter-1',
      viewCount: 0,
      order: 1,
      deletedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  },

  comment(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 1,
      userId: 1,
      commentableType: 'manga',
      commentableId: 1,
      parentId: null,
      content: 'Test comment content',
      likesCount: 0,
      depth: 0,
      deletedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  },

  rating(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 1,
      userId: 1,
      mangaId: 1,
      score: '4.5',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  },

  notification(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 1,
      userId: 1,
      type: 'chapter.created',
      payload: { mangaId: 1, chapterId: 1 },
      readAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    };
  },
};
