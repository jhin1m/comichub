import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsArray, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { MangaStatus, MangaType } from '../../manga/dto/create-manga.dto.js';

export enum SearchSortField {
  VIEWS = 'views',
  UPDATED_AT = 'updated_at',
  CREATED_AT = 'created_at',
  RATING = 'rating',
}

export class SearchQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search query string', minLength: 1, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by genre slugs (comma-separated or repeated)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  genre?: string[];

  @ApiPropertyOptional({ enum: MangaStatus })
  @IsOptional()
  @IsEnum(MangaStatus)
  status?: MangaStatus;

  @ApiPropertyOptional({ enum: MangaType })
  @IsOptional()
  @IsEnum(MangaType)
  type?: MangaType;

  @ApiPropertyOptional({ enum: SearchSortField, default: SearchSortField.VIEWS })
  @IsOptional()
  @IsEnum(SearchSortField)
  sort?: SearchSortField;
}
