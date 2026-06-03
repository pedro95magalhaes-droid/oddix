import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('links')
  getLinks() {
    return this.paymentsService.getCheckoutLinks();
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout/pro')
  async createProCheckout(@Req() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.paymentsService.createCheckoutForUser(userId, 'Pro');
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout/vip')
  async createVipCheckout(@Req() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.paymentsService.createCheckoutForUser(userId, 'Vip');
  }

  @Post('webhook/asaas')
  async asaasWebhook(@Body() body: any, @Headers() headers: Record<string, string>) {
    return this.paymentsService.handleAsaasWebhook(body, headers);
  }
}
