import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ResultsCronService } from './results-cron.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly resultsCronService: ResultsCronService,
  ) {}

  @Get()
  getAdmin() {
    return {
      ok: true,
      message: 'Área admin liberada',
    };
  }

  private startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  private startOfLastSevenDays() {
    const today = this.startOfToday();
    today.setDate(today.getDate() - 6);
    return today;
  }

  private percent(part: number, total: number) {
    if (!total) return 0;
    return Number(((part / total) * 100).toFixed(1));
  }

  @Get('dashboard')
  async getDashboard() {
    const todayStart = this.startOfToday();
    const weekStart = this.startOfLastSevenDays();

    const [
      totalUsers,
      vipUsers,
      proUsers,
      freeUsers,
      admins,
      todayUsers,
      weekUsers,
      totalBets,
      openBets,
      wonBets,
      lostBets,
      playerPropsBets,
      audioHistory,
      latestUsers,
      latestBets,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { plan: { in: ['Vip', 'VIP', 'vip'] } },
      }),
      this.prisma.user.count({
        where: { plan: { in: ['Pro', 'PRO', 'pro'] } },
      }),
      this.prisma.user.count({
        where: { plan: { in: ['Free', 'FREE', 'free'] } },
      }),
      this.prisma.user.count({
        where: { role: { in: ['ADMIN', 'admin'] } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      this.prisma.bet.count(),
      this.prisma.bet.count({ where: { status: 'open' } }),
      this.prisma.bet.count({ where: { status: 'won' } }),
      this.prisma.bet.count({ where: { status: 'lost' } }),
      this.prisma.bet.count({
        where: {
          OR: [
            { tip: { contains: 'chute', mode: 'insensitive' } },
            { tip: { contains: 'finalização', mode: 'insensitive' } },
            { tip: { contains: 'finalizacao', mode: 'insensitive' } },
            { tip: { contains: 'assistência', mode: 'insensitive' } },
            { tip: { contains: 'assistencia', mode: 'insensitive' } },
            { tip: { contains: 'jogador', mode: 'insensitive' } },
            { tip: { contains: 'player', mode: 'insensitive' } },
          ],
        },
      }),
      (this.prisma as any).audioHistory?.count?.().catch(() => 0) || Promise.resolve(0),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          plan: true,
          createdAt: true,
        },
      }),
      this.prisma.bet.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          league: true,
          tip: true,
          odd: true,
          confidence: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const finishedBets = wonBets + lostBets;
    const winRate = this.percent(wonBets, finishedBets);
    const conversionRate = this.percent(vipUsers + proUsers, totalUsers);
    const simulatedStake = Number(process.env.ODDIX_SIMULATED_STAKE || 10);
    const profit = Number(
      (
        (await this.calculateSimulatedProfit(simulatedStake))
      ).toFixed(2),
    );
    const roi = totalBets ? Number(((profit / (totalBets * simulatedStake)) * 100).toFixed(1)) : 0;

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      users: {
        totalUsers,
        vipUsers,
        proUsers,
        freeUsers,
        paidUsers: vipUsers + proUsers,
        admins,
        todayUsers,
        weekUsers,
        conversionRate,
        latestUsers,
      },
      bets: {
        totalBets,
        openBets,
        wonBets,
        lostBets,
        finishedBets,
        winRate,
        simulatedStake,
        profit,
        roi,
        playerPropsBets,
        latestBets,
      },
      system: {
        backend: true,
        whatsappEnabled: process.env.WHATSAPP_WEB_ENABLED !== 'false',
        voiceEnabled: process.env.ODDIX_VOICE_ENABLED === 'true',
        hypeEnabled: process.env.ODDIX_HYPE_ENABLED !== 'false',
        ttsUrlConfigured: !!process.env.ODDIX_TTS_URL,
        audioHistory,
      },
    };
  }

  private async calculateSimulatedProfit(stake: number) {
    const finished = await this.prisma.bet.findMany({
      where: { status: { in: ['won', 'lost'] } },
      select: { status: true, odd: true },
    });

    return finished.reduce((acc, bet) => {
      if (bet.status === 'won') return acc + stake * (Number(bet.odd || 1) - 1);
      if (bet.status === 'lost') return acc - stake;
      return acc;
    }, 0);
  }

  @Get('ai-logs')
  async getAiLogs() {
    return {
      logs: [],
      message: 'AiResultLog desativado temporariamente. O robô continua funcionando sem essa tabela.',
    };
  }

  @Get('users')
  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
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

  @Patch('users/:id/plan')
  async updateUserPlan(@Param('id') id: string, @Body() body: any) {
    return this.prisma.user.update({
      where: { id },
      data: { plan: body.plan },
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

  @Patch('users/:id/role')
  async updateUserRole(@Param('id') id: string, @Body() body: any) {
    return this.prisma.user.update({
      where: { id },
      data: { role: body.role },
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

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário excluído com sucesso' };
  }

  @Get('bets')
  async getBets() {
    return this.prisma.bet.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Post('bets')
  async createBet(@Body() body: any) {
    return this.prisma.bet.create({
      data: {
        homeTeam: body.homeTeam,
        awayTeam: body.awayTeam,
        league: body.league,
        tip: body.tip,
        odd: Number(body.odd),
        confidence: Number(body.confidence),
        status: body.status || 'open',
        homeLogo: body.homeLogo || null,
        awayLogo: body.awayLogo || null,
        leagueLogo: body.leagueLogo || null,
        fixtureId: body.fixtureId ? Number(body.fixtureId) : null,
        gameDate: body.gameDate ? new Date(body.gameDate) : null,
        homeScore: body.homeScore ?? null,
        awayScore: body.awayScore ?? null,
        statusShort: body.statusShort || null,
        elapsed: body.elapsed ?? null,
        provider: body.provider || null,
        markets: body.markets || null,
        multiples: body.multiples || null,
        analysis: body.analysis || null,
        risk: body.risk || null,
      },
    });
  }

  @Patch('bets/:id')
  async updateBet(@Param('id') id: string, @Body() body: any) {
    return this.prisma.bet.update({
      where: { id },
      data: {
        homeTeam: body.homeTeam,
        awayTeam: body.awayTeam,
        league: body.league,
        tip: body.tip,
        odd: Number(body.odd),
        confidence: Number(body.confidence),
        status: body.status || 'open',
        homeLogo: body.homeLogo || null,
        awayLogo: body.awayLogo || null,
        leagueLogo: body.leagueLogo || null,
        fixtureId: body.fixtureId ? Number(body.fixtureId) : null,
        gameDate: body.gameDate ? new Date(body.gameDate) : null,
        homeScore: body.homeScore ?? null,
        awayScore: body.awayScore ?? null,
        statusShort: body.statusShort || null,
        elapsed: body.elapsed ?? null,
        provider: body.provider || null,
        markets: body.markets || null,
        multiples: body.multiples || null,
        analysis: body.analysis || null,
        risk: body.risk || null,
      },
    });
  }

  @Post('bets/sync-results')
  async syncBetResults() {
    return this.resultsCronService.syncResults('manual');
  }

  @Delete('bets/:id')
  async deleteBet(@Param('id') id: string) {
    await this.prisma.bet.delete({ where: { id } });
    return { message: 'Palpite excluído com sucesso' };
  }
}
