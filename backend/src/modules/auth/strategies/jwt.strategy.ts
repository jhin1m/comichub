import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { users } from '../../../database/schema/index.js';
import type { JwtPayload } from '../types/jwt-payload.type.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    // Ban check — runs on every authenticated request
    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      throw new UnauthorizedException({
        message: 'Account is banned',
        bannedUntil: user.bannedUntil,
      });
    }

    // Return DB user with `sub` alias so both user.id and user.sub work in controllers
    return { ...user, sub: user.id };
  }
}
