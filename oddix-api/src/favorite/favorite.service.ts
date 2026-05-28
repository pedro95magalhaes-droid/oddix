import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  async addFavorite(userId: string, betId: string) {
    return this.prisma.userFavoriteBet.upsert({
      where: {
        userId_betId: {
          userId,
          betId,
        },
      },
      update: {},
      create: {
        userId,
        betId,
      },
      include: {
        bet: true,
      },
    });
  }

  async getFavorites(userId: string) {
    return this.prisma.userFavoriteBet.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        bet: true,
      },
    });
  }

  async removeFavorite(userId: string, betId: string) {
    await this.prisma.userFavoriteBet.delete({
      where: {
        userId_betId: {
          userId,
          betId,
        },
      },
    });

    return {
      message: 'Palpite removido dos favoritos',
    };
  }
}