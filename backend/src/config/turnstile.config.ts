import { registerAs } from '@nestjs/config';

export const turnstileConfig = registerAs('turnstile', () => ({
  secretKey: process.env.TURNSTILE_SECRET_KEY || '',
}));
