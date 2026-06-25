import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.authService.me(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async dashboard(@Req() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.authService.getDashboard(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/dashboard')
  async adminDashboard(@Req() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.authService.getAdminDashboard(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/user-plan')
  async adminUpdateUserPlan(@Req() req: any, @Body() body: any) {
    const actorUserId = req.user.userId || req.user.sub || req.user.id;
    return this.authService.adminUpdateUserPlan(actorUserId, body.userId, body.plan);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('plan')
  async updatePlan(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.authService.updatePlan(userId, body.plan);
  }
}
