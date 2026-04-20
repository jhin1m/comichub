import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq, gt, and } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { users, refreshTokens, type User } from '../../database/schema/index.js';
import { MailService } from '../../common/services/mail.service.js';
import {
  REDIS_AVAILABLE,
  type RedisStatus,
} from '../../common/providers/redis.provider.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { TokenResponseDto } from './dto/token-response.dto.js';
import type { JwtPayload, JwtRefreshPayload } from './types/jwt-payload.type.js';

const RESET_TTL = 60 * 15;
// H5 login lockout — 15-minute window, hard lock at 10 failed attempts per email.
const LOGIN_FAIL_WINDOW_SEC = 15 * 60;
const LOGIN_FAIL_LOCK_THRESHOLD = 10;
// C2 OAuth code exchange — short-lived, single-use.
const OAUTH_CODE_TTL_SEC = 60;

function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return 60 * 60 * 24 * 7;
  const n = Number(match[1]);
  switch (match[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    case 'w': return n * 604800;
    default: return n;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// H5: key emails by hash so we don't keep raw PII in Redis.
function emailKey(email: string): string {
  const h = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  return `login-fail:${h}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: import('ioredis').Redis,
    private readonly mailService: MailService,
    @Inject(REDIS_AVAILABLE) private readonly redisStatus: RedisStatus,
  ) {}

  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    const [user] = await this.db
      .insert(users)
      .values({ name: dto.name, email: dto.email, password: hashed })
      .returning();

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    await this.assertNotLockedOut(dto.email);

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    if (!user || !user.password) {
      await this.recordLoginFailure(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.recordLoginFailure(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearLoginFailures(dto.email);
    return this.issueTokens(user);
  }

  // H5: hard-lock after 10 failed attempts in 15 min. Best-effort — falls
  // open when Redis is down; per-IP throttle (ThrottlerGuard) still active.
  private async assertNotLockedOut(email: string): Promise<void> {
    if (!this.redisStatus.available) return;
    try {
      const raw = await this.redis.get(emailKey(email));
      const count = raw ? Number(raw) : 0;
      if (count >= LOGIN_FAIL_LOCK_THRESHOLD) {
        throw new ForbiddenException(
          'Too many failed login attempts. Try again in 15 minutes.',
        );
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.warn('Lockout check failed, allowing login', err);
    }
  }

  private async recordLoginFailure(email: string): Promise<void> {
    if (!this.redisStatus.available) return;
    try {
      const key = emailKey(email);
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, LOGIN_FAIL_WINDOW_SEC);
    } catch (err) {
      this.logger.warn('Failed to record login failure', err);
    }
  }

  private async clearLoginFailures(email: string): Promise<void> {
    if (!this.redisStatus.available) return;
    try {
      await this.redis.del(emailKey(email));
    } catch {
      /* ignore */
    }
  }

  async getMe(userId: number) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { password: false },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private get refreshTtl(): number {
    return parseDurationToSeconds(
      this.configService.get<string>('jwt.refreshExpiry', '7d'),
    );
  }

  async logout(userId: number): Promise<void> {
    await Promise.allSettled([
      this.redis.del(`refresh:${userId}`),
      this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId)),
    ]);
  }

  async refresh(
    user: User & { refreshToken: string; jti?: string },
  ): Promise<TokenResponseDto> {
    const [row] = await this.db
      .select({
        token: refreshTokens.token,
        jti: refreshTokens.jti,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, user.id),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    // H3 reuse detection: row.jti is set AND doesn't match the presented token →
    // someone replayed a previously rotated refresh token. Nuke the session and
    // force re-login for everyone (both victim and attacker).
    if (row?.jti && user.jti && row.jti !== user.jti) {
      this.logger.warn(
        `Refresh reuse detected for user ${user.id}; revoking session`,
      );
      await Promise.allSettled([
        this.db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id)),
        this.redis.del(`refresh:${user.id}`),
      ]);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    // Match against Redis (raw) first, DB (hash) second — existing dual-write logic.
    const stored = await this.redis.get(`refresh:${user.id}`);
    if (stored) {
      if (stored !== user.refreshToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
    } else {
      if (!row || row.token !== hashToken(user.refreshToken)) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      await this.redis.setex(
        `refresh:${user.id}`,
        this.refreshTtl,
        user.refreshToken,
      );
    }
    return this.issueTokens(user);
  }

  async loginWithGoogle(user: User): Promise<TokenResponseDto> {
    return this.issueTokens(user);
  }

  // C2: single-use code bound to user — avoids leaking tokens via URL.
  async createOauthCode(userId: number): Promise<string> {
    if (!this.redisStatus.available) {
      throw new ServiceUnavailableException(
        'OAuth temporarily unavailable — Redis down',
      );
    }
    const code = crypto.randomBytes(32).toString('hex');
    await this.redis.setex(`oauth-code:${code}`, OAUTH_CODE_TTL_SEC, String(userId));
    return code;
  }

  async exchangeOauthCode(code: string): Promise<TokenResponseDto> {
    if (!this.redisStatus.available) {
      throw new ServiceUnavailableException(
        'OAuth temporarily unavailable — Redis down',
      );
    }
    const userIdRaw = await this.redis.getdel(`oauth-code:${code}`);
    if (!userIdRaw) {
      throw new UnauthorizedException('Invalid or expired OAuth code');
    }
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, Number(userIdRaw)),
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.issueTokens(user);
  }

  async forgotPassword(email: string): Promise<void> {
    if (!this.redisStatus.available) {
      throw new ServiceUnavailableException(
        'Password reset is temporarily unavailable',
      );
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user || !user.password) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.redis.setex(`pwd-reset:${hash}`, RESET_TTL, String(user.id));

    const frontendUrl = this.configService.get<string>(
      'app.frontendUrl',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await this.mailService.sendResetPassword(email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const userId = await this.redis.get(`pwd-reset:${hash}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.db
      .update(users)
      .set({ password: hashed })
      .where(eq(users.id, Number(userId)));

    await Promise.allSettled([
      this.redis.del(`pwd-reset:${hash}`),
      this.redis.del(`refresh:${userId}`),
      this.db
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, Number(userId))),
    ]);
  }

  private async issueTokens(user: User): Promise<TokenResponseDto> {
    const jti = crypto.randomUUID();
    const basePayload: JwtPayload = {
      sub: user.id,
      uuid: user.uuid,
      email: user.email,
      role: user.role,
    };
    const refreshPayload: JwtRefreshPayload = { ...basePayload, jti };

    const accessSecret =
      this.configService.getOrThrow<string>('jwt.accessSecret');
    const refreshSecret =
      this.configService.getOrThrow<string>('jwt.refreshSecret');
    const accessExpiry = this.configService.get<string>(
      'jwt.accessExpiry',
      '15m',
    );
    const refreshExpiry = this.configService.get<string>(
      'jwt.refreshExpiry',
      '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload },
        {
          secret: accessSecret,
          expiresIn: accessExpiry as
            | `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`
            | number,
        },
      ),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiry as
          | `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`
          | number,
      }),
    ]);

    const ttl = this.refreshTtl;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.db
      .insert(refreshTokens)
      .values({
        userId: user.id,
        token: hashToken(refreshToken),
        jti,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: refreshTokens.userId,
        set: { token: hashToken(refreshToken), jti, expiresAt },
      });
    await this.redis.setex(`refresh:${user.id}`, ttl, refreshToken);

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
