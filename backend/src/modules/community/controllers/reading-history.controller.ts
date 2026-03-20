import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReadingHistoryService } from '../services/reading-history.service.js';
import type { UpsertReadingHistoryDto } from '../services/reading-history.service.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { User } from '../../../database/schema/index.js';

@ApiTags('reading-history')
@ApiBearerAuth()
@Controller('users/me/reading-history')
export class ReadingHistoryController {
  constructor(private readonly historyService: ReadingHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get reading history' })
  getHistory(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    return this.historyService.getHistory(user.id, pagination);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert reading history entry' })
  upsert(@CurrentUser() user: User, @Body() dto: UpsertReadingHistoryDto) {
    return this.historyService.upsert(user.id, dto);
  }

  @Delete(':mangaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove reading history entry' })
  async remove(
    @CurrentUser() user: User,
    @Param('mangaId', ParseIntPipe) mangaId: number,
  ) {
    await this.historyService.removeEntry(user.id, mangaId);
  }
}
