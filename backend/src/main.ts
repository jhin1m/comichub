import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const isProd = nodeEnv === 'production';

  app.enableShutdownHooks();

  // Trust proxy — Cloudflare → Caddy → Node (2 hops by default).
  // Required for correct req.ip and for ThrottlerGuard to rate-limit by real client IP.
  const trustProxyHops = configService.get<number>('app.trustProxy', 2);
  app.set('trust proxy', trustProxyHops);

  // Helmet — security headers (CSP/HSTS/X-Frame-Options/nosniff/referrer-policy).
  // Prod: strict Helmet defaults. Dev: relaxed directives so Swagger UI's inline
  // scripts/styles + external validator can load. Never set CSP to `false`
  // (CWE-1021/693 — keeps the directive enforced in every environment).
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? undefined
        : {
            directives: {
              defaultSrc: [`'self'`],
              styleSrc: [`'self'`, `'unsafe-inline'`],
              imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
              scriptSrc: [`'self'`, `'unsafe-inline'`],
            },
          },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Compression — reduces JSON payload size ~70-80%, skip small responses
  app.use(compression({ threshold: 1024 }));

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS — explicit allowlist. Reflected-origin with credentials is forbidden.
  // B-C1: pass (null, false) on rejection — throwing Error here produces HTTP 500
  // instead of a clean CORS block, breaking every cross-origin preflight UX.
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });

  // Swagger — dev/staging only
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle(`${configService.get<string>('app.name', 'ComicHub')} API`)
      .setDescription('Manga/Comic platform REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  const appName = configService.get<string>('app.name', 'ComicHub');
  logger.log(`${appName} API running on http://localhost:${port}`);
  logger.log(
    `trust proxy=${trustProxyHops} · CORS origins=[${corsOrigins.join(', ')}]`,
  );
  if (!isProd) {
    logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
