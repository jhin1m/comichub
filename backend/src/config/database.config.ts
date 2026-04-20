import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  // DATABASE_SSL=require when DB traffic crosses a network boundary.
  // Default off — DB and app on same VPS doesn't need encryption.
  const ssl = process.env.DATABASE_SSL === 'require' ? 'require' : undefined;
  return { url, ssl };
});
