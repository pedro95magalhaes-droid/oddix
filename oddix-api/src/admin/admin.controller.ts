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
      message: 'Área admin liberada',
    };
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
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: 'Usuário excluído com sucesso',
    };
  }

  @Get('bets')
  async getBets() {
    return this.prisma.bet.findMany({
      orderBy: { createdAt: 'desc' },
    });
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

        markets: body.markets || null,
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

        markets: body.markets || null,
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
    await this.prisma.bet.delete({
      where: { id },
    });

    return {
      message: 'Palpite excluído com sucesso',
    };
  }
}