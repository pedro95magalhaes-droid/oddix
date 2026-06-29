import { Controller, Get, Param, Query } from '@nestjs/common';
import { FootballService } from './football.service';

@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  private isRefreshRequest(refresh?: string) {
    return ["1", "true", "yes", "sim", "on"].includes(
      String(refresh || "").trim().toLowerCase(),
    );
  }

  private isDisabledRequest(value?: string) {
    return ["0", "false", "no", "nao", "não", "off"].includes(
      String(value || "").trim().toLowerCase(),
    );
  }

  /**
   * Compatibilidade: permite testar direto /football.
   */
  @Get()
  async getRootFixtures(
    @Query('date') date?: string,
    @Query('refresh') refresh?: string,
    @Query('fallback') fallback?: string,
  ) {
    return this.footballService.getFixtures(date, {
      forceRefresh: this.isRefreshRequest(refresh),
      allowEmptyFallback: !this.isDisabledRequest(fallback),
    });
  }

  @Get('fixtures')
  async getFixtures(
    @Query('date') date?: string,
    @Query('refresh') refresh?: string,
    @Query('fallback') fallback?: string,
  ) {
    return this.footballService.getFixtures(date, {
      forceRefresh: this.isRefreshRequest(refresh),
      allowEmptyFallback: !this.isDisabledRequest(fallback),
    });
  }

  @Get('today')
  async getTodayFixtures(
    @Query('date') date?: string,
    @Query('refresh') refresh?: string,
    @Query('fallback') fallback?: string,
  ) {
    return this.footballService.getFixtures(date, {
      forceRefresh: this.isRefreshRequest(refresh),
      allowEmptyFallback: !this.isDisabledRequest(fallback),
    });
  }

  @Get('dashboard')
  async getDashboardFixtures(
    @Query('date') date?: string,
    @Query('refresh') refresh?: string,
    @Query('fallback') fallback?: string,
  ) {
    return this.footballService.getFixtures(date, {
      forceRefresh: this.isRefreshRequest(refresh),
      allowEmptyFallback: !this.isDisabledRequest(fallback),
    });
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


  /**
   * Rota simples para confirmar no Railway qual build está rodando.
   */
  @Get('build-info')
  async buildInfo() {
    return {
      ok: true,
      service: 'oddix-football',
      oddixFix: 'worldcup-direct-return-v3-flashscore-debug',
      timestamp: new Date().toISOString(),
    };
  }


  @Get('lineups/:fixtureId')
  async getLineups(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getLineups(fixtureId);
  }

  @Get('player-props/:fixtureId')
  async getPlayerProps(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getPlayerProps(fixtureId);
  }

  @Get('fixture/:fixtureId')
  async getFixtureById(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureById(fixtureId);
  }
}
