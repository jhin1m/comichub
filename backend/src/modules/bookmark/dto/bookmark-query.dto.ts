import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export enum BookmarkSortBy {
  UPDATED = 'updated',
  LAST_READ = 'lastRead',
  ADDED = 'added',
  TITLE = 'title',
}

export enum BookmarkSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class BookmarkQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by folder ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId?: number;

  @ApiPropertyOptional({ description: 'Search by manga title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: BookmarkSortBy,
    default: BookmarkSortBy.UPDATED,
  })
  @IsOptional()
  @IsEnum(BookmarkSortBy)
  sortBy?: BookmarkSortBy;

  @ApiPropertyOptional({
    enum: BookmarkSortOrder,
    default: BookmarkSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(BookmarkSortOrder)
  sortOrder?: BookmarkSortOrder;

  @ApiPropertyOptional({
    description: 'Comma-separated manga types (manga,manhwa,manhua,doujinshi)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]+(,[a-z]+)*$/)
  types?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated genre slugs to include',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+(,[a-z0-9-]+)*$/)
  genres?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated genre slugs to exclude',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+(,[a-z0-9-]+)*$/)
  excludedGenres?: string;

  @ApiPropertyOptional({
    description: 'Demographic filter (shounen,shoujo,seinen,josei)',
  })
  @IsOptional()
  @IsString()
  demographic?: string;

  @ApiPropertyOptional({
    description: 'Manga status (ongoing,completed,hiatus,dropped,cancelled)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Minimum chapter count' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minChapters?: number;

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

  @ApiPropertyOptional({ description: 'Comma-separated author IDs' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(,\d+)*$/)
  authors?: string;

  @ApiPropertyOptional({ description: 'Comma-separated artist IDs' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(,\d+)*$/)
  artists?: string;

  @ApiPropertyOptional({ description: 'Minimum average rating (0-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
}
