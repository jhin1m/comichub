import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ImportSource } from '../types/import-source.enum.js';

export class ImportSearchDto {
  @ApiProperty({ example: 'One Piece', description: 'Search query' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  q!: string;

  @ApiProperty({ enum: ImportSource, example: ImportSource.MANGABAKA })
  @IsEnum(ImportSource)
  source!: ImportSource;
}
