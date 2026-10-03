import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { GroupController } from './organization/group.controller';
import { InvitationController } from './organization/invitation.controller';
import { InvitationService } from './organization/invitation.service';
import { GroupService } from './organization/group.service';
import { OrganizationAccessService } from './organization/organization-access.service';
import { OrganizationController } from './organization/organization.controller';
import { OrganizationService } from './organization/organization.service';
import { SessionController } from './session/session.controller';
import { LoginThrottleService } from './session/login-throttle.service';
import { SessionService } from './session/session.service';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';

@Module({
  controllers: [
    UserController,
    SessionController,
    InvitationController,
    OrganizationController,
    GroupController,
  ],
  providers: [
    UserService,
    SessionService,
    LoginThrottleService,
    OrganizationService,
    OrganizationAccessService,
    GroupService,
    InvitationService,
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

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const docs = new DocumentBuilder().setTitle('Identity Service').build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
