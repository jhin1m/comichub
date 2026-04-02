import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { users, type User } from '../../database/schema/index.js';
import { MailService } from '../../common/services/mail.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { TokenResponseDto } from './dto/token-response.dto.js';
import type { JwtPayload } from './types/jwt-payload.type.js';

// Redis token TTL in seconds (7 days)
const REFRESH_TTL = 60 * 60 * 24 * 7;
// Password reset token TTL in seconds (15 min)
const RESET_TTL = 60 * 15;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: import('ioredis').Redis,
    private readonly mailService: MailService,
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
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async getMe(userId: number) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { password: false },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async logout(userId: number): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
  }

  async refresh(
    user: User & { refreshToken: string },
  ): Promise<TokenResponseDto> {
    // Verify stored token matches
    const stored = await this.redis.get(`refresh:${user.id}`);
    if (!stored || stored !== user.refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return this.issueTokens(user);
  }

  async loginWithGoogle(user: User): Promise<TokenResponseDto> {
    return this.issueTokens(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    // Silent return for non-existent users or OAuth-only accounts (no password)
    if (!user || !user.password) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    await this.redis.setex(`pwd-reset:${hash}`, RESET_TTL, String(user.id));

    const frontendUrl = this.configService.get<string>(
      'app.frontendUrl',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await this.mailService.sendResetPassword(email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const userId = await this.redis.get(`pwd-reset:${hash}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.db
      .update(users)
      .set({ password: hashed })
      .where(eq(users.id, Number(userId)));

    // Delete reset token (single-use) + force re-login
    await Promise.all([
      this.redis.del(`pwd-reset:${hash}`),
      this.redis.del(`refresh:${userId}`),
    ]);
  }

  private async issueTokens(user: User): Promise<TokenResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      uuid: user.uuid,
      email: user.email,
      role: user.role,
    };

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
        { ...payload },
        {
          secret: accessSecret,
          expiresIn: accessExpiry as
            | `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`
            | number,
        },
      ),

      this.jwtService.signAsync(
        { ...payload },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiry as
            | `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`
            | number,
        },
      ),
    ]);

    // Store refresh token in Redis (rotate on each use)
    await this.redis.setex(`refresh:${user.id}`, REFRESH_TTL, refreshToken);

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
