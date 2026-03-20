"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.drizzleProvider = exports.postgresClientProvider = exports.POSTGRES_CLIENT = exports.DRIZZLE = void 0;
const config_1 = require("@nestjs/config");
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
exports.DRIZZLE = Symbol('DRIZZLE');
exports.POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');
exports.postgresClientProvider = {
    provide: exports.POSTGRES_CLIENT,
    inject: [config_1.ConfigService],
    useFactory: (config) => {
        const url = config.getOrThrow('database.url');
        return (0, postgres_1.default)(url);
    },
};
exports.drizzleProvider = {
    provide: exports.DRIZZLE,
    inject: [exports.POSTGRES_CLIENT],
    useFactory: (client) => {
        return (0, postgres_js_1.drizzle)(client);
    },
};
//# sourceMappingURL=drizzle.provider.js.map