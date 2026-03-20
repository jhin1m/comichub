import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StickerService } from '../services/sticker.service.js';
import {
  CreateStickerSetDto,
  UpdateStickerSetDto,
  CreateStickerDto,
} from '../dto/sticker.dto.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';

@ApiTags('stickers')
@Controller('sticker-sets')
export class StickerController {
  constructor(private readonly stickerService: StickerService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active sticker sets' })
  listSets() {
    return this.stickerService.listSets();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get sticker set with stickers' })
  getSet(@Param('id', ParseIntPipe) id: number) {
    return this.stickerService.getSet(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create sticker set (admin)' })
  createSet(@Body() dto: CreateStickerSetDto) {
    return this.stickerService.createSet(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update sticker set (admin)' })
  updateSet(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStickerSetDto,
  ) {
    return this.stickerService.updateSet(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete sticker set (admin)' })
  async removeSet(@Param('id', ParseIntPipe) id: number) {
    await this.stickerService.removeSet(id);
  }

  @Post(':id/stickers')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Add sticker to set (admin)' })
  addSticker(
    @Param('id', ParseIntPipe) setId: number,
    @Body() dto: CreateStickerDto,
  ) {
    return this.stickerService.addSticker(setId, dto);
  }

  @Delete('stickers/:stickerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Remove sticker (admin)' })
  async removeSticker(@Param('stickerId', ParseIntPipe) stickerId: number) {
    await this.stickerService.removeSticker(stickerId);
  }
}
