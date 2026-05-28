import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BetsService } from './bets.service';

@Controller('bets')
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Get()
  async getAll() {
    return this.betsService.getAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.betsService.getById(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.betsService.create(body);
  }

  @Post('seed')
  async seed() {
    return this.betsService.seed();
  }
}