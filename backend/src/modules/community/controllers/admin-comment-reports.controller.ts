import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { CommentReportsService } from '../services/comment-reports.service.js';
import { ResolveCommentReportDto } from '../dto/resolve-comment-report.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import type { User } from '../../../database/schema/index.js';

@ApiTags('admin-comment-reports')
@Controller('admin/comment-reports')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminCommentReportsController {
  constructor(private readonly service: CommentReportsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List comment reports (admin)' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'resolved', 'dismissed'] })
  list(
    @Query() pagination: PaginationDto,
    @Query('status') status?: 'pending' | 'resolved' | 'dismissed',
  ) {
    return this.service.listReports(pagination, status);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a report (admin)' })
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: User,
    @Body() dto: ResolveCommentReportDto,
  ) {
    return this.service.resolveReport(id, admin.id, dto);
  }
}
