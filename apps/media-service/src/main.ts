/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Media Service')
    .setDescription('Médias, métadonnées et stockage objet')
    .setVersion('0.0.1')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const docsPath = `${globalPrefix}/docs`;
  // CORS limité à la doc Swagger : elle est consommée depuis la page agrégée
  // de l'api-gateway, sur un autre port. Le CORS applicatif reste porté par
  // le Gateway (cf. docs/architecture/microservices.md).
  app.use(
    [`/${docsPath}`, `/${docsPath}-json`],
    (_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      next();
    },
  );
  SwaggerModule.setup(docsPath, app, swaggerDocument);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`📘 Documentation Swagger : http://localhost:${port}/${docsPath}`);
}

bootstrap();
