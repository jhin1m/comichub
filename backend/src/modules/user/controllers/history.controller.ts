import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { HistoryService } from '../services/history.service.js';
import { UpsertHistoryDto } from '../dto/upsert-history.dto.js';
import type { JwtPayload } from '../../auth/types/jwt-payload.type.js';

@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert reading history (manga_id + chapter_id)' })
  @HttpCode(HttpStatus.OK)
  upsert(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertHistoryDto,
  ) {
    return this.historyService.upsert(user.sub, dto);
  }
}
