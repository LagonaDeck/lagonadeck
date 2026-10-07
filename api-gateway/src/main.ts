import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { OrganizationController } from './organization.controller';

@Module({ controllers: [AuthController, OrganizationController] })
class AppModule {}

async function bootstrap() {
  if (!process.env.IDENTITY_SERVICE_URL) {
    throw new Error('IDENTITY_SERVICE_URL is not set');
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
