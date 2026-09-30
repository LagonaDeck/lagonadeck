import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SmtpModule } from './smtp/smtp.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [SmtpModule, MailModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
