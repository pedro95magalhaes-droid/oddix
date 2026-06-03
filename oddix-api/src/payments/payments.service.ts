import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type OddixPlan = 'Free' | 'Pro' | 'Vip';
type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS'
  | string;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private proLink() {
    return (
      this.config.get<string>('ASAAS_PRO_LINK') ||
      process.env.ASAAS_PRO_LINK ||
      'https://www.asaas.com/c/ghmckkqfrfkan6z1'
    );
  }

  private vipLink() {
    return (
      this.config.get<string>('ASAAS_VIP_LINK') ||
      process.env.ASAAS_VIP_LINK ||
      'https://www.asaas.com/c/htvg25um0tpbr7bx'
    );
  }

  private asaasApiKey() {
    return this.config.get<string>('ASAAS_API_KEY') || process.env.ASAAS_API_KEY || '';
  }

  private asaasBaseUrl() {
    return process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';
  }

  private webhookToken() {
    return (
      this.config.get<string>('ASAAS_WEBHOOK_TOKEN') ||
      process.env.ASAAS_WEBHOOK_TOKEN ||
      ''
    );
  }

  private proPrice() {
    return Number(process.env.ODDIX_PRO_PRICE || 19.99);
  }

  private vipPrice() {
    return Number(process.env.ODDIX_VIP_PRICE || 39.99);
  }

  getCheckoutLinks() {
    return {
      ok: true,
      provider: 'asaas',
      plans: {
        pro: {
          plan: 'Pro',
          price: this.proPrice(),
          url: this.proLink(),
          benefits: [
            'IA Premium',
            'Dashboard de análises',
            'Combinadas inteligentes',
            'Player Props básicos',
          ],
        },
        vip: {
          plan: 'Vip',
          price: this.vipPrice(),
          url: this.vipLink(),
          benefits: [
            'Tudo do PRO',
            'Grupo VIP WhatsApp',
            'Cards premium',
            'Áudios GREEN/RED',
            'Almost Green',
            'Player Props premium',
          ],
        },
      },
    };
  }

  async createCheckoutForUser(userId: string, plan: OddixPlan) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return {
        ok: false,
        message: 'Usuário não encontrado.',
      };
    }

    const normalizedPlan = this.normalizePlan(plan);

    /**
     * Fase 1: usa os links Asaas já criados no painel.
     * O usuário já consegue pagar agora.
     *
     * Fase 2: quando você configurar ASAAS_API_KEY, este método pode ser expandido
     * para criar cobranças PIX/assinatura via API com externalReference=user.id.
     */
    return {
      ok: true,
      provider: 'asaas',
      mode: 'payment-link',
      plan: normalizedPlan,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        currentPlan: user.plan,
      },
      checkoutUrl: normalizedPlan === 'Vip' ? this.vipLink() : this.proLink(),
      note:
        'Link Asaas retornado. Para liberação automática total, configure o webhook Asaas e use email/externalReference do usuário no pagamento.',
    };
  }

  async handleAsaasWebhook(body: any, headers: Record<string, string>) {
    this.assertWebhookIsAllowed(headers);

    const event = String(body?.event || '').toUpperCase();
    const payment = body?.payment || body?.data?.payment || body?.data || body || {};
    const status = String(payment?.status || '').toUpperCase() as AsaasPaymentStatus;

    const isPaid = this.isPaidEvent(event, status);

    if (!isPaid) {
      this.logger.log(`Webhook Asaas ignorado: event=${event} status=${status}`);
      return {
        ok: true,
        ignored: true,
        reason: 'Evento ainda não representa pagamento confirmado.',
        event,
        status,
      };
    }

    const plan = this.detectPlanFromPayment(payment);
    const user = await this.findUserFromPayment(payment);

    if (!plan) {
      this.logger.warn(`Webhook Asaas pago, mas plano não identificado: ${JSON.stringify(this.safePaymentLog(payment))}`);
      return {
        ok: false,
        updated: false,
        reason: 'Pagamento confirmado, mas não foi possível identificar se é Pro ou Vip.',
        event,
        status,
      };
    }

    if (!user) {
      this.logger.warn(`Webhook Asaas pago, mas usuário não identificado: ${JSON.stringify(this.safePaymentLog(payment))}`);
      return {
        ok: false,
        updated: false,
        plan,
        reason:
          'Pagamento confirmado, mas não foi possível identificar o usuário. Confira se o email do pagador é o mesmo cadastrado no Oddix ou use externalReference.',
        event,
        status,
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { plan },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
      },
    });

    this.logger.log(`Pagamento Asaas confirmado. Usuário ${updated.email} atualizado para ${plan}.`);

    return {
      ok: true,
      updated: true,
      event,
      status,
      plan,
      user: updated,
    };
  }

  private assertWebhookIsAllowed(headers: Record<string, string>) {
    const expected = this.webhookToken();
    if (!expected) return;

    const received =
      headers['asaas-access-token'] ||
      headers['x-asaas-webhook-token'] ||
      headers['x-webhook-token'] ||
      headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      '';

    if (received !== expected) {
      throw new UnauthorizedException('Webhook Asaas não autorizado.');
    }
  }

  private isPaidEvent(event: string, status: string) {
    const paidEvents = [
      'PAYMENT_RECEIVED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED_IN_CASH',
    ];

    const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

    return paidEvents.includes(event) || paidStatuses.includes(status);
  }

  private normalizeText(value: any) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9@._\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizePlan(plan: any): OddixPlan {
    const text = this.normalizeText(plan);
    if (text.includes('vip')) return 'Vip';
    if (text.includes('pro')) return 'Pro';
    return 'Free';
  }

  private detectPlanFromPayment(payment: any): OddixPlan | null {
    const value = Number(payment?.value || payment?.netValue || payment?.originalValue || 0);

    const haystack = this.normalizeText([
      payment?.description,
      payment?.externalReference,
      payment?.paymentLink,
      payment?.subscription,
      payment?.installment,
      payment?.invoiceUrl,
      payment?.bankSlipUrl,
      payment?.billingType,
      payment?.customer,
      payment?.id,
    ].filter(Boolean).join(' '));

    if (haystack.includes('oddix vip') || haystack.includes('vip')) return 'Vip';
    if (haystack.includes('oddix pro') || haystack.includes('pro')) return 'Pro';

    // Fallback por valor dos links atuais.
    if (value >= this.vipPrice() - 0.1 && value <= this.vipPrice() + 0.1) return 'Vip';
    if (value >= this.proPrice() - 0.1 && value <= this.proPrice() + 0.1) return 'Pro';

    return null;
  }

  private async findUserFromPayment(payment: any) {
    const externalReference = String(payment?.externalReference || '').trim();

    if (externalReference) {
      const byId = await this.prisma.user.findUnique({ where: { id: externalReference } }).catch(() => null);
      if (byId) return byId;

      if (externalReference.includes('@')) {
        const byExternalEmail = await this.prisma.user.findUnique({
          where: { email: externalReference.toLowerCase() },
        }).catch(() => null);
        if (byExternalEmail) return byExternalEmail;
      }
    }

    const directEmail = this.extractEmail([
      payment?.email,
      payment?.payerEmail,
      payment?.customerEmail,
      payment?.billingEmail,
      payment?.description,
      payment?.externalReference,
    ]);

    if (directEmail) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: directEmail } }).catch(() => null);
      if (byEmail) return byEmail;
    }

    const customerId = String(payment?.customer || '').trim();

    if (customerId && this.asaasApiKey()) {
      const customer = await this.fetchAsaasCustomer(customerId);
      const email = this.extractEmail([customer?.email, customer?.notificationDisabled ? '' : customer?.email]);

      if (email) {
        const byCustomerEmail = await this.prisma.user.findUnique({ where: { email } }).catch(() => null);
        if (byCustomerEmail) return byCustomerEmail;
      }
    }

    return null;
  }

  private extractEmail(values: any[]) {
    const text = values.filter(Boolean).join(' ');
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : null;
  }

  private async fetchAsaasCustomer(customerId: string) {
    try {
      const response = await fetch(`${this.asaasBaseUrl()}/customers/${encodeURIComponent(customerId)}`, {
        method: 'GET',
        headers: {
          access_token: this.asaasApiKey(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;
      return response.json();
    } catch (error: any) {
      this.logger.warn(`Erro ao buscar customer Asaas: ${error?.message || error}`);
      return null;
    }
  }

  private safePaymentLog(payment: any) {
    return {
      id: payment?.id,
      customer: payment?.customer,
      value: payment?.value,
      status: payment?.status,
      description: payment?.description,
      externalReference: payment?.externalReference,
      paymentLink: payment?.paymentLink,
      invoiceUrl: payment?.invoiceUrl,
    };
  }
}
