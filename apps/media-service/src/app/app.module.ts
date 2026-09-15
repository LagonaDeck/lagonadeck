import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [PrismaModule, StorageModule, MediaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
