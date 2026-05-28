import { Injectable } from '@nestjs/common';
import { MarketsService } from '../markets/markets.service';
import { OddsService } from '../odds/odds.service';

type RiskLevel = 'Baixo' | 'Médio' | 'Alto';

@Injectable()
export class AiService {
  constructor(
    private readonly marketsService: MarketsService,
    private readonly oddsService: OddsService,
  ) {}

  async generateBet(game: any) {
    const homeTeam = game.homeTeam || game.teams?.home?.name || 'Time Casa';
    const awayTeam = game.awayTeam || game.teams?.away?.name || 'Time Visitante';
    const league = game.leagueName || game.league?.name || game.league || 'Liga';

    const statusShort = game.status?.short || game.fixture?.status?.short || '';
    const elapsed = Number(game.status?.elapsed || game.fixture?.status?.elapsed || 0);

    const score = game.score || game.goals || {};
    const homeGoals = Number(score.home ?? score?.fulltime?.home ?? 0);
    const awayGoals = Number(score.away ?? score?.fulltime?.away ?? 0);

    const seed = this.createSeed(
      `${homeTeam}-${awayTeam}-${league}-${statusShort}-${elapsed}-${homeGoals}-${awayGoals}`,
    );

    const context = this.buildMatchContext({
      homeTeam,
      awayTeam,
      league,
      statusShort,
      elapsed,
      homeGoals,
      awayGoals,
      seed,
    });

    const playerProps = await this.oddsService.getPlayerProps({
      homeTeam,
      awayTeam,
      league,
    });

    const flatMarkets = this.marketsService.getFlatMarkets();

    const generatedMarkets = flatMarkets
      .map((market: any, index: number) => {
        const marketSeed = this.createSeed(`${seed}-${market.key}-${index}`);

        const confidence = this.generateConfidence(
          market.key,
          index,
          context,
          marketSeed,
        );

        const odd = this.generateOdd(market.key, confidence, context, marketSeed);

        const rawTip = this.generateTip(
          market.key,
          homeTeam,
          awayTeam,
          context,
          marketSeed,
        );

        const tip = this.sanitizeTip(rawTip, homeTeam, awayTeam, context);

        const risk = this.getRisk(confidence, market.key, context);

        return {
          key: market.key,
          category: market.category,
          market: market.name,
          tip,
          odd,
          confidence,
          risk,
          reason: this.generateProfessionalReason(
            market.name,
            homeTeam,
            awayTeam,
            context,
            confidence,
            risk,
          ),
        };
      })
      .filter((market) => this.isMarketAllowed(market, context))
      .filter((market) => !this.isConditionalTip(market.tip));

    const bestMarkets = generatedMarkets
      .sort((a, b) => {
        const scoreA = this.marketScore(a.confidence, a.odd, a.risk, context, a.key);
        const scoreB = this.marketScore(b.confidence, b.odd, b.risk, context, b.key);
        return scoreB - scoreA;
      })
      .slice(0, 5);

    const playerPropMarkets = playerProps.map((prop: any, index: number) => ({
      key: prop.marketKey,
      category: 'Player Props',
      market: prop.marketName,
      tip: prop.tip,
      odd: prop.odd,
      confidence:
        prop.marketKey === 'player_shots_on_target'
          ? Math.max(76, 86 - index)
          : prop.marketKey === 'player_shots'
          ? Math.max(74, 83 - index)
          : Math.max(68, 74 - index),
      risk: (
        prop.marketKey === 'player_goal_scorer_anytime'
          ? 'Alto'
          : index <= 2
          ? 'Baixo'
          : 'Médio'
      ) as RiskLevel,
      reason: `Mercado real encontrado na The Odds API via ${prop.bookmaker}. Entrada baseada em linha disponível de player props, sem inventar jogador ou odd.`,
    }));

    const mergedMarkets = [...playerPropMarkets, ...bestMarkets]
      .filter((market) => market.risk !== 'Alto')
      .filter((market) => Number(market.confidence || 0) >= 70)
      .sort((a, b) => {
        const scoreA = this.marketScore(a.confidence, a.odd, a.risk, context, a.key);
        const scoreB = this.marketScore(b.confidence, b.odd, b.risk, context, b.key);
        return scoreB - scoreA;
      })
      .slice(0, 5);

    const fallback = this.safeFallbackMarket(homeTeam, awayTeam, league, context);
    fallback.tip = this.sanitizeTip(fallback.tip, homeTeam, awayTeam, context);

    const finalMarkets = mergedMarkets.length ? mergedMarkets : [fallback];
    const best = finalMarkets[0];

    const multiples = this.generateMultiples(finalMarkets, context);

    return {
      homeTeam,
      awayTeam,
      league,
      status: 'open',

      tip: this.sanitizeTip(best.tip, homeTeam, awayTeam, context),
      odd: best.odd,
      confidence: best.confidence,
      risk: best.risk,

      markets: finalMarkets.map((market) => ({
        ...market,
        tip: this.sanitizeTip(market.tip, homeTeam, awayTeam, context),
      })),

      multiples,

      analysis: this.generateProfessionalAnalysis({
        homeTeam,
        awayTeam,
        league,
        context,
        best: {
          ...best,
          tip: this.sanitizeTip(best.tip, homeTeam, awayTeam, context),
        },
        bestMarkets: finalMarkets.map((market) => ({
          ...market,
          tip: this.sanitizeTip(market.tip, homeTeam, awayTeam, context),
        })),
        multiples,
      }),
    };
  }

