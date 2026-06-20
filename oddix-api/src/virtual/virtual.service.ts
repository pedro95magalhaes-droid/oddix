import { Injectable } from '@nestjs/common';
import { VirtualBadge, VirtualPick, VirtualStats } from './virtual.types';

@Injectable()
export class VirtualService {
  private readonly leagues = [
    'Euro Cup Virtual',
    'Copa Virtual',
    'Super Liga Virtual',
    'Primeira Liga Virtual',
    'Express Virtual',
  ];

  private getBadge(confidence: number): VirtualBadge {
    if (confidence >= 93) return 'ELITE';
    if (confidence >= 85) return 'MUITO_FORTE';
    return 'FORTE';
  }

  getLeagues() {
    return {
      success: true,
      total: this.leagues.length,
      leagues: this.leagues,
    };
  }

  getUpcoming() {
    return {
      success: true,
      matches: this.leagues.map((league, index) => ({
        id: `virtual-match-${index + 1}`,
        league,
        homeTeam: `Oddix ${index + 1}`,
        awayTeam: `Virtual ${index + 2}`,
        kickoff: new Date(Date.now() + (index + 1) * 5 * 60 * 1000).toISOString(),
        status: 'UPCOMING',
      })),
    };
  }

  getTopPicks(): { success: boolean; picks: VirtualPick[] } {
    const picks: VirtualPick[] = [
      {
        id: 'vp-001',
        league: 'Euro Cup Virtual',
        homeTeam: 'Virtual Madrid',
        awayTeam: 'Virtual Milan',
        market: 'Over 2.5 Gols',
        tip: 'Mais de 2.5 gols',
        odd: 1.82,
        confidence: 94,
        badge: this.getBadge(94),
        status: 'PENDING',
        profit: 0,
        roi: 0,
        kickoff: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        reason: 'Padrão ofensivo forte, alta média de gols e sequência positiva no modelo virtual.',
      },
      {
        id: 'vp-002',
        league: 'Copa Virtual',
        homeTeam: 'Virtual Brasil',
        awayTeam: 'Virtual França',
        market: 'Ambas Marcam',
        tip: 'BTTS Sim',
        odd: 1.75,
        confidence: 88,
        badge: this.getBadge(88),
        status: 'PENDING',
        profit: 0,
        roi: 0,
        kickoff: new Date(Date.now() + 14 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        reason: 'As duas equipes apresentam padrão recorrente de gol marcado e sofrido.',
      },
      {
        id: 'vp-003',
        league: 'Super Liga Virtual',
        homeTeam: 'Virtual City',
        awayTeam: 'Virtual Bayern',
        market: 'Dupla Chance',
        tip: 'Casa ou Empate',
        odd: 1.48,
        confidence: 82,
        badge: this.getBadge(82),
        status: 'PENDING',
        profit: 0,
        roi: 0,
        kickoff: new Date(Date.now() + 21 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        reason: 'Mandante com melhor consistência recente e baixa taxa de derrota no padrão analisado.',
      },
    ];

    return {
      success: true,
      picks,
    };
  }

  getStats(): { success: boolean; stats: VirtualStats } {
    return {
      success: true,
      stats: {
        greens: 128,
        reds: 32,
        voids: 4,
        pending: 6,
        total: 170,
        winRate: 80,
        roi: 23.4,
        profit: 56.3,
        streak: 9,
        bestStreak: 15,
      },
    };
  }

  getHistory() {
    return {
      success: true,
      history: [
        {
          id: 'vh-001',
          date: new Date().toISOString(),
          league: 'Euro Cup Virtual',
          market: 'Over 2.5 Gols',
          tip: 'Mais de 2.5 gols',
          odd: 1.82,
          status: 'GREEN',
          profit: 0.82,
          badge: 'ELITE',
        },
        {
          id: 'vh-002',
          date: new Date().toISOString(),
          league: 'Copa Virtual',
          market: 'BTTS',
          tip: 'Ambas marcam',
          odd: 1.75,
          status: 'GREEN',
          profit: 0.75,
          badge: 'MUITO_FORTE',
        },
        {
          id: 'vh-003',
          date: new Date().toISOString(),
          league: 'Express Virtual',
          market: 'Over 1.5 Gols',
          tip: 'Mais de 1.5 gols',
          odd: 1.42,
          status: 'RED',
          profit: -1,
          badge: 'FORTE',
        },
      ],
    };
  }

  getHallOfFame() {
    return {
      success: true,
      hallOfFame: {
        bestOdd: {
          league: 'Euro Cup Virtual',
          market: 'Over 3.5 Gols',
          odd: 2.35,
          result: 'GREEN',
        },
        bestRoi: {
          period: '7 dias',
          roi: 34.8,
        },
        bestStreak: {
          greens: 15,
        },
        topLeague: {
          league: 'Euro Cup Virtual',
          winRate: 84,
          roi: 28.2,
        },
      },
    };
  }

  getRoi() {
    return {
      success: true,
      roi: {
        today: 18.4,
        sevenDays: 23.4,
        thirtyDays: 31.7,
        profitToday: 12.6,
        profitSevenDays: 56.3,
        profitThirtyDays: 144.9,
      },
    };
  }

  getResults() {
    return {
      success: true,
      results: [
        'GREEN',
        'GREEN',
        'RED',
        'GREEN',
        'GREEN',
        'GREEN',
        'VOID',
        'GREEN',
      ],
    };
  }

  getPickById(id: string) {
    const pick = this.getTopPicks().picks.find((item) => item.id === id);

    return {
      success: Boolean(pick),
      pick: pick ?? null,
    };
  }
}