import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { FolderService } from '../services/folder.service.js';
import { CreateFolderDto } from '../dto/create-folder.dto.js';
import { UpdateFolderDto } from '../dto/update-folder.dto.js';
import type { JwtPayload } from '../../auth/types/jwt-payload.type.js';

@ApiTags('bookmark-folders')
@ApiBearerAuth()
@Controller('bookmarks/folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  @ApiOperation({ summary: 'List user bookmark folders with counts' })
  getUserFolders(@CurrentUser() user: JwtPayload) {
    return this.folderService.getUserFolders(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create custom bookmark folder' })
  createFolder(@CurrentUser() user: JwtPayload, @Body() dto: CreateFolderDto) {
    return this.folderService.createFolder(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update custom bookmark folder' })
  updateFolder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folderService.updateFolder(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete custom bookmark folder' })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFolder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.folderService.deleteFolder(user.sub, id);
  }
}
