import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

type AuthUserPayload = {
  id: string;
  name?: string | null;
  email: string;
  role?: string | null;
  plan?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: String(data.email || '').trim().toLowerCase(),
        password: hashedPassword,
        plan: this.planForStorage(this.resolvePlanFromEmail(data.email, 'free', data.role)),
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: String(data.email || '').trim().toLowerCase(),
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!user) return null;

    const effectivePlan = this.resolvePlanFromEmail(user.email, user.plan, user.role);

    return {
      ...user,
      plan: effectivePlan,
      accessAllowed: this.isPremiumPlan(effectivePlan),
    };
  }

  async updatePlan(userId: string, plan: string, requester?: any) {
    const requesterRole = String(requester?.role || '').toLowerCase();
    const requesterEmail = String(requester?.email || '').trim().toLowerCase();
    const allowSelfUpdate = this.envFlag('ODDIX_ALLOW_SELF_PLAN_UPDATE', false);
    const isAdmin = requesterRole === 'admin' || this.emailInEnvList(requesterEmail, 'ODDIX_ADMIN_USERS');

    if (!allowSelfUpdate && !isAdmin) {
      throw new ForbiddenException('Apenas administradores podem alterar plano manualmente');
    }

    const normalizedPlan = this.normalizePlan(plan);

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        plan: this.planForStorage(normalizedPlan),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
      },
    });
  }

  private buildAuthResponse(user: AuthUserPayload & { role?: string | null; plan?: string | null; createdAt?: Date }) {
    const effectivePlan = this.resolvePlanFromEmail(user.email, user.plan, user.role);
    const normalizedRole = String(user.role || '').trim() || 'user';

    const token = this.jwtService.sign({
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: normalizedRole,
      plan: effectivePlan,
      accessAllowed: this.isPremiumPlan(effectivePlan),
    });

    return {
      access_token: token,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: normalizedRole,
        plan: effectivePlan,
        accessAllowed: this.isPremiumPlan(effectivePlan),
      },
    };
  }

  private resolvePlanFromEmail(email: string | null | undefined, currentPlan?: string | null, role?: string | null) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = String(role || '').trim().toLowerCase();

    if (normalizedRole === 'admin' || normalizedRole === 'owner') return 'admin';
    if (this.emailInEnvList(normalizedEmail, 'ODDIX_ADMIN_USERS')) return 'admin';
    if (this.emailInEnvList(normalizedEmail, 'ODDIX_PRO_USERS')) return 'pro';
    if (this.emailInEnvList(normalizedEmail, 'ODDIX_PREMIUM_USERS')) return 'premium';
    if (this.emailInEnvList(normalizedEmail, 'ODDIX_VIP_USERS')) return 'vip';

    return this.normalizePlan(currentPlan);
  }

  private emailInEnvList(email: string, envName: string) {
    if (!email) return false;

    return String(process.env[envName] || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .includes(email);
  }

  private normalizePlan(value: any) {
    const plan = String(value || '').trim().toLowerCase();

    if (plan === 'vip') return 'vip';
    if (plan === 'pro') return 'pro';
    if (plan === 'premium') return 'premium';
    if (plan === 'admin' || plan === 'owner') return 'admin';

    return 'free';
  }

  private planForStorage(plan: string) {
    const normalized = this.normalizePlan(plan);
    if (normalized === 'vip') return 'VIP';
    if (normalized === 'pro') return 'PRO';
    if (normalized === 'premium') return 'Premium';
    if (normalized === 'admin') return 'Admin';
    return 'Free';
  }

  private isPremiumPlan(plan: string) {
    return ['vip', 'pro', 'premium', 'admin'].includes(this.normalizePlan(plan));
  }

  private envFlag(name: string, defaultValue = false) {
    const value = process.env[name];
    if (value === undefined) return defaultValue;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value).toLowerCase());
  }
}
