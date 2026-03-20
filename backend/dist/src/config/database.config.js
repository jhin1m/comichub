"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const config_1 = require("@nestjs/config");
exports.databaseConfig = (0, config_1.registerAs)('database', () => {
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error('DATABASE_URL is required');
    return { url };
});
//# sourceMappingURL=database.config.js.map