import { Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module.js';
import { ViewCounterResetJob } from './view-counter-reset.job.js';

@Module({
  imports: [AuthModule],
  providers: [ViewCounterResetJob],
})
export class JobsModule {}
