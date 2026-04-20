import { Global, Module } from '@nestjs/common';
import { ReadinessService } from './services/readiness.service.js';

@Global()
@Module({
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class CommonModule {}
