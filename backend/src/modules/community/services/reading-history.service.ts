import { Injectable } from '@nestjs/common';
import { HistoryService } from '../../user/services/history.service.js';
import type { PaginationDto } from '../../../common/dto/pagination.dto.js';

export interface UpsertReadingHistoryDto {
  mangaId: number;
  chapterId?: number;
}

/**
 * Community reading history service — delegates to user module's HistoryService
 * to avoid duplicate logic. Keeps the interface expected by community controller.
 */
@Injectable()
export class ReadingHistoryService {
  constructor(private readonly historyService: HistoryService) {}

  async upsert(userId: number, dto: UpsertReadingHistoryDto) {
    return this.historyService.upsert(userId, {
      mangaId: dto.mangaId,
      chapterId: dto.chapterId as number,
    });
  }

  async getHistory(userId: number, pagination: PaginationDto) {
    return this.historyService.getHistory(userId, pagination);
  }

  async removeEntry(userId: number, mangaId: number) {
    return this.historyService.removeEntry(userId, mangaId);
  }
}
