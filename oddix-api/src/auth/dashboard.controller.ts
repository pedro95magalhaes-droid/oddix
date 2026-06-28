import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly authService: AuthService) {}

  private getUserId(req: any) {
    return req.user.userId || req.user.sub || req.user.id;
  }

  @Get()
  async all(@Req() req: any) {
    return this.authService.getDashboard(this.getUserId(req));
  }

  @Get('overview')
  async overview(@Req() req: any) {
    return this.authService.getDashboardOverview(this.getUserId(req));
  }

  @Get('games')
  async games(@Req() req: any) {
    return this.authService.getDashboardGames(this.getUserId(req));
  }

  @Get('bets')
  async bets(@Req() req: any) {
    return this.authService.getDashboardBets(this.getUserId(req));
  }

  @Get('players')
  async players(@Req() req: any) {
    return this.authService.getDashboardPlayers(this.getUserId(req));
  }

  @Get('markets')
  async markets(@Req() req: any) {
    return this.authService.getDashboardMarkets(this.getUserId(req));
  }

  @Get('compliance')
  async compliance(@Req() req: any) {
    return this.authService.getDashboardCompliance(this.getUserId(req));
  }

  @Get('bankroll')
  async bankroll(@Req() req: any) {
    return this.authService.getDashboardBankroll(this.getUserId(req));
  }

  @Post('bankroll')
  async setBankroll(@Req() req: any, @Body() body: any) {
    return this.authService.setDashboardBankroll(this.getUserId(req), body);
  }

  @Post('bets')
  async createBet(@Req() req: any, @Body() body: any) {
    return this.authService.createDashboardBet(this.getUserId(req), body);
  }

  @Patch('bets/:id')
  async updateBet(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.authService.updateDashboardBet(this.getUserId(req), id, body);
  }

  @Delete('bets/:id')
  async deleteBet(@Req() req: any, @Param('id') id: string) {
    return this.authService.deleteDashboardBet(this.getUserId(req), id);
  }

}
