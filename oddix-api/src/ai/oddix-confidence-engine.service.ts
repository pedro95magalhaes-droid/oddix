import { Injectable } from '@nestjs/common';

type RiskLevel = 'Baixo' | 'Médio' | 'Alto';

type ConfidenceInput = {
  minute?: number | null;
  statusShort?: string | null;
  homeTeam?: string;
  awayTeam?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  odd?: number | null;
  oldOdd?: number | null;
  originalOdd?: number | null;
  prematchOdd?: number | null;
  trend?: string | null;
  marketKey?: string;
  tip?: string;
  possessionHome?: number | null;
  possessionAway?: number | null;
  attacksHome?: number | null;
  attacksAway?: number | null;
  dangerousAttacksHome?: number | null;
  dangerousAttacksAway?: number | null;
  shotsTotalHome?: number | null;
  shotsTotalAway?: number | null;
  shotsOnGoalHome?: number | null;
  shotsOnGoalAway?: number | null;
  cornersHome?: number | null;
  cornersAway?: number | null;
  yellowCardsHome?: number | null;
  yellowCardsAway?: number | null;
};

@Injectable()
export class OddixConfidenceEngineService {
  calculate(input: ConfidenceInput) {
    const minute = Number(input.minute || 0);
    const odd = Number(input.odd || 1);
    const marketKey = String(input.marketKey || '');
    const tip = String(input.tip || '');
    const statusShort = String(input.statusShort || '').toUpperCase();

    const homeGoals = Number(input.homeGoals || 0);
    const awayGoals = Number(input.awayGoals || 0);
    const totalGoals = homeGoals + awayGoals;

    const possessionHome = this.safeNumber(input.possessionHome, 50);
    const possessionAway = this.safeNumber(input.possessionAway, 50);
    const attacksHome = this.safeNumber(input.attacksHome, 0);
    const attacksAway = this.safeNumber(input.attacksAway, 0);
    const dangerousAttacksHome = this.safeNumber(input.dangerousAttacksHome, 0);
    const dangerousAttacksAway = this.safeNumber(input.dangerousAttacksAway, 0);
    const shotsTotalHome = this.safeNumber(input.shotsTotalHome, 0);
    const shotsTotalAway = this.safeNumber(input.shotsTotalAway, 0);
    const shotsOnGoalHome = this.safeNumber(input.shotsOnGoalHome, 0);
    const shotsOnGoalAway = this.safeNumber(input.shotsOnGoalAway, 0);
    const cornersHome = this.safeNumber(input.cornersHome, 0);
    const cornersAway = this.safeNumber(input.cornersAway, 0);
    const yellowCardsHome = this.safeNumber(input.yellowCardsHome, 0);
    const yellowCardsAway = this.safeNumber(input.yellowCardsAway, 0);

    const dominanceHome = this.clamp(
      50 +
        (possessionHome - possessionAway) * 0.2 +
        (dangerousAttacksHome - dangerousAttacksAway) * 0.55 +
        (shotsOnGoalHome - shotsOnGoalAway) * 4 +
        (cornersHome - cornersAway) * 1.8,
      5,
      95,
    );

    const dominanceAway = this.clamp(100 - dominanceHome, 5, 95);

    const dominantTeam =
      dominanceHome >= dominanceAway + 8
        ? input.homeTeam || 'Mandante'
        : dominanceAway >= dominanceHome + 8
        ? input.awayTeam || 'Visitante'
        : 'Jogo equilibrado';

    const totalShots = shotsTotalHome + shotsTotalAway + shotsOnGoalHome + shotsOnGoalAway;
    const totalShotsOnGoal = shotsOnGoalHome + shotsOnGoalAway;
    const totalDangerous = dangerousAttacksHome + dangerousAttacksAway;
    const totalCorners = cornersHome + cornersAway;
    const totalCards = yellowCardsHome + yellowCardsAway;

    let score = 58;
    const reasons: string[] = [];

    if (['FT', 'AET', 'PEN', 'CANC', 'PST', 'ABD'].includes(statusShort)) {
      return this.result({
        score: 20,
        confidence: 35,
        risk: 'Alto',
        send: false,
        level: 'IGNORAR',
        category: 'FINISHED',
        dominanceHome,
        dominanceAway,
        dominantTeam,
        reasons: ['Jogo finalizado ou inválido para nova entrada.'],
      });
    }

    if (minute > 0 && minute < 8) {
      score -= 8;
      reasons.push('Jogo ainda muito cedo; aguardando leitura de volume.');
    }

    if (minute >= 75) {
      score -= 10;
      reasons.push('Reta final com risco maior de odd instável.');
    }

    if (odd >= 1.35 && odd <= 2.2) {
      score += 10;
      reasons.push('Odd dentro da faixa saudável do Oddix.');
    } else if (odd > 2.2 && odd <= 2.8) {
      score += 2;
      reasons.push('Odd com valor, mas risco moderado.');
    } else if (odd < 1.25) {
      score -= 9;
      reasons.push('Odd muito baixa para exposição principal.');
    } else {
      score -= 12;
      reasons.push('Odd alta demais para padrão seguro.');
    }

    if (totalDangerous >= 28) {
      score += 10;
      reasons.push('Volume alto de ataques perigosos.');
    } else if (totalDangerous >= 18) {
      score += 6;
      reasons.push('Ataques perigosos em bom ritmo.');
    }

    if (totalShotsOnGoal >= 5) {
      score += 9;
      reasons.push('Boa quantidade de chutes no alvo.');
    } else if (totalShotsOnGoal >= 3) {
      score += 5;
      reasons.push('Finalizações no alvo suficientes para sustentar mercado.');
    }

    if (totalShots >= 12) {
      score += 6;
      reasons.push('Volume geral de finalizações positivo.');
    }

    if (totalCorners >= 6) {
      score += 5;
      reasons.push('Escanteios indicam pressão ofensiva.');
    }

    if (totalCards >= 5) {
      score -= 4;
      reasons.push('Cartões elevados aumentam volatilidade.');
    }

    const normalizedTip = this.normalize(tip);

    if (marketKey === 'totals' || normalizedTip.includes('over') || normalizedTip.includes('under')) {
      if (normalizedTip.includes('under')) {
        if (totalGoals <= 1 && minute >= 25) {
          score += 9;
          reasons.push('Placar controlado favorece linha de under.');
        }
        if (totalShotsOnGoal >= 6 && minute < 60) {
          score -= 6;
          reasons.push('Muitos chutes no alvo reduzem segurança do under.');
        }
      }

      if (normalizedTip.includes('over')) {
        if (totalDangerous >= 25 || totalShotsOnGoal >= 4) {
          score += 8;
          reasons.push('Pressão ofensiva sustenta mercado de over.');
        }
        if (minute >= 70 && totalGoals <= 1) {
          score -= 5;
          reasons.push('Pouco tempo restante para buscar over.');
        }
      }
    }

    if (marketKey === 'double_chance') {
      score += 7;
      reasons.push('Dupla chance reduz exposição ao resultado seco.');
    }

    if (marketKey === 'btts') {
      if (shotsOnGoalHome >= 2 && shotsOnGoalAway >= 2) {
        score += 8;
        reasons.push('Ambos os times chegaram bem no alvo.');
      } else {
        score -= 5;
        reasons.push('BTTS sem confirmação forte dos dois ataques.');
      }
    }

    if (marketKey === 'h2h') {
      score -= 10;
      reasons.push('Resultado seco tem risco maior no padrão Oddix.');
    }

    if (marketKey === 'spreads') {
      score += 3;
      reasons.push('Handicap protege parcialmente a entrada.');
    }

    const confidence = this.clamp(Math.round(score), 35, 96);

    const risk: RiskLevel =
      confidence >= 82 && odd <= 2.2
        ? 'Baixo'
        : confidence >= 72 && odd <= 2.6
        ? 'Médio'
        : 'Alto';

    const send = confidence >= 75 && risk !== 'Alto' && minute < 78;

    const level =
      confidence >= 88
        ? 'MUITO_FORTE'
        : confidence >= 80
        ? 'FORTE'
        : confidence >= 72
        ? 'BOM'
        : 'FRACO';

    const category =
      risk === 'Baixo'
        ? 'SAFE'
        : risk === 'Médio'
        ? 'VALUE'
        : 'RISKY';

    if (!reasons.length) {
      reasons.push('Entrada avaliada por estatística, mercado e momento do jogo.');
    }

    return this.result({
      score: confidence,
      confidence,
      risk,
      send,
      level,
      category,
      dominanceHome,
      dominanceAway,
      dominantTeam,
      reasons,
    });
  }

  private normalize(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private safeNumber(value: any, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private result(data: {
    score: number;
    confidence: number;
    risk: RiskLevel;
    send: boolean;
    level: string;
    category: string;
    dominanceHome: number;
    dominanceAway: number;
    dominantTeam: string;
    reasons: string[];
  }) {
    return {
      score: Math.round(data.score),
      confidence: Math.round(data.confidence),
      risk: data.risk,
      send: data.send,
      level: data.level,
      category: data.category,
      dominanceHome: Math.round(data.dominanceHome),
      dominanceAway: Math.round(data.dominanceAway),
      dominantTeam: data.dominantTeam,
      reasons: data.reasons,
    };
  }
}