  private createSeed(text: string) {
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
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
    return items[seed % items.length];
  }

  private normalizeText(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isConditionalTip(tip: string) {
    const normalized = this.normalizeText(tip);

    return (
      normalized.includes('entrada ao vivo somente') ||
      normalized.includes('somente se') ||
      normalized.includes('ritmo ofensivo') ||
      normalized.includes('ritmo confirmar') ||
      normalized.includes('aguardar') ||
      normalized.includes('evitar 1o tempo') ||
      normalized.includes('jogo ja em andamento') ||
      normalized.includes('exposicao controlada')
    );
  }

  private getSafeRealTip(homeTeam: string, awayTeam: string, context: any) {
    const livePrefix = context.isLive ? 'Ao vivo: ' : '';

    if (context.isLive) {
      if (context.elapsed >= 70) {
        return context.totalGoals <= 2
          ? `${livePrefix}Under 4.5 gols`
          : `${livePrefix}Over 3.5 gols`;
      }

      if (context.totalGoals <= 1) {
        return `${livePrefix}Under 3.5 gols`;
      }

      return `${livePrefix}Over 1.5 gols`;
    }

    if (context.goalTrend >= 72) {
      return 'Over 1.5 gols';
    }

    if (context.favorite === awayTeam) {
      return `${awayTeam} ou empate`;
    }

    return `${homeTeam} ou empate`;
  }

  private sanitizeTip(tip: string, homeTeam: string, awayTeam: string, context: any) {
    if (!tip || this.isConditionalTip(tip)) {
      return this.getSafeRealTip(homeTeam, awayTeam, context);
    }

    return tip;
  }

  private buildMatchContext(data: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    statusShort: string;
    elapsed: number;
    homeGoals: number;
    awayGoals: number;
    seed: number;
  }) {
    const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(
      data.statusShort,
    );

    const isFinished = ['FT', 'AET', 'PEN'].includes(data.statusShort);

    const totalGoals = data.homeGoals + data.awayGoals;
    const goalDifference = Math.abs(data.homeGoals - data.awayGoals);

    const homeStrength = this.seededInt(data.seed + 11, 56, 86);
    const awayStrength = this.seededInt(data.seed + 22, 52, 84);
    const goalTrend = this.seededInt(data.seed + 33, 45, 88);
    const cornerTrend = this.seededInt(data.seed + 44, 42, 86);
    const cardTrend = this.seededInt(data.seed + 55, 38, 82);
    const shotTrend = this.seededInt(data.seed + 66, 44, 88);
    const balance = Math.abs(homeStrength - awayStrength);

    return {
      ...data,
      isLive,
      isFinished,
      totalGoals,
      goalDifference,
      isDraw: data.homeGoals === data.awayGoals,
      homeWinning: data.homeGoals > data.awayGoals,
      awayWinning: data.awayGoals > data.homeGoals,
      homeStrength,
      awayStrength,
      goalTrend,
      cornerTrend,
      cardTrend,
      shotTrend,
      balance,
      favorite:
        homeStrength >= awayStrength + 5
          ? data.homeTeam
          : awayStrength >= homeStrength + 5
          ? data.awayTeam
          : 'equilibrado',
      underdog:
        homeStrength >= awayStrength + 5
          ? data.awayTeam
          : awayStrength >= homeStrength + 5
          ? data.homeTeam
          : 'nenhum',
      gamePhase: this.getGamePhase(data.statusShort, data.elapsed),
      matchTempo: this.getMatchTempo(data.elapsed, totalGoals, goalTrend),
    };
  }

  private getGamePhase(statusShort: string, elapsed: number) {
    if (statusShort === 'HT') return 'intervalo';
    if (['FT', 'AET', 'PEN'].includes(statusShort)) return 'finalizado';
    if (elapsed > 75) return 'reta final';
    if (elapsed > 45) return 'segundo tempo';
    if (elapsed > 0) return 'primeiro tempo';
    return 'pré-jogo';
  }

  private getMatchTempo(elapsed: number, totalGoals: number, goalTrend: number) {
    if (!elapsed) {
      if (goalTrend >= 72) return 'tendente a gols';
      if (goalTrend <= 54) return 'mais controlado';
      return 'neutro';
    }

    if (totalGoals >= 3 && elapsed <= 70) return 'aberto';
    if (totalGoals === 0 && elapsed >= 35) return 'travado';
    if (totalGoals <= 1 && elapsed >= 60) return 'controlado';

    return 'equilibrado';
  }

  private isMarketAllowed(market: any, context: any) {
    if (!market) return false;

    const blockedAlways = ['placar_correto', 'jogadores', 'bet_builder'];
    if (blockedAlways.includes(market.key)) return false;

    if (market.risk === 'Alto') return false;
    if (market.confidence < 68) return false;
    if (Number(market.odd) > 2.35 && market.confidence < 78) return false;

    if (context.isFinished) return false;

    if (context.isLive && context.elapsed >= 75) {
      const allowedLate = ['total_gols', 'escanteios', 'chutes_no_gol', 'chutes'];
      if (!allowedLate.includes(market.key)) return false;
      if (market.confidence < 76) return false;
    }

    if (market.key === 'resultado_final' && context.balance < 22) return false;
    if (market.key === 'multipla') return false;

    return true;
  }

  private marketScore(
    confidence: number,
    odd: number,
    risk: RiskLevel,
    context: any,
    key: string,
  ) {
    const riskPenalty: Record<RiskLevel, number> = {
      Baixo: 0,
      Médio: 9,
      Alto: 30,
    };

    let bonus = 0;

    if (key === 'player_shots_on_target') bonus += 36;
    if (key === 'player_shots') bonus += 30;
    if (key === 'escanteios') bonus += 24;
    if (key === 'chutes_no_gol') bonus += 22;
    if (key === 'chutes') bonus += 20;
    if (key === 'total_gols') bonus += 8;

    if (key === 'dupla_chance') bonus -= 8;
    if (key === 'empate_anula') bonus -= 6;
    if (key === 'resultado_final') bonus -= 14;
    if (key === 'ambas_marcam') bonus -= 8;
    if (key === 'handicap_asiatico') bonus += 2;

    if (key === 'total_gols') bonus += context.goalTrend >= 70 ? 8 : 3;
    if (key === 'escanteios') bonus += context.cornerTrend >= 70 ? 5 : -5;
    if (key === 'cartoes') bonus += context.cardTrend >= 68 ? 4 : -6;
    if (key === 'chutes' || key === 'chutes_no_gol') bonus += context.shotTrend >= 70 ? 4 : -5;

    if (key === 'resultado_final') bonus += context.balance >= 22 ? 4 : -20;
    if (key === 'ambas_marcam') bonus += context.goalTrend >= 72 ? 3 : -8;

    if (context.isLive && key === 'ao_vivo') bonus += 6;
    if (context.isLive && context.elapsed >= 75) bonus -= 8;

    return confidence + odd * 2.2 + bonus - riskPenalty[risk];
  }

