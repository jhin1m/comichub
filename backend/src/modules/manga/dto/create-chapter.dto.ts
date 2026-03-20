import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateChapterDto {
  @ApiProperty({ example: 1.5, description: 'Chapter number (supports decimals like 1.5)' })
  @IsNumber()
  @Min(0)
  @Max(99999)
  number!: number;

  @ApiPropertyOptional({ example: 'The Beginning' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 1, description: 'Display order (defaults to number * 10)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
