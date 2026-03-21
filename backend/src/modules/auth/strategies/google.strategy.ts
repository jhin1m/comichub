import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { users } from '../../../database/schema/index.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {
    super({
      clientID: configService.get<string>('google.clientId') || 'not-configured',
      clientSecret: configService.get<string>('google.clientSecret') || 'not-configured',
      callbackURL: configService.get<string>('google.callbackUrl') || 'http://localhost:3000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    const googleId = profile.id;
    const name = profile.displayName || email?.split('@')[0] || 'User';
    const avatar = profile.photos?.[0]?.value;

    if (!email) {
      return done(new Error('No email from Google'), undefined);
    }

    // Find by google_id first, then by email
    let user = await this.db.query.users.findFirst({
      where: eq(users.googleId, googleId),
    });

    if (!user) {
      user = await this.db.query.users.findFirst({
        where: eq(users.email, email),
      });
    }

    if (!user) {
      // Create new user via Google OAuth
      const [created] = await this.db
        .insert(users)
        .values({ name, email, googleId, avatar: avatar ?? null })
        .returning();
      user = created;
    } else if (!user.googleId) {
      // Link google_id to existing account
      await this.db
        .update(users)
        .set({ googleId, avatar: user.avatar ?? avatar ?? null })
        .where(eq(users.id, user.id));
      user = { ...user, googleId };
    }

    done(null, user);
  }
}
