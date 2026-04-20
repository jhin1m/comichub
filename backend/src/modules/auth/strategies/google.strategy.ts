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
      clientID:
        configService.get<string>('google.clientId') || 'not-configured',
      clientSecret:
        configService.get<string>('google.clientSecret') || 'not-configured',
      callbackURL:
        configService.get<string>('google.callbackUrl') ||
        'http://localhost:3000/api/v1/auth/google/callback',
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

    // Find by google_id first (already-linked account).
    let user = await this.db.query.users.findFirst({
      where: eq(users.googleId, googleId),
    });

    // H6: block silent link. If there's a pre-existing LOCAL account with this
    // email, do NOT auto-link — an attacker can pre-create an account with the
    // victim's email to hijack their Google sign-in. Frontend must ship an
    // explicit "link Google" flow (from settings, after password login) before
    // this branch can be re-enabled.
    if (!user) {
      const byEmail = await this.db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (byEmail && byEmail.password) {
        return done(
          Object.assign(new Error('ACCOUNT_EXISTS_NO_LINK'), {
            name: 'AccountExistsNoLink',
          }),
          undefined,
        );
      }
      // No collision OR existing account is Google-only without googleId
      // (rare migration case) — allow creation / re-attach.
      if (byEmail && !byEmail.password) {
        await this.db
          .update(users)
          .set({ googleId, avatar: byEmail.avatar ?? avatar ?? null })
          .where(eq(users.id, byEmail.id));
        user = { ...byEmail, googleId };
      }
    }

    if (!user) {
      const [created] = await this.db
        .insert(users)
        .values({ name, email, googleId, avatar: avatar ?? null })
        .returning();
      user = created;
    }

    done(null, user);
  }
}
