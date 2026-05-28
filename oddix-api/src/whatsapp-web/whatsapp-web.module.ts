import { Module } from '@nestjs/common';
import { WhatsappWebService } from './whatsapp-web.service';

@Module({
  providers: [WhatsappWebService],
  exports: [WhatsappWebService],
})
export class WhatsappWebModule {}