import { Injectable } from '@nestjs/common';

export type OddixConfidenceLevel = 'IGNORA' | 'BOM' | 'FORTE' | 'ELITE' | 'ABSURDO';
export type OddixMarketCategory = 'SAFE' | 'BOOST' | 'EXTREME';

export type OddixConfidenceInput = {
  minute?: number;
  statusShort?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeGoals?: number;
  awayGoals?: number;

  possessionHome?: number;
  possessionAway?: number;

  attacksHome?: number;
  attacksAway?: number;
  dangerousAttacksHome?: number;
  dangerousAttacksAway?: number;

  shotsTotalHome?: number;
  shotsTotalAway?: number;
  shotsOnGoalHome?: number;
  shotsOnGoalAway?: number;

  cornersHome?: number;
  cornersAway?: number;
  yellowCardsHome?: number;
  yellowCardsAway?: number;

  odd?: number;
  oldOdd?: number;
  originalOdd?: number;
  prematchOdd?: number;
  trend?: number;

  marketKey?: string;
  tip?: string;
};

export type OddixConfidenceResult = {
  score: number;
  confidence: number;
  level: OddixConfidenceLevel;
  category: OddixMarketCategory;
  send: boolean;
  risk: 'Baixo' | 'Médio' | 'Alto';
  dominantSide: 'home' | 'away' | 'balanced';
  dominantTeam: string;
  dominanceHome: number;
  dominanceAway: number;
  recommendedMarket: string;
  recommendedTip: string;
  reasons: string[];
};

@Injectable()
export class OddixConfidenceEngineService {
  calculate(input: OddixConfidenceInput): OddixConfidenceResult {
    const minute = this.num(input.minute);
    const homeTeam = input.homeTeam || 'Casa';
    const awayTeam = input.awayTeam || 'Visitante';
    const homeGoals = this.num(input.homeGoals);
    const awayGoals = this.num(input.awayGoals);
    const odd = this.num(input.odd || 1);

    const dominance = this.calculateDominance(input);
    const dominantSide = this.getDominantSide(dominance.home, dominance.away);
    const dominantTeam = dominantSide === 'home' ? homeTeam : dominantSide === 'away' ? awayTeam : 'Jogo equilibrado';

    const reasons: string[] = [];
    let score = 50;

    const dominanceGap = Math.abs(dominance.home - dominance.away);
    if (dominanceGap >= 35) {
      score += 22;
      reasons.push(`Dominância muito forte (${dominance.home}% x ${dominance.away}%).`);
    } else if (dominanceGap >= 22) {
      score += 15;
      reasons.push(`Boa vantagem territorial (${dominance.home}% x ${dominance.away}%).`);
    } else if (dominanceGap >= 12) {
      score += 8;
      reasons.push(`Leve superioridade detectada (${dominance.home}% x ${dominance.away}%).`);
    } else {
      score -= 6;
      reasons.push('Jogo ainda equilibrado, sem domínio claro.');
    }

    const shotsOnGoalTotal = this.num(input.shotsOnGoalHome) + this.num(input.shotsOnGoalAway);
    const shotsTotal = this.num(input.shotsTotalHome) + this.num(input.shotsTotalAway);
    const cornersTotal = this.num(input.cornersHome) + this.num(input.cornersAway);
    const dangerousTotal = this.num(input.dangerousAttacksHome) + this.num(input.dangerousAttacksAway);
    const totalGoals = homeGoals + awayGoals;

    if (shotsOnGoalTotal >= 8) {
      score += 14;
      reasons.push(`Volume alto de chutes no gol (${shotsOnGoalTotal}).`);
    } else if (shotsOnGoalTotal >= 5) {
      score += 9;
      reasons.push(`Bom volume de chutes no gol (${shotsOnGoalTotal}).`);
    }

    if (shotsTotal >= 22) {
      score += 10;
      reasons.push(`Jogo com muitas finalizações (${shotsTotal}).`);
    } else if (shotsTotal >= 16) {
      score += 6;
      reasons.push(`Finalizações em ritmo interessante (${shotsTotal}).`);
    }

    if (cornersTotal >= 9) {
      score += 10;
      reasons.push(`Escanteios altos para o minuto (${cornersTotal}).`);
    } else if (cornersTotal >= 6) {
      score += 6;
      reasons.push(`Escanteios em boa linha (${cornersTotal}).`);
    }

    if (dangerousTotal >= 110) {
      score += 12;
      reasons.push(`Ataques perigosos muito fortes (${dangerousTotal}).`);
    } else if (dangerousTotal >= 75) {
      score += 8;
      reasons.push(`Ataques perigosos relevantes (${dangerousTotal}).`);
    }

    if (minute >= 18 && minute <= 78) {
      score += 6;
      reasons.push(`Minuto bom para entrada (${minute}').`);
    } else if (minute > 82) {
      score -= 10;
      reasons.push('Reta final avançada: risco maior.');
    } else if (minute > 0 && minute < 12) {
      score -= 7;
      reasons.push('Jogo muito cedo: pouca amostra ao vivo.');
    }

    const oddScore = this.scoreOdd(odd, input);
    score += oddScore.points;
    if (oddScore.reason) reasons.push(oddScore.reason);

    if (totalGoals >= 3 && minute >= 60) {
      score -= 5;
      reasons.push('Jogo já teve muitos gols; cuidado com entrada tardia em over.');
    }

    if (this.isFinished(input.statusShort)) {
      score = 0;
      reasons.push('Jogo finalizado: entrada bloqueada.');
    }

    score = this.clamp(Math.round(score), 0, 100);
    const level = this.getLevel(score);
    const category = this.getCategory(odd, score);
    const risk = this.getRisk(score, odd, minute);
    const market = this.chooseMarket(input, dominantSide, totalGoals, cornersTotal, shotsOnGoalTotal, minute);

    return {
      score,
      confidence: score,
      level,
      category,
      send: this.shouldSend(score, odd),
      risk,
      dominantSide,
      dominantTeam,
      dominanceHome: dominance.home,
      dominanceAway: dominance.away,
      recommendedMarket: market.market,
      recommendedTip: market.tip,
      reasons: reasons.slice(0, 6),
    };
  }

  private calculateDominance(input: OddixConfidenceInput) {
    const home = {
      possession: this.num(input.possessionHome),
      attacks: this.num(input.attacksHome),
      dangerous: this.num(input.dangerousAttacksHome),
      shots: this.num(input.shotsTotalHome),
      shotsOnGoal: this.num(input.shotsOnGoalHome),
      corners: this.num(input.cornersHome),
    };

    const away = {
      possession: this.num(input.possessionAway),
      attacks: this.num(input.attacksAway),
      dangerous: this.num(input.dangerousAttacksAway),
      shots: this.num(input.shotsTotalAway),
      shotsOnGoal: this.num(input.shotsOnGoalAway),
      corners: this.num(input.cornersAway),
    };

    const homeScore =
      home.possession * 0.08 +
      home.attacks * 0.12 +
      home.dangerous * 0.28 +
      home.shots * 0.18 +
      home.shotsOnGoal * 0.24 +
      home.corners * 0.1;

    const awayScore =
      away.possession * 0.08 +
      away.attacks * 0.12 +
      away.dangerous * 0.28 +
      away.shots * 0.18 +
      away.shotsOnGoal * 0.24 +
      away.corners * 0.1;

    const total = homeScore + awayScore;
    if (total <= 0) return { home: 50, away: 50 };

    const homePct = Math.round((homeScore / total) * 100);
    return { home: homePct, away: 100 - homePct };
  }

  private chooseMarket(
    input: OddixConfidenceInput,
    dominantSide: 'home' | 'away' | 'balanced',
    totalGoals: number,
    cornersTotal: number,
    shotsOnGoalTotal: number,
    minute: number,
  ) {
    const homeTeam = input.homeTeam || 'Casa';
    const awayTeam = input.awayTeam || 'Visitante';
    const dominantTeam = dominantSide === 'home' ? homeTeam : dominantSide === 'away' ? awayTeam : homeTeam;

    if (cornersTotal >= 8 && minute <= 75) {
      return { market: 'Escanteios', tip: `Over ${cornersTotal + 0.5} escanteios` };
    }

    if (shotsOnGoalTotal >= 6 && minute <= 78) {
      return { market: 'Chutes no gol', tip: `Over ${shotsOnGoalTotal + 0.5} chutes no gol` };
    }

    if (dominantSide !== 'balanced' && minute >= 55 && minute <= 82) {
      return { market: 'Próximo gol', tip: `Próximo gol ${dominantTeam}` };
    }

    if (totalGoals <= 1 && minute >= 55) {
      return { market: 'Total de gols', tip: 'Under 3.5 gols' };
    }

    if (totalGoals >= 2 && minute <= 70) {
      return { market: 'Total de gols', tip: 'Over 2.5 gols' };
    }

    return { market: 'Total de gols', tip: 'Over 1.5 gols' };
  }

  private scoreOdd(odd: number, input: OddixConfidenceInput) {
    let points = 0;
    let reason = '';

    if (odd >= 1.4 && odd <= 2.0) {
      points += 10;
      reason = `Odd dentro da zona ideal (${odd}).`;
    } else if (odd > 2.0 && odd <= 2.3) {
      points += 3;
      reason = `Odd alta com possível valor (${odd}), exige confiança maior.`;
    } else if (odd > 2.3) {
      points -= 12;
      reason = `Odd muito alta (${odd}), risco elevado.`;
    } else if (odd > 0 && odd < 1.4) {
      points -= 8;
      reason = `Odd baixa demais (${odd}), pouco valor.`;
    }

    const oldOdd = this.num(input.oldOdd);
    const originalOdd = this.num(input.originalOdd || input.prematchOdd);
    const trend = this.num(input.trend);

    if (oldOdd > 0 && odd > 0 && odd < oldOdd) {
      points += 7;
      reason += ` Odd caiu de ${oldOdd} para ${odd}.`;
    }

    if (originalOdd > 0 && odd > 0 && odd < originalOdd) {
      points += 8;
      reason += ` Mercado veio de ${originalOdd} para ${odd}.`;
    }

    if (trend === 1) points += 4;
    if (trend === 3) points -= 2;

    return { points, reason: reason.trim() };
  }

  private shouldSend(score: number, odd: number) {
    if (score < 80) return false;
    if (odd > 2.3) return score >= 95;
    if (odd > 2.0) return score >= 90;
    return true;
  }

  private getLevel(score: number): OddixConfidenceLevel {
    if (score >= 95) return 'ABSURDO';
    if (score >= 90) return 'ELITE';
    if (score >= 85) return 'FORTE';
    if (score >= 80) return 'BOM';
    return 'IGNORA';
  }

  private getCategory(odd: number, score: number): OddixMarketCategory {
    if (odd >= 4 && score >= 95) return 'EXTREME';
    if (odd >= 2.2) return 'BOOST';
    return 'SAFE';
  }

  private getRisk(score: number, odd: number, minute: number): 'Baixo' | 'Médio' | 'Alto' {
    if (score >= 90 && odd <= 2.1 && minute <= 80) return 'Baixo';
    if (score >= 84 && odd <= 2.35) return 'Médio';
    return 'Alto';
  }

  private getDominantSide(home: number, away: number): 'home' | 'away' | 'balanced' {
    if (home >= away + 12) return 'home';
    if (away >= home + 12) return 'away';
    return 'balanced';
  }

  private isFinished(statusShort?: string) {
    const short = String(statusShort || '').toUpperCase();
    return ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short);
  }

  private num(value: any) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value).replace('%', '').replace(',', '.').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
