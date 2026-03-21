import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RankingService } from '../modules/manga/services/ranking.service.js';
import { TaxonomyService } from '../modules/manga/services/taxonomy.service.js';

@Injectable()
export class CacheWarmupJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmupJob.name);

  constructor(
    private readonly rankingService: RankingService,
    private readonly taxonomyService: TaxonomyService,
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
    }
  }
}
