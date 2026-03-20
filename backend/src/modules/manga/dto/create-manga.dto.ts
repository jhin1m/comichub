import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  MaxLength,
  IsNotEmpty,
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

  @ApiPropertyOptional({ example: 'ワンピース' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleAlt?: string;

  @ApiPropertyOptional({ example: 'A pirate adventure...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://s3.../cover.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover?: string;

  @ApiPropertyOptional({ enum: MangaStatus, default: MangaStatus.ONGOING })
  @IsOptional()
  @IsEnum(MangaStatus)
  status?: MangaStatus;

  @ApiPropertyOptional({ enum: MangaType, default: MangaType.MANGA })
  @IsOptional()
  @IsEnum(MangaType)
  type?: MangaType;

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
