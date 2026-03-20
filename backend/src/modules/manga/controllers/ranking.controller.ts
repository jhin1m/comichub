import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RankingService } from '../services/ranking.service.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

@ApiTags('rankings')
@Controller('manga')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Public()
  @Get('hot')
  @ApiOperation({ summary: 'Get hot manga list (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated hot manga' })
  getHot(@Query() query: PaginationDto) {
    return this.rankingService.getHotManga(query.page, query.limit);
  }

  @Public()
  @Get('rankings/daily')
  @ApiOperation({ summary: 'Daily top 20 manga by views_day' })
  @ApiResponse({ status: 200, description: 'Daily ranking' })
  getDaily() {
    return this.rankingService.getRanking('daily');
  }

  @Public()
  @Get('rankings/weekly')
  @ApiOperation({ summary: 'Weekly top 20 manga by views_week' })
  @ApiResponse({ status: 200, description: 'Weekly ranking' })
  getWeekly() {
    return this.rankingService.getRanking('weekly');
  }

  @Public()
  @Get('rankings/alltime')
  @ApiOperation({ summary: 'All-time top 20 manga by total views' })
  @ApiResponse({ status: 200, description: 'All-time ranking' })
  getAllTime() {
    return this.rankingService.getRanking('alltime');
  }

  @Public()
  @Get('rankings/toprated')
  @ApiOperation({ summary: 'Top-rated manga (min 10 ratings)' })
  @ApiResponse({ status: 200, description: 'Top-rated ranking' })
  getTopRated() {
    return this.rankingService.getRanking('toprated');
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Patch(':id/hot')
  @ApiOperation({ summary: 'Toggle is_hot flag on manga (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Hot status toggled' })
  @ApiResponse({ status: 404, description: 'Manga not found' })
  toggleHot(@Param('id', ParseIntPipe) id: number) {
    return this.rankingService.toggleHot(id);
  }
}
