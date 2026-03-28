import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ChangeFolderDto {
  @ApiProperty({ description: 'Target folder ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId!: number;
}
