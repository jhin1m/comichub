"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_js_1 = require("./app.module.js");
const http_exception_filter_js_1 = require("./common/filters/http-exception.filter.js");
const transform_interceptor_js_1 = require("./common/interceptors/transform.interceptor.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const nodeEnv = configService.get('app.nodeEnv', 'development');
    app.enableShutdownHooks();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new http_exception_filter_js_1.HttpExceptionFilter());
    app.useGlobalInterceptors(new transform_interceptor_js_1.TransformInterceptor());
    app.enableCors({
        origin: nodeEnv === 'production' ? false : true,
    });
    if (nodeEnv !== 'production') {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('ComicHub API')
            .setDescription('Manga/Comic platform REST API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    const port = configService.get('app.port', 3000);
    await app.listen(port);
    console.log(`ComicHub API running on http://localhost:${port}`);
    if (nodeEnv !== 'production') {
        console.log(`Swagger docs at http://localhost:${port}/api/docs`);
    }
}
void bootstrap();
//# sourceMappingURL=main.js.map