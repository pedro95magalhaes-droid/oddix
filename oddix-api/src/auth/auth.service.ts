import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

type OddixPlan = 'Free' | 'VIP' | 'PRO' | 'Premium' | 'Admin';

const PREMIUM_PLANS = ['vip', 'pro', 'premium', 'admin'];

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private normalizeEmail(email?: string | null) {
    return String(email || '').trim().toLowerCase();
  }

  private envList(name: string) {
    return String(process.env[name] || '')
      .split(',')
      .map((item) => this.normalizeEmail(item))
      .filter(Boolean);
  }

  private normalizePlan(value?: string | null): OddixPlan {
    const plan = String(value || '').trim().toLowerCase();

    if (plan === 'vip') return 'VIP';
    if (plan === 'pro') return 'PRO';
    if (plan === 'premium') return 'Premium';
    if (plan === 'admin' || plan === 'owner') return 'Admin';

    return 'Free';
  }

  private effectivePlan(user: any): OddixPlan {
    const email = this.normalizeEmail(user?.email);
    const role = String(user?.role || '').trim().toLowerCase();
    const storedPlan = this.normalizePlan(user?.plan);

    if (this.envList('ODDIX_ADMIN_USERS').includes(email) || role === 'admin' || role === 'owner') {
      return 'Admin';
    }

    if (this.envList('ODDIX_PRO_USERS').includes(email)) return 'PRO';
    if (this.envList('ODDIX_VIP_USERS').includes(email)) return 'VIP';

    return storedPlan;
  }

  private isPremium(plan: string) {
    return PREMIUM_PLANS.includes(String(plan || '').trim().toLowerCase());
  }

  private buildUserPayload(user: any) {
    if (!user) return null;

    const plan = this.effectivePlan(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan,
      accessAllowed: this.isPremium(plan),
      createdAt: user.createdAt,
    };
  }

  private signUser(user: any) {
    const plan = this.effectivePlan(user);

    return this.jwtService.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan,
    });
  }

  async register(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        plan: 'Free',
      },
    });

    const token = this.signUser(user);

    return {
      access_token: token,
      token,
      user: this.buildUserPayload(user),
    };
  }

  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const token = this.signUser(user);

    return {
      access_token: token,
      token,
      user: this.buildUserPayload(user),
    };
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

    return this.buildUserPayload(user);
  }

  async updatePlan(userId: string, plan: string) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        plan,
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

  async getDashboard(userId: string) {
    const user = await this.me(userId);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      user,
      access: {
        allowed: user.accessAllowed,
        plan: user.plan,
        status: user.accessAllowed ? 'acesso liberado' : 'plano sem acesso',
      },
      source: 'backend',
      hasOperationalData: false,
      metrics: {
        bankroll: {
          current: 0,
          monthlyChangePercent: 0,
        },
        roi: {
          current: 0,
          period: '30 dias',
        },
        winRate: {
          current: 0,
          greens: 0,
          reds: 0,
        },
        bets: {
          today: 0,
          open: 0,
          closed: 0,
        },
      },
      charts: {
        bankroll: [
          { label: 'D-6', value: 0 },
          { label: 'D-5', value: 0 },
          { label: 'D-4', value: 0 },
          { label: 'D-3', value: 0 },
          { label: 'D-2', value: 0 },
          { label: 'Ontem', value: 0 },
          { label: 'Hoje', value: 0 },
        ],
        roi: [
          { label: 'D-6', value: 0 },
          { label: 'D-5', value: 0 },
          { label: 'D-4', value: 0 },
          { label: 'D-3', value: 0 },
          { label: 'D-2', value: 0 },
          { label: 'Ontem', value: 0 },
          { label: 'Hoje', value: 0 },
        ],
        winRate: [
          { label: 'Greens', value: 0 },
          { label: 'Reds', value: 0 },
        ],
      },
      analyses: [],
      bets: [],
      players: [],
      markets: [],
      games: [],
      compliance: {
        seals: ['18+', 'Jogue com responsabilidade', 'Aposta não é investimento', 'Não recupere perdas'],
        checklist: [
          'Conteúdo exclusivo para maiores de 18 anos.',
          'Apostas envolvem risco financeiro.',
          'O jogo deve ser tratado como entretenimento.',
          'Não utilize apostas como fonte de renda ou investimento.',
          'Estabeleça limite de banca, valor e tempo.',
        ],
      },
      emptyState: {
        title: 'Dados operacionais ainda não conectados',
        message:
          'Este painel já busca dados reais do backend. Para popular apostas, análises, banca, jogadores e mercados, conecte as tabelas/serviços correspondentes ao endpoint /auth/dashboard.',
      },
    };
  }

  async getAdminDashboard(actorUserId: string) {
    const actor = await this.me(actorUserId);

    if (!actor || this.normalizePlan(actor.plan) !== 'Admin') {
      throw new ForbiddenException('Acesso administrativo necessário');
    }

    const users = await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
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

    const normalizedUsers = users.map((user) => this.buildUserPayload(user));
    const planCounts = normalizedUsers.reduce(
      (acc: Record<string, number>, user: any) => {
        const plan = String(user?.plan || 'Free');
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      },
      {},
    );

    return {
      actor,
      totalUsers: normalizedUsers.length,
      premiumUsers: normalizedUsers.filter((user: any) => user?.accessAllowed).length,
      blockedUsers: normalizedUsers.filter((user: any) => !user?.accessAllowed).length,
      planCounts,
      users: normalizedUsers,
    };
  }

  async adminUpdateUserPlan(actorUserId: string, targetUserId: string, plan: string) {
    const actor = await this.me(actorUserId);

    if (!actor || this.normalizePlan(actor.plan) !== 'Admin') {
      throw new ForbiddenException('Acesso administrativo necessário');
    }

    const normalizedPlan = this.normalizePlan(plan);

    const updatedUser = await this.prisma.user.update({
      where: {
        id: targetUserId,
      },
      data: {
        plan: normalizedPlan,
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

    return this.buildUserPayload(updatedUser);
  }
}
