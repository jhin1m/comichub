import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateFolderDto {
  @ApiPropertyOptional({ example: 'Favorites', maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
