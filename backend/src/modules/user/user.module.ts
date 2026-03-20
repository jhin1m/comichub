import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UserService } from './services/user.service.js';
import { FollowService } from './services/follow.service.js';
import { HistoryService } from './services/history.service.js';
import { UserController } from './controllers/user.controller.js';
import { FollowController } from './controllers/follow.controller.js';
import { HistoryController } from './controllers/history.controller.js';
import { AdminUserController } from './controllers/admin-user.controller.js';

@Module({
  imports: [AuthModule],
  providers: [UserService, FollowService, HistoryService],
  controllers: [
    UserController,
    FollowController,
    HistoryController,
    AdminUserController,
  ],
  exports: [UserService, FollowService, HistoryService],
})
export class UserModule {}
