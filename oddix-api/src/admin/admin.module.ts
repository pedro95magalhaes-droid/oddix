import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ResultsCronService } from './results-cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [AdminController],
  providers: [ResultsCronService],
})
export class AdminModule {}