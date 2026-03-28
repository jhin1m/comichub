import {
  Controller,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { ContentPreferencesService } from '../services/content-preferences.service.js';
import { UpsertContentPreferencesDto } from '../dto/content-preferences.dto.js';

@ApiTags('users')
@Controller('users')
export class ContentPreferencesController {
  constructor(
    private readonly contentPreferencesService: ContentPreferencesService,
  ) {}

  @Get('preferences')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my content preferences' })
  getPreferences(@CurrentUser('sub') userId: number) {
    return this.contentPreferencesService.getByUserId(userId);
  }

  @Put('preferences')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert my content preferences' })
  @HttpCode(HttpStatus.OK)
  upsertPreferences(
    @CurrentUser('sub') userId: number,
    @Body() dto: UpsertContentPreferencesDto,
  ) {
    return this.contentPreferencesService.upsert(userId, dto);
  }
}
