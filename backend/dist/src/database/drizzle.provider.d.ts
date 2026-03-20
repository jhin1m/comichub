import { Provider } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export declare const DRIZZLE: unique symbol;
export declare const POSTGRES_CLIENT: unique symbol;
export type DrizzleDB = PostgresJsDatabase;
export declare const postgresClientProvider: Provider;
export declare const drizzleProvider: Provider;
