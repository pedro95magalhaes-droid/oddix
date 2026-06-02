import { Injectable } from '@nestjs/common';

type MarketLike = Record<string, any>;

type BoostContext = {
  isLive?: boolean;
  elapsed?: number;
  totalGoals?: number;
  league?: string;
  seed?: number;
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

  private marketFamily(market: MarketLike) {
    const text = this.normalize(`${market.key || ''} ${market.market || ''} ${market.tip || ''} ${market.category || ''}`);

    if (text.includes('player') || text.includes('jogador') || text.includes('chute no gol') || text.includes('finalizacao')) return 'player-props';
    if (text.includes('escanteio') || text.includes('corner')) return 'corners';
    if (text.includes('ambas') || text.includes('btts')) return 'btts';
    if (text.includes('handicap') || text.includes('+1.5') || text.includes('-1.5')) return 'handicap';
    if (text.includes('dupla') || text.includes('double chance')) return 'double-chance';
    if (text.includes('under') || text.includes('over') || text.includes('gol')) return 'goals';

    return text.slice(0, 30) || 'generic';
  }

  private isRepeatedUnsafeTip(market: MarketLike) {
    const tip = this.normalize(market.tip);
    return tip === 'under 4.5 gols' || tip === 'under 3.5 gols' || tip === 'over 1.5 gols';
  }

  private scoreMarket(market: MarketLike, context: BoostContext) {
    const confidence = Number(market.confidence || 0);
    const odd = Number(market.odd || 0);
    const risk = String(market.risk || 'Médio');
    const family = this.marketFamily(market);

    let score = confidence;

    if (market.isRealOdd) score += 12;
    if (odd >= 1.25 && odd <= 2.0) score += 8;
    if (odd > 2.1) score -= 16;
    if (risk === 'Baixo') score += 10;
    if (risk === 'Médio') score += 2;
    if (risk === 'Alto') score -= 35;

    if (family === 'player-props') score += 9;
    if (family === 'double-chance') score += 6;
    if (family === 'handicap') score += 5;
    if (family === 'btts') score += 3;
    if (family === 'corners') score += 2;

    if (this.isRepeatedUnsafeTip(market)) score -= 10;

    if (context.isLive && family === 'goals' && Number(context.elapsed || 0) >= 55 && Number(context.totalGoals || 0) >= 2) score += 4;
    if (context.isLive && family === 'corners') score -= 4;

    return score;
  }

  selectBestMarkets(markets: MarketLike[], context: BoostContext = {}, limit = 5) {
    const usedFamilies = new Map<string, number>();
    const usedTips = new Set<string>();
    const output: MarketLike[] = [];

    const sorted = [...(markets || [])]
      .filter((market) => market && Number(market.confidence || 0) >= 68)
      .filter((market) => String(market.risk || '') !== 'Alto')
      .filter((market) => Number(market.odd || 0) >= 1.2)
      .filter((market) => Number(market.odd || 0) <= 2.15 || Number(market.confidence || 0) >= 88)
      .sort((a, b) => this.scoreMarket(b, context) - this.scoreMarket(a, context));

    for (const market of sorted) {
      const family = this.marketFamily(market);
      const tipKey = this.normalize(market.tip).replace(/\d+(?:[.,]\d+)?/g, 'x');
      const familyCount = usedFamilies.get(family) || 0;

      if (tipKey && usedTips.has(tipKey)) continue;
      if (familyCount >= 2) continue;

      output.push({
        ...market,
        oddixBoostV2: {
          family,
          score: Math.round(this.scoreMarket(market, context)),
          selected: true,
        },
      });

      usedFamilies.set(family, familyCount + 1);
      usedTips.add(tipKey);

      if (output.length >= limit) break;
    }

    return output;
  }
}
