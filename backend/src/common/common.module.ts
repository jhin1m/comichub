import { Global, Module } from '@nestjs/common';
import { ReadinessService } from './services/readiness.service.js';
import { DiagnosticController } from './controllers/diagnostic.controller.js';

// B-C2: DiagnosticController exposes trust-proxy hops + XFF chain.
// Only register it outside production so the route does not exist on prod
// (defence-in-depth beyond the in-controller NotFoundException guard).
const isProd = process.env.NODE_ENV === 'production';

@Global()
@Module({
  controllers: isProd ? [] : [DiagnosticController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class CommonModule {}
