import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';

export const DRIZZLE = Symbol('DRIZZLE');
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export type DrizzleDB = PostgresJsDatabase;

export const postgresClientProvider: Provider = {
  provide: POSTGRES_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Sql => {
    const url = config.getOrThrow<string>('database.url');
    return postgres(url);
  },
};

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [POSTGRES_CLIENT],
  useFactory: (client: Sql): DrizzleDB => {
    return drizzle(client);
  },
};
