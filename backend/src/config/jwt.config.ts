import { registerAs } from '@nestjs/config';

const MIN_SECRET_BYTES = 32;

export const jwtConfig = registerAs('jwt', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isTest = nodeEnv === 'test';

  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!isTest) {
    if (!accessSecret || !refreshSecret) {
      throw new Error(
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required (min 32 bytes). ' +
          'Generate with: openssl rand -hex 32',
      );
    }
    if (Buffer.byteLength(accessSecret) < MIN_SECRET_BYTES) {
      throw new Error(
        `JWT_ACCESS_SECRET must be at least ${MIN_SECRET_BYTES} bytes`,
      );
    }
    if (Buffer.byteLength(refreshSecret) < MIN_SECRET_BYTES) {
      throw new Error(
        `JWT_REFRESH_SECRET must be at least ${MIN_SECRET_BYTES} bytes`,
      );
    }
  }

  return {
    accessSecret: accessSecret || 'test-access-secret-min-32-bytes-xxxxxx',
    refreshSecret: refreshSecret || 'test-refresh-secret-min-32-bytes-xxxxx',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  };
});
