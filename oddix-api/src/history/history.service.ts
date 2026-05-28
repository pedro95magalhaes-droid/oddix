import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async addToHistory(userId: string, betId: string) {
    return this.prisma.userBetHistory.upsert({
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

  async getMyHistory(userId: string) {
    return this.prisma.userBetHistory.findMany({
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

  async removeFromHistory(userId: string, betId: string) {
    await this.prisma.userBetHistory.delete({
      where: {
        userId_betId: {
          userId,
          betId,
        },
      },
    });

    return {
      message: 'Palpite removido do histórico',
    };
  }
}