import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RankingService } from '../modules/manga/services/ranking.service.js';
import { TaxonomyService } from '../modules/manga/services/taxonomy.service.js';
import { ReadinessService } from '../common/services/readiness.service.js';

@Injectable()
export class CacheWarmupJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmupJob.name);

  constructor(
    private readonly rankingService: RankingService,
    private readonly taxonomyService: TaxonomyService,
    private readonly readiness: ReadinessService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await Promise.all([
        this.rankingService.getRanking('daily'),
        this.rankingService.getRanking('weekly'),
        this.rankingService.getRanking('alltime'),
        this.rankingService.getRanking('toprated'),
        this.taxonomyService.findAll('genres'),
      ]);
      this.logger.log('Cache warmup completed (rankings + genres)');
    } catch (err) {
      this.logger.warn('Cache warmup failed (non-blocking)', err);
    } finally {
      // Always flip readiness — even on warmup failure, app can serve cold.
      // Avoiding permanent 503 is more important than perfect cache state.
      this.readiness.setReady();
    }
  }
}
