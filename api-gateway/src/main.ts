import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { OrganizationController } from './organization.controller';
import { ProductController } from './product.controller';

@Module({
  controllers: [AuthController, OrganizationController, ProductController],
})
class AppModule {}

async function bootstrap() {
  if (!process.env.IDENTITY_SERVICE_URL) {
    throw new Error('IDENTITY_SERVICE_URL is not set');
  }
  if (!process.env.INVENTORY_SERVICE_URL) {
    throw new Error('INVENTORY_SERVICE_URL is not set');
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
