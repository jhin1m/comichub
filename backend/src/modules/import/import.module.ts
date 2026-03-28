import { Module } from '@nestjs/common';
import { MangaModule } from '../manga/manga.module.js';
import { ImportService } from './services/import.service.js';
import { ImportMappingService } from './services/import-mapping.service.js';
import { MangaBakaAdapter } from './adapters/mangabaka.adapter.js';
import { WeebDexAdapter } from './adapters/weebdex.adapter.js';
import { ImportController } from './controllers/import.controller.js';

@Module({
  imports: [MangaModule],
  controllers: [ImportController],
  providers: [
    ImportService,
    ImportMappingService,
    MangaBakaAdapter,
    WeebDexAdapter,
  ],
  exports: [ImportService],
})
export class ImportModule {}
