import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async getMyHistory(@Req() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.historyService.getMyHistory(userId);
  }

  @Post(':betId')
  async addToHistory(@Req() req: any, @Param('betId') betId: string) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.historyService.addToHistory(userId, betId);
  }

  @Delete(':betId')
  async removeFromHistory(@Req() req: any, @Param('betId') betId: string) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.historyService.removeFromHistory(userId, betId);
  }
}