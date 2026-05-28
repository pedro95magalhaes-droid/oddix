import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  async getFavorites(@Req() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.favoriteService.getFavorites(userId);
  }

  @Post(':betId')
  async addFavorite(@Req() req: any, @Param('betId') betId: string) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.favoriteService.addFavorite(userId, betId);
  }

  @Delete(':betId')
  async removeFavorite(@Req() req: any, @Param('betId') betId: string) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.favoriteService.removeFavorite(userId, betId);
  }
}