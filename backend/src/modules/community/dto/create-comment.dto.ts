import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export enum CommentableType {
  MANGA = 'manga',
  CHAPTER = 'chapter',
}

export class CreateCommentDto {
  @ApiProperty({ enum: CommentableType })
  @IsEnum(CommentableType)
  commentableType!: CommentableType;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  commentableId!: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number;

  @ApiProperty({ example: 'Great manga!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export enum CommentSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  BEST = 'best',
}

export class CommentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CommentSort, default: CommentSort.NEWEST })
  @IsOptional()
  @IsEnum(CommentSort)
  sort?: CommentSort = CommentSort.NEWEST;
}
