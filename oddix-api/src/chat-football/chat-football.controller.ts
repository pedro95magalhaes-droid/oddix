import { Body, Controller, Headers, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatFootballService } from './chat-football.service';
import { OddixCopilotService } from './oddix-copilot.service';
import { StreamingService } from './streaming.service';
import type { ChatFootballRequest } from './chat-football.types';

type HeaderBag = Record<string, string | string[] | undefined>;

type OddixAccessDecision = {
  allowed: boolean;
  plan: string;
  reason?: string;
  email?: string;
  authMode?: 'jwt' | 'env-email' | 'legacy-token' | 'trusted-client' | 'disabled' | 'none';
};

@Controller('chat-football')
export class ChatFootballController {
  constructor(
    private readonly chatFootballService: ChatFootballService,
    private readonly copilotService: OddixCopilotService,
    private readonly streamingService: StreamingService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('message')
  async handleMessage(
    @Body() body: ChatFootballRequest | any,
    @Headers() headers?: HeaderBag,
  ) {
    const access = this.resolveAccess(body, headers);

    if (!access.allowed) {
      return this.blockedResponse(access);
    }

    const response = await this.chatFootballService.handleMessage({
      ...body,
      userPlan: access.plan,
      accessPlan: access.plan,
      userEmail: access.email || body?.userEmail,
      context: {
        ...(body?.context || {}),
        userPlan: access.plan,
        accessPlan: access.plan,
        userEmail: access.email || body?.context?.userEmail,
        accessControl: access.authMode || 'vip-pro',
      },
    });

    return this.copilotService.enhanceResponse(body, response);
  }

  @Post('stream')
  async handleStream(
    @Body() body: ChatFootballRequest | any,
    @Headers() headers?: HeaderBag,
  ) {
    const response = await this.handleMessage(
      {
        ...body,
        stream: true,
      },
      headers,
    );

    return this.streamingService.buildPseudoStreamResponse(response.answer, response.data || {});
  }

  @Post('v14/message')
  async handleV14Message(
    @Body() body: ChatFootballRequest | any,
    @Headers() headers?: HeaderBag,
  ) {
    return this.handleMessage(body, headers);
  }

  @Post('v15/message')
  async handleV15Message(
    @Body() body: ChatFootballRequest | any,
    @Headers() headers?: HeaderBag,
  ) {
    return this.handleMessage(
      {
        ...body,
        version: 'v15',
      } as any,
      headers,
    );
  }

  @Post('v15/stream')
  async handleV15Stream(
    @Body() body: ChatFootballRequest | any,
    @Headers() headers?: HeaderBag,
  ) {
    return this.handleStream(
      {
        ...body,
        version: 'v15',
        stream: true,
      } as any,
      headers,
    );
  }

  private resolveAccess(body: any, headers?: HeaderBag): OddixAccessDecision {
    if (!this.isAccessControlEnabled()) {
      return { allowed: true, plan: 'dev', authMode: 'disabled' };
    }

    const authToken = this.resolveAuthToken(body, headers);
    const jwtPayload = this.verifyJwt(authToken);
    const email = this.firstText(jwtPayload?.email, body?.userEmail, body?.user?.email, body?.context?.userEmail).toLowerCase();
    const envPlan = this.planFromEmail(email);
    const jwtPlan = this.normalizePlan(jwtPayload?.plan || jwtPayload?.subscriptionPlan || jwtPayload?.role);
    const clientPlan = this.normalizePlan(
      this.firstText(
        this.header(headers, 'x-oddix-plan'),
        this.header(headers, 'x-user-plan'),
        this.header(headers, 'x-subscription-plan'),
        body?.userPlan,
        body?.accessPlan,
        body?.plan,
        body?.subscriptionPlan,
        body?.subscription?.plan,
        body?.user?.plan,
        body?.context?.userPlan,
        body?.context?.accessPlan,
      ),
    );

    const legacyAccessToken = this.firstText(
      this.header(headers, 'x-oddix-access-token'),
      body?.accessToken,
      body?.token,
      body?.context?.accessToken,
    );

    const trustedClientPlanEnabled = this.envFlag('ODDIX_TRUST_CLIENT_PLAN', false);
    const legacyTokenAllowed = this.isLegacyAccessTokenAllowed(legacyAccessToken);

    let plan = envPlan || (jwtPayload ? jwtPlan : 'free');
    let authMode: OddixAccessDecision['authMode'] = envPlan ? 'env-email' : jwtPayload ? 'jwt' : 'none';

    if (!this.isPremiumPlan(plan) && trustedClientPlanEnabled && this.isPremiumPlan(clientPlan)) {
      plan = clientPlan;
      authMode = 'trusted-client';
    }

    if (!this.isPremiumPlan(plan) && legacyTokenAllowed && this.isPremiumPlan(clientPlan)) {
      plan = clientPlan;
      authMode = 'legacy-token';
    }

    if (!this.isPremiumPlan(plan)) {
      return {
        allowed: false,
        plan: plan || 'free',
        reason: jwtPayload ? 'PLAN_REQUIRED' : 'LOGIN_REQUIRED',
        email,
        authMode,
      };
    }

    return { allowed: true, plan, email, authMode };
  }

  private isAccessControlEnabled() {
    const value = String(process.env.ODDIX_ACCESS_CONTROL_ENABLED ?? 'true').toLowerCase();
    return !['false', '0', 'off', 'disabled'].includes(value);
  }

  private blockedResponse(access: OddixAccessDecision) {
    const loginMessage =
      access.reason === 'LOGIN_REQUIRED'
        ? '\n\nFaça login no dashboard com uma conta VIP ou PRO para liberar automaticamente.'
        : '';

    const planMessage =
      access.reason === 'PLAN_REQUIRED'
        ? `\n\nSua conta foi identificada${access.email ? ` (${access.email})` : ''}, mas o plano atual não é VIP/PRO.`
        : '';

    return {
      success: false,
      blocked: true,
      reason: access.reason || 'PLAN_REQUIRED',
      intent: 'ACCESS_BLOCKED',
      answer:
        `🔒 **Acesso restrito**\n\nEste recurso é exclusivo para clientes **VIP** e **PRO**. O acesso agora é liberado automaticamente pelo login e pelo plano da conta.${loginMessage}${planMessage}`,
      data: {
        requiredPlans: ['vip', 'pro', 'premium', 'admin'],
        receivedPlan: access.plan,
        email: access.email,
        authMode: access.authMode,
      },
    };
  }

  private resolveAuthToken(body: any, headers?: HeaderBag) {
    const authorization = this.header(headers, 'authorization');
    return this.firstText(
      authorization?.replace(/^Bearer\s+/i, ''),
      this.header(headers, 'x-auth-token'),
      this.header(headers, 'x-access-token'),
      body?.authToken,
      body?.access_token,
      body?.jwt,
      body?.context?.authToken,
    );
  }

  private verifyJwt(token: string) {
    if (!token) return null;

    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'oddix_secret_2026',
      }) as any;
    } catch {
      return null;
    }
  }

  private planFromEmail(email: string) {
    if (!email) return null;
    if (this.emailInEnvList(email, 'ODDIX_ADMIN_USERS')) return 'admin';
    if (this.emailInEnvList(email, 'ODDIX_PRO_USERS')) return 'pro';
    if (this.emailInEnvList(email, 'ODDIX_PREMIUM_USERS')) return 'premium';
    if (this.emailInEnvList(email, 'ODDIX_VIP_USERS')) return 'vip';
    return null;
  }

  private emailInEnvList(email: string, envName: string) {
    return String(process.env[envName] || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .includes(email);
  }

  private isLegacyAccessTokenAllowed(token: string) {
    const requiredToken =
      process.env.ODDIX_VIP_ACCESS_TOKEN ||
      process.env.ODDIX_PRO_ACCESS_TOKEN ||
      process.env.ODDIX_ACCESS_TOKEN ||
      '';

    return !!requiredToken && !!token && token === requiredToken;
  }

  private header(headers: HeaderBag | undefined, name: string) {
    if (!headers) return '';

    const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];

    if (Array.isArray(value)) return value[0] || '';

    return value || '';
  }

  private firstText(...values: any[]) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) return text;
    }

    return '';
  }

  private normalizePlan(value: any) {
    const plan = String(value || '').trim().toLowerCase();

    if (plan === 'vip') return 'vip';
    if (plan === 'pro') return 'pro';
    if (plan === 'premium') return 'premium';
    if (plan === 'admin' || plan === 'owner') return 'admin';

    return 'free';
  }

  private isPremiumPlan(plan: string) {
    return ['vip', 'pro', 'premium', 'admin', 'dev'].includes(this.normalizePlan(plan));
  }

  private envFlag(name: string, defaultValue = false) {
    const value = process.env[name];
    if (value === undefined) return defaultValue;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value).toLowerCase());
  }
}
