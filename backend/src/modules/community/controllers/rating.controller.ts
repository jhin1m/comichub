import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatingService } from '../services/rating.service.js';
import { CreateRatingDto } from '../dto/create-rating.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { User } from '../../../database/schema/index.js';

@ApiTags('ratings')
@ApiBearerAuth()
@Controller('manga/:id')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post('rate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert rating for manga (0.5–5.0)' })
  upsert(
    @Param('id', ParseIntPipe) mangaId: number,
    @CurrentUser() user: User,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingService.upsert(mangaId, user.id, dto);
  }

  @Get('rating')
  @ApiOperation({ summary: "Get user's rating for manga" })
  getUserRating(
    @Param('id', ParseIntPipe) mangaId: number,
    @CurrentUser() user: User,
  ) {
    return this.ratingService.getUserRating(mangaId, user.id);
  }

  @Delete('rate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove rating' })
  async remove(
    @Param('id', ParseIntPipe) mangaId: number,
    @CurrentUser() user: User,
  ) {
    await this.ratingService.remove(mangaId, user.id);
  }
}
