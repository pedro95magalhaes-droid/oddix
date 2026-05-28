import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ResultsCronService } from './results-cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WhatsappWebModule } from '../whatsapp-web/whatsapp-web.module';

@Module({
  imports: [PrismaModule, TelegramModule, WhatsappWebModule],
  controllers: [AdminController],
  providers: [ResultsCronService],
})
export class AdminModule {}