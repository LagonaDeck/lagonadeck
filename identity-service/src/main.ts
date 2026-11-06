import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { MailService } from './mail/mail.service';
import { InternalGuard } from './internal.guard';
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
    MailService,
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
  if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL is not set');
  if (!process.env.INTERNAL_TOKEN) throw new Error('INTERNAL_TOKEN is not set');

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalGuards(new InternalGuard());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const docs = new DocumentBuilder()
    .setTitle('Identity Service')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-internal-token' },
      'internal',
    )
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-user-id' }, 'user')
    .addBearerAuth()
    .addSecurityRequirements('internal')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
