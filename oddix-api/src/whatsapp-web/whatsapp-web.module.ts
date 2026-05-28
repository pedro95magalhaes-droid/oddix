import { Module } from '@nestjs/common';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappWebController } from './whatsapp-web.controller';

@Module({
  controllers: [WhatsappWebController],
  providers: [WhatsappWebService],
  exports: [WhatsappWebService],
})
export class WhatsappWebModule {}