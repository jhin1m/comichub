import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Logger as DrizzleLoggerInterface } from 'drizzle-orm';
import postgres, { Sql } from 'postgres';
import * as schema from './schema/index.js';

export const DRIZZLE = Symbol('DRIZZLE');
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

/** Logs all SQL queries in development via NestJS logger */
class DevQueryLogger implements DrizzleLoggerInterface {
  private readonly logger = new Logger('SQL');
  logQuery(query: string, params: unknown[]): void {
    this.logger.debug(`${query} -- params(${params.length})`);
  }
}

export const postgresClientProvider: Provider = {
  provide: POSTGRES_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Sql => {
    const url = config.getOrThrow<string>('database.url');
    const ssl = config.get<'require' | undefined>('database.ssl');
    return postgres(url, {
      ssl,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  },
};

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [POSTGRES_CLIENT, ConfigService],
  useFactory: (client: Sql, config: ConfigService): DrizzleDB => {
    const isDev = config.get<string>('app.nodeEnv', 'development') !== 'production';
    return drizzle(client, {
      schema,
      logger: isDev ? new DevQueryLogger() : false,
    });
  },
};
