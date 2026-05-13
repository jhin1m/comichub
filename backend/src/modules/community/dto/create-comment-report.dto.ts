import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CommentReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  SEXUAL_CONTENT = 'sexual_content',
  SPOILER = 'spoiler',
  MISINFORMATION = 'misinformation',
  OTHER = 'other',
}

export class CreateCommentReportDto {
  @ApiProperty({ enum: CommentReportReason })
  @IsEnum(CommentReportReason)
  reason!: CommentReportReason;

  @ApiPropertyOptional({ description: 'Optional free-text context (max 500)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
