import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BetsService {
  constructor(private readonly prisma: PrismaService) {}

  private maxOpenBetHours() {
    return Number(process.env.ODDIX_MAX_OPEN_BET_HOURS || 72);
  }

  private recentResultDays() {
    return Number(process.env.ODDIX_RECENT_RESULT_DAYS || 7);
  }

  async getAll() {
    const maxOpenHours = this.maxOpenBetHours();
    const openCutoff = new Date(Date.now() - maxOpenHours * 60 * 60 * 1000);
    const recentCutoff = new Date(Date.now() - this.recentResultDays() * 24 * 60 * 60 * 1000);

    // Dashboard limpo:
    // 1) OPEN só aparece se ainda estiver dentro da janela segura.
    // 2) WON/LOST recentes aparecem para histórico/greens.
    // 3) EXPIRED/VOID/CANCELED não voltam para o dashboard principal.
    return this.prisma.bet.findMany({
      where: {
        OR: [
          {
            status: 'open',
            createdAt: { gte: openCutoff },
          },
          {
            status: { in: ['won', 'lost'] },
            createdAt: { gte: recentCutoff },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getById(id: string) {
    return this.prisma.bet.findUnique({
      where: { id },
    });
  }

  async create(data: any) {
    return this.prisma.bet.create({
      data: {
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        league: data.league,
        tip: data.tip,
        odd: Number(data.odd || 0),
        confidence: Number(data.confidence || 0),
        status: data.status || 'open',

        homeLogo: data.homeLogo || null,
        awayLogo: data.awayLogo || null,
        leagueLogo: data.leagueLogo || null,

        fixtureId:
          data.fixtureId === null || data.fixtureId === undefined || data.fixtureId === ''
            ? null
            : Number(data.fixtureId),

        gameDate: data.gameDate ? new Date(data.gameDate) : null,

        markets: data.markets || undefined,
        multiples: data.multiples || undefined,
        analysis: data.analysis || null,
        risk: data.risk || null,

        homeScore:
          data.homeScore === null || data.homeScore === undefined || data.homeScore === ''
            ? null
            : Number(data.homeScore),

        awayScore:
          data.awayScore === null || data.awayScore === undefined || data.awayScore === ''
            ? null
            : Number(data.awayScore),

        statusShort: data.statusShort || null,

        elapsed:
          data.elapsed === null || data.elapsed === undefined || data.elapsed === ''
            ? null
            : Number(data.elapsed),

        provider: data.provider || null,
      },
    });
  }

  async cleanupOpenBets() {
    const maxOpenHours = this.maxOpenBetHours();
    const cutoff = new Date(Date.now() - maxOpenHours * 60 * 60 * 1000);

    const result = await this.prisma.bet.updateMany({
      where: {
        status: 'open',
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'expired',
        result: 'expired',
      } as any,
    });

    return {
      success: true,
      expired: result.count || 0,
      maxOpenHours,
      message: 'Bets abertas antigas foram expiradas e não aparecem mais no dashboard.',
    };
  }

  async getDebugSummary() {
    const maxOpenHours = this.maxOpenBetHours();
    const cutoff = new Date(Date.now() - maxOpenHours * 60 * 60 * 1000);

    const [openTotal, oldOpenTotal, wonTotal, lostTotal, expiredTotal, voidTotal, canceledTotal] =
      await Promise.all([
        this.prisma.bet.count({ where: { status: 'open' } }),
        this.prisma.bet.count({ where: { status: 'open', createdAt: { lt: cutoff } } }),
        this.prisma.bet.count({ where: { status: 'won' } }),
        this.prisma.bet.count({ where: { status: 'lost' } }),
        this.prisma.bet.count({ where: { status: 'expired' } }),
        this.prisma.bet.count({ where: { status: 'void' } }),
        this.prisma.bet.count({ where: { status: 'canceled' } }),
      ]);

    return {
      success: true,
      maxOpenHours,
      openTotal,
      oldOpenTotal,
      wonTotal,
      lostTotal,
      expiredTotal,
      voidTotal,
      canceledTotal,
    };
  }

  async seed() {
    return this.prisma.bet.createMany({
      data: [
        {
          homeTeam: 'Manchester City',
          awayTeam: 'Liverpool',
          league: 'Premier League',
          tip: 'Ambas marcam',
          odd: 1.72,
          confidence: 87,
          status: 'open',
        },
        {
          homeTeam: 'PSG',
          awayTeam: 'Bayern Munich',
          league: 'Champions League',
          tip: 'Mais de 1.5 gols',
          odd: 1.45,
          confidence: 94,
          status: 'open',
        },
        {
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          league: 'Premier League',
          tip: 'Arsenal vence ou empata',
          odd: 1.6,
          confidence: 82,
          status: 'open',
        },
        {
          homeTeam: 'Inter Milan',
          awayTeam: 'Juventus',
          league: 'Serie A',
          tip: 'Menos de 3.5 gols',
          odd: 1.38,
          confidence: 89,
          status: 'open',
        },
      ],
    });
  }
}
