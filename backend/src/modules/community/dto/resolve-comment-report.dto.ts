import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResolveCommentReportAction {
  DISMISS = 'dismiss',
  DELETE_COMMENT = 'delete_comment',
  WARN_USER = 'warn_user',
}

export class ResolveCommentReportDto {
  @ApiProperty({ enum: ResolveCommentReportAction })
  @IsEnum(ResolveCommentReportAction)
  action!: ResolveCommentReportAction;

  @ApiPropertyOptional({ description: 'Optional resolution note (max 500)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}
