"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Config = void 0;
const config_1 = require("@nestjs/config");
exports.s3Config = (0, config_1.registerAs)('s3', () => ({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket: process.env.AWS_S3_BUCKET || '',
    region: process.env.AWS_S3_REGION || 'ap-southeast-1',
}));
//# sourceMappingURL=s3.config.js.map