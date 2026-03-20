import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpsertHistoryDto {
  @ApiProperty({ description: 'Manga ID' })
  @IsInt()
  @Min(1)
  mangaId!: number;

  @ApiPropertyOptional({ description: 'Chapter ID (optional)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  chapterId!: number;
}