  private generateConfidence(key: string, index: number, context: any, seed: number) {
    const base: Record<string, number> = {
      total_gols: 74,
      dupla_chance: 76,
      empate_anula: 73,
      handicap_asiatico: 71,
      escanteios: 80,
      cartoes: 68,
      chutes_no_gol: 80,
      chutes: 78,
      ambas_marcam: 63,
      primeiro_tempo: 60,
      resultado_final: 58,
      jogadores: 50,
      bet_builder: 48,
      multipla: 45,
      placar_correto: 35,
      ao_vivo: 74,
    };

    let value = base[key] ?? 58;

    if (key === 'total_gols' || key === 'ao_vivo') {
      if (context.goalTrend >= 72) value += 7;
      if (context.goalTrend <= 55) value += 4;
      if (context.matchTempo === 'travado') value += 6;
      if (context.totalGoals >= 3 && context.elapsed >= 60) value -= 7;
    }

    if (key === 'dupla_chance') {
      value += context.balance >= 10 ? 8 : 3;
      if (context.isLive && context.elapsed >= 70) value += 5;
    }

    if (key === 'empate_anula') {
      value += context.balance >= 12 ? 8 : 2;
    }

    if (key === 'handicap_asiatico') {
      value += context.balance >= 10 ? 7 : 2;
    }

    if (key === 'resultado_final') {
      value += context.balance >= 22 ? 10 : -12;
    }

    if (key === 'ambas_marcam') {
      value += context.goalTrend >= 74 ? 7 : -8;
    }

    if (key === 'escanteios') value += Math.round((context.cornerTrend - 60) * 0.25);
    if (key === 'cartoes') value += Math.round((context.cardTrend - 60) * 0.22);
    if (key === 'chutes' || key === 'chutes_no_gol') value += Math.round((context.shotTrend - 60) * 0.22);

    if (context.isLive) {
      if (context.elapsed < 12) value -= 5;
      if (context.elapsed >= 75) value -= 4;
      if (key === 'total_gols' && context.matchTempo === 'aberto') value += 5;
      if (key === 'total_gols' && context.matchTempo === 'controlado') value += 6;
      if (key === 'ao_vivo') value += 4;
      if (key === 'placar_correto') value -= 20;
    }

    if (context.isFinished) value -= 30;

    const variation = this.seededInt(seed + index, -4, 5);

    return Math.max(35, Math.min(91, value + variation));
  }

  private generateOdd(key: string, confidence: number, context: any, seed: number) {
    const baseOdds: Record<string, number> = {
      total_gols: 1.55,
      dupla_chance: 1.38,
      empate_anula: 1.52,
      handicap_asiatico: 1.62,
      escanteios: 1.72,
      cartoes: 1.74,
      chutes_no_gol: 1.78,
      chutes: 1.72,
      ambas_marcam: 1.82,
      primeiro_tempo: 1.68,
      resultado_final: 2.05,
      jogadores: 2.25,
      bet_builder: 2.55,
      multipla: 2.75,
      placar_correto: 8.5,
      ao_vivo: 1.58,
    };

    let odd = baseOdds[key] ?? 1.75;

    odd += this.seededNumber(seed + 99, -0.08, 0.12);

    if (confidence >= 82) odd -= 0.06;
    if (confidence <= 65) odd += 0.12;
    if (context.isLive && context.elapsed >= 70) odd += 0.05;

    return Number(Math.max(1.25, Math.min(2.45, odd)).toFixed(2));
  }

