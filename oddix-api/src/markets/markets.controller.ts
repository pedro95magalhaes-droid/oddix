import { Controller, Get } from '@nestjs/common';
import { MarketsService } from './markets.service';

@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get()
  getCatalog() {
    return this.marketsService.getCatalog();
  }

  @Get('flat')
  getFlatMarkets() {
    return this.marketsService.getFlatMarkets();
  }
}