import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const bets = await this.prisma.bet.findMany();

    const totalBets = bets.length;
    const wonBets = bets.filter((bet) => bet.status === 'won').length;
    const lostBets = bets.filter((bet) => bet.status === 'lost').length;
    const openBets = bets.filter((bet) => bet.status === 'open').length;

    const finishedBets = wonBets + lostBets;

    const winRate =
      finishedBets > 0 ? Number(((wonBets / finishedBets) * 100).toFixed(2)) : 0;

    const averageOdd =
      totalBets > 0
        ? Number(
            (
              bets.reduce((sum, bet) => sum + Number(bet.odd || 0), 0) /
              totalBets
            ).toFixed(2),
          )
        : 0;

    const leagueStats: Record<string, number> = {};

    bets.forEach((bet) => {
      if (bet.league) {
        leagueStats[bet.league] = (leagueStats[bet.league] || 0) + 1;
      }
    });

    const bestLeague =
      Object.entries(leagueStats).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const marketStats: Record<string, number> = {};

    bets.forEach((bet: any) => {
      const markets = Array.isArray(bet.markets) ? bet.markets : [];

      markets.forEach((market: any) => {
        const name = market.market || market.category;

        if (name) {
          marketStats[name] = (marketStats[name] || 0) + 1;
        }
      });
    });

    const bestMarket =
      Object.entries(marketStats).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const simulatedStake = 10;

    const profit = bets.reduce((sum, bet) => {
      if (bet.status === 'won') {
        return sum + (Number(bet.odd || 0) * simulatedStake - simulatedStake);
      }

      if (bet.status === 'lost') {
        return sum - simulatedStake;
      }

      return sum;
    }, 0);

    const totalInvested = finishedBets * simulatedStake;

    const roi =
      totalInvested > 0
        ? Number(((profit / totalInvested) * 100).toFixed(2))
        : 0;

    return {
      totalBets,
      wonBets,
      lostBets,
      openBets,
      winRate,
      averageOdd,
      bestLeague,
      bestMarket,
      simulatedStake,
      profit: Number(profit.toFixed(2)),
      roi,
    };
  }
}