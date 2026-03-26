import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ImportSource } from '../types/import-source.enum.js';

export class ImportMangaDto {
  @ApiProperty({ example: '12345', description: 'External ID from source API' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  externalId!: string;

  @ApiProperty({ enum: ImportSource, example: ImportSource.MANGABAKA })
  @IsEnum(ImportSource)
  source!: ImportSource;
}
