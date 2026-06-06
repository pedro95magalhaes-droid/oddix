import { Injectable } from "@nestjs/common";
import { MarketsService } from "../markets/markets.service";
import { OddsService } from "../odds/odds.service";
import { OddixConfidenceEngineService } from "./oddix-confidence-engine.service";
import { OddixBoostV2Service } from "./oddix-boost-v2.service";

type RiskLevel = "Baixo" | "Médio" | "Alto";

@Injectable()
export class AiService {
  private readonly oddixBoostV2 = new OddixBoostV2Service();
  private readonly recentProfessionalMarketKeys: string[] = [];
  private readonly recentProfessionalFixtureKeys: string[] = [];

  constructor(
    private readonly marketsService: MarketsService,
    private readonly oddsService: OddsService,
    private readonly confidenceEngine: OddixConfidenceEngineService,
  ) {}

  async generateBet(game: any) {
    const homeTeam = game.homeTeam || game.teams?.home?.name || "Time Casa";
    const awayTeam =
      game.awayTeam || game.teams?.away?.name || "Time Visitante";
    const league =
      game.leagueName || game.league?.name || game.league || "Liga";

    const statusShort = game.status?.short || game.fixture?.status?.short || "";
    const elapsed = Number(
      game.status?.elapsed || game.fixture?.status?.elapsed || 0,
    );

    const score = game.score || game.goals || {};
    const homeGoals = Number(score.home ?? score?.fulltime?.home ?? 0);
    const awayGoals = Number(score.away ?? score?.fulltime?.away ?? 0);

    const seed = this.createSeed(
      `${homeTeam}-${awayTeam}-${league}-${statusShort}-${elapsed}-${homeGoals}-${awayGoals}`,
    );

    let context: any = this.buildMatchContext({
      homeTeam,
      awayTeam,
      league,
      statusShort,
      elapsed,
      homeGoals,
      awayGoals,
      seed,
    });

    // Quando o provider enviar estatísticas reais (FlashScore/SportScore/etc.),
    // a IA deixa de usar apenas seed simulada e passa a ponderar posse,
    // finalizações, chutes no gol, escanteios e cartões reais.
    context = this.applyRealStatsToContext(context, game);
    context = {
      ...context,
      ...this.getLiveQualityGate(context, league),
    };

    const professionalProfile = this.buildProfessionalTipsterProfile(
      game,
      context,
      homeTeam,
      awayTeam,
      league,
      seed,
    );

    context = {
      ...context,
      professionalProfile,
      professionalScore: professionalProfile.score,
      professionalLevel: professionalProfile.level,
      professionalReasons: professionalProfile.reasons,
      professionalNoBetReasons: professionalProfile.noBetReasons,
      minSendConfidence: Math.max(
        Number(context.minSendConfidence || 70),
        professionalProfile.minConfidence,
      ),
      goalTrend: Math.max(context.goalTrend || 0, professionalProfile.goalTrend),
      cornerTrend: Math.max(context.cornerTrend || 0, professionalProfile.cornerTrend),
      shotTrend: Math.max(context.shotTrend || 0, professionalProfile.shotTrend),
    };

    /**
     * REGRA ODDIX PREMIUM:
     * Sem estatística real = sem palpite.
     *
     * Isso evita:
     * - aposta OPEN presa;
     * - VOID por falta de métrica;
     * - palpite em chutes/escanteios/player props sem dado real;
     * - envio para VIP/FREE sem base estatística.
     *
     * Para desligar temporariamente:
     * ODDIX_REQUIRE_REAL_STATS_FOR_TIPS=false
     */
    if (
      this.shouldRequireRealStatsForTips() &&
      context.realStatsAvailable !== true &&
      context.isLive
    ) {
      return null;
    }

    const realOdds = await this.oddsService.getBestOdds({
      homeTeam,
      awayTeam,
      league,
    });

    const playerProps = realOdds.filter((pick: any) =>
      String(pick.marketKey || "").startsWith("player_"),
    );

    const gameOdds = realOdds.filter(
      (pick: any) => !String(pick.marketKey || "").startsWith("player_"),
    );

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

        const rawTip = this.generateTip(
          market.key,
          homeTeam,
          awayTeam,
          context,
          marketSeed,
        );

        const tip = this.sanitizeTip(rawTip, homeTeam, awayTeam, context);
        const realOdd = this.findRealOddForMarket(gameOdds, market.key, tip);
        const odd =
          realOdd?.odd ||
          this.generateOdd(market.key, confidence, context, marketSeed);
        const risk = this.getRisk(confidence, market.key, context);

        return {
          key: market.key,
          category: market.category,
          market: market.name,
          tip: realOdd?.tip || tip,
          odd,
          confidence,
          risk,
          bookmaker: realOdd?.bookmaker || null,
          oddsSource: realOdd ? "the-odds-api" : "oddix-estimada",
          isRealOdd: !!realOdd,
          reason: this.generateProfessionalReason(
            market.name,
            homeTeam,
            awayTeam,
            context,
            confidence,
            risk,
            realOdd,
          ),
        };
      })
      .filter((market) => this.isMarketAllowed(market, context))
      .filter((market) => !this.isConditionalTip(market.tip));

    const professionalMarkets = this.buildProfessionalMarketCandidates(
      homeTeam,
      awayTeam,
      league,
      context,
      gameOdds,
      seed,
    ).filter((market) => this.isMarketAllowed(market, context));

    const allGeneratedMarkets = [...professionalMarkets, ...generatedMarkets];

    const bestMarkets = allGeneratedMarkets
      .sort((a, b) => {
        const scoreA = this.marketScore(
          a.confidence,
          a.odd,
          a.risk,
          context,
          a.key,
        );
        const scoreB = this.marketScore(
          b.confidence,
          b.odd,
          b.risk,
          context,
          b.key,
        );
        return scoreB - scoreA;
      })
      .slice(0, 5);

    const playerPropMarkets = playerProps
      .filter(() => !context.isLive || context.realStatsAvailable === true)
      .filter((prop: any) => {
        const key = String(prop.marketKey || "");
        if (
          key === "player_goal_scorer_anytime" &&
          process.env.ODDIX_ALLOW_ANYTIME_SCORER !== "true"
        )
          return false;
        return [
          "player_shots_on_target",
          "player_shots",
          "player_assists",
          "player_goal_scorer_anytime",
        ].includes(key);
      })
      .filter((prop: any) => Number(prop.odd || 0) >= 1.18)
      .filter(
        (prop: any) =>
          Number(prop.odd || 0) <=
          Number(process.env.ODDIX_PLAYER_PROP_MAX_ODD || 3.0),
      )
      .map((prop: any, index: number) => {
        const key = String(prop.marketKey || "");
        const isSot = key === "player_shots_on_target";
        const isShots = key === "player_shots";
        const isAssist = key === "player_assists";
        const isScorer = key === "player_goal_scorer_anytime";
        const odd = Number(prop.odd || 0);

        let confidence = isSot
          ? 88 - index
          : isShots
            ? 85 - index
            : isAssist
              ? 76 - index
              : 72 - index;

        if (context.isLive && context.elapsed > 0 && context.elapsed <= 70)
          confidence += 2;
        if (context.shotTrend >= 70 && (isSot || isShots)) confidence += 3;
        if (odd >= 2.4) confidence -= 4;
        if (odd >= 2.8) confidence -= 5;
        if (isScorer) confidence -= 8;

        confidence = Math.max(
          isSot ? 76 : isShots ? 74 : 68,
          Math.min(91, Math.round(confidence)),
        );

        const risk = (
          isScorer || odd >= 2.65
            ? "Alto"
            : confidence >= 82 && odd <= 2.15
              ? "Baixo"
              : "Médio"
        ) as RiskLevel;

        return {
          key,
          category: "Player Props",
          market: prop.marketName || "Player Props",
          player: prop.player || prop.playerName || null,
          playerPhoto: prop.playerPhoto || prop.photo || null,
          tip: prop.tip,
          odd,
          confidence,
          risk,
          bookmaker: prop.bookmaker,
          oddsSource: prop.source || "the-odds-api",
          isRealOdd: true,
          point: prop.point ?? null,
          eventId: prop.eventId ?? null,
          reason: `Mercado real de Player Props encontrado via ${prop.bookmaker}. A Oddix priorizou linha de jogador com odd real, sem inventar atleta, linha ou cotação.`,
        };
      });

    const mergedMarkets = [...playerPropMarkets, ...bestMarkets]
      .filter((market) => market.risk !== "Alto")
      .filter(
        (market) =>
          Number(market.confidence || 0) >=
          Number(context.minSendConfidence || 70),
      )
      .sort((a, b) => {
        const scoreA = this.marketScore(
          a.confidence,
          a.odd,
          a.risk,
          context,
          a.key,
        );
        const scoreB = this.marketScore(
          b.confidence,
          b.odd,
          b.risk,
          context,
          b.key,
        );
        return scoreB - scoreA;
      })
      .slice(0, 5);

    const fallback = this.safeFallbackMarket(
      homeTeam,
      awayTeam,
      league,
      context,
    );
    fallback.tip = this.sanitizeTip(fallback.tip, homeTeam, awayTeam, context);

    const rawFinalMarkets = mergedMarkets.length ? mergedMarkets : [fallback];

    const finalMarkets = this.oddixBoostV2.selectBestMarkets(
      rawFinalMarkets
        .map((market: any) =>
          this.applyConfidenceEngine(market, context, homeTeam, awayTeam, game),
        )
        .filter(
          (market: any) =>
            market.oddixEngine?.send || Number(market.confidence || 0) >= 80,
        ),
      {
        isLive: context.isLive,
        elapsed: context.elapsed,
        totalGoals: context.totalGoals,
        league,
        seed,
      },
      5,
    );

    let safeFinalMarkets = context.liveQualityBlocked
      ? [this.buildBlockedLiveMarket(homeTeam, awayTeam, league, context)]
      : finalMarkets.length
        ? finalMarkets
        : [
            this.applyConfidenceEngine(
              fallback,
              context,
              homeTeam,
              awayTeam,
              game,
            ),
          ];

    safeFinalMarkets = this.applyProfessionalAntiRepetition(
      safeFinalMarkets,
      context,
      homeTeam,
      awayTeam,
    );

    const best = safeFinalMarkets[0];
    this.rememberProfessionalPick(best, homeTeam, awayTeam);

    const multiples = this.generateMultiples(safeFinalMarkets, context);

    return {
      homeTeam,
      awayTeam,
      league,
      status: "open",
      sources: {
        matchData:
          game.provider || game.sources?.matchData || "api-football/sportmonks",
        odds: safeFinalMarkets.some((market: any) => market.isRealOdd)
          ? "the-odds-api"
          : "oddix-estimada",
        confidenceEngine: "oddix-professional-tipster-engine-v3",
        realOddsCount: realOdds.length,
        playerPropsCount: playerPropMarkets.length,
        estimatedOddsCount: safeFinalMarkets.filter(
          (market: any) => !market.isRealOdd,
        ).length,
        realStatsAvailable: context.realStatsAvailable === true,
        liveQualityLevel: context.liveQualityLevel || "PREMATCH",
        liveQualityBlocked: context.liveQualityBlocked === true,
        liveQualityReason: context.liveQualityReason || null,
      },

      tip: this.sanitizeTip(best.tip, homeTeam, awayTeam, context),
      odd: best.odd,
      confidence: best.confidence,
      risk: best.risk,
      engineScore: best.oddixEngine?.score ?? best.confidence,
      engineLevel: best.oddixEngine?.level || "BOM",
      engineCategory: best.oddixEngine?.category || "SAFE",
      dominanceHome: best.oddixEngine?.dominanceHome ?? 50,
      dominanceAway: best.oddixEngine?.dominanceAway ?? 50,
      dominantTeam: best.oddixEngine?.dominantTeam || "Jogo equilibrado",
      engineReasons: best.oddixEngine?.reasons || [],

      markets: safeFinalMarkets.map((market) => ({
        ...market,
        tip: this.sanitizeTip(market.tip, homeTeam, awayTeam, context),
      })),

      playerProps: playerPropMarkets
        .filter((market: any) => market.isRealOdd)
        .slice(0, Number(process.env.ODDIX_PLAYER_PROPS_RESPONSE_LIMIT || 12))
        .map((market: any) => ({
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
        bestMarkets: safeFinalMarkets.map((market) => ({
          ...market,
          tip: this.sanitizeTip(market.tip, homeTeam, awayTeam, context),
        })),
        multiples,
      }),
    };
  }


  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  private normalizeStatNumber(value: any, fallback = 0) {
    const parsed = Number(
      String(value ?? fallback)
        .replace("%", "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, ""),
    );
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readTeamFormScore(game: any, side: "home" | "away", seed: number) {
    const team = side === "home" ? game?.teams?.home : game?.teams?.away;
    const candidates = [
      team?.form,
      team?.lastFive,
      team?.recentForm,
      game?.form?.[side],
      game?.teamForm?.[side],
      game?.stats?.form?.[side],
      game?.raw?.form?.[side],
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const letters = candidate.toUpperCase().replace(/[^WDLVDE]/g, "").slice(-5);
        if (letters.length) {
          let points = 0;
          for (const ch of letters) {
            if (["W", "V"].includes(ch)) points += 3;
            if (["D", "E"].includes(ch)) points += 1;
          }
          return this.clamp((points / Math.max(1, letters.length * 3)) * 20, 6, 20);
        }
      }

      if (Array.isArray(candidate)) {
        const last = candidate.slice(-5);
        if (last.length) {
          let points = 0;
          for (const item of last) {
            const result = this.normalizeText(item?.result || item?.status || item);
            if (result.includes("win") || result.includes("vitoria") || result === "w" || result === "v") points += 3;
            else if (result.includes("draw") || result.includes("empate") || result === "d" || result === "e") points += 1;
          }
          return this.clamp((points / Math.max(1, last.length * 3)) * 20, 6, 20);
        }
      }
    }

    return this.seededInt(seed + (side === "home" ? 120 : 240), 10, 17);
  }

  private readStatCandidate(game: any, side: "home" | "away", names: string[], fallback: number) {
    const team = side === "home" ? game?.teams?.home : game?.teams?.away;
    const buckets = [
      team,
      game?.stats?.[side],
      game?.teamStats?.[side],
      game?.preMatchStats?.[side],
      game?.raw?.stats?.[side],
      game?.raw?.preMatchStats?.[side],
    ].filter(Boolean);

    const normalizedNames = names.map((name) => this.normalizeText(name));

    for (const bucket of buckets) {
      for (const [key, value] of Object.entries(bucket || {})) {
        const normalizedKey = this.normalizeText(key);
        if (normalizedNames.some((name) => normalizedKey.includes(name))) {
          return this.normalizeStatNumber(value, fallback);
        }
      }
    }

    return fallback;
  }

  private buildProfessionalTipsterProfile(
    game: any,
    context: any,
    homeTeam: string,
    awayTeam: string,
    league: string,
    seed: number,
  ) {
    const leagueQuality = this.clamp(Number(game?.oddix?.qualityScore || 70), 0, 100);
    const homeForm = this.readTeamFormScore(game, "home", seed);
    const awayForm = this.readTeamFormScore(game, "away", seed);
    const formEdge = Math.abs(homeForm - awayForm);

    const homeGoalsFor = this.readStatCandidate(game, "home", ["goalsFor", "goals_for", "gols pro", "marcados"], this.seededNumber(seed + 301, 1.05, 2.05));
    const awayGoalsFor = this.readStatCandidate(game, "away", ["goalsFor", "goals_for", "gols pro", "marcados"], this.seededNumber(seed + 302, 0.85, 1.85));
    const homeGoalsAgainst = this.readStatCandidate(game, "home", ["goalsAgainst", "goals_against", "gols contra", "sofridos"], this.seededNumber(seed + 303, 0.75, 1.55));
    const awayGoalsAgainst = this.readStatCandidate(game, "away", ["goalsAgainst", "goals_against", "gols contra", "sofridos"], this.seededNumber(seed + 304, 0.9, 1.8));

    const attackScore = this.clamp(((homeGoalsFor + awayGoalsFor) / 3.7) * 20, 7, 20);
    const defenseScore = this.clamp((2.8 - Math.min(2.8, (homeGoalsAgainst + awayGoalsAgainst) / 2)) * 7.2 + 6, 6, 20);
    const formScore = this.clamp((homeForm + awayForm) / 2 + Math.min(4, formEdge / 2), 7, 20);
    const homeAwayScore = this.clamp(10 + (homeForm - awayForm) * 0.25 + (leagueQuality >= 80 ? 3 : 0), 6, 15);
    const momentScore = this.clamp((leagueQuality / 100) * 15 + (context.realStatsAvailable ? 3 : 0), 5, 15);

    const realOddsOptions = [
      ...(Array.isArray(game?.odds?.options) ? game.odds.options : []),
      ...(Array.isArray(game?.odds?.opções) ? game.odds.opções : []),
    ];
    const hasRealOdds = realOddsOptions.some((option: any) => Number(option?.odd || option?.ímpar || option?.rate?.decimal || 0) > 1);
    const oddValueScore = hasRealOdds ? 9 : leagueQuality >= 82 ? 7 : 5;

    const rawScore = formScore + attackScore + defenseScore + homeAwayScore + momentScore + oddValueScore;
    const realDataPenalty = context.realStatsAvailable ? 0 : context.isLive ? 20 : 4;
    const score = this.clamp(rawScore - realDataPenalty, 0, 100);

    const favorite =
      homeForm + homeGoalsFor * 4 - homeGoalsAgainst >= awayForm + awayGoalsFor * 4 - awayGoalsAgainst + 5
        ? homeTeam
        : awayForm + awayGoalsFor * 4 - awayGoalsAgainst >= homeForm + homeGoalsFor * 4 - homeGoalsAgainst + 5
          ? awayTeam
          : "equilibrado";

    const totalGoalProjection = homeGoalsFor + awayGoalsFor + (homeGoalsAgainst + awayGoalsAgainst) * 0.42;
    const bttsIndex = this.clamp((homeGoalsFor + awayGoalsFor + homeGoalsAgainst + awayGoalsAgainst) * 14, 35, 92);
    const underIndex = this.clamp((2.8 - Math.min(2.8, totalGoalProjection / 1.35)) * 22 + 35, 30, 90);
    const goalTrend = this.clamp(totalGoalProjection * 23 + (bttsIndex > 68 ? 6 : 0), 42, 94);
    const cornerTrend = this.clamp(48 + attackScore * 1.4 + (context.realStatsAvailable ? 8 : 0), 42, 92);
    const shotTrend = this.clamp(50 + attackScore * 1.5 + (context.realStatsAvailable ? 8 : 0), 44, 94);

    const noBetReasons: string[] = [];
    if (score < 80) noBetReasons.push(`Score profissional abaixo do corte mínimo (${score}/100).`);
    if (context.isLive && context.realStatsAvailable !== true) noBetReasons.push("Live sem estatísticas reais para leitura profissional.");
    if (context.isFinished) noBetReasons.push("Jogo finalizado.");

    const level =
      score >= 95 ? "TOP_PICK" :
      score >= 90 ? "VIP_PREMIUM" :
      score >= 85 ? "VIP" :
      score >= 80 ? "BOM" :
      "NO_BET";

    return {
      score,
      level,
      minConfidence: score >= 90 ? 84 : score >= 85 ? 80 : score >= 80 ? 76 : 999,
      leagueQuality,
      formScore,
      attackScore,
      defenseScore,
      homeAwayScore,
      momentScore,
      oddValueScore,
      favorite,
      totalGoalProjection,
      bttsIndex,
      underIndex,
      goalTrend,
      cornerTrend,
      shotTrend,
      reasons: [
        `Score profissional ${score}/100 (${level}).`,
        `Forma ${formScore}/20, ataque ${attackScore}/20, defesa ${defenseScore}/20, casa/fora ${homeAwayScore}/15, momento ${momentScore}/15, valor odd ${oddValueScore}/10.`,
        favorite === "equilibrado" ? "Confronto sem favorito claro." : `${favorite} aparece com vantagem técnica no modelo.`,
      ],
      noBetReasons,
    };
  }

  private confidenceFromProfessionalScore(context: any, modifier = 0) {
    const score = Number(context.professionalScore || 0);
    const hasRealStats = context.realStatsAvailable === true;
    const cap = hasRealStats ? 91 : context.isLive ? 68 : 88;
    return this.clamp(score - 2 + modifier, 60, cap);
  }

  private buildProfessionalMarketCandidates(
    homeTeam: string,
    awayTeam: string,
    league: string,
    context: any,
    realOdds: any[],
    seed: number,
  ) {
    const profile = context.professionalProfile;
    if (!profile || profile.score < 80 || context.isFinished) return [];

    const favorite = profile.favorite === "equilibrado" ? homeTeam : profile.favorite;
    const other = favorite === homeTeam ? awayTeam : homeTeam;
    const candidates: any[] = [];

    const push = (params: {
      key: string;
      category: string;
      market: string;
      tip: string;
      baseOdd: number;
      confidenceModifier?: number;
      risk?: RiskLevel;
      requiresStats?: boolean;
    }) => {
      if (params.requiresStats && context.realStatsAvailable !== true) return;
      const realOdd = this.findRealOddForMarket(realOdds, params.key, params.tip);
      const confidence = this.confidenceFromProfessionalScore(context, params.confidenceModifier || 0);
      const odd = realOdd?.odd || Number((params.baseOdd + this.seededNumber(seed + candidates.length, -0.04, 0.06)).toFixed(2));

      candidates.push({
        key: params.key,
        category: params.category,
        market: params.market,
        tip: realOdd?.tip || params.tip,
        odd,
        confidence,
        risk: params.risk || (confidence >= 84 && Number(odd) <= 2.05 ? "Baixo" : "Médio"),
        bookmaker: realOdd?.bookmaker || null,
        oddsSource: realOdd ? "the-odds-api" : "oddix-professional-estimada",
        isRealOdd: !!realOdd,
        professionalScore: profile.score,
        reason: this.generateV3Reason(params.market, params.tip, homeTeam, awayTeam, league, context, confidence, realOdd),
      });
    };

    if (profile.favorite !== "equilibrado" && profile.score >= 82) {
      push({
        key: "dupla_chance",
        category: "Protegido",
        market: "Dupla Chance",
        tip: `${favorite} ou empate`,
        baseOdd: 1.38,
        confidenceModifier: 2,
        risk: "Baixo",
      });

      push({
        key: "handicap_asiatico",
        category: "Protegido",
        market: "Handicap Asiático",
        tip: `${favorite} +0.25 handicap asiático`,
        baseOdd: 1.58,
        confidenceModifier: 0,
      });
    }

    if (profile.goalTrend >= 74 && profile.totalGoalProjection >= 2.55) {
      push({
        key: "total_gols",
        category: "Gols",
        market: "Total de Gols",
        tip: "Over 1.5 gols",
        baseOdd: 1.52,
        confidenceModifier: 1,
        risk: "Baixo",
      });

      if (profile.bttsIndex >= 70) {
        push({
          key: "ambas_marcam",
          category: "Gols",
          market: "Ambas Marcam",
          tip: "Ambas equipes marcam: Sim",
          baseOdd: 1.78,
          confidenceModifier: -3,
          risk: "Médio",
        });
      }
    }

    if (profile.underIndex >= 72 || profile.totalGoalProjection <= 2.15) {
      push({
        key: "total_gols",
        category: "Protegido",
        market: "Total de Gols",
        tip: "Under 3.5 gols",
        baseOdd: 1.55,
        confidenceModifier: 1,
        risk: "Baixo",
      });
    }

    if (context.realStatsAvailable === true) {
      if (profile.cornerTrend >= 72) {
        push({
          key: "escanteios",
          category: "Estatísticas",
          market: "Escanteios",
          tip: profile.cornerTrend >= 82 ? "Over 8.5 escanteios" : "Over 7.5 escanteios",
          baseOdd: 1.72,
          confidenceModifier: -2,
          requiresStats: true,
        });
      }

      if (profile.shotTrend >= 73) {
        push({
          key: "chutes_no_gol",
          category: "Estatísticas",
          market: "Chutes no Gol",
          tip: profile.shotTrend >= 83 ? "Over 6.5 chutes no gol" : "Over 5.5 chutes no gol",
          baseOdd: 1.76,
          confidenceModifier: -2,
          requiresStats: true,
        });
      }
    }

    if (context.isLive && context.totalGoals <= 1 && context.elapsed >= 55 && context.elapsed <= 75) {
      push({
        key: "total_gols",
        category: "Live Profissional",
        market: "Total de Gols Live",
        tip: "Ao vivo: Under 3.5 gols",
        baseOdd: 1.62,
        confidenceModifier: -1,
      });
    }

    return candidates;
  }

  private generateV3Reason(
    market: string,
    tip: string,
    homeTeam: string,
    awayTeam: string,
    league: string,
    context: any,
    confidence: number,
    realOdd?: any,
  ) {
    const profile = context.professionalProfile || {};
    const statsText = context.realStatsAvailable
      ? "com estatísticas reais incorporadas"
      : "em modo pré-jogo estimado, sem usar mercado dependente de estatística real";

    return `Oddix Professional Tipster Engine V3 selecionou ${market} para ${homeTeam} x ${awayTeam} (${league}). Entrada: ${tip}. Score ${profile.score || 0}/100, nível ${profile.level || "BOM"}, ${statsText}. ${profile.reasons?.join(" ") || ""} ${realOdd ? `Odd real encontrada via ${realOdd.bookmaker}.` : "Odd estimada e limitada por gestão de risco."} Confiança ${confidence}%.`;
  }

  private professionalMarketKey(market: any) {
    const text = this.normalizeText(`${market?.key || ""} ${market?.tip || ""}`);
    if (text.includes("over 1 5") || text.includes("over 1.5")) return "over_1_5";
    if (text.includes("under 3 5") || text.includes("under 3.5")) return "under_3_5";
    if (text.includes("ambas") || text.includes("btts")) return "btts";
    if (text.includes("handicap")) return "handicap";
    if (text.includes("dupla") || text.includes("empate")) return "dupla_chance";
    if (text.includes("escanteio") || text.includes("corner")) return "corners";
    if (text.includes("chute")) return "shots";
    return String(market?.key || market?.market || "unknown");
  }

  private applyProfessionalAntiRepetition(
    markets: any[],
    context: any,
    homeTeam: string,
    awayTeam: string,
  ) {
    const fixtureKey = this.normalizeText(`${homeTeam}-${awayTeam}`);
    const recentFixture = this.recentProfessionalFixtureKeys.includes(fixtureKey);
    const maxSameMarket = Number(process.env.ODDIX_MAX_REPEAT_MARKET_WINDOW || 2);

    const scored = (markets || []).map((market, index) => {
      const key = this.professionalMarketKey(market);
      const repeats = this.recentProfessionalMarketKeys.filter((item) => item === key).length;
      const repeatPenalty = repeats >= maxSameMarket ? 22 : repeats * 8;
      const fixturePenalty = recentFixture ? 12 : 0;
      const proBonus = Number(market?.professionalScore || context.professionalScore || 0) >= 90 ? 6 : 0;

      return {
        market,
        index,
        score:
          Number(market?.confidence || 0) +
          Number(market?.odd || 0) * 2 +
          proBonus -
          repeatPenalty -
          fixturePenalty,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.market)
      .slice(0, 5);
  }

  private rememberProfessionalPick(market: any, homeTeam: string, awayTeam: string) {
    if (!market || market?.key === "blocked_live_no_stats") return;

    const marketKey = this.professionalMarketKey(market);
    const fixtureKey = this.normalizeText(`${homeTeam}-${awayTeam}`);

    this.recentProfessionalMarketKeys.unshift(marketKey);
    this.recentProfessionalFixtureKeys.unshift(fixtureKey);

    this.recentProfessionalMarketKeys.splice(12);
    this.recentProfessionalFixtureKeys.splice(20);
  }

  private mapGeneratedMarketToOddsKeys(key: string) {
    const map: Record<string, string[]> = {
      resultado_final: ["h2h"],
      total_gols: ["totals"],
      ao_vivo: ["totals"],
      ambas_marcam: ["btts"],
      handicap_asiatico: ["spreads"],
      handicap_europeu: ["spreads"],
    };

    return map[key] || [];
  }

  private findRealOddForMarket(
    realOdds: any[],
    marketKey: string,
    generatedTip: string,
  ) {
    const allowedKeys = this.mapGeneratedMarketToOddsKeys(marketKey);
    if (!allowedKeys.length) return null;

    const normalizedTip = this.normalizeText(generatedTip);
    const candidates = (realOdds || []).filter((odd) =>
      allowedKeys.includes(odd.marketKey),
    );

    if (!candidates.length) return null;

    const exact = candidates.find((odd) => {
      const tip = this.normalizeText(odd.tip);
      return (
        tip && (normalizedTip.includes(tip) || tip.includes(normalizedTip))
      );
    });

    if (exact) return exact;

    const safe = candidates
      .filter((odd) => Number(odd.odd || 0) >= 1.25)
      .filter((odd) => Number(odd.odd || 0) <= 2.35)
      .sort((a, b) => Number(a.odd || 0) - Number(b.odd || 0));

    return safe[0] || candidates[0] || null;
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
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isPremiumLiveLeague(league: any) {
    const normalized = this.normalizeText(league);

    const premiumWords = [
      "brasileirao",
      "brasil serie a",
      "brazil serie a",
      "brasil serie b",
      "brazil serie b",
      "copa do brasil",
      "libertadores",
      "sudamericana",
      "sul americana",
      "champions league",
      "europa league",
      "conference league",
      "premier league",
      "championship",
      "la liga",
      "bundesliga",
      "serie a",
      "serie b",
      "ligue 1",
      "primeira liga",
      "eredivisie",
      "mls",
      "liga mx",
      "argentina primera",
      "copa argentina",
      "world cup",
      "copa america",
      "euro",
    ];

    return premiumWords.some((word) => normalized.includes(word));
  }

  private shouldRequireRealStatsForTips() {
    return (
      String(process.env.ODDIX_REQUIRE_REAL_STATS_FOR_TIPS || "true").toLowerCase() !==
      "false"
    );
  }

  private getLiveQualityGate(context: any, league: any) {
    if (!context.isLive) {
      return {
        liveQualityLevel: "PREMATCH",
        liveQualityBlocked: false,
        liveQualityReason: null,
        minSendConfidence: 70,
        liveConfidenceCap: 95,
      };
    }

    const hasRealStats = context.realStatsAvailable === true;
    const premiumLeague = this.isPremiumLiveLeague(league);

    if (hasRealStats) {
      return {
        liveQualityLevel: "PREMIUM",
        liveQualityBlocked: false,
        liveQualityReason: "Estatísticas reais disponíveis.",
        minSendConfidence: 80,
        liveConfidenceCap: 95,
      };
    }

    if (!premiumLeague) {
      return {
        liveQualityLevel: "BLOCKED",
        liveQualityBlocked: true,
        liveQualityReason:
          "Live bloqueado: liga sem estatísticas reais e fora da lista premium.",
        minSendConfidence: 999,
        liveConfidenceCap: 0,
      };
    }

    return {
      liveQualityLevel: "LIMITED",
      liveQualityBlocked: false,
      liveQualityReason:
        "Live limitado: sem estatísticas reais. Apenas mercados conservadores.",
      minSendConfidence: 80,
      liveConfidenceCap: 68,
    };
  }

  private requiresRealStatsMarket(key: any, tip?: any) {
    const normalizedKey = this.normalizeText(key);
    const normalizedTip = this.normalizeText(tip);
    const text = `${normalizedKey} ${normalizedTip}`;

    return (
      normalizedKey.startsWith("player_") ||
      text.includes("escanteio") ||
      text.includes("corner") ||
      text.includes("chute") ||
      text.includes("finalizacao") ||
      text.includes("finalização") ||
      text.includes("shots") ||
      text.includes("sot") ||
      text.includes("cartao") ||
      text.includes("cartão") ||
      text.includes("yellow") ||
      text.includes("assistencia") ||
      text.includes("assistência")
    );
  }

  private isConservativeLiveWithoutStatsMarket(market: any) {
    const key = this.normalizeText(market?.key);
    const tip = this.normalizeText(market?.tip);

    if (this.requiresRealStatsMarket(key, tip)) return false;

    const allowedKeys = [
      "dupla_chance",
      "empate_anula",
      "handicap_asiatico",
      "handicap_europeu",
      "total_gols",
    ];
    if (!allowedKeys.includes(key)) return false;

    if (key === "total_gols") {
      return tip.includes("under") || tip.includes("menos de");
    }

    return true;
  }

  private capMarketForLiveWithoutStats(market: any, context: any) {
    if (!context?.isLive || context.realStatsAvailable === true) return market;

    const cap = Number(context.liveConfidenceCap ?? 68);
    const confidence = Math.min(Number(market?.confidence || 0), cap);

    return {
      ...market,
      confidence,
      risk: confidence >= 65 ? "Médio" : "Alto",
      reason:
        `${market?.reason || ""} Live sem estatísticas reais: confiança limitada a ${cap}% e mercados agressivos bloqueados.`.trim(),
    };
  }

  private buildBlockedLiveMarket(
    homeTeam: string,
    awayTeam: string,
    league: string,
    context: any,
  ) {
    return {
      key: "blocked_live_no_stats",
      category: "Bloqueado",
      market: "Live bloqueado",
      tip: "SEM ENTRADA: jogo ao vivo sem estatísticas reais",
      odd: 0,
      confidence: 0,
      risk: "Alto" as RiskLevel,
      bookmaker: null,
      oddsSource: "blocked",
      isRealOdd: false,
      oddixEngine: {
        send: false,
        score: 0,
        confidence: 0,
        risk: "Alto",
        level: "BLOQUEADO",
        category: "NO_BET",
        dominanceHome: 50,
        dominanceAway: 50,
        dominantTeam: "Sem leitura segura",
        reasons: [context.liveQualityReason || "Live sem estatísticas reais."],
      },
      reason: `Oddix bloqueou ${homeTeam} x ${awayTeam} (${league}). ${context.liveQualityReason || "Sem estatísticas reais para leitura ao vivo."}`,
    };
  }

  private isConditionalTip(tip: string) {
    const normalized = this.normalizeText(tip);

    return (
      normalized.includes("entrada ao vivo somente") ||
      normalized.includes("somente se") ||
      normalized.includes("ritmo ofensivo") ||
      normalized.includes("ritmo confirmar") ||
      normalized.includes("aguardar") ||
      normalized.includes("evitar 1o tempo") ||
      normalized.includes("jogo ja em andamento") ||
      normalized.includes("exposicao controlada")
    );
  }

  private getSafeRealTip(homeTeam: string, awayTeam: string, context: any) {
    const livePrefix = context.isLive ? "Ao vivo: " : "";

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
      return "Over 1.5 gols";
    }

    if (context.favorite === awayTeam) {
      return `${awayTeam} ou empate`;
    }

    return `${homeTeam} ou empate`;
  }

  private sanitizeTip(
    tip: string,
    homeTeam: string,
    awayTeam: string,
    context: any,
  ) {
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
    const isLive = ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(
      data.statusShort,
    );

    const isFinished = ["FT", "AET", "PEN"].includes(data.statusShort);

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
            : "equilibrado",
      underdog:
        homeStrength >= awayStrength + 5
          ? data.awayTeam
          : awayStrength >= homeStrength + 5
            ? data.homeTeam
            : "nenhum",
      gamePhase: this.getGamePhase(data.statusShort, data.elapsed),
      matchTempo: this.getMatchTempo(data.elapsed, totalGoals, goalTrend),
      realStatsAvailable: false,
      liveQualityLevel: isLive ? "LIMITED" : "PREMATCH",
      liveQualityBlocked: false,
      liveQualityReason: null,
      minSendConfidence: isLive ? 80 : 70,
      liveConfidenceCap: 95,
    };
  }

  private extractStatValue(stats: any[], aliases: string[]) {
    const normalize = (value: any) =>
      String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const wanted = aliases.map((item) => normalize(item));

    const row = (stats || []).find((item: any) => {
      const type = normalize(
        item?.type || item?.name || item?.title || item?.statName,
      );
      return wanted.some((alias) => type.includes(alias));
    });

    if (!row) return null;

    const rawValue = row?.value ?? row?.home ?? row?.away ?? row?.total ?? null;
    if (rawValue === null || rawValue === undefined || rawValue === "")
      return null;

    const parsed = Number(
      String(rawValue)
        .replace("%", "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, ""),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readStatsTeams(game: any) {
    const candidates = [
      game?.statistics,
      game?.stats,
      game?.oddixStats,
      game?.flashScoreStats,
      game?.flashScoreRaw?.statistics,
      game?.flashScoreRaw?.stats,
      game?.raw?.statistics,
      game?.raw?.stats,
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (Array.isArray(candidate?.teams)) return candidate.teams;
      if (Array.isArray(candidate)) {
        const looksLikeOddixTeams = candidate.some((item: any) =>
          Array.isArray(item?.statistics),
        );
        if (looksLikeOddixTeams) return candidate;
      }
    }

    return [];
  }

  private getRealStatsSnapshot(game: any) {
    const teams = this.readStatsTeams(game);
    if (!teams.length) return null;

    const homeStats = teams[0]?.statistics || teams[0]?.stats || [];
    const awayStats = teams[1]?.statistics || teams[1]?.stats || [];

    const get = (stats: any[], aliases: string[]) =>
      this.extractStatValue(stats, aliases);

    const possessionHome = get(homeStats, ["Ball Possession", "posse"]);
    const possessionAway = get(awayStats, ["Ball Possession", "posse"]);
    const shotsTotalHome = get(homeStats, [
      "Total Shots",
      "finalizacoes",
      "chutes totais",
    ]);
    const shotsTotalAway = get(awayStats, [
      "Total Shots",
      "finalizacoes",
      "chutes totais",
    ]);
    const shotsOnGoalHome = get(homeStats, [
      "Shots on Goal",
      "chutes no gol",
      "on target",
    ]);
    const shotsOnGoalAway = get(awayStats, [
      "Shots on Goal",
      "chutes no gol",
      "on target",
    ]);
    const cornersHome = get(homeStats, [
      "Corner Kicks",
      "escanteios",
      "corners",
    ]);
    const cornersAway = get(awayStats, [
      "Corner Kicks",
      "escanteios",
      "corners",
    ]);
    const yellowCardsHome = get(homeStats, [
      "Yellow Cards",
      "cartoes amarelos",
    ]);
    const yellowCardsAway = get(awayStats, [
      "Yellow Cards",
      "cartoes amarelos",
    ]);

    const hasAnyRealStat = [
      possessionHome,
      possessionAway,
      shotsTotalHome,
      shotsTotalAway,
      shotsOnGoalHome,
      shotsOnGoalAway,
      cornersHome,
      cornersAway,
      yellowCardsHome,
      yellowCardsAway,
    ].some((value) => value !== null && value !== undefined);

    if (!hasAnyRealStat) return null;

    return {
      possessionHome,
      possessionAway,
      shotsTotalHome,
      shotsTotalAway,
      shotsOnGoalHome,
      shotsOnGoalAway,
      cornersHome,
      cornersAway,
      yellowCardsHome,
      yellowCardsAway,
    };
  }

  private trendFromStat(total: number, excellent: number, base = 52) {
    const ratio = Math.max(0, Math.min(1.4, total / Math.max(1, excellent)));
    return Math.max(42, Math.min(94, Math.round(base + ratio * 30)));
  }

  private applyRealStatsToContext(context: any, game: any) {
    const stats = this.getRealStatsSnapshot(game);
    if (!stats) return context;

    const elapsed = Math.max(1, Number(context.elapsed || 0));
    const paceMultiplier = context.isLive
      ? Math.max(0.45, Math.min(1.25, 90 / elapsed))
      : 1;

    const totalShots =
      Number(stats.shotsTotalHome || 0) + Number(stats.shotsTotalAway || 0);
    const totalShotsOnGoal =
      Number(stats.shotsOnGoalHome || 0) + Number(stats.shotsOnGoalAway || 0);
    const totalCorners =
      Number(stats.cornersHome || 0) + Number(stats.cornersAway || 0);
    const totalCards =
      Number(stats.yellowCardsHome || 0) + Number(stats.yellowCardsAway || 0);

    const projectedShots = context.isLive
      ? totalShots * paceMultiplier
      : totalShots;
    const projectedShotsOnGoal = context.isLive
      ? totalShotsOnGoal * paceMultiplier
      : totalShotsOnGoal;
    const projectedCorners = context.isLive
      ? totalCorners * paceMultiplier
      : totalCorners;
    const projectedCards = context.isLive
      ? totalCards * paceMultiplier
      : totalCards;

    const possessionHome = stats.possessionHome ?? context.possessionHome;
    const possessionAway = stats.possessionAway ?? context.possessionAway;

    const homePressure =
      Number(stats.shotsTotalHome || 0) * 2 +
      Number(stats.shotsOnGoalHome || 0) * 5 +
      Number(stats.cornersHome || 0) * 3 +
      Number(possessionHome || 50) * 0.4;

    const awayPressure =
      Number(stats.shotsTotalAway || 0) * 2 +
      Number(stats.shotsOnGoalAway || 0) * 5 +
      Number(stats.cornersAway || 0) * 3 +
      Number(possessionAway || 50) * 0.4;

    const pressureTotal = Math.max(1, homePressure + awayPressure);
    const dominanceHome = Math.round((homePressure / pressureTotal) * 100);
    const dominanceAway = 100 - dominanceHome;

    return {
      ...context,
      realStatsAvailable: true,
      possessionHome,
      possessionAway,
      shotsTotalHome: stats.shotsTotalHome,
      shotsTotalAway: stats.shotsTotalAway,
      shotsOnGoalHome: stats.shotsOnGoalHome,
      shotsOnGoalAway: stats.shotsOnGoalAway,
      cornersHome: stats.cornersHome,
      cornersAway: stats.cornersAway,
      yellowCardsHome: stats.yellowCardsHome,
      yellowCardsAway: stats.yellowCardsAway,
      dominanceHome,
      dominanceAway,
      dominantTeam:
        dominanceHome >= dominanceAway + 12
          ? context.homeTeam
          : dominanceAway >= dominanceHome + 12
            ? context.awayTeam
            : "Jogo equilibrado",
      shotTrend: Math.max(
        context.shotTrend,
        this.trendFromStat(projectedShots + projectedShotsOnGoal * 1.8, 24, 50),
      ),
      cornerTrend: Math.max(
        context.cornerTrend,
        this.trendFromStat(projectedCorners, 9, 50),
      ),
      cardTrend: Math.max(
        context.cardTrend,
        this.trendFromStat(projectedCards, 5, 45),
      ),
      goalTrend: Math.max(
        context.goalTrend,
        this.trendFromStat(
          projectedShotsOnGoal * 2 + projectedShots * 0.35,
          12,
          48,
        ),
      ),
    };
  }

  private getGamePhase(statusShort: string, elapsed: number) {
    if (statusShort === "HT") return "intervalo";
    if (["FT", "AET", "PEN"].includes(statusShort)) return "finalizado";
    if (elapsed > 75) return "reta final";
    if (elapsed > 45) return "segundo tempo";
    if (elapsed > 0) return "primeiro tempo";
    return "pré-jogo";
  }

  private getMatchTempo(
    elapsed: number,
    totalGoals: number,
    goalTrend: number,
  ) {
    if (!elapsed) {
      if (goalTrend >= 72) return "tendente a gols";
      if (goalTrend <= 54) return "mais controlado";
      return "neutro";
    }

    if (totalGoals >= 3 && elapsed <= 70) return "aberto";
    if (totalGoals === 0 && elapsed >= 35) return "travado";
    if (totalGoals <= 1 && elapsed >= 60) return "controlado";

    return "equilibrado";
  }

  private isMarketAllowed(market: any, context: any) {
    if (!market) return false;

    const blockedAlways = ["placar_correto", "jogadores", "bet_builder"];
    if (blockedAlways.includes(market.key)) return false;

    if (market.risk === "Alto") return false;
    if (market.confidence < 68) return false;
    if (Number(market.odd) > 2.35 && market.confidence < 78) return false;

    if (context.isFinished) return false;

    if (
      this.shouldRequireRealStatsForTips() &&
      context.realStatsAvailable !== true &&
      context.isLive
    ) {
      return false;
    }

    if (
      context.realStatsAvailable !== true &&
      this.requiresRealStatsMarket(market.key, market.tip)
    ) {
      return false;
    }

    if (context.isLive && context.liveQualityBlocked) return false;

    if (context.isLive && context.realStatsAvailable !== true) {
      if (!this.isConservativeLiveWithoutStatsMarket(market)) return false;
      if (Number(market.odd || 0) > 2.0) return false;
    }

    if (context.isLive && context.elapsed >= 75) {
      const allowedLate = [
        "total_gols",
        "escanteios",
        "chutes_no_gol",
        "chutes",
      ];
      if (!allowedLate.includes(market.key)) return false;
      if (market.confidence < 76) return false;
    }

    if (market.key === "resultado_final" && context.balance < 22) return false;
    if (market.key === "multipla") return false;

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

    if (key === "player_shots_on_target") bonus += 42;
    if (key === "player_shots") bonus += 34;
    if (key === "player_assists") bonus += 18;
    if (key === "escanteios") bonus += 24;
    if (key === "chutes_no_gol") bonus += 22;
    if (key === "chutes") bonus += 20;
    if (key === "total_gols") bonus += 8;

    if (key === "dupla_chance") bonus -= 8;
    if (key === "empate_anula") bonus -= 6;
    if (key === "resultado_final") bonus -= 14;
    if (key === "ambas_marcam") bonus -= 8;
    if (key === "handicap_asiatico") bonus += 2;

    if (key === "total_gols") bonus += context.goalTrend >= 70 ? 8 : 3;
    if (key === "escanteios") bonus += context.cornerTrend >= 70 ? 5 : -5;
    if (key === "cartoes") bonus += context.cardTrend >= 68 ? 4 : -6;
    if (key === "chutes" || key === "chutes_no_gol")
      bonus += context.shotTrend >= 70 ? 4 : -5;

    if (key === "resultado_final") bonus += context.balance >= 22 ? 4 : -20;
    if (key === "ambas_marcam") bonus += context.goalTrend >= 72 ? 3 : -8;

    if (context.isLive && key === "ao_vivo") bonus += 6;
    if (context.isLive && context.elapsed >= 75) bonus -= 8;
    if (context.isLive && context.realStatsAvailable !== true) {
      bonus -= this.isConservativeLiveWithoutStatsMarket({ key }) ? 10 : 45;
    }

    return confidence + odd * 2.2 + bonus - riskPenalty[risk];
  }

  private generateConfidence(
    key: string,
    index: number,
    context: any,
    seed: number,
  ) {
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

    if (key === "total_gols" || key === "ao_vivo") {
      if (context.goalTrend >= 72) value += 7;
      if (context.goalTrend <= 55) value += 4;
      if (context.matchTempo === "travado") value += 6;
      if (context.totalGoals >= 3 && context.elapsed >= 60) value -= 7;
    }

    if (key === "dupla_chance") {
      value += context.balance >= 10 ? 8 : 3;
      if (context.isLive && context.elapsed >= 70) value += 5;
    }

    if (key === "empate_anula") {
      value += context.balance >= 12 ? 8 : 2;
    }

    if (key === "handicap_asiatico") {
      value += context.balance >= 10 ? 7 : 2;
    }

    if (key === "resultado_final") {
      value += context.balance >= 22 ? 10 : -12;
    }

    if (key === "ambas_marcam") {
      value += context.goalTrend >= 74 ? 7 : -8;
    }

    if (key === "escanteios")
      value += Math.round((context.cornerTrend - 60) * 0.25);
    if (key === "cartoes") value += Math.round((context.cardTrend - 60) * 0.22);
    if (key === "chutes" || key === "chutes_no_gol")
      value += Math.round((context.shotTrend - 60) * 0.22);

    if (context.isLive) {
      if (context.elapsed < 12) value -= 5;
      if (context.elapsed >= 75) value -= 4;
      if (key === "total_gols" && context.matchTempo === "aberto") value += 5;
      if (key === "total_gols" && context.matchTempo === "controlado")
        value += 6;
      if (key === "ao_vivo") value += 4;
      if (key === "placar_correto") value -= 20;
    }

    if (context.isFinished) value -= 30;

    const variation = this.seededInt(seed + index, -4, 5);

    return Math.max(35, Math.min(91, value + variation));
  }

  private generateOdd(
    key: string,
    confidence: number,
    context: any,
    seed: number,
  ) {
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

  private generateTip(
    key: string,
    homeTeam: string,
    awayTeam: string,
    context: any,
    seed: number,
  ) {
    const livePrefix = context.isLive ? "Ao vivo: " : "";
    const favorite =
      context.favorite === "equilibrado" ? homeTeam : context.favorite;

    const safeGoalLine =
      context.goalTrend >= 72
        ? this.pickBySeed(["Over 1.5 gols", "Over 2.0 gols asiático"], seed + 1)
        : this.pickBySeed(["Under 3.5 gols", "Under 4.5 gols"], seed + 2);

    const cornerLine = this.pickBySeed(
      ["Over 7.5 escanteios", "Over 8.5 escanteios"],
      seed + 3,
    );
    const cardLine = this.pickBySeed(
      ["Over 2.5 cartões", "Over 3.5 cartões"],
      seed + 4,
    );
    const shotLine = this.pickBySeed(
      ["Over 18.5 chutes totais", "Over 20.5 chutes totais"],
      seed + 5,
    );
    const shotOnTargetLine = this.pickBySeed(
      ["Over 5.5 chutes no gol", "Over 6.5 chutes no gol"],
      seed + 6,
    );

    const liveRealTip =
      context.totalGoals <= 1
        ? "Under 3.5 gols"
        : context.totalGoals >= 3
          ? "Over 3.5 gols"
          : "Over 1.5 gols";

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
        context.gamePhase === "pré-jogo"
          ? "Over 0.5 gol no 1º tempo"
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
    if (
      ["placar_correto", "multipla", "bet_builder", "jogadores"].includes(
        key || "",
      )
    ) {
      return "Alto";
    }

    if (key === "resultado_final" && context?.balance < 22) return "Alto";

    if (context?.isLive && context.elapsed >= 75) {
      if (
        confidence >= 82 &&
        ["dupla_chance", "empate_anula", "total_gols"].includes(key || "")
      ) {
        return "Médio";
      }
      return "Alto";
    }

    if (confidence >= 80) return "Baixo";
    if (confidence >= 70) return "Médio";

    return "Alto";
  }

  private safeFallbackMarket(
    homeTeam: string,
    awayTeam: string,
    league: string,
    context: any,
  ) {
    const favorite =
      context.favorite === "equilibrado" ? homeTeam : context.favorite;
    const tip = this.getSafeRealTip(homeTeam, awayTeam, context);

    const liveWithoutStats =
      context.isLive && context.realStatsAvailable !== true;

    return {
      key: liveWithoutStats ? "dupla_chance" : "total_gols",
      category: liveWithoutStats ? "Live limitado" : "Protegido",
      market: liveWithoutStats ? "Entrada conservadora" : "Total de gols",
      tip: liveWithoutStats ? `${favorite} ou empate` : tip,
      odd: liveWithoutStats ? 1.35 : context.isLive ? 1.48 : 1.55,
      confidence: liveWithoutStats ? 62 : 74,
      risk: liveWithoutStats ? ("Médio" as RiskLevel) : ("Médio" as RiskLevel),
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
    realOdd?: any,
  ) {
    const phase =
      context.gamePhase === "pré-jogo"
        ? "pré-jogo"
        : `momento atual da partida (${context.gamePhase})`;

    const scoreText = context.isLive
      ? ` Placar atual: ${context.homeGoals}x${context.awayGoals}.`
      : "";

    const oddsText = realOdd
      ? ` Odd real encontrada na The Odds API via ${realOdd.bookmaker}.`
      : " Odd estimada pela Oddix porque não houve linha real compatível na The Odds API.";

    return `Mercado de ${market} selecionado para ${homeTeam} x ${awayTeam} com base no ${phase}, equilíbrio técnico, tendência de gols ${context.goalTrend}/100, escanteios ${context.cornerTrend}/100, cartões ${context.cardTrend}/100 e finalizações ${context.shotTrend}/100.${scoreText}${oddsText} Confiança estimada em ${confidence}% e risco ${risk}.`;
  }

  private generateMultiples(markets: any[], context: any) {
    const safe = markets
      .filter((market) => market.risk !== "Alto")
      .filter((market) => market.confidence >= 70)
      .filter((market) => Number(market.odd) <= 2.1)
      .filter((market) => !this.isConditionalTip(market.tip))
      .filter(
        (market) => !context.isLive || context.realStatsAvailable === true,
      )
      .slice(0, 4);

    const conservative = safe.slice(0, 2);
    const moderate = safe.slice(0, 3);
    const aggressive = safe.slice(0, 4);

    const build = (
      name: string,
      items: any[],
      risk: RiskLevel,
      stake: string,
    ) => {
      const combinedOdd = items.reduce(
        (acc, item) => acc * Number(item.odd || 1),
        1,
      );

      return {
        name,
        selections: items.map((item) => ({
          market: item.market,
          tip: this.sanitizeTip(item.tip, "", "", context),
          odd: item.odd,
          confidence: item.confidence,
          risk: item.risk,
        })),
        combinedOdd: Number(combinedOdd.toFixed(2)),
        risk,
        stake,
        note:
          risk === "Baixo"
            ? "Múltipla protegida, indicada para controle de banca."
            : risk === "Médio"
              ? "Múltipla equilibrada. Use stake reduzida."
              : "Múltipla agressiva. Use apenas valor simbólico.",
      };
    };

    return {
      conservative: build(
        "Múltipla Conservadora",
        conservative,
        "Baixo",
        "0.5 unidade",
      ),
      moderate: build("Múltipla Moderada", moderate, "Médio", "0.25 unidade"),
      aggressive: build(
        "Múltipla Agressiva",
        aggressive,
        "Alto",
        "0.10 unidade",
      ),
    };
  }

  private applyConfidenceEngine(
    market: any,
    context: any,
    homeTeam: string,
    awayTeam: string,
    game: any,
  ) {
    const oddsMeta = this.extractOddsMetaFromGame(game, market);
    const dominanceHint = this.buildDominanceHint(context, game);

    const engine = this.confidenceEngine.calculate({
      minute: context.elapsed,
      statusShort: context.statusShort,
      homeTeam,
      awayTeam,
      homeGoals: context.homeGoals,
      awayGoals: context.awayGoals,
      odd: Number(market.odd || 1),
      oldOdd: oddsMeta.oldOdd,
      originalOdd: oddsMeta.originalOdd,
      prematchOdd: oddsMeta.prematchOdd,
      trend: oddsMeta.trend,
      marketKey: market.key,
      tip: market.tip,
      possessionHome: dominanceHint.possessionHome,
      possessionAway: dominanceHint.possessionAway,
      attacksHome: dominanceHint.attacksHome,
      attacksAway: dominanceHint.attacksAway,
      dangerousAttacksHome: dominanceHint.dangerousAttacksHome,
      dangerousAttacksAway: dominanceHint.dangerousAttacksAway,
      shotsTotalHome: dominanceHint.shotsTotalHome,
      shotsTotalAway: dominanceHint.shotsTotalAway,
      shotsOnGoalHome: dominanceHint.shotsOnGoalHome,
      shotsOnGoalAway: dominanceHint.shotsOnGoalAway,
      cornersHome: dominanceHint.cornersHome,
      cornersAway: dominanceHint.cornersAway,
      yellowCardsHome: dominanceHint.yellowCardsHome,
      yellowCardsAway: dominanceHint.yellowCardsAway,
    });

    const rawConfidence = Math.max(
      Number(market.confidence || 0),
      engine.confidence,
    );
    const cappedMarket = this.capMarketForLiveWithoutStats(
      {
        ...market,
        confidence: rawConfidence,
        risk:
          engine.risk === "Alto" && rawConfidence >= 90 ? "Médio" : engine.risk,
      },
      context,
    );

    const confidence = Number(cappedMarket.confidence || 0);
    const risk = cappedMarket.risk as RiskLevel;
    const blockedByStats =
      context.isLive &&
      context.realStatsAvailable !== true &&
      !this.isConservativeLiveWithoutStatsMarket(cappedMarket);

    return {
      ...cappedMarket,
      confidence,
      risk,
      oddixEngine: {
        ...engine,
        send: blockedByStats ? false : engine.send,
        score: blockedByStats ? Math.min(engine.score, 40) : engine.score,
        level: blockedByStats ? "BLOQUEADO" : engine.level,
        category: blockedByStats ? "NO_BET" : engine.category,
        reasons: blockedByStats
          ? [
              ...(engine.reasons || []),
              "Mercado exige estatísticas reais e foi bloqueado no live.",
            ]
          : engine.reasons,
      },
      engineScore: blockedByStats ? Math.min(engine.score, 40) : engine.score,
      engineLevel: blockedByStats ? "BLOQUEADO" : engine.level,
      engineCategory: blockedByStats ? "NO_BET" : engine.category,
      dominanceHome: engine.dominanceHome,
      dominanceAway: engine.dominanceAway,
      dominantTeam: engine.dominantTeam,
      engineReasons: engine.reasons,
      reason:
        `${cappedMarket.reason || ""} Score Oddix ${engine.score}/100 (${engine.level}). ${engine.reasons.join(" ")}`.trim(),
    };
  }

  private extractOddsMetaFromGame(game: any, market: any) {
    const rawOdds =
      game?.odds ||
      game?.allScoresRaw?.odds ||
      game?.raw?.odds ||
      game?.allScoresRaw?.promotedPredictions?.predictions?.[0]?.odds ||
      null;

    const options = Array.isArray(rawOdds?.options) ? rawOdds.options : [];
    const normalizedTip = this.normalizeText(market?.tip || "");

    const option =
      options.find((item: any) =>
        this.normalizeText(item?.name).includes(normalizedTip),
      ) ||
      options.find(
        (item: any) =>
          Number(item?.rate?.decimal || 0) === Number(market?.odd || 0),
      ) ||
      options.find(
        (item: any) =>
          Number(item?.rate?.decimal || 0) >= 1.35 &&
          Number(item?.rate?.decimal || 0) <= 2.3,
      ) ||
      options[0] ||
      null;

    return {
      oldOdd: Number(option?.oldRate?.decimal || 0),
      originalOdd: Number(option?.originalRate?.decimal || 0),
      prematchOdd: Number(option?.prematchRate?.decimal || 0),
      trend: Number(option?.trend || 0),
    };
  }

  private buildDominanceHint(context: any, game: any) {
    const raw = game?.allScoresRaw || game?.raw || game || {};

    if (context.isLive && context.realStatsAvailable !== true) {
      return {
        possessionHome: 50,
        possessionAway: 50,
        attacksHome: 0,
        attacksAway: 0,
        dangerousAttacksHome: 0,
        dangerousAttacksAway: 0,
        shotsTotalHome: 0,
        shotsTotalAway: 0,
        shotsOnGoalHome: 0,
        shotsOnGoalAway: 0,
        cornersHome: 0,
        cornersAway: 0,
        yellowCardsHome: 0,
        yellowCardsAway: 0,
      };
    }

    const homeScore = Number(context.homeStrength || 60);
    const awayScore = Number(context.awayStrength || 60);
    const totalStrength = Math.max(1, homeScore + awayScore);
    const homeShare = homeScore / totalStrength;
    const awayShare = awayScore / totalStrength;

    const gameTime = Number(raw?.gameTime || context.elapsed || 0);
    const hasLiveMomentum = gameTime > 0;

    const baseShots = hasLiveMomentum
      ? Math.max(8, Math.round((context.shotTrend || 60) / 4))
      : 10;
    const baseCorners = hasLiveMomentum
      ? Math.max(3, Math.round((context.cornerTrend || 55) / 10))
      : 4;
    const baseDangerous = hasLiveMomentum
      ? Math.max(
          35,
          Math.round(
            (context.shotTrend || 60) + (context.cornerTrend || 55) / 2,
          ),
        )
      : 45;

    return {
      possessionHome: Number(
        context.possessionHome ?? Math.round(45 + (homeShare - 0.5) * 30),
      ),
      possessionAway: Number(
        context.possessionAway ?? Math.round(45 + (awayShare - 0.5) * 30),
      ),
      attacksHome: Math.round(baseDangerous * homeShare * 1.45),
      attacksAway: Math.round(baseDangerous * awayShare * 1.45),
      dangerousAttacksHome: Math.round(baseDangerous * homeShare),
      dangerousAttacksAway: Math.round(baseDangerous * awayShare),
      shotsTotalHome: Number(
        context.shotsTotalHome ?? Math.round(baseShots * homeShare),
      ),
      shotsTotalAway: Number(
        context.shotsTotalAway ?? Math.round(baseShots * awayShare),
      ),
      shotsOnGoalHome: Number(
        context.shotsOnGoalHome ??
          Math.max(1, Math.round(baseShots * homeShare * 0.38)),
      ),
      shotsOnGoalAway: Number(
        context.shotsOnGoalAway ??
          Math.max(1, Math.round(baseShots * awayShare * 0.38)),
      ),
      cornersHome: Number(
        context.cornersHome ?? Math.round(baseCorners * homeShare),
      ),
      cornersAway: Number(
        context.cornersAway ?? Math.round(baseCorners * awayShare),
      ),
      yellowCardsHome: Number(context.yellowCardsHome ?? 1),
      yellowCardsAway: Number(context.yellowCardsAway ?? 1),
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
    const {
      homeTeam,
      awayTeam,
      league,
      context,
      best,
      bestMarkets,
      multiples,
    } = data;

    const favoriteText =
      context.favorite === "equilibrado"
        ? "não há favorito claro pelo modelo"
        : `${context.favorite} aparece com leve vantagem`;

    const gameMoment = context.isLive
      ? `A partida está ao vivo, em fase de ${context.gamePhase}, com placar ${context.homeGoals}x${context.awayGoals}.`
      : context.isFinished
        ? `A partida já está finalizada.`
        : `A partida ainda não começou.`;

    const statsNote = context.isLive
      ? context.realStatsAvailable
        ? "A leitura ao vivo usa estatísticas reais disponíveis no provider."
        : `A leitura ao vivo foi limitada porque não há estatísticas reais disponíveis. ${context.liveQualityReason || ""}`.trim()
      : "";

    const marketList = bestMarkets
      .map(
        (market, index) =>
          `${index + 1}. ${market.market}: ${market.tip} | odd ${market.odd} (${market.isRealOdd ? "real" : "estimada"}) | confiança ${market.confidence}% | risco ${market.risk}`,
      )
      .join("\n");

    return `Análise Oddix Professional Tipster Engine V3 — ${homeTeam} x ${awayTeam} (${league}).

${gameMoment}

Leitura profissional:
Score V3: ${context.professionalScore || 0}/100 (${context.professionalLevel || "BOM"}). ${(context.professionalReasons || []).join(" ")}

O modelo priorizou mercados protegidos, evitando placar correto, bet builder agressivo e resultado seco sem vantagem clara. Neste confronto, ${favoriteText}. Tendência de gols ${context.goalTrend}/100, escanteios ${context.cornerTrend}/100, cartões ${context.cardTrend}/100 e finalizações ${context.shotTrend}/100${context.realStatsAvailable ? " com leitura de estatísticas reais do jogo." : ". "}

Entrada principal:
${best.tip} | odd ${best.odd} | confiança ${best.confidence}% | risco ${best.risk}.

Mercados recomendados:
${marketList}

Múltiplas:
Conservadora: ${multiples?.conservative?.selections?.map((s: any) => s.tip).join(" + ") || "Sem múltipla segura"} | odd ${multiples?.conservative?.combinedOdd || "-"}.
Moderada: ${multiples?.moderate?.selections?.map((s: any) => s.tip).join(" + ") || "Sem múltipla segura"} | odd ${multiples?.moderate?.combinedOdd || "-"}.

Fontes:
Dados do jogo: FlashScore como principal, Soccer Football Info para estatísticas reais e SportScore6 como fallback. Odds: The Odds API quando disponível; caso contrário, odd marcada como estimada.

Gestão:
Risco baixo: stake padrão. Risco médio: stake reduzida. Risco alto: evitar ou usar valor simbólico.`;
  }

  async generateBestMultipleFromGames(games: any[]) {
    const bets = await Promise.all(
      (games || []).map((game) => this.generateBet(game)),
    );

    const generated = bets
      .filter(Boolean)
      .map((bet: any) => {
        const bestMarket = Array.isArray(bet.markets)
          ? bet.markets.find(
              (m: any) =>
                m.risk !== "Alto" &&
                Number(m.confidence) >= 70 &&
                Number(m.odd) <= 2.1 &&
                !this.isConditionalTip(m.tip),
            ) || bet.markets[0]
          : null;

        return {
          game: `${bet.homeTeam} x ${bet.awayTeam}`,
          league: bet.league,
          market: bestMarket?.market || "Melhor entrada",
          tip: this.sanitizeTip(
            bestMarket?.tip || bet.tip,
            bet.homeTeam,
            bet.awayTeam,
            {
              isLive: false,
              goalTrend: 60,
              favorite: bet.homeTeam,
              totalGoals: 0,
            },
          ),
          odd: Number(bestMarket?.odd || bet.odd || 1),
          confidence: Number(bestMarket?.confidence || bet.confidence || 0),
          risk: bestMarket?.risk || bet.risk || "Médio",
        };
      })
      .filter((item: any) => item.tip && item.odd > 1)
      .filter((item: any) => item.risk !== "Alto")
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

    const build = (
      name: string,
      selections: any[],
      risk: RiskLevel,
      stake: string,
    ) => {
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
          risk === "Baixo"
            ? "Múltipla com jogos diferentes e mercados protegidos."
            : risk === "Médio"
              ? "Múltipla equilibrada, com stake reduzida."
              : "Múltipla agressiva, usar stake simbólica.",
      };
    };

    const result = {
      conservative: build(
        "Múltipla Conservadora do Dia",
        conservative,
        "Baixo",
        "0.5 unidade",
      ),
      moderate: build(
        "Múltipla Moderada do Dia",
        moderate,
        "Médio",
        "0.25 unidade",
      ),
      aggressive: build(
        "Múltipla Agressiva do Dia",
        aggressive,
        "Alto",
        "0.10 unidade",
      ),
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
