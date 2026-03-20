import { OnModuleDestroy } from '@nestjs/common';
import type { Sql } from 'postgres';
export declare class DrizzleModule implements OnModuleDestroy {
    private readonly client;
    constructor(client: Sql);
    onModuleDestroy(): Promise<void>;
}
