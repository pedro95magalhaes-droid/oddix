import { Injectable } from '@nestjs/common';
import { MarketsService } from '../markets/markets.service';
import { OddsService } from '../odds/odds.service';
import { OddixConfidenceEngineService } from './oddix-confidence-engine.service';
import { OddixBoostV2Service } from './oddix-boost-v2.service';

type RiskLevel = 'Baixo' | 'Médio' | 'Alto';

type CandidateMarket = {
  key: string;
  category: string;
  market: string;
  tip: string;
  odd: number;
  confidence: number;
  risk: RiskLevel | 'Médio/Baixo';
  bookmaker?: string | null;
  oddsSource?: string;
  isRealOdd?: boolean;
  reason?: string;
};

@Injectable()
export class AiService {
  private readonly oddixBoostV2 = new OddixBoostV2Service();

  constructor(
    private readonly marketsService: MarketsService,
    private readonly oddsService: OddsService,
    private readonly confidenceEngine: OddixConfidenceEngineService,
  ) {}

  private normalizeText(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s.+-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private createSeed(text: string) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private seededNumber(seed: number, min: number, max: number) {
    const x = Math.sin(seed) * 10000;
    const value = x - Math.floor(x);
    return min + value * (max - min);
  }

  private seededInt(seed: number, min: number, max: number) {
    return Math.round(this.seededNumber(seed, min, max));
  }

  private pickBySeed<T>(items: T[], seed: number) {
    return items[Math.abs(seed) % items.length];
  }

  private clamp(value: number, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  private num(value: any, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private getHomeTeam(game: any) {
    return (
      game?.homeTeam ||
      game?.teams?.home?.name ||
      game?.times?.home?.name ||
      game?.times?.home?.nome ||
      game?.times?.casa?.name ||
      game?.times?.casa?.nome ||
      'Time Casa'
    );
  }

  private getAwayTeam(game: any) {
    return (
      game?.awayTeam ||
      game?.teams?.away?.name ||
      game?.times?.away?.name ||
      game?.times?.away?.nome ||
      game?.times?.fora?.name ||
      game?.times?.fora?.nome ||
      'Time Visitante'
    );
  }

  private getLeague(game: any) {
    return (
      game?.leagueName ||
      game?.league?.name ||
      game?.league?.nome ||
      game?.liga?.name ||
      game?.liga?.nome ||
      game?.league ||
      'Liga'
    );
  }

  private getStatus(game: any) {
    const status = game?.status || game?.fixture?.status || game?.jogo?.status || {};
    return {
      short: String(status?.short || status?.curto || ''),
      elapsed: Number(status?.elapsed || status?.decorrido || status?.['tempo decorrido'] || 0),
    };
  }

  private getGoals(game: any) {
    const goals = game?.goals || game?.gols || {};
    const score = game?.score || game?.placar || {};
    const fulltime = score?.fulltime || score?.['tempo integral'] || {};

    const homeGoals = Number(
      goals?.home ??
        goals?.casa ??
        fulltime?.home ??
        fulltime?.casa ??
        0,
    );

    const awayGoals = Number(
      goals?.away ??
        goals?.fora ??
        goals?.visitante ??
        fulltime?.away ??
        fulltime?.fora ??
        fulltime?.visitante ??
        0,
    );

    return {
      homeGoals: Number.isFinite(homeGoals) ? homeGoals : 0,
      awayGoals: Number.isFinite(awayGoals) ? awayGoals : 0,
      totalGoals: (Number.isFinite(homeGoals) ? homeGoals : 0) + (Number.isFinite(awayGoals) ? awayGoals : 0),
    };
  }

  private isLive(statusShort: string) {
    return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY', 'INT'].includes(String(statusShort || '').toUpperCase());
  }

  private isFinished(statusShort: string) {
    return ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(String(statusShort || '').toUpperCase());
  }

  private getStatValue(stats: any, teamIndex: number, labels: string[]) {
    const teams = stats?.teams || stats?.statistics?.teams || [];
    const list = teams?.[teamIndex]?.statistics || teams?.[teamIndex]?.stats || [];
    if (!Array.isArray(list)) return undefined;

    const found = list.find((item: any) => {
      const label = this.normalizeText(item?.type || item?.name || item?.label || item?.title);
      return labels.some((target) => label.includes(this.normalizeText(target)));
    });

    if (!found) return undefined;
    return this.num(found.value ?? found.val ?? found.stat, undefined as any);
  }

  private extractStats(game: any) {
    const rawStats = game?.statistics || game?.stats || {};
    const boostStats = this.oddixBoostV2.extractStats(rawStats);

    const stats = {
      ...boostStats,
      shotsHome: boostStats.shotsHome ?? this.getStatValue(rawStats, 0, ['total shots', 'chutes', 'finalizações', 'finalizacoes']),
      shotsAway: boostStats.shotsAway ?? this.getStatValue(rawStats, 1, ['total shots', 'chutes', 'finalizações', 'finalizacoes']),
      shotsOnHome: boostStats.shotsOnHome ?? this.getStatValue(rawStats, 0, ['shots on goal', 'shots on target', 'chutes no gol']),
      shotsOnAway: boostStats.shotsOnAway ?? this.getStatValue(rawStats, 1, ['shots on goal', 'shots on target', 'chutes no gol']),
      cornersHome: boostStats.cornersHome ?? this.getStatValue(rawStats, 0, ['corner', 'escanteio']),
      cornersAway: boostStats.cornersAway ?? this.getStatValue(rawStats, 1, ['corner', 'escanteio']),
      xgHome: boostStats.xgHome ?? this.getStatValue(rawStats, 0, ['expected goals', 'xg']),
      xgAway: boostStats.xgAway ?? this.getStatValue(rawStats, 1, ['expected goals', 'xg']),
    };

    const hasRealStats =
      rawStats?.available === true &&
      rawStats?.simulated !== true &&
      [
        stats.shotsHome,
        stats.shotsAway,
        stats.shotsOnHome,
        stats.shotsOnAway,
        stats.cornersHome,
        stats.cornersAway,
        stats.xgHome,
        stats.xgAway,
      ].some((value) => value !== undefined && value !== null);

    return { stats, hasRealStats, rawStats };
  }

  private getGameOddFromFixture(game: any, fallback = 1.55) {
    const options = game?.odds?.options || game?.odds?.opções || [];
    if (!Array.isArray(options) || !options.length) return fallback;

    const safe = options
      .map((item: any) => Number(item?.odd || item?.rate?.decimal || 0))
      .filter((odd: number) => odd >= 1.25 && odd <= 2.15)
      .sort((a: number, b: number) => a - b);

    return Number((safe[0] || fallback).toFixed(2));
  }

  private async getRealOdds(homeTeam: string, awayTeam: string, league: string) {
    try {
      const odds = await this.oddsService.getBestOdds({ homeTeam, awayTeam, league });
      return Array.isArray(odds) ? odds : [];
    } catch {
      return [];
    }
  }

  private mapRealOddMarket(prop: any, index: number): CandidateMarket | null {
    const key = String(prop.marketKey || '');
    const odd = Number(prop.odd || 0);

    if (!odd || odd < 1.25 || odd > 2.35) return null;

    if (key === 'player_goal_scorer_anytime' && process.env.ODDIX_ALLOW_ANYTIME_SCORER !== 'true') {
      return null;
    }

    if (!['player_shots_on_target', 'player_shots', 'player_assists', 'player_goal_scorer_anytime'].includes(key)) {
      return null;
    }

    return {
      key,
      category: 'Player Props',
      market: prop.marketName || 'Player Props',
      tip: prop.tip,
      odd,
      confidence: key === 'player_shots_on_target' ? Math.max(76, 86 - index) : key === 'player_shots' ? Math.max(74, 83 - index) : Math.max(68, 74 - index),
      risk: key === 'player_goal_scorer_anytime' ? 'Alto' : index <= 2 ? 'Baixo' : 'Médio',
      bookmaker: prop.bookmaker,
      oddsSource: 'the-odds-api',
      isRealOdd: true,
      reason: `Mercado real encontrado via ${prop.bookmaker || 'The Odds API'}.`,
    };
  }

  private buildPregameMarkets(homeTeam: string, awayTeam: string, league: string, seed: number, fixtureOdd: number, qualityScore: number): CandidateMarket[] {
    const confidenceBase = this.clamp(Number(qualityScore || 75), 68, 85);
    const favoriteIsAway = seed % 3 === 0;
    const protectedTeam = favoriteIsAway ? awayTeam : homeTeam;

    const markets: CandidateMarket[] = [
      {
        key: 'handicap_asiatico',
        category: 'Proteção',
        market: 'Handicap Asiático',
        tip: `${protectedTeam} +1.5 handicap`,
        odd: Math.min(1.75, Math.max(1.35, fixtureOdd || 1.45)),
        confidence: this.clamp(confidenceBase + 2, 68, 86),
        risk: 'Baixo',
        oddsSource: 'oddix-estimada',
        isRealOdd: false,
        reason: 'Pré-jogo sem estatística real: mercado protegido. Escanteios e player props bloqueados.',
      },
      {
        key: 'dupla_chance',
        category: 'Proteção',
        market: 'Dupla Chance',
        tip: `${protectedTeam} ou empate`,
        odd: 1.55,
        confidence: this.clamp(confidenceBase, 68, 84),
        risk: 'Baixo',
        oddsSource: 'oddix-estimada',
        isRealOdd: false,
        reason: 'Pré-jogo sem estatística real: dupla chance é mais segura que resultado seco.',
      },
      {
        key: 'total_gols',
        category: 'Gols',
        market: 'Total de Gols',
        tip: seed % 2 === 0 ? 'Under 3.5 gols' : 'Over 1.5 gols',
        odd: seed % 2 === 0 ? 1.55 : 1.50,
        confidence: this.clamp(confidenceBase - 4, 68, 80),
        risk: 'Médio',
        oddsSource: 'oddix-estimada',
        isRealOdd: false,
        reason: 'Mercado de gols conservador. Sem usar tendência simulada.',
      },
    ];

    return markets;
  }

  private buildLiveMarkets(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    seed: number;
    qualityScore: number;
    elapsed: number;
    totalGoals: number;
    stats: any;
    hasRealStats: boolean;
  }): CandidateMarket[] {
    const { homeTeam, awayTeam, seed, qualityScore, elapsed, totalGoals, stats, hasRealStats } = params;
    const confidenceBase = this.clamp(Number(qualityScore || 75), 68, 88);
    const totalShotsOn = this.num(stats.shotsOnHome, 0) + this.num(stats.shotsOnAway, 0);
    const totalShots = this.num(stats.shotsHome, 0) + this.num(stats.shotsAway, 0);
    const totalCorners = this.num(stats.cornersHome, 0) + this.num(stats.cornersAway, 0);
    const totalXg = this.num(stats.xgHome, 0) + this.num(stats.xgAway, 0);

    if (!hasRealStats) {
      return [
        {
          key: 'handicap_asiatico',
          category: 'Proteção',
          market: 'Handicap Asiático',
          tip: `${seed % 2 === 0 ? homeTeam : awayTeam} +0.5 handicap`,
          odd: 1.55,
          confidence: this.clamp(confidenceBase - 3, 68, 82),
          risk: 'Baixo',
          oddsSource: 'oddix-estimada',
          isRealOdd: false,
          reason: 'Ao vivo sem estatística real: entrada protegida. Escanteios/chutes bloqueados.',
        },
        {
          key: 'total_gols',
          category: 'Gols',
          market: 'Total de Gols',
          tip: elapsed >= 55 && totalGoals >= 2 ? 'Under 5.5 gols' : 'Under 3.5 gols',
          odd: 1.52,
          confidence: this.clamp(confidenceBase - 5, 68, 78),
          risk: 'Médio',
          oddsSource: 'oddix-estimada',
          isRealOdd: false,
          reason: 'Sem estatística real: mercado conservador, sem inventar pressão ou volume.',
        },
      ];
    }

    const markets: CandidateMarket[] = [];

    if (elapsed >= 25 && totalShotsOn >= 4) {
      markets.push({
        key: 'chutes_no_gol',
        category: 'Finalizações',
        market: 'Chutes no Gol',
        tip: `Over ${Math.max(4.5, totalShotsOn + 1.5).toFixed(1)} chutes no gol`,
        odd: 1.62,
        confidence: this.clamp(confidenceBase + 5, 72, 90),
        risk: 'Médio/Baixo',
        oddsSource: 'estatística-real',
        isRealOdd: false,
        reason: `Chutes no gol reais no jogo: ${totalShotsOn}.`,
      });
    }

    if (elapsed >= 30 && totalCorners >= 5) {
      markets.push({
        key: 'escanteios',
        category: 'Escanteios',
        market: 'Escanteios',
        tip: `Over ${Math.max(7.5, totalCorners + 1.5).toFixed(1)} escanteios`,
        odd: 1.68,
        confidence: this.clamp(confidenceBase + 3, 72, 88),
        risk: 'Médio',
        oddsSource: 'estatística-real',
        isRealOdd: false,
        reason: `Escanteios reais no jogo: ${totalCorners}.`,
      });
    }

    if ((totalXg >= 1.1 || totalShotsOn >= 4 || totalShots >= 10) && totalGoals <= 2) {
      markets.push({
        key: 'total_gols',
        category: 'Gols',
        market: 'Total de Gols',
        tip: totalGoals <= 1 ? 'Over 1.5 gols' : 'Over 2.5 gols',
        odd: totalGoals <= 1 ? 1.58 : 1.82,
        confidence: this.clamp(confidenceBase + 2, 70, 86),
        risk: 'Médio',
        oddsSource: 'estatística-real',
        isRealOdd: false,
        reason: `Volume real: ${totalShots} chutes, ${totalShotsOn} no gol, xG ${totalXg.toFixed(2)}.`,
      });
    }

    if (!markets.length) {
      markets.push({
        key: 'handicap_asiatico',
        category: 'Proteção',
        market: 'Handicap Asiático',
        tip: `${seed % 2 === 0 ? homeTeam : awayTeam} +0.5 handicap`,
        odd: 1.55,
        confidence: this.clamp(confidenceBase - 2, 68, 82),
        risk: 'Baixo',
        oddsSource: 'estatística-real',
        isRealOdd: false,
        reason: 'Estatística real disponível, mas sem volume suficiente para mercado agressivo.',
      });
    }

    return markets;
  }

  private isUnsafeMarket(market: CandidateMarket, isLive: boolean, hasRealStats: boolean) {
    const text = this.normalizeText(`${market.key} ${market.market} ${market.tip}`);
    if (text.includes('escanteio') || text.includes('corner')) return !isLive || !hasRealStats;
    if (text.includes('chute no gol') || text.includes('shots on target')) return !isLive || !hasRealStats;
    if (text.includes('player') || text.includes('jogador')) return !hasRealStats || !market.isRealOdd;
    if (text.includes('placar correto')) return true;
    return false;
  }

  private applyConfidenceEngine(market: any, context: any, homeTeam: string, awayTeam: string, game: any) {
    try {
      const enriched = {
        ...market,
        homeTeam,
        awayTeam,
        league: game?.league?.name || game?.league || '',
        status: game?.fixture?.status,
        game,
      };

      const result = this.confidenceEngine.analyze
        ? this.confidenceEngine.analyze(enriched)
        : this.confidenceEngine.calculate
        ? this.confidenceEngine.calculate(enriched)
        : null;

      if (!result) return market;

      return {
        ...market,
        confidence: Number(result.confidence || market.confidence || 0),
        oddixEngine: result,
      };
    } catch {
      return market;
    }
  }

  private generateMultiples(markets: any[], context: any) {
    const safe = (markets || [])
      .filter((market) => Number(market.odd || 0) >= 1.25 && Number(market.odd || 0) <= 2.05)
      .filter((market) => String(market.risk || '').toLowerCase() !== 'alto')
      .slice(0, 3);

    if (safe.length < 2) return null;

    const oddTotal = safe.reduce((total, market) => total * Number(market.odd || 1), 1);

    return {
      enabled: true,
      type: context.isLive ? 'live' : 'pre-game',
      selections: safe,
      oddTotal: Number(oddTotal.toFixed(2)),
    };
  }

  private generateProfessionalAnalysis(data: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    context: any;
    best: any;
    bestMarkets: any[];
    multiples?: any;
  }) {
    const { homeTeam, awayTeam, league, context, best, bestMarkets } = data;
    const stats = context.stats || {};
    const hasRealStats = !!context.hasRealStats;

    const lines = [
      `Análise Oddix — ${homeTeam} x ${awayTeam} (${league}).`,
      context.isLive ? `Jogo ao vivo, minuto ${context.elapsed || 0}.` : 'Pré-jogo.',
      hasRealStats
        ? `Dados reais detectados: chutes ${this.num(stats.shotsHome, 0) + this.num(stats.shotsAway, 0)}, chutes no gol ${this.num(stats.shotsOnHome, 0) + this.num(stats.shotsOnAway, 0)}, escanteios ${this.num(stats.cornersHome, 0) + this.num(stats.cornersAway, 0)}.`
        : 'Sem estatísticas reais suficientes. O modelo bloqueou escanteios, player props e chutes agressivos.',
      `Entrada principal: ${best.tip} | odd ${best.odd} | confiança ${best.confidence}% | risco ${best.risk}.`,
      '',
      'Mercados recomendados:',
      ...bestMarkets.slice(0, 3).map((market: any, index: number) => `${index + 1}. ${market.market}: ${market.tip} | odd ${market.odd} | ${market.confidence}%`),
    ];

    return lines.join('\\n');
  }

  async generateBet(game: any) {
    const homeTeam = this.getHomeTeam(game);
    const awayTeam = this.getAwayTeam(game);
    const league = this.getLeague(game);
    const status = this.getStatus(game);
    const goals = this.getGoals(game);
    const isLive = this.isLive(status.short);
    const isFinished = this.isFinished(status.short);
    const qualityScore = Number(game?.oddix?.qualityScore || game?.qualityScore || 75);
    const seed = this.createSeed(`${homeTeam}-${awayTeam}-${league}-${status.short}-${status.elapsed}-${goals.homeGoals}-${goals.awayGoals}`);
    const statsInfo = this.extractStats(game);

    const context = {
      homeTeam,
      awayTeam,
      league,
      statusShort: status.short,
      elapsed: status.elapsed,
      homeGoals: goals.homeGoals,
      awayGoals: goals.awayGoals,
      totalGoals: goals.totalGoals,
      isLive,
      isFinished,
      seed,
      qualityScore,
      stats: statsInfo.stats,
      hasRealStats: statsInfo.hasRealStats,
    };

    const realOdds = await this.getRealOdds(homeTeam, awayTeam, league);
    const playerPropMarkets = realOdds
      .filter((pick: any) => String(pick.marketKey || '').startsWith('player_'))
      .map((prop: any, index: number) => this.mapRealOddMarket(prop, index))
      .filter(Boolean) as CandidateMarket[];

    const fixtureOdd = this.getGameOddFromFixture(game, 1.55);
    const candidateMarkets = isLive
      ? this.buildLiveMarkets({ homeTeam, awayTeam, league, seed, qualityScore, elapsed: status.elapsed, totalGoals: goals.totalGoals, stats: statsInfo.stats, hasRealStats: statsInfo.hasRealStats })
      : this.buildPregameMarkets(homeTeam, awayTeam, league, seed, fixtureOdd, qualityScore);

    const rawFinalMarkets = [...playerPropMarkets, ...candidateMarkets]
      .filter((market) => !this.isUnsafeMarket(market, isLive, statsInfo.hasRealStats))
      .filter((market) => Number(market.odd || 0) >= 1.25 && Number(market.odd || 0) <= 2.15)
      .filter((market) => Number(market.confidence || 0) >= 68)
      .map((market) => this.applyConfidenceEngine(market, context, homeTeam, awayTeam, game))
      .filter((market) => market?.oddixEngine?.send !== false);

    const finalMarkets = this.oddixBoostV2.selectBestMarkets(rawFinalMarkets, {
      isLive,
      elapsed: status.elapsed,
      totalGoals: goals.totalGoals,
      homeGoals: goals.homeGoals,
      awayGoals: goals.awayGoals,
      league,
      seed,
      qualityScore,
      stats: statsInfo.stats,
      statistics: statsInfo.rawStats,
      hasRealStats: statsInfo.hasRealStats,
    }, 5);

    const safeFinalMarkets = finalMarkets.length
      ? finalMarkets
      : this.oddixBoostV2.selectBestMarkets(this.buildPregameMarkets(homeTeam, awayTeam, league, seed, fixtureOdd, qualityScore), {
          isLive: false,
          elapsed: status.elapsed,
          totalGoals: goals.totalGoals,
          league,
          seed,
          qualityScore,
          hasRealStats: false,
        }, 3);

    const best = safeFinalMarkets[0] || {
      tip: 'Sem entrada segura no momento',
      odd: 0,
      confidence: 0,
      risk: 'Alto',
      market: 'Sem entrada',
    };

    const multiples = this.generateMultiples(safeFinalMarkets, context);

    return {
      homeTeam,
      awayTeam,
      league,
      status: 'open',
      sources: {
        matchData: game.provider || game.sources?.matchData || 'provider',
        odds: safeFinalMarkets.some((market: any) => market.isRealOdd) ? 'the-odds-api' : 'oddix-estimada',
        confidenceEngine: 'oddix-confidence-engine-v1',
        realOddsCount: realOdds.length,
        playerPropsCount: playerPropMarkets.length,
        estimatedOddsCount: safeFinalMarkets.filter((market: any) => !market.isRealOdd).length,
        stats: statsInfo.hasRealStats ? 'real' : 'indisponivel',
      },
      tip: best.tip,
      odd: best.odd,
      confidence: best.confidence,
      risk: best.risk,
      engineScore: best.oddixEngine?.score ?? best.confidence,
      engineLevel: best.oddixEngine?.level || 'BOM',
      engineCategory: best.oddixEngine?.category || 'SAFE',
      dominanceHome: best.oddixEngine?.dominanceHome ?? 50,
      dominanceAway: best.oddixEngine?.dominanceAway ?? 50,
      dominantTeam: best.oddixEngine?.dominantTeam || 'Jogo equilibrado',
      engineReasons: best.oddixEngine?.reasons || [],
      markets: safeFinalMarkets,
      playerProps: playerPropMarkets.slice(0, 8),
      multiples,
      analysis: this.generateProfessionalAnalysis({
        homeTeam,
        awayTeam,
        league,
        context,
        best,
        bestMarkets: safeFinalMarkets,
        multiples,
      }),
    };
  }
}
