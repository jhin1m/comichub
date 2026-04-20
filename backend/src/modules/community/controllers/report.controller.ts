import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportService } from '../services/report.service.js';
import { CreateReportDto } from '../dto/create-report.dto.js';
import {
  UpdateReportStatusDto,
  ReportStatus,
} from '../dto/update-report-status.dto.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import type { User } from '../../../database/schema/index.js';

@ApiTags('reports')
@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // C3: 3 reports/min/user — keeps moderator queue clean, blocks harassment spam.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('chapters/:id/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit chapter report' })
  submit(
    @Param('id', ParseIntPipe) chapterId: number,
    @CurrentUser() user: User,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportService.submit(chapterId, user.id, dto);
  }

  @Get('reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'List all reports (admin)' })
  @ApiQuery({ name: 'status', enum: ReportStatus, required: false })
  list(
    @Query() pagination: PaginationDto,
    @Query('status') status?: ReportStatus,
  ) {
    return this.reportService.list(pagination, status);
  }

  @Patch('reports/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update report status (admin)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportService.updateStatus(id, dto);
  }

  @Delete('reports/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete report (admin)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.reportService.remove(id);
  }
}
