import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaPg } from '@prisma/adapter-pg';
import { CatalogSyncService } from './catalog-sync.service';
import { PrismaClient } from './generated/prisma/client';
import { IdentityService } from './identity.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  controllers: [ReportController, ProductController, InventoryController],
  providers: [
    IdentityService,
    ProductService,
    InventoryService,
    ReportService,
    CatalogSyncService,
    {
      provide: PrismaClient,
      useFactory: () =>
        new PrismaClient({
          adapter: new PrismaPg({
            connectionString: process.env.DATABASE_URL,
          }),
        }),
    },
  ],
})
class AppModule {}

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!process.env.IDENTITY_SERVICE_URL) {
    throw new Error('IDENTITY_SERVICE_URL is not set');
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const docs = new DocumentBuilder().setTitle('Inventory Service').build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));
  await app.listen(process.env.PORT ?? 3002);
}

void bootstrap();
