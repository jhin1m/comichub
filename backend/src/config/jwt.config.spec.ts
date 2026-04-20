import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('jwtConfig', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('throws when secrets missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    const { jwtConfig } = await import('./jwt.config.js');
    expect(() => jwtConfig()).toThrow(/JWT_ACCESS_SECRET and JWT_REFRESH_SECRET/);
  });

  it('throws when secrets missing in development (no silent fallback)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    const { jwtConfig } = await import('./jwt.config.js');
    expect(() => jwtConfig()).toThrow(/JWT_ACCESS_SECRET and JWT_REFRESH_SECRET/);
  });

  it('throws when secret < 32 bytes', async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_ACCESS_SECRET = 'short';
    process.env.JWT_REFRESH_SECRET = 'x'.repeat(32);
    const { jwtConfig } = await import('./jwt.config.js');
    expect(() => jwtConfig()).toThrow(/JWT_ACCESS_SECRET must be at least 32/);
  });

  it('passes in test env even with missing secrets', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    const { jwtConfig } = await import('./jwt.config.js');
    expect(() => jwtConfig()).not.toThrow();
  });

  it('accepts 32-byte secrets', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    const { jwtConfig } = await import('./jwt.config.js');
    const result = jwtConfig();
    expect(result.accessSecret).toBe('a'.repeat(32));
    expect(result.refreshSecret).toBe('b'.repeat(32));
  });
});
