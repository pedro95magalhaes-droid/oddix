import { Controller, Get, Param, Query } from '@nestjs/common';
import { FootballService } from './football.service';

@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('fixtures')
  async getFixtures(@Query('date') date: string) {
    return this.footballService.getFixtures(date);
  }

  @Get('fixture/:fixtureId')
  async getFixtureById(@Param('fixtureId') fixtureId: string) {
    return this.footballService.getFixtureById(fixtureId);
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
  async debug(@Query('date') date: string) {
    return this.footballService.debug(date);
  }
}
