import { Controller, Get, Param } from '@nestjs/common';
import { VirtualService } from './virtual.service';

@Controller('virtual')
export class VirtualController {
  constructor(private readonly virtualService: VirtualService) {}

  @Get('leagues')
  getLeagues() {
    return this.virtualService.getLeagues();
  }

  @Get('upcoming')
  getUpcoming() {
    return this.virtualService.getUpcoming();
  }

  @Get('top-picks')
  getTopPicks() {
    return this.virtualService.getTopPicks();
  }

  @Get('stats')
  getStats() {
    return this.virtualService.getStats();
  }

  @Get('history')
  getHistory() {
    return this.virtualService.getHistory();
  }

  @Get('hall-of-fame')
  getHallOfFame() {
    return this.virtualService.getHallOfFame();
  }

  @Get('roi')
  getRoi() {
    return this.virtualService.getRoi();
  }

  @Get('results')
  getResults() {
    return this.virtualService.getResults();
  }

  @Get('pick/:id')
  getPickById(@Param('id') id: string) {
    return this.virtualService.getPickById(id);
  }
}