import { Controller, Get } from '@nestjs/common';
import { WhatsappWebService } from './whatsapp-web.service';

@Controller('whatsapp-web')
export class WhatsappWebController {
  constructor(private readonly whatsapp: WhatsappWebService) {}

  @Get('groups')
  async groups() {
    return this.whatsapp.listGroups();
  }

  @Get('test-vip')
  async testVip() {
    return this.whatsapp.sendText('🚀 Teste Oddix VIP no WhatsApp Web funcionando!', 'vip');
  }

  @Get('test-free')
  async testFree() {
    return this.whatsapp.sendText('🚀 Teste Oddix FREE no WhatsApp Web funcionando!', 'free');
  }
}
