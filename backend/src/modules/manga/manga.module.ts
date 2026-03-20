import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MangaController } from './controllers/manga.controller.js';
import { ChapterController } from './controllers/chapter.controller.js';
import { GenreController } from './controllers/genre.controller.js';
import { ArtistController } from './controllers/artist.controller.js';
import { AuthorController } from './controllers/author.controller.js';
import { GroupController } from './controllers/group.controller.js';
import { MangaService } from './services/manga.service.js';
import { ChapterService } from './services/chapter.service.js';
import { ChapterImageService } from './services/chapter-image.service.js';
import { ViewTrackingService } from './services/view-tracking.service.js';
import { TaxonomyService } from './services/taxonomy.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    MangaController,
    ChapterController,
    GenreController,
    ArtistController,
    AuthorController,
    GroupController,
  ],
  providers: [
    MangaService,
    ChapterService,
    ChapterImageService,
    ViewTrackingService,
    TaxonomyService,
  ],
})
export class MangaModule {}
