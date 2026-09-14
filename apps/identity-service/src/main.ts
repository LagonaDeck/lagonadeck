/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Identity Service')
    .setDescription(
      'Utilisateurs, authentification, workspaces, rôles et permissions',
    )
    .setVersion('0.0.1')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const docsPath = `${globalPrefix}/docs`;
  // CORS limité à la doc Swagger : elle est consommée depuis la page agrégée
  // de l'api-gateway, sur un autre port. Le CORS applicatif reste porté par
  // le Gateway (cf. docs/architecture/microservices.md).
  app.use([`/${docsPath}`, `/${docsPath}-json`], (_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });
  SwaggerModule.setup(docsPath, app, swaggerDocument);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`📘 Documentation Swagger : http://localhost:${port}/${docsPath}`);
}

bootstrap();
