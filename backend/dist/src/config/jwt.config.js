"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtConfig = void 0;
const config_1 = require("@nestjs/config");
exports.jwtConfig = (0, config_1.registerAs)('jwt', () => {
    const isProd = process.env.NODE_ENV === 'production';
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (isProd && (!accessSecret || !refreshSecret)) {
        throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production');
    }
    return {
        accessSecret: accessSecret || 'dev-access-secret',
        refreshSecret: refreshSecret || 'dev-refresh-secret',
        accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    };
});
//# sourceMappingURL=jwt.config.js.map