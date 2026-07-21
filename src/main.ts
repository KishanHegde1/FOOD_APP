import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { PROFILE_PHOTO_UPLOAD_ROUTE } from './users/profile-photo-storage.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

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
        : process.env.NODE_ENV !== 'production',
    credentials: configuredOrigins.length > 0,
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

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
