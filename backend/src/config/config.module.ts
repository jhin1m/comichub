import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './app.config.js';
import { databaseConfig } from './database.config.js';
import { redisConfig } from './redis.config.js';
import { s3Config } from './s3.config.js';
import { jwtConfig } from './jwt.config.js';
import { googleConfig } from './google.config.js';
import { importConfig } from '../modules/import/config/import.config.js';
import { turnstileConfig } from './turnstile.config.js';
import { mailConfig } from './mail.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        s3Config,
        jwtConfig,
        googleConfig,
        importConfig,
        turnstileConfig,
        mailConfig,
      ],
      envFilePath: ['.env'],
    }),
  ],
})
export class AppConfigModule {}
