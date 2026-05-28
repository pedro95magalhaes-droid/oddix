import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  @Patch('plan')
  async updatePlan(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;

    return this.authService.updatePlan(userId, body.plan);
  }
}