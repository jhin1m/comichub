import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  createResilientRedis,
  REDIS_AVAILABLE,
  type RedisStatus,
} from '../../common/providers/redis.provider.js';
import { MailService } from '../../common/services/mail.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  providers: [
    AuthService,
    MailService,
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    {
      provide: REDIS_AVAILABLE,
      useValue: { available: false } as RedisStatus,
    },
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService, REDIS_AVAILABLE],
      useFactory: (config: ConfigService, status: RedisStatus) =>
        createResilientRedis(config, status),
    },
  ],
  controllers: [AuthController],
  exports: ['REDIS_CLIENT', REDIS_AVAILABLE],
})
export class AuthModule {}
