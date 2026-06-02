import { Injectable } from '@nestjs/common';

export type OddixMarket = Record<string, any>;

export type OddixStatsSnapshot = {
  possessionHome?: number;
  possessionAway?: number;
  shotsHome?: number;
  shotsAway?: number;
  shotsOnHome?: number;
  shotsOnAway?: number;
  cornersHome?: number;
  cornersAway?: number;
  xgHome?: number;
  xgAway?: number;
  momentumHome?: number;
  momentumAway?: number;
  dangerousHome?: number;
  dangerousAway?: number;
};

export type OddixBoostContext = {
  fixtureId?: string | number;
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  provider?: string;
  qualityScore?: number;
  isLive?: boolean;
  elapsed?: number;
  totalGoals?: number;
  homeGoals?: number;
  awayGoals?: number;
  odds?: any;
  statistics?: any;
  stats?: OddixStatsSnapshot;
  seed?: number;
};

export type OddixBoostPick = OddixMarket & {
  oddixBoostV2: {
    family: string;
    score: number;
    selected: boolean;
    reasons: string[];
    stats: OddixStatsSnapshot;
  };
};

@Injectable()
export class OddixBoostV2Service {
  private normalize(value: any) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s.+-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private num(value: any, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private clamp(value: number, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  private hash(text: string) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private marketFamily(market: OddixMarket) {
    const text = this.normalize(
      `${market.key || ''} ${market.market || ''} ${market.tip || ''} ${market.category || ''} ${market.selection || ''}`,
    );

    if (
      text.includes('player') ||
      text.includes('jogador') ||
      text.includes('chute no gol') ||
      text.includes('finalizacao') ||
      text.includes('finalização') ||
      text.includes('assistencia') ||
      text.includes('assistência')
    ) {
      return 'player-props';
    }

    if (text.includes('escanteio') || text.includes('corner')) return 'corners';
    if (text.includes('ambas') || text.includes('btts')) return 'btts';
    if (text.includes('handicap') || text.includes('+1.5') || text.includes('+0.5') || text.includes('-1.5')) return 'handicap';
    if (text.includes('dupla') || text.includes('double chance') || text.includes('empate anula') || text.includes('dnb')) {
      return 'protection';
    }
    if (text.includes('under') || text.includes('over') || text.includes('gol')) return 'goals';

    return text.slice(0, 30) || 'generic';
  }

  private normalizeTipKey(market: OddixMarket) {
    return this.normalize(market.tip || market.selection || market.market)
      .replace(/\d+(?:[.,]\d+)?/g, 'x')
      .replace(/\b(casa|fora|time|jogo|ao vivo|pre jogo|pré jogo)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isRepeatedUnsafeTip(market: OddixMarket) {
    const tip = this.normalize(market.tip || market.selection);
    return (
      tip === 'under 4.5 gols' ||
      tip === 'under 3.5 gols' ||
      tip === 'over 1.5 gols' ||
      tip === 'ambas marcam sim' ||
      tip === 'ambas marcam - sim'
    );
  }

  private extractStatByLabels(stats: any, teamIndex: number, labels: string[]) {
    const team = stats?.teams?.[teamIndex] || stats?.statistics?.teams?.[teamIndex];
    const list = team?.statistics || team?.stats || [];

    if (!Array.isArray(list)) return undefined;

    const found = list.find((item: any) => {
      const label = this.normalize(item?.type || item?.name || item?.label || item?.title);
      return labels.some((target) => label.includes(this.normalize(target)));
    });

    if (!found) return undefined;

    return this.num(found.value ?? found.val ?? found.stat, undefined as any);
  }

  private extractFotmobStat(stats: any, side: 'home' | 'away', labels: string[]) {
    const blocks = [
      stats?.content?.stats?.Periods?.All?.stats,
      stats?.content?.stats?.periods?.all?.stats,
      stats?.stats?.Periods?.All?.stats,
      stats?.stats?.periods?.all?.stats,
      stats?.stats,
      stats?.statistics,
    ];

    for (const block of blocks) {
      if (!Array.isArray(block)) continue;

      for (const section of block) {
        const statsItems = section?.stats || section?.items || [];
        if (!Array.isArray(statsItems)) continue;

        for (const item of statsItems) {
          const title = this.normalize(item?.title || item?.name || item?.key);
          if (!labels.some((label) => title.includes(this.normalize(label)))) continue;

          const values = item?.stats || item?.values || [];
          if (Array.isArray(values)) {
            const index = side === 'home' ? 0 : 1;
            return this.num(values[index], undefined as any);
          }

          return this.num(side === 'home' ? item?.home : item?.away, undefined as any);
        }
      }
    }

    return undefined;
  }

  extractStats(input: any): OddixStatsSnapshot {
    const stats = input?.statistics || input?.stats || input || {};

    const fromApi = {
      possessionHome: this.extractStatByLabels(stats, 0, ['possession', 'posse']),
      possessionAway: this.extractStatByLabels(stats, 1, ['possession', 'posse']),
      shotsHome: this.extractStatByLabels(stats, 0, ['total shots', 'chutes', 'finalizacoes', 'finalizações']),
      shotsAway: this.extractStatByLabels(stats, 1, ['total shots', 'chutes', 'finalizacoes', 'finalizações']),
      shotsOnHome: this.extractStatByLabels(stats, 0, ['shots on goal', 'shots on target', 'chutes no gol', 'no gol']),
      shotsOnAway: this.extractStatByLabels(stats, 1, ['shots on goal', 'shots on target', 'chutes no gol', 'no gol']),
      cornersHome: this.extractStatByLabels(stats, 0, ['corner', 'escanteio']),
      cornersAway: this.extractStatByLabels(stats, 1, ['corner', 'escanteio']),
      xgHome: this.extractStatByLabels(stats, 0, ['expected goals', 'xg']),
      xgAway: this.extractStatByLabels(stats, 1, ['expected goals', 'xg']),
    };

    const fromFotmob = {
      possessionHome: this.extractFotmobStat(stats, 'home', ['possession', 'posse']),
      possessionAway: this.extractFotmobStat(stats, 'away', ['possession', 'posse']),
      shotsHome: this.extractFotmobStat(stats, 'home', ['total shots', 'shots', 'chutes']),
      shotsAway: this.extractFotmobStat(stats, 'away', ['total shots', 'shots', 'chutes']),
      shotsOnHome: this.extractFotmobStat(stats, 'home', ['shots on target', 'shots on goal', 'chutes no gol']),
      shotsOnAway: this.extractFotmobStat(stats, 'away', ['shots on target', 'shots on goal', 'chutes no gol']),
      cornersHome: this.extractFotmobStat(stats, 'home', ['corners', 'corner kicks', 'escanteios']),
      cornersAway: this.extractFotmobStat(stats, 'away', ['corners', 'corner kicks', 'escanteios']),
      xgHome: this.extractFotmobStat(stats, 'home', ['expected goals', 'xg']),
      xgAway: this.extractFotmobStat(stats, 'away', ['expected goals', 'xg']),
    };

    return {
      possessionHome: input?.possessionHome ?? fromApi.possessionHome ?? fromFotmob.possessionHome,
      possessionAway: input?.possessionAway ?? fromApi.possessionAway ?? fromFotmob.possessionAway,
      shotsHome: input?.shotsHome ?? fromApi.shotsHome ?? fromFotmob.shotsHome,
      shotsAway: input?.shotsAway ?? fromApi.shotsAway ?? fromFotmob.shotsAway,
      shotsOnHome: input?.shotsOnHome ?? fromApi.shotsOnHome ?? fromFotmob.shotsOnHome,
      shotsOnAway: input?.shotsOnAway ?? fromApi.shotsOnAway ?? fromFotmob.shotsOnAway,
      cornersHome: input?.cornersHome ?? fromApi.cornersHome ?? fromFotmob.cornersHome,
      cornersAway: input?.cornersAway ?? fromApi.cornersAway ?? fromFotmob.cornersAway,
      xgHome: input?.xgHome ?? fromApi.xgHome ?? fromFotmob.xgHome,
      xgAway: input?.xgAway ?? fromApi.xgAway ?? fromFotmob.xgAway,
      momentumHome: input?.momentumHome,
      momentumAway: input?.momentumAway,
      dangerousHome: input?.dangerousHome,
      dangerousAway: input?.dangerousAway,
    };
  }

  private statSum(stats: OddixStatsSnapshot, a: keyof OddixStatsSnapshot, b: keyof OddixStatsSnapshot) {
    return this.num(stats[a], 0) + this.num(stats[b], 0);
  }

  private dominantSide(context: OddixBoostContext, stats: OddixStatsSnapshot) {
    const homePower =
      this.num(stats.shotsOnHome, 0) * 5 +
      this.num(stats.shotsHome, 0) * 2 +
      this.num(stats.cornersHome, 0) * 1.5 +
      this.num(stats.xgHome, 0) * 8 +
      this.num(stats.momentumHome, 0) * 0.25;

    const awayPower =
      this.num(stats.shotsOnAway, 0) * 5 +
      this.num(stats.shotsAway, 0) * 2 +
      this.num(stats.cornersAway, 0) * 1.5 +
      this.num(stats.xgAway, 0) * 8 +
      this.num(stats.momentumAway, 0) * 0.25;

    if (homePower >= awayPower + 8) return { side: 'home', team: context.homeTeam || 'Casa', power: homePower - awayPower };
    if (awayPower >= homePower + 8) return { side: 'away', team: context.awayTeam || 'Fora', power: awayPower - homePower };

    return { side: 'balanced', team: '', power: Math.abs(homePower - awayPower) };
  }

  private scoreMarket(market: OddixMarket, context: OddixBoostContext, stats: OddixStatsSnapshot) {
    const confidence = this.num(market.confidence, 0);
    const odd = this.num(market.odd, 0);
    const risk = String(market.risk || 'Médio');
    const riskNorm = this.normalize(risk);
    const family = this.marketFamily(market);

    let score = confidence;
    const reasons: string[] = [];

    if (market.isRealOdd || market.source === 'FotMob' || market.source === 'The Odds API' || market.source === 'FlashScore') {
      score += 10;
      reasons.push('odd/dado real');
    }

    if (odd >= 1.25 && odd <= 2.0) {
      score += 8;
      reasons.push('odd segura');
    }

    if (odd > 2.1) {
      score -= 16;
      reasons.push('odd alta');
    }

    if (riskNorm.includes('baixo')) score += 10;
    if (riskNorm.includes('medio') || riskNorm.includes('médio')) score += 2;
    if (riskNorm.includes('alto')) score -= 35;

    if (family === 'player-props') score += 9;
    if (family === 'protection') score += 7;
    if (family === 'handicap') score += 6;
    if (family === 'btts') score += 2;
    if (family === 'corners') score += 3;

    if (this.isRepeatedUnsafeTip(market)) score -= 14;

    const elapsed = this.num(context.elapsed, 0);
    const totalGoals = this.num(context.totalGoals, 0);
    const totalCorners = this.statSum(stats, 'cornersHome', 'cornersAway');
    const totalShotsOn = this.statSum(stats, 'shotsOnHome', 'shotsOnAway');
    const totalShots = this.statSum(stats, 'shotsHome', 'shotsAway');
    const totalXg = this.num(stats.xgHome, 0) + this.num(stats.xgAway, 0);

    if (context.isLive) {
      if (family === 'corners' && elapsed >= 35 && totalCorners >= 5) {
        score += 14;
        reasons.push('escanteios reais fortes');
      }

      if (family === 'goals' && elapsed >= 25 && totalShotsOn >= 4) {
        score += 10;
        reasons.push('chutes no alvo');
      }

      if (family === 'goals' && elapsed >= 30 && totalXg >= 1.2) {
        score += 10;
        reasons.push('xG forte');
      }

      if (family === 'goals' && elapsed >= 55 && totalGoals >= 2) {
        score += 4;
      }

      if (family === 'btts' && totalShotsOn >= 5 && totalGoals <= 2) {
        score += 6;
      }

      if (family === 'player-props' && totalShots >= 10) {
        score += 7;
      }
    }

    return { score, reasons };
  }

  buildCandidateMarkets(context: OddixBoostContext = {}): OddixMarket[] {
    const stats = context.stats || this.extractStats(context.statistics || {});
    const quality = this.clamp(this.num(context.qualityScore, 72), 45, 95);
    const elapsed = this.num(context.elapsed, 0);
    const isLive = !!context.isLive;
    const totalGoals = this.num(context.totalGoals, 0);
    const homeTeam = context.homeTeam || 'Casa';
    const awayTeam = context.awayTeam || 'Fora';
    const dominant = this.dominantSide(context, stats);

    const totalCorners = this.statSum(stats, 'cornersHome', 'cornersAway');
    const totalShotsOn = this.statSum(stats, 'shotsOnHome', 'shotsOnAway');
    const totalShots = this.statSum(stats, 'shotsHome', 'shotsAway');
    const totalXg = this.num(stats.xgHome, 0) + this.num(stats.xgAway, 0);

    const candidates: OddixMarket[] = [];

    const add = (market: OddixMarket) => {
      candidates.push({
        fixtureId: context.fixtureId,
        game: `${homeTeam} x ${awayTeam}`,
        homeTeam,
        awayTeam,
        league: context.league,
        source: 'Oddix Boost V2',
        ...market,
      });
    };

    if (isLive) {
      if (elapsed >= 25 && totalShotsOn >= 4) {
        add({
          market: 'Chutes no gol',
          tip: `Over ${Math.max(4.5, totalShotsOn + 1.5).toFixed(1)} chutes no gol`,
          odd: 1.62,
          confidence: this.clamp(quality + 8),
          risk: 'Médio/Baixo',
          isRealOdd: false,
        });
      }

      if (elapsed >= 30 && totalCorners >= 5) {
        add({
          market: 'Escanteios',
          tip: `Over ${Math.max(7.5, totalCorners + 1.5).toFixed(1)} escanteios`,
          odd: 1.68,
          confidence: this.clamp(quality + 7),
          risk: 'Médio',
          isRealOdd: false,
        });
      }

      if (elapsed >= 20 && totalXg >= 1.1 && totalGoals <= 2) {
        add({
          market: 'Total de Gols',
          tip: totalGoals <= 1 ? 'Over 1.5 gols' : 'Over 2.5 gols',
          odd: totalGoals <= 1 ? 1.58 : 1.82,
          confidence: this.clamp(quality + 6),
          risk: 'Médio',
          isRealOdd: false,
        });
      }

      if (dominant.side !== 'balanced' && elapsed >= 35) {
        add({
          market: 'Proteção',
          tip: `${dominant.team} +0.5 handicap`,
          odd: 1.55,
          confidence: this.clamp(quality + 7),
          risk: 'Baixo',
          isRealOdd: false,
        });
      }

      if (elapsed >= 55 && totalGoals >= 2) {
        add({
          market: 'Total de Gols',
          tip: 'Under 5.5 gols',
          odd: 1.45,
          confidence: this.clamp(quality + 5),
          risk: 'Baixo',
          isRealOdd: false,
        });
      }
    } else {
      const seed = this.hash(`${context.fixtureId || ''}-${homeTeam}-${awayTeam}-${context.league || ''}`);
      const rotation = seed % 6;

      const pregameOptions: OddixMarket[] = [
        {
          market: 'Proteção',
          tip: `${homeTeam} +1.5 handicap`,
          odd: 1.45,
          confidence: this.clamp(quality + 3),
          risk: 'Baixo',
        },
        {
          market: 'Dupla Chance',
          tip: `${homeTeam} ou empate`,
          odd: 1.58,
          confidence: this.clamp(quality + 2),
          risk: 'Baixo',
        },
        {
          market: 'Total de Gols',
          tip: 'Over 2.0 gols asiático',
          odd: 1.75,
          confidence: this.clamp(quality),
          risk: 'Médio',
        },
        {
          market: 'Escanteios',
          tip: 'Over 8.5 escanteios',
          odd: 1.72,
          confidence: this.clamp(quality - 1),
          risk: 'Médio',
        },
        {
          market: 'Ambas Marcam',
          tip: 'Ambas marcam - Sim',
          odd: 1.82,
          confidence: this.clamp(quality - 2),
          risk: 'Médio',
        },
        {
          market: 'Total de Gols',
          tip: 'Under 3.5 gols',
          odd: 1.55,
          confidence: this.clamp(quality - 1),
          risk: 'Baixo',
        },
      ];

      // Alterna mercado principal para não deixar o VIP com cara repetida.
      add(pregameOptions[rotation]);
      add(pregameOptions[(rotation + 2) % pregameOptions.length]);
      add(pregameOptions[(rotation + 4) % pregameOptions.length]);
    }

    return candidates;
  }

  selectBestMarkets(markets: OddixMarket[], context: OddixBoostContext = {}, limit = 5): OddixBoostPick[] {
    const stats = context.stats || this.extractStats(context.statistics || {});
    const usedFamilies = new Map<string, number>();
    const usedTips = new Set<string>();
    const output: OddixBoostPick[] = [];

    const sourceMarkets = Array.isArray(markets) && markets.length ? markets : this.buildCandidateMarkets({ ...context, stats });

    const sorted = [...sourceMarkets]
      .filter((market) => market && this.num(market.confidence, 0) >= 68)
      .filter((market) => !this.normalize(market.risk).includes('alto'))
      .filter((market) => this.num(market.odd, 0) >= 1.2)
      .filter((market) => this.num(market.odd, 0) <= 2.15 || this.num(market.confidence, 0) >= 88)
      .sort((a, b) => this.scoreMarket(b, context, stats).score - this.scoreMarket(a, context, stats).score);

    for (const market of sorted) {
      const family = this.marketFamily(market);
      const tipKey = this.normalizeTipKey(market);
      const familyCount = usedFamilies.get(family) || 0;

      if (tipKey && usedTips.has(tipKey)) continue;

      // Permite até 2 mercados de gols, mas só 1 família genérica/proteção/player por seleção.
      if (family === 'goals' && familyCount >= 2) continue;
      if (family !== 'goals' && familyCount >= 1) continue;

      const scored = this.scoreMarket(market, context, stats);

      output.push({
        ...market,
        oddixBoostV2: {
          family,
          score: Math.round(scored.score),
          selected: true,
          reasons: scored.reasons,
          stats,
        },
      });

      usedFamilies.set(family, familyCount + 1);
      usedTips.add(tipKey);

      if (output.length >= limit) break;
    }

    return output;
  }

  generateBestPick(context: OddixBoostContext = {}, markets: OddixMarket[] = []) {
    const selected = this.selectBestMarkets(markets, context, 3);
    const best = selected[0] || this.selectBestMarkets(this.buildCandidateMarkets(context), context, 1)[0];

    return {
      fixtureId: context.fixtureId,
      game: `${context.homeTeam || 'Casa'} x ${context.awayTeam || 'Fora'}`,
      homeTeam: context.homeTeam,
      awayTeam: context.awayTeam,
      league: context.league,
      market: best?.market || 'Oddix Boost',
      tip: best?.tip || 'Sem entrada segura no momento',
      odd: best?.odd || 0,
      confidence: best?.confidence || 0,
      risk: best?.risk || 'Alto',
      source: 'Oddix Boost V2',
      qualityScore: context.qualityScore || 0,
      markets: selected,
      oddixBoostV2: best?.oddixBoostV2 || null,
    };
  }
}
