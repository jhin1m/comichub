import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { UserService } from '../services/user.service.js';
import { BanUserDto } from '../dto/ban-user.dto.js';
import { UserQueryDto } from '../dto/user-query.dto.js';

@ApiTags('admin-users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (paginated, searchable)' })
  listUsers(@Query() query: UserQueryDto) {
    return this.userService.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserById(id);
  }

  @Patch(':id/ban')
  @ApiOperation({ summary: 'Ban or unban a user' })
  @HttpCode(HttpStatus.OK)
  banUser(@Param('id', ParseIntPipe) id: number, @Body() dto: BanUserDto) {
    return this.userService.banUser(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a user' })
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUser(id);
  }
}
