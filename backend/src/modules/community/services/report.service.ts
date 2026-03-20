import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { chapterReports } from '../../../database/schema/community.schema.js';
import { chapters } from '../../../database/schema/manga.schema.js';
import { CreateReportDto } from '../dto/create-report.dto.js';
import { UpdateReportStatusDto, ReportStatus } from '../dto/update-report-status.dto.js';
import type { PaginationDto } from '../../../common/dto/pagination.dto.js';

@Injectable()
export class ReportService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async submit(chapterId: number, userId: number, dto: CreateReportDto) {
    const [chapter] = await this.db
      .select({ id: chapters.id })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (!chapter) throw new NotFoundException('Chapter not found');

    const [report] = await this.db
      .insert(chapterReports)
      .values({
        userId,
        chapterId,
        type: dto.type,
        description: dto.description ?? null,
        status: 'pending',
      })
      .returning();

    return report;
  }

  async list(pagination: PaginationDto, status?: ReportStatus) {
    const baseQuery = this.db.select().from(chapterReports);

    if (status) {
      return baseQuery
        .where(eq(chapterReports.status, status))
        .limit(pagination.limit)
        .offset(pagination.offset)
        .orderBy(chapterReports.createdAt);
    }

    return baseQuery
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(chapterReports.createdAt);
  }

  async updateStatus(reportId: number, dto: UpdateReportStatusDto) {
    const [existing] = await this.db
      .select()
      .from(chapterReports)
      .where(eq(chapterReports.id, reportId))
      .limit(1);

    if (!existing) throw new NotFoundException('Report not found');

    const [updated] = await this.db
      .update(chapterReports)
      .set({ status: dto.status })
      .where(eq(chapterReports.id, reportId))
      .returning();

    return updated;
  }

  async remove(reportId: number) {
    const [existing] = await this.db
      .select()
      .from(chapterReports)
      .where(eq(chapterReports.id, reportId))
      .limit(1);

    if (!existing) throw new NotFoundException('Report not found');

    await this.db
      .delete(chapterReports)
      .where(eq(chapterReports.id, reportId));
  }
}
