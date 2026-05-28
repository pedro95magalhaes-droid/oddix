import { Controller, Get, Header } from '@nestjs/common';
import * as QRCode from 'qrcode';
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

  @Get('qr')
  async getQr() {
    const data = this.whatsapp.getQr();

    if (!data.qr) {
      return {
        ok: false,
        connected: data.connected,
        message: data.connected
          ? 'WhatsApp já conectado.'
          : 'QR ainda não gerado. Aguarde alguns segundos e atualize.',
        sessionDir: data.sessionDir,
      };
    }

    const qrImage = await QRCode.toDataURL(data.qr);

    return {
      ok: true,
      connected: data.connected,
      qrImage,
      sessionDir: data.sessionDir,
    };
  }

  @Get('qr-page')
  @Header('Content-Type', 'text/html')
  async getQrPage() {
    const data = this.whatsapp.getQr();

    if (!data.qr) {
      return `
        <html>
          <body style="font-family:Arial;background:#050505;color:white;text-align:center;padding:40px">
            <h1>ODDIX WhatsApp</h1>
            <p>${data.connected ? 'WhatsApp já conectado.' : 'QR ainda não gerado. Atualize em alguns segundos.'}</p>
          </body>
        </html>
      `;
    }

    const qrImage = await QRCode.toDataURL(data.qr);

    return `
      <html>
        <body style="font-family:Arial;background:#050505;color:white;text-align:center;padding:40px">
          <h1>ODDIX WhatsApp QR</h1>
          <p>Escaneie no WhatsApp: Dispositivos conectados > Conectar dispositivo</p>
          <img src="${qrImage}" style="width:360px;height:360px;background:white;padding:20px;border-radius:20px" />
          <p>Depois de conectar, volte o Start Command normal.</p>
        </body>
      </html>
    `;
  }
}