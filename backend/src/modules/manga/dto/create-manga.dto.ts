import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  IsBoolean,
  MaxLength,
  IsNotEmpty,
  Max,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MangaStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  HIATUS = 'hiatus',
  DROPPED = 'dropped',
}

export enum MangaType {
  MANGA = 'manga',
  MANHWA = 'manhwa',
  MANHUA = 'manhua',
  DOUJINSHI = 'doujinshi',
}

export class CreateMangaDto {
  @ApiProperty({ example: 'One Piece' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ example: 'one-piece' })
  @IsOptional()
  @IsString()
  @MaxLength(520)
  slug?: string;

  @ApiPropertyOptional({ example: ['ワンピース', 'One Piece'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  altTitles?: string[];

  @ApiPropertyOptional({ example: 'A pirate adventure...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://s3.../cover.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover?: string;

  @ApiPropertyOptional({
    example: 'ja',
    description: 'ISO 639-1 language code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  originalLanguage?: string;

  @ApiPropertyOptional({ enum: MangaStatus, default: MangaStatus.ONGOING })
  @IsOptional()
  @IsEnum(MangaStatus)
  status?: MangaStatus;

  @ApiPropertyOptional({ enum: MangaType, default: MangaType.MANGA })
  @IsOptional()
  @IsEnum(MangaType)
  type?: MangaType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isNsfw?: boolean;

  @ApiPropertyOptional({
    description: 'Demographic (shounen, shoujo, seinen, josei)',
    enum: ['shounen', 'shoujo', 'seinen', 'josei'],
  })
  @IsOptional()
  @IsIn(['shounen', 'shoujo', 'seinen', 'josei'], {
    message: 'demographic must be one of: shounen, shoujo, seinen, josei',
  })
  demographic?: string;

  @ApiPropertyOptional({ example: 2020 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  genreIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  artistIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  authorIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  groupIds?: number[];
}
