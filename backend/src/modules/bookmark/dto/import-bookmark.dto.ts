import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImportFormat {
  MAL_XML = 'mal-xml',
  MAL_JSON = 'mal-json',
}

export enum ImportStrategy {
  SKIP = 'skip',
  OVERWRITE = 'overwrite',
}

export class ImportBookmarkDto {
  @ApiProperty({ enum: ImportFormat })
  @IsEnum(ImportFormat)
  format: ImportFormat = ImportFormat.MAL_XML;

  @ApiPropertyOptional({ enum: ImportStrategy })
  @IsOptional()
  @IsEnum(ImportStrategy)
  strategy?: ImportStrategy = ImportStrategy.SKIP;
}

export enum ExportFormat {
  JSON = 'json',
  XML = 'xml',
}

export class ExportBookmarkDto {
  @ApiPropertyOptional({ enum: ExportFormat })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.JSON;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId?: number;
}
