import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

  app.enableShutdownHooks();

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

  // CORS — restrict in production
  app.enableCors({
    origin:
      nodeEnv === 'production'
        ? configService.get<string>('app.frontendUrl', 'http://localhost:3000')
        : true,
    credentials: true,
  });

  // Swagger — dev/staging only
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ComicHub API')
      .setDescription('Manga/Comic platform REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  console.log(`ComicHub API running on http://localhost:${port}`);
  if (nodeEnv !== 'production') {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
