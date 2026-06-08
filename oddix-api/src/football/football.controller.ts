import { Controller, Get, Param, Query } from '@nestjs/common';
import { FootballService } from './football.service';

@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  /**
   * Compatibilidade: permite testar direto /football.
   */
  @Get()
  async getRootFixtures(@Query('date') date?: string) {
    return this.footballService.getFixtures(date);
  }

  @Get('fixtures')
  async getFixtures(@Query('date') date?: string) {
    return this.footballService.getFixtures(date);
  }

  @Get('today')
  async getTodayFixtures(@Query('date') date?: string) {
    return this.footballService.getFixtures(date);
  }

  @Get('dashboard')
  async getDashboardFixtures(@Query('date') date?: string) {
    return this.footballService.getFixtures(date);
  }

  @Get('live')
  async getLiveFixtures() {
    return this.footballService.getLiveFixtures();
  }

  @Get('leagues')
  async getLeagues() {
    return this.footballService.getLeagues();
  }

  @Get('statistics/:fixtureId')
  async getStatistics(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getStatistics(fixtureId);
  }

  @Get('lineups/:fixtureId')
  async getLineups(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getLineups(fixtureId);
  }

  @Get('debug')
  async debug(@Query('date') date?: string) {
    return this.footballService.debug(date);
  }

  /**
   * Remove jogos encerrados/adiados/cancelados, jogos antigos e ligas ruins do cache.
   */
  @Get('cache/cleanup')
  async cleanupCache() {
    return this.footballService.cleanupDashboardCache(true);
  }

  /**
   * Apaga todo o cache de jogos.
   */
  @Get('cache/clear')
  async clearCache() {
    return this.footballService.clearAllFixturesCache();
  }

  /**
   * Diagnóstico rápido da SportScore/SportScore6/FlashScore.
   */
  @Get('sportscore/debug')
  async sportScoreDebug(@Query('date') date?: string) {
    return this.footballService.debug(date);
  }

  @Get('fixture/:fixtureId')
  async getFixtureById(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureById(fixtureId);
  }
}
