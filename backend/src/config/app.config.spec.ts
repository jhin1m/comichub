import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('appConfig.corsOrigins', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('parses CORS_ORIGINS env (comma-separated)', async () => {
    process.env.CORS_ORIGINS = 'https://a.example, https://b.example';
    const { appConfig } = await import('./app.config.js');
    expect(appConfig().corsOrigins).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('defaults to zetsu.moe apex + www in production', async () => {
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'production';
    const { appConfig } = await import('./app.config.js');
    expect(appConfig().corsOrigins).toEqual([
      'https://zetsu.moe',
      'https://www.zetsu.moe',
    ]);
  });

  it('defaults to localhost:3000 in non-production', async () => {
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'development';
    const { appConfig } = await import('./app.config.js');
    expect(appConfig().corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('trustProxy defaults to 2', async () => {
    delete process.env.TRUST_PROXY_HOPS;
    const { appConfig } = await import('./app.config.js');
    expect(appConfig().trustProxy).toBe(2);
  });

  it('trustProxy respects TRUST_PROXY_HOPS override', async () => {
    process.env.TRUST_PROXY_HOPS = '3';
    const { appConfig } = await import('./app.config.js');
    expect(appConfig().trustProxy).toBe(3);
  });
});
