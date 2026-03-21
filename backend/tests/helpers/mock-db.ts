/**
 * Creates a chainable Drizzle ORM mock for unit/integration tests.
 * Each method returns `this` to support chaining (e.g. .update().set().where()).
 */
import { vi } from 'vitest';

export function createMockDb() {
  const mock: any = {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      manga: { findFirst: vi.fn(), findMany: vi.fn() },
      chapters: { findFirst: vi.fn(), findMany: vi.fn() },
      notifications: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  };

  // Allow chained .where() to resolve
  mock.where.mockReturnValue({
    ...mock,
    // resolve the chain when awaited
    then: (resolve: any) => resolve([]),
  });

  return mock;
}

export function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
  };
}
