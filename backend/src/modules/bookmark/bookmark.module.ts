import { Module, forwardRef } from '@nestjs/common';
import { UserModule } from '../user/user.module.js';
import { BookmarkService } from './services/bookmark.service.js';
import { FolderService } from './services/folder.service.js';
import { ImportExportService } from './services/import-export.service.js';
import { BookmarkController } from './controllers/bookmark.controller.js';
import { FolderController } from './controllers/folder.controller.js';
import { ImportExportController } from './controllers/import-export.controller.js';

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [FolderController, BookmarkController, ImportExportController],
  providers: [BookmarkService, FolderService, ImportExportService],
  exports: [BookmarkService, FolderService, ImportExportService],
})
export class BookmarkModule {}
