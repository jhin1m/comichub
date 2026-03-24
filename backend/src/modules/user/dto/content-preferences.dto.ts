import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
  IsIn,
} from 'class-validator';

const VALID_TYPES = ['manga', 'manhwa', 'manhua', 'doujinshi'];
const VALID_DEMOGRAPHICS = ['shounen', 'shoujo', 'seinen', 'josei'];

export class UpsertContentPreferencesDto {
  @ApiPropertyOptional({ description: 'Hide NSFW content' })
  @IsOptional()
  @IsBoolean()
  hideNsfw?: boolean;

  @ApiPropertyOptional({
    description: 'Excluded manga types',
    enum: VALID_TYPES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(VALID_TYPES, { each: true })
  excludedTypes?: string[];

  @ApiPropertyOptional({
    description: 'Excluded demographics',
    enum: VALID_DEMOGRAPHICS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(VALID_DEMOGRAPHICS, { each: true })
  excludedDemographics?: string[];

  @ApiPropertyOptional({ description: 'Excluded genre slugs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedGenreSlugs?: string[];

  @ApiPropertyOptional({
    description: 'Highlighted genre slugs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlightedGenreSlugs?: string[];
}
