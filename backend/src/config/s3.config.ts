import { registerAs } from '@nestjs/config';

export const s3Config = registerAs('s3', () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  bucket: process.env.AWS_S3_BUCKET || '',
  region: process.env.AWS_S3_REGION || 'ap-southeast-1',
  endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  publicUrl: process.env.AWS_S3_PUBLIC_URL || '',
}));
