import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { users, type User } from '../../database/schema/index.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { TokenResponseDto } from './dto/token-response.dto.js';
import type { JwtPayload } from './types/jwt-payload.type.js';

// Redis token TTL in seconds (7 days)
const REFRESH_TTL = 60 * 60 * 24 * 7;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: import('ioredis').Redis,
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
      this.jwtService.signAsync(payload as any, {
        secret: accessSecret,
        expiresIn: accessExpiry as any,
      }),

      this.jwtService.signAsync(payload as any, {
        secret: refreshSecret,
        expiresIn: refreshExpiry as any,
      }),
    ]);

    // Store refresh token in Redis (rotate on each use)
    await this.redis.setex(`refresh:${user.id}`, REFRESH_TTL, refreshToken);

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
