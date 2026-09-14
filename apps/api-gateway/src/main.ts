/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

// Ports fixés par infrastructure/docker-compose.dev.yml.
const AGGREGATED_SERVICES = [
  { name: 'API Gateway', port: 3000 },
  { name: 'Identity Service', port: 3001 },
  { name: 'Catalog Service', port: 3002 },
  { name: 'Inventory Service', port: 3003 },
  { name: 'Sales Service', port: 3004 },
  { name: 'Analytics Service', port: 3005 },
  { name: 'Media Service', port: 3006 },
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription("Point d'entrée HTTP du système LagonaDeck")
    .setVersion('0.0.1')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const docsPath = `${globalPrefix}/docs`;
  SwaggerModule.setup(docsPath, app, swaggerDocument);

  // Page unique agrégeant la documentation de tous les services, via le
  // sélecteur multi-spécifications natif de Swagger UI (menu déroulant).
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      urls: AGGREGATED_SERVICES.map((service) => ({
        name: service.name,
        url: `http://localhost:${service.port}/${docsPath}-json`,
      })),
    },
    // Le CSS par défaut de @nestjs/swagger masque cette barre (pensé pour
    // le cas mono-spécification) ; on la réaffiche pour le sélecteur multi-services.
    customCss:
      '.swagger-ui .topbar .download-url-wrapper { display: flex !important; }',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`📘 Documentation Swagger : http://localhost:${port}/${docsPath}`);
  Logger.log(`📚 Documentation agrégée : http://localhost:${port}/docs`);
}

bootstrap();
