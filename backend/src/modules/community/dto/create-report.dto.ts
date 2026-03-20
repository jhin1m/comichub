import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReportType {
  BROKEN_IMAGES = 'broken_images',
  WRONG_CHAPTER = 'wrong_chapter',
  DUPLICATE = 'duplicate',
  INAPPROPRIATE = 'inappropriate',
  SPAM = 'spam',
  OTHER = 'other',
}

export class CreateReportDto {
  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  type!: ReportType;

  @ApiPropertyOptional({ example: 'Images are broken on page 5' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
