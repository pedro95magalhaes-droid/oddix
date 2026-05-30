import { Controller, Get, Param, Query } from '@nestjs/common';
import { FootballService } from './football.service';

@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('fixtures')
  async getFixtures(@Query('date') date?: string) {
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

  @Get('debug')
  async debug(@Query('date') date?: string) {
    return this.footballService.debug(date);
  }

  /**
   * Rota definitiva para limpar o Dashboard sem apagar tudo:
   * remove jogos encerrados/adiados/cancelados, jogos antigos e ligas ruins.
   */
  @Get('cache/cleanup')
  async cleanupCache() {
    return this.footballService.cleanupDashboardCache(true);
  }

  /**
   * Rota de emergência: apaga todo o cache de jogos.
   * Use quando o banco já estiver contaminado por dados antigos.
   */
  @Get('cache/clear')
  async clearCache() {
    return this.footballService.clearAllFixturesCache();
  }


  /**
   * Diagnóstico da Broadage por data.
   * Mostra quais ligas e jogos a Broadage retorna antes do filtro principal.
   */
  @Get('broadage/test')
  async testBroadage(@Query('date') date?: string) {
    return this.footballService.testBroadageLeagues(date);
  }

  /**
   * Diagnóstico dos torneios disponíveis na Broadage.
   * Útil para confirmar cobertura: Brasileirão, Libertadores, Premier League etc.
   */
  @Get('broadage/tournaments')
  async broadageTournaments(@Query('q') q?: string) {
    return this.footballService.getBroadageTournaments(q);
  }

  @Get('fixture/:fixtureId')
  async getFixtureById(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureById(fixtureId);
  }
}
