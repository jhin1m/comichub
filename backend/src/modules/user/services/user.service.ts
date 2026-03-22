import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, ilike, or, sql, count } from 'drizzle-orm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  users,
  userProfiles,
  follows,
} from '../../../database/schema/index.js';
import type { UpdateProfileDto } from '../dto/update-profile.dto.js';
import type { BanUserDto } from '../dto/ban-user.dto.js';
import type { UserQueryDto } from '../dto/user-query.dto.js';
import type {
  MyProfile,
  PublicUserProfile,
  PaginatedResult,
} from '../types/user.types.js';

@Injectable()
export class UserService {
  private s3: S3Client;
  private bucket: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    this.s3 = new S3Client({
      region: config.get<string>('s3.region', 'ap-southeast-1'),
      credentials: {
        accessKeyId: config.get<string>('s3.accessKeyId', ''),
        secretAccessKey: config.get<string>('s3.secretAccessKey', ''),
      },
    });
    this.bucket = config.get<string>('s3.bucket', '');
  }

  async getMe(userId: number): Promise<MyProfile> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const { password: _password, ...safe } = user;
    return {
      ...safe,
      profile: user.profile
        ? {
            bio: user.profile.bio,
            website: user.profile.website,
            twitter: user.profile.twitter,
            discord: user.profile.discord,
          }
        : null,
    };
  }

  async getPublicProfile(uuid: string): Promise<PublicUserProfile> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.uuid, uuid),
      with: { profile: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    const [followsRow] = await this.db
      .select({ cnt: count() })
      .from(follows)
      .where(eq(follows.userId, user.id));

    return {
      uuid: user.uuid,
      name: user.name,
      avatar: user.avatar,
      bio: user.profile?.bio ?? null,
      joinedAt: user.createdAt,
      followsCount: followsRow?.cnt ?? 0,
    };
  }

  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<MyProfile> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');

    const { name, bio, website, twitter, discord } = dto;

    if (name !== undefined) {
      await this.db.update(users).set({ name }).where(eq(users.id, userId));
    }

    const profileFields = { bio, website, twitter, discord };
    const hasProfileUpdate = Object.values(profileFields).some(
      (v) => v !== undefined,
    );

    if (hasProfileUpdate) {
      const existing = await this.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
      });
      if (existing) {
        await this.db
          .update(userProfiles)
          .set(profileFields)
          .where(eq(userProfiles.userId, userId));
      } else {
        await this.db.insert(userProfiles).values({ userId, ...profileFields });
      }
    }

    return this.getMe(userId);
  }

  async uploadAvatar(
    userId: number,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<{ avatar: string }> {
    if (!file) throw new BadRequestException('No file provided');

    const resized = await sharp(file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const key = `avatars/${userId}.webp`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: resized,
        ContentType: 'image/webp',
      }),
    );

    const region = this.config.get<string>('s3.region', 'ap-southeast-1');
    const avatarUrl = `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;

    await this.db
      .update(users)
      .set({ avatar: avatarUrl })
      .where(eq(users.id, userId));

    return { avatar: avatarUrl };
  }

  // Admin methods
  async listUsers(
    query: UserQueryDto,
  ): Promise<PaginatedResult<Omit<typeof users.$inferSelect, 'password'>>> {
    const { page, limit, offset, search } = query;

    const where = search
      ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
      : undefined;

    const [totalRow, rows] = await Promise.all([
      this.db.select({ cnt: count() }).from(users).where(where),
      this.db
        .select({
          id: users.id,
          uuid: users.uuid,
          name: users.name,
          email: users.email,
          avatar: users.avatar,
          role: users.role,
          xp: users.xp,
          level: users.level,
          bannedUntil: users.bannedUntil,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          deletedAt: users.deletedAt,
          googleId: users.googleId,
        })
        .from(users)
        .where(where)
        .orderBy(sql`${users.createdAt} desc`)
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalRow[0]?.cnt ?? 0;
    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserById(id: number): Promise<
    Omit<typeof users.$inferSelect, 'password'> & {
      profile: typeof userProfiles.$inferSelect | null;
    }
  > {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
      with: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { password: _password, ...safe } = user;
    return { ...safe, profile: user.profile ?? null };
  }

  async banUser(id: number, dto: BanUserDto): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) throw new NotFoundException('User not found');

    const bannedUntil = dto.bannedUntil ? new Date(dto.bannedUntil) : null;
    await this.db.update(users).set({ bannedUntil }).where(eq(users.id, id));

    return {
      message: bannedUntil
        ? `User banned until ${bannedUntil.toISOString()}`
        : 'User unbanned',
    };
  }

  async deleteUser(id: number): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) throw new NotFoundException('User not found');

    await this.db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, id));
    return { message: 'User deleted' };
  }
}
