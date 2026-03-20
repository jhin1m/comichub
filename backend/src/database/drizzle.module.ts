import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { drizzleProvider, postgresClientProvider, POSTGRES_CLIENT } from './drizzle.provider.js';
import type { Sql } from 'postgres';

@Global()
@Module({
  providers: [postgresClientProvider, drizzleProvider],
  exports: [drizzleProvider],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: Sql) {}

  async onModuleDestroy() {
    await this.client.end();
  }
}
