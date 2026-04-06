import { registerAs } from '@nestjs/config';

export const importConfig = registerAs('import', () => ({
  mangabaka: {
    baseUrl: process.env.MANGABAKA_BASE_URL || 'https://api.mangabaka.dev',
    apiKey: process.env.MANGABAKA_API_KEY || '',
  },
  weebdex: {
    baseUrl: process.env.WEEBDEX_BASE_URL || 'https://api.weebdex.org',
    apiKey: process.env.WEEBDEX_API_KEY || '',
  },
  atsumaru: {
    baseUrl: process.env.ATSUMARU_BASE_URL || 'https://atsu.moe',
  },
}));
