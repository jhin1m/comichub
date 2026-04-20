import { registerAs } from '@nestjs/config';

const parseCorsOrigins = (): string[] => {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    return ['https://zetsu.moe', 'https://www.zetsu.moe'];
  }
  return ['http://localhost:3000'];
};

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME || 'ComicHub',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  url: process.env.APP_URL || 'http://localhost:3000',
  corsOrigins: parseCorsOrigins(),
  trustProxy: parseInt(process.env.TRUST_PROXY_HOPS || '2', 10),
}));
