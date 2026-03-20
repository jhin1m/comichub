import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { MangaStatus, MangaType } from './create-manga.dto.js';

export enum MangaSortField {
  VIEWS = 'views',
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

  @ApiPropertyOptional({ enum: MangaSortField, default: MangaSortField.UPDATED_AT })
  @IsOptional()
  @IsEnum(MangaSortField)
  sort?: MangaSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
