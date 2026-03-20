import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/types/jwt-payload.type.js';
import { NotificationService } from './notification.service.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications (paginated, newest first)' })
  list(@CurrentUser() user: JwtPayload, @Query() query: NotificationQueryDto) {
    return this.notificationService.list(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationService.getUnreadCount(user.sub);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationService.markRead(user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @HttpCode(HttpStatus.OK)
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationService.delete(user.sub, id);
  }
}
