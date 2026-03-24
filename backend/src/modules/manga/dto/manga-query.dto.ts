import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsBoolean,
  IsNumber,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { MangaStatus, MangaType } from './create-manga.dto.js';

export enum MangaSortField {
  VIEWS = 'views',
  TRENDING = 'trending',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class MangaQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MangaStatus })
  @IsOptional()
  @IsEnum(MangaStatus)
  status?: MangaStatus;

  @ApiPropertyOptional({ enum: MangaType })
  @IsOptional()
  @IsEnum(MangaType)
  type?: MangaType;

  @ApiPropertyOptional({ description: 'Genre slug' })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({ description: 'Artist ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  artist?: number;

  @ApiPropertyOptional({ description: 'Author ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  author?: number;

  @ApiPropertyOptional({
    description: 'Original language code (e.g. ja, ko, zh)',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Publication year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Filter NSFW content' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  nsfw?: boolean;

  @ApiPropertyOptional({
    enum: MangaSortField,
    default: MangaSortField.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(MangaSortField)
  sort?: MangaSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;

  @ApiPropertyOptional({
    description: 'Comma-separated genre slugs to include (AND logic, max 10)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+(,[a-z0-9-]+)*$/, {
    message: 'includeGenres must be comma-separated lowercase slugs',
  })
  includeGenres?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated genre slugs to exclude (max 10)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+(,[a-z0-9-]+)*$/, {
    message: 'excludeGenres must be comma-separated lowercase slugs',
  })
  excludeGenres?: string;

  @ApiPropertyOptional({
    description: 'Demographic filter (shounen, shoujo, seinen, josei)',
    enum: ['shounen', 'shoujo', 'seinen', 'josei'],
  })
  @IsOptional()
  @IsIn(['shounen', 'shoujo', 'seinen', 'josei'], {
    message: 'demographic must be one of: shounen, shoujo, seinen, josei',
  })
  demographic?: string;

  @ApiPropertyOptional({ description: 'Year range start' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearFrom?: number;

  @ApiPropertyOptional({ description: 'Year range end' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearTo?: number;

  @ApiPropertyOptional({ description: 'Minimum chapter count' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minChapter?: number;

  @ApiPropertyOptional({ description: 'Minimum average rating (0-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Comma-separated manga types to exclude (e.g. manhwa,doujinshi)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]+(,[a-z]+)*$/, {
    message: 'excludeTypes must be comma-separated lowercase type values',
  })
  excludeTypes?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated demographics to exclude (e.g. shoujo,josei)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]+(,[a-z]+)*$/, {
    message: 'excludeDemographics must be comma-separated lowercase values',
  })
  excludeDemographics?: string;
}
