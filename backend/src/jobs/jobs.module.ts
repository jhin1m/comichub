import { Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module.js';
import { MangaModule } from '../modules/manga/manga.module.js';
import { ViewCounterResetJob } from './view-counter-reset.job.js';
import { CounterFlushJob } from './counter-flush.job.js';
import { CacheInvalidationJob } from './cache-invalidation.job.js';
import { CacheWarmupJob } from './cache-warmup.job.js';
import { ImageMirrorJob } from './image-mirror.job.js';

@Module({
  imports: [AuthModule, MangaModule],
  providers: [
    ViewCounterResetJob,
    CounterFlushJob,
    CacheInvalidationJob,
    CacheWarmupJob,
    ImageMirrorJob,
  ],
})
export class JobsModule {}