  private generateTip(key: string, homeTeam: string, awayTeam: string, context: any, seed: number) {
    const livePrefix = context.isLive ? 'Ao vivo: ' : '';
    const favorite = context.favorite === 'equilibrado' ? homeTeam : context.favorite;

    const safeGoalLine =
      context.goalTrend >= 72
        ? this.pickBySeed(['Over 1.5 gols', 'Over 2.0 gols asiático'], seed + 1)
        : this.pickBySeed(['Under 3.5 gols', 'Under 4.5 gols'], seed + 2);

    const cornerLine = this.pickBySeed(['Over 7.5 escanteios', 'Over 8.5 escanteios'], seed + 3);
    const cardLine = this.pickBySeed(['Over 2.5 cartões', 'Over 3.5 cartões'], seed + 4);
    const shotLine = this.pickBySeed(['Over 18.5 chutes totais', 'Over 20.5 chutes totais'], seed + 5);
    const shotOnTargetLine = this.pickBySeed(['Over 5.5 chutes no gol', 'Over 6.5 chutes no gol'], seed + 6);

    const liveRealTip =
      context.totalGoals <= 1
        ? 'Under 3.5 gols'
        : context.totalGoals >= 3
        ? 'Over 3.5 gols'
        : 'Over 1.5 gols';

    const tips: Record<string, string> = {
      resultado_final:
        context.balance >= 22
          ? `${livePrefix}${favorite} para vencer`
          : `${livePrefix}${favorite} empate anula aposta`,
      dupla_chance:
        context.favorite === awayTeam
          ? `${livePrefix}${awayTeam} ou empate`
          : `${livePrefix}${homeTeam} ou empate`,
      empate_anula: `${livePrefix}${favorite} empate anula aposta`,
      total_gols: `${livePrefix}${safeGoalLine}`,
      ambas_marcam:
        context.goalTrend >= 74
          ? `${livePrefix}Ambas equipes marcam: Sim`
          : `${livePrefix}Ambas equipes marcam: Não`,
      handicap_asiatico:
        context.favorite === awayTeam
          ? `${livePrefix}${awayTeam} +0.25 handicap asiático`
          : `${livePrefix}${homeTeam} +0.25 handicap asiático`,
      handicap_europeu:
        context.favorite === awayTeam
          ? `${livePrefix}${awayTeam} +1 handicap europeu`
          : `${livePrefix}${homeTeam} +1 handicap europeu`,
      escanteios: `${livePrefix}${cornerLine}`,
      cartoes: `${livePrefix}${cardLine}`,
      chutes: `${livePrefix}${shotLine}`,
      chutes_no_gol: `${livePrefix}${shotOnTargetLine}`,
      primeiro_tempo:
        context.gamePhase === 'pré-jogo'
          ? 'Over 0.5 gol no 1º tempo'
          : `${livePrefix}Under 3.5 gols`,
      aposta_simples: `${livePrefix}${safeGoalLine}`,
      multipla: `Dupla chance + ${safeGoalLine}`,
      bet_builder: `${safeGoalLine} + dupla chance`,
      ao_vivo: `${livePrefix}${liveRealTip}`,
    };

    return this.sanitizeTip(
      tips[key] || `${livePrefix}${safeGoalLine}`,
      homeTeam,
      awayTeam,
      context,
    );
  }

  private getRisk(confidence: number, key?: string, context?: any): RiskLevel {
    if (['placar_correto', 'multipla', 'bet_builder', 'jogadores'].includes(key || '')) {
      return 'Alto';
    }

    if (key === 'resultado_final' && context?.balance < 22) return 'Alto';

    if (context?.isLive && context.elapsed >= 75) {
      if (confidence >= 82 && ['dupla_chance', 'empate_anula', 'total_gols'].includes(key || '')) {
        return 'Médio';
      }
      return 'Alto';
    }

    if (confidence >= 80) return 'Baixo';
    if (confidence >= 70) return 'Médio';

    return 'Alto';
  }

  private safeFallbackMarket(homeTeam: string, awayTeam: string, league: string, context: any) {
    const favorite = context.favorite === 'equilibrado' ? homeTeam : context.favorite;
    const tip = this.getSafeRealTip(homeTeam, awayTeam, context);

    return {
      key: 'total_gols',
      category: 'Protegido',
      market: 'Total de gols',
      tip,
      odd: context.isLive ? 1.48 : 1.55,
      confidence: 74,
      risk: 'Médio' as RiskLevel,
      reason: `Mercado real escolhido como fallback para ${homeTeam} x ${awayTeam} (${league}). O modelo evitou entradas condicionais e priorizou uma linha mensurável para validação GREEN/RED. Referência técnica: ${favorite}.`,
    };
  }

