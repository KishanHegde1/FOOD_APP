import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { parseCorsOrigins } from './config/env.utils';
import { PROFILE_PHOTO_UPLOAD_ROUTE } from './users/profile-photo-storage.service';

async function bootstrap() {
  const environment = process.env.NODE_ENV ?? 'development';
  const isProduction = environment === 'production';
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: isProduction ? ['error', 'warn'] : ['error', 'warn', 'log'],
  });
  const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

  app.use(helmet());
  app.use(
    PROFILE_PHOTO_UPLOAD_ROUTE,
    express.static(join(process.cwd(), 'uploads', 'profile-photos'), {
      dotfiles: 'deny',
      fallthrough: false,
      immutable: true,
      index: false,
      maxAge: '30d',
    }),
  );
  app.enableCors({
    origin:
      configuredOrigins.length > 0
        ? configuredOrigins
        : isProduction
          ? false
          : true,
    credentials: configuredOrigins.length > 0,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Idempotency-Key',
    ],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Food Delivery API')
    .setDescription('Food delivery backend API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID token',
      },
      'firebase-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port, '0.0.0.0');
  console.log(
    `food-app-backend started environment=${environment} port=${port}`,
  );
}
void bootstrap();
