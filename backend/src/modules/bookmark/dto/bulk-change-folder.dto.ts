import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkChangeFolderDto {
  @ApiProperty({
    description: 'List of manga IDs whose folder should change',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  mangaIds!: number[];

  @ApiProperty({ description: 'Target folder ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId!: number;
}
