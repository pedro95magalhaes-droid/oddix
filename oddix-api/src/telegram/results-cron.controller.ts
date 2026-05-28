import { Controller, Get, Query } from '@nestjs/common';
import { ResultsCronService } from './results-cron.service.telegram';

@Controller('telegram')
export class ResultsCronController {
  constructor(private readonly resultsCronService: ResultsCronService) {}

  @Get('debug-results')
  async debugResults() {
    return this.resultsCronService.syncResults('manual');
  }

  @Get('debug-fixtures')
  async debugFixtures(@Query('date') date: string) {
    return this.resultsCronService.debugFixturesByDate(date);
  }
}