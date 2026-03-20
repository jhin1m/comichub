"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConfig = void 0;
const config_1 = require("@nestjs/config");
exports.redisConfig = (0, config_1.registerAs)('redis', () => ({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
}));
//# sourceMappingURL=redis.config.js.map