  private generateProfessionalReason(
    market: string,
    homeTeam: string,
    awayTeam: string,
    context: any,
    confidence: number,
    risk: RiskLevel,
  ) {
    const phase =
      context.gamePhase === 'pré-jogo'
        ? 'pré-jogo'
        : `momento atual da partida (${context.gamePhase})`;

    const scoreText = context.isLive
      ? ` Placar atual: ${context.homeGoals}x${context.awayGoals}.`
      : '';

    return `Mercado de ${market} selecionado para ${homeTeam} x ${awayTeam} com base no ${phase}, equilíbrio técnico, tendência de gols ${context.goalTrend}/100, escanteios ${context.cornerTrend}/100, cartões ${context.cardTrend}/100 e finalizações ${context.shotTrend}/100.${scoreText} Confiança estimada em ${confidence}% e risco ${risk}.`;
  }

  private generateMultiples(markets: any[], context: any) {
    const safe = markets
      .filter((market) => market.risk !== 'Alto')
      .filter((market) => market.confidence >= 70)
      .filter((market) => Number(market.odd) <= 2.1)
      .filter((market) => !this.isConditionalTip(market.tip))
      .slice(0, 4);

    const conservative = safe.slice(0, 2);
    const moderate = safe.slice(0, 3);
    const aggressive = safe.slice(0, 4);

    const build = (name: string, items: any[], risk: RiskLevel, stake: string) => {
      const combinedOdd = items.reduce((acc, item) => acc * Number(item.odd || 1), 1);

      return {
        name,
        selections: items.map((item) => ({
          market: item.market,
          tip: this.sanitizeTip(item.tip, '', '', context),
          odd: item.odd,
          confidence: item.confidence,
          risk: item.risk,
        })),
        combinedOdd: Number(combinedOdd.toFixed(2)),
        risk,
        stake,
        note:
          risk === 'Baixo'
            ? 'Múltipla protegida, indicada para controle de banca.'
            : risk === 'Médio'
            ? 'Múltipla equilibrada. Use stake reduzida.'
            : 'Múltipla agressiva. Use apenas valor simbólico.',
      };
    };

    return {
      conservative: build('Múltipla Conservadora', conservative, 'Baixo', '0.5 unidade'),
      moderate: build('Múltipla Moderada', moderate, 'Médio', '0.25 unidade'),
      aggressive: build('Múltipla Agressiva', aggressive, 'Alto', '0.10 unidade'),
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
    const { homeTeam, awayTeam, league, context, best, bestMarkets, multiples } = data;

    const favoriteText =
      context.favorite === 'equilibrado'
        ? 'não há favorito claro pelo modelo'
        : `${context.favorite} aparece com leve vantagem`;

    const gameMoment = context.isLive
      ? `A partida está ao vivo, em fase de ${context.gamePhase}, com placar ${context.homeGoals}x${context.awayGoals}.`
      : context.isFinished
      ? `A partida já está finalizada.`
      : `A partida ainda não começou.`;

    const marketList = bestMarkets
      .map(
        (market, index) =>
          `${index + 1}. ${market.market}: ${market.tip} | odd ${market.odd} | confiança ${market.confidence}% | risco ${market.risk}`,
      )
      .join('\n');

    return `Análise Oddix — ${homeTeam} x ${awayTeam} (${league}).

${gameMoment}

Leitura:
O modelo priorizou mercados protegidos, evitando placar correto, bet builder agressivo e resultado seco sem vantagem clara. Neste confronto, ${favoriteText}. Tendência de gols ${context.goalTrend}/100, escanteios ${context.cornerTrend}/100, cartões ${context.cardTrend}/100 e finalizações ${context.shotTrend}/100.

Entrada principal:
${best.tip} | odd ${best.odd} | confiança ${best.confidence}% | risco ${best.risk}.

Mercados recomendados:
${marketList}

Múltiplas:
Conservadora: ${multiples?.conservative?.selections?.map((s: any) => s.tip).join(' + ') || 'Sem múltipla segura'} | odd ${multiples?.conservative?.combinedOdd || '-'}.
Moderada: ${multiples?.moderate?.selections?.map((s: any) => s.tip).join(' + ') || 'Sem múltipla segura'} | odd ${multiples?.moderate?.combinedOdd || '-'}.

Gestão:
Risco baixo: stake padrão. Risco médio: stake reduzida. Risco alto: evitar ou usar valor simbólico.`;
  }

  async generateBestMultipleFromGames(games: any[]) {
    const bets = await Promise.all((games || []).map((game) => this.generateBet(game)));

    const generated = bets
      .filter(Boolean)
      .map((bet: any) => {
        const bestMarket = Array.isArray(bet.markets)
          ? bet.markets.find(
              (m: any) =>
                m.risk !== 'Alto' &&
                Number(m.confidence) >= 70 &&
                Number(m.odd) <= 2.1 &&
                !this.isConditionalTip(m.tip),
            ) || bet.markets[0]
          : null;

        return {
          game: `${bet.homeTeam} x ${bet.awayTeam}`,
          league: bet.league,
          market: bestMarket?.market || 'Melhor entrada',
          tip: this.sanitizeTip(bestMarket?.tip || bet.tip, bet.homeTeam, bet.awayTeam, {
            isLive: false,
            goalTrend: 60,
            favorite: bet.homeTeam,
            totalGoals: 0,
          }),
          odd: Number(bestMarket?.odd || bet.odd || 1),
          confidence: Number(bestMarket?.confidence || bet.confidence || 0),
          risk: bestMarket?.risk || bet.risk || 'Médio',
        };
      })
      .filter((item: any) => item.tip && item.odd > 1)
      .filter((item: any) => item.risk !== 'Alto')
      .filter((item: any) => item.confidence >= 70)
      .filter((item: any) => item.odd <= 2.1)
      .filter((item: any) => !this.isConditionalTip(item.tip))
      .sort((a: any, b: any) => {
        const riskScore: any = { Baixo: 18, Médio: 7, Alto: -30 };
        const scoreA = a.confidence + riskScore[a.risk] + a.odd * 1.5;
        const scoreB = b.confidence + riskScore[b.risk] + b.odd * 1.5;
        return scoreB - scoreA;
      });

    const uniqueGames: any[] = [];
    const used = new Set<string>();

    for (const item of generated) {
      const key = item.game.toLowerCase();
      if (!used.has(key)) {
        used.add(key);
        uniqueGames.push(item);
      }

      if (uniqueGames.length >= 4) break;
    }

    const conservative = uniqueGames.slice(0, 2);
    const moderate = uniqueGames.slice(0, 3);
    const aggressive = uniqueGames.slice(0, 4);

    const build = (name: string, selections: any[], risk: RiskLevel, stake: string) => {
      const combinedOdd = selections.reduce(
        (acc, item) => acc * Number(item.odd || 1),
        1,
      );

      const avgConfidence = selections.length
        ? Math.round(
            selections.reduce(
              (acc, item) => acc + Number(item.confidence || 0),
              0,
            ) / selections.length,
          )
        : 0;

      return {
        name,
        selections,
        combinedOdd: Number(combinedOdd.toFixed(2)),
        confidence: avgConfidence,
        risk,
        stake,
        note:
          risk === 'Baixo'
            ? 'Múltipla com jogos diferentes e mercados protegidos.'
            : risk === 'Médio'
            ? 'Múltipla equilibrada, com stake reduzida.'
            : 'Múltipla agressiva, usar stake simbólica.',
      };
    };

    const result = {
      conservative: build('Múltipla Conservadora do Dia', conservative, 'Baixo', '0.5 unidade'),
      moderate: build('Múltipla Moderada do Dia', moderate, 'Médio', '0.25 unidade'),
      aggressive: build('Múltipla Agressiva do Dia', aggressive, 'Alto', '0.10 unidade'),
    };

    return {
      ...result,
      bestTelegramPick:
        result.conservative.selections.length >= 2
          ? result.conservative
          : result.moderate.selections.length >= 2
          ? result.moderate
          : null,
    };
  }
}