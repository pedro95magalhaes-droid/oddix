import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import { FootballResearchService, ResearchItem, ResearchResult } from './football-research.service';
import { OddixLlmService, OddixLlmMessage } from './oddix-llm.service';
import { OddixBrainService, OddixBrainDecision } from './oddix-brain.service';
import { OddixQueryCleanerService } from './oddix-query-cleaner.service';
import { OddixResearchAgentService } from './oddix-research-agent.service';
import { OddixWorldCupResolverService } from './oddix-worldcup-resolver.service';
import { FlashScoreService } from './flashscore.service';
import { OddixMasterRouterService, OddixMasterRoute } from './oddix-master-router.service';

export type OddixDataOrchestratorResponse = {
  handled: boolean;
  answer: string;
  data?: Record<string, any>;
  suggestions?: string[];
};

@Injectable()
export class OddixDataOrchestratorService {
  private readonly logger = new Logger(OddixDataOrchestratorService.name);

  constructor(
    @Optional() private readonly footballService?: FootballService,
    @Optional() private readonly flashScoreService?: FlashScoreService,
    @Optional() private readonly masterRouter?: OddixMasterRouterService,
    @Optional() private readonly researchService?: FootballResearchService,
    @Optional() private readonly llmService?: OddixLlmService,
    @Optional() private readonly brainService?: OddixBrainService,
    @Optional() private readonly queryCleaner?: OddixQueryCleanerService,
    @Optional() private readonly researchAgent?: OddixResearchAgentService,
    @Optional() private readonly worldCupResolver?: OddixWorldCupResolverService,
  ) {}

  async answer(message: string, sessionId = 'anonymous'): Promise<OddixDataOrchestratorResponse> {
    if (this.asksForFlashScoreDiagnostic(message)) {
      return this.answerFlashScoreDiagnostic();
    }
    const cleanedQuery = this.queryCleaner?.analyze(message) || null;
    const decision =
      (await this.brainService?.think(message, sessionId).catch(() => null)) ||
      this.localDecision(message);

    if (cleanedQuery?.intentHint === 'MATCH_RESULT' && cleanedQuery.teams) {
      (decision as any).intent = 'MATCH_ANALYSIS';
      (decision as any).entities = {
        ...(decision as any).entities,
        homeTeam: cleanedQuery.teams.home,
        awayTeam: cleanedQuery.teams.away,
      };
      (decision as any).normalizedQuestion = cleanedQuery.cleanMessage;
    }

    if (cleanedQuery?.intentHint === 'TODAY_CUP_GAMES') {
      (decision as any).intent = 'TODAY_GAMES';
    }

    // V21: router mestre decide antes do fluxo antigo.
    // Ele evita que perguntas globais caiam no resolver errado e força FlashScore
    // somente quando a pergunta realmente precisa de dados de futebol.
    const masterRoute = this.masterRouter?.classify(message, decision, cleanedQuery) || null;
    this.applyMasterRouteToDecision(masterRoute, decision);

    try {
      if (masterRoute?.kind === 'FOOTBALL_LINEUP' || this.asksForLineup(message)) {
        return this.answerLineupQuestion(message, decision);
      }

      if (masterRoute?.kind === 'FOOTBALL_ODDS') {
        return this.answerOddsQuestion(message, decision, masterRoute);
      }

      if (masterRoute?.kind === 'FOOTBALL_STANDINGS' || masterRoute?.kind === 'FOOTBALL_NEWS' || masterRoute?.kind === 'FOOTBALL_TEAM' || masterRoute?.kind === 'FOOTBALL_PLAYER' || masterRoute?.kind === 'FOOTBALL_GLOBAL') {
        return this.answerGeneralFootball(message, decision);
      }

      if (masterRoute?.kind === 'GENERAL_CHAT') {
        return this.answerGeneral(message);
      }

      if (decision.intent === 'GENERAL') {
        if (this.shouldResearch(decision, message)) {
          return this.answerGeneralFootball(message, decision);
        }

        return this.answerGeneral(message);
      }

      if (decision.intent === 'LIVE') {
        return this.answerLiveGames(message, decision);
      }

      if (decision.intent === 'TODAY_GAMES') {
        return this.answerTodayGames(message, decision);
      }

      if (decision.intent === 'TOP_PICKS') {
        return this.answerTopPicks(message, decision);
      }

      if (decision.intent === 'MATCH_ANALYSIS') {
        const teams =
          this.extractTeams(message, decision) ||
          cleanedQuery?.teams ||
          this.queryCleaner?.extractTeams(cleanedQuery?.cleanMessage || message) ||
          null;

        if (teams) {
          const questionForResearch =
            cleanedQuery?.intentHint === 'MATCH_RESULT'
              ? `${teams.home} x ${teams.away} resultado placar futebol`
              : message;

          return this.answerMatchQuestion(questionForResearch, teams.home, teams.away, decision);
        }

        return this.answerTodayGames(message, decision);
      }

      if (decision.intent === 'MULTIPLE') {
        return this.answerMultiple(message, decision);
      }

      if (decision.intent === 'FOLLOW_UP') {
        return this.answerFollowUp(message, decision);
      }

      if (['TEAM', 'NEWS', 'PLAYER', 'VALUE_BETS', 'VIRTUAL', 'EXPLAIN', 'BANKROLL'].includes(decision.intent)) {
        return this.answerGeneralFootball(message, decision);
      }

      return this.answerGeneral(message);
    } catch (error: any) {
      this.logger.warn(`[ODDIX_ORCHESTRATOR] falhou: ${error?.message || error}`);

      return {
        handled: true,
        answer:
          '⚠️ Tentei buscar dados reais agora, mas não consegui validar a base Oddix neste momento. Não vou inventar jogos, odds ou estatísticas.',
        data: {
          waitingForData: true,
          error: error?.message || 'orchestrator_failed',
          decision,
        },
      };
    }
  }

  private asksForFlashScoreDiagnostic(message: string) {
    const text = this.normalize(message);
    return (
      text.includes('diagnostico flashscore') ||
      text.includes('diagnóstico flashscore') ||
      text.includes('debug flashscore') ||
      text.includes('testar flashscore') ||
      text.includes('status flashscore')
    );
  }

  private flashScoreFallbackStatus() {
    const diagnostics: any = this.flashScoreService?.getDiagnostics?.() || null;
    const attempts = Array.isArray(diagnostics?.lastAttempts) ? diagnostics.lastAttempts : [];
    const errorText = attempts
      .map((attempt: any) => attempt?.error || '')
      .filter(Boolean)
      .join(' | ');
    const quota = !!diagnostics?.quotaBlocked || /quota|too many requests|rate.?limit|daily.*request|429|exceeded/i.test(errorText);

    return {
      diagnostics,
      quota,
      unavailable: quota || attempts.some((attempt: any) => attempt?.ok === false),
      reason: quota
        ? 'A FlashScore está conectada, mas a cota/limite do provider foi atingida. Acionei fallback web/cache e não vou inventar dados.'
        : 'A FlashScore não confirmou dados agora. Acionei fallback web/cache e não vou inventar dados.',
    };
  }

  private async answerFlashScoreDiagnostic(): Promise<OddixDataOrchestratorResponse> {
    const diagnostics: any = this.flashScoreService?.getDiagnostics?.() || {
      enabled: false,
      hasKey: false,
      error: 'FlashScoreService não foi injetado no ChatFootballModule',
    };

    let liveProbe: any = null;
    let todayProbe: any = null;
    const today = this.todayIso('America/Sao_Paulo');

    try {
      liveProbe = await this.flashScoreService?.getLiveFixtures?.();
    } catch (error: any) {
      liveProbe = { ok: false, data: [], error: error?.message || String(error) };
    }

    try {
      todayProbe = await this.flashScoreService?.getFixtures?.(today);
    } catch (error: any) {
      todayProbe = { ok: false, data: [], error: error?.message || String(error) };
    }

    const liveCount = Array.isArray(liveProbe?.data) ? liveProbe.data.length : 0;
    const todayCount = Array.isArray(todayProbe?.data) ? todayProbe.data.length : 0;

    const status = diagnostics?.hasKey
      ? diagnostics?.enabled
        ? 'FlashScore está ativa no backend.'
        : 'FlashScore tem chave, mas está desativada por variável de ambiente.'
      : 'FlashScore não tem chave detectada no ambiente do backend.';

    return {
      handled: true,
      answer:
        `🧪 Diagnóstico FlashScore

${status}

` +
        `Base URL: ${diagnostics?.baseURL || 'não detectada'}
` +
        `Host: ${diagnostics?.host || 'não detectado'}
` +
        `Timezone: ${diagnostics?.timezone || 'não detectado'}

` +
        `Teste ao vivo: ${liveProbe?.ok ? 'OK' : 'FALHOU'} — ${liveCount} jogo(s).
` +
        `Teste jogos de hoje (${today}): ${todayProbe?.ok ? 'OK' : 'FALHOU'} — ${todayCount} jogo(s).

` +
        `Erro live: ${liveProbe?.error ? String(liveProbe.error).slice(0, 350) : 'nenhum'}
` +
        `Erro hoje: ${todayProbe?.error ? String(todayProbe.error).slice(0, 350) : 'nenhum'}

` +
        `Se os dois testes voltarem 0 jogos enquanto há jogo ao vivo, o problema está na chave, host/base URL ou endpoint da API FlashScore usada no deploy.`,
      data: {
        diagnostics,
        liveProbe: {
          ok: liveProbe?.ok,
          count: liveCount,
          error: liveProbe?.error,
        },
        todayProbe: {
          ok: todayProbe?.ok,
          count: todayCount,
          error: todayProbe?.error,
        },
      },
      suggestions: ['jogos ao vivo agora', 'quais jogos da copa tem hoje'],
    };
  }

  private async answerGeneral(message: string): Promise<OddixDataOrchestratorResponse> {
    const answer = await this.humanizeWithDeepSeek(
      message,
      'Pergunta geral, sem necessidade obrigatória de dados atuais de futebol.',
      `Responda como um assistente inteligente e natural.
Se a pergunta for sobre apostas ou jogos atuais, avise que precisa consultar a base Oddix.
Se for conhecimento geral, responda normalmente.`,
    );

    return {
      handled: true,
      answer:
        answer ||
        'Posso te ajudar com futebol, apostas, análise de jogos, múltiplas, gestão de banca ou perguntas gerais. Me diga o que você quer analisar.',
      data: { general: true },
    };
  }

  private async answerGeneralFootball(
    message: string,
    decision: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const research = await this.runResearch(message, decision);
    const fixtures = await this.getTodayFixtures();
    const context = JSON.stringify(
      {
        decision,
        research,
        todayFixtures: fixtures.slice(0, 20).map((fixture) => this.simplifyFixture(fixture)),
        rule: 'Use primeiro a pesquisa web quando a pergunta pedir informação factual atual. Use os jogos das APIs somente se forem relevantes. Se faltar dado, diga claramente.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      'Responda de forma natural, como ChatGPT. Para informação factual atual, use a pesquisa web e/ou APIs fornecidas. Não invente dado fora do contexto.',
    );

    return {
      handled: true,
      answer: answer || 'Não consegui montar uma resposta completa com dados reais agora.',
      data: { decision, research, fixtures },
    };
  }

  private async answerTodayGames(
    message: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const wantsCup = this.asksForCup(message);

    // V17: perguntas sobre Copa/Mundial não podem depender só da base local.
    // O resolver valida a data de hoje, faz multi-search e remove partidas futuras/passadas.
    if (wantsCup && this.worldCupResolver) {
      const resolved = await this.worldCupResolver.resolveToday(message);

      if (!resolved.fixtures.length) {
        const strongWebFallback = await this.buildStrongWebFixtureFallback(message, decision, 'cup_today');
        if (strongWebFallback.fixtures.length) {
          return this.answerFromWebFixtureFallback(
            message,
            decision,
            strongWebFallback,
            '🏆 Jogos da Copa/Mundial encontrados pela web',
            'jogos de Copa/Mundial hoje',
          );
        }
      }

      return {
        handled: true,
        answer: resolved.answer,
        data: {
          fixtures: resolved.fixtures,
          localFixtures: resolved.localFixtures,
          webFixtures: resolved.webFixtures,
          research: {
            items: resolved.researchItems,
            queries: resolved.researchQueries,
            provider: resolved.provider,
            error: resolved.error,
          },
          decision,
          v17: {
            worldCupResolver: true,
            todayIso: resolved.todayIso,
            validatedDate: true,
          },
        },
        suggestions: resolved.fixtures.slice(0, 4).map((game: any) => `Analise ${game.home} x ${game.away}`),
      };
    }

    const research = await this.runResearch(message, decision);
    let fixtures = await this.getTodayFixtures();

    if (wantsCup) {
      fixtures = fixtures.filter((game) => this.isCupCompetition(game));
    }

    if (!fixtures.length) {
      const strongWebFallback = await this.buildStrongWebFixtureFallback(message, decision, wantsCup ? 'cup_today' : 'today');
      if (strongWebFallback.fixtures.length) {
        return this.answerFromWebFixtureFallback(
          message,
          decision,
          strongWebFallback,
          wantsCup ? '🏆 Jogos da Copa/Mundial encontrados pela web' : '⚽ Jogos de hoje encontrados pela web',
          wantsCup ? 'jogos de Copa/Mundial hoje' : 'jogos de hoje',
        );
      }

      const researchAnswer = await this.answerFromResearchOnly(message, research, decision, 'jogos de hoje');
      if (researchAnswer) return researchAnswer;

      const flashScoreStatus = this.flashScoreFallbackStatus();

      return {
        handled: true,
        answer:
          `⚽ Não encontrei jogos reais confirmados agora.

${flashScoreStatus.reason}

Também tentei validar pela pesquisa web em tempo real, mas não encontrei dados suficientes para listar partidas com segurança. Não vou inventar partidas.`,
        data: {
          waitingForData: true,
          fixtures: [],
          research,
          decision,
          flashScoreDiagnostics: flashScoreStatus.diagnostics,
          flashScoreQuota: flashScoreStatus.quota,
        },
        suggestions: [
          'Mostrar jogos ao vivo',
          'Top Picks de hoje',
          'Analisar um jogo específico',
        ],
      };
    }

    const context = this.buildFixturesContext(fixtures, 'jogos de hoje', decision, research);
    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Liste os jogos encontrados usando apenas os dados fornecidos.
Não invente partidas. Se a pergunta mencionar Copa/Mundial/FIFA, liste apenas jogos de competições com Copa/World Cup/FIFA/Mundial/Club World Cup quando existirem e com data compatível.`,
    );

    return {
      handled: true,
      answer: answer || this.formatFixturesList(fixtures, '⚽ Jogos encontrados hoje na base Oddix'),
      data: {
        fixtures,
        research,
        decision,
      },
      suggestions: fixtures.slice(0, 4).map((game: any) => {
        const home = game?.teams?.home?.name || game?.homeTeam || 'Casa';
        const away = game?.teams?.away?.name || game?.awayTeam || 'Fora';
        return `Analise ${home} x ${away}`;
      }),
    };
  }

  private async answerLiveGames(
    message: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const research = await this.runResearch(message, decision);
    const fixtures = await this.getLiveFixtures();

    if (!fixtures.length) {
      const strongWebFallback = await this.buildStrongWebFixtureFallback(message, decision, 'live');
      if (strongWebFallback.fixtures.length) {
        return this.answerFromWebFixtureFallback(
          message,
          decision,
          strongWebFallback,
          '⚡ Jogos ao vivo encontrados pela web',
          'jogos ao vivo',
        );
      }

      const researchAnswer = await this.answerFromResearchOnly(message, research, decision, 'jogos ao vivo');
      if (researchAnswer) return researchAnswer;

      const flashScoreStatus = this.flashScoreFallbackStatus();

      return {
        handled: true,
        answer:
          `⚡ Não encontrei jogos ao vivo/ativos confirmados agora.

${flashScoreStatus.reason}

Também tentei a pesquisa web em tempo real, mas ela não confirmou uma lista confiável de jogos ao vivo. Não vou inventar placar.

Digite \`diagnóstico flashscore\` para ver o status técnico da conexão.`,
        data: {
          waitingForData: true,
          fixtures: [],
          research,
          decision,
          flashScoreDiagnostics: flashScoreStatus.diagnostics,
          flashScoreQuota: flashScoreStatus.quota,
        },
        suggestions: [
          'Mostrar jogos de hoje',
          'Top Picks de hoje',
          'Analisar um jogo específico',
        ],
      };
    }

    const enriched = await this.enrichFixtures(fixtures.slice(0, 12));
    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        research,
        liveFixtures: fixtures.slice(0, 25).map((game: any) => this.simplifyFixture(game)),
        richLiveContext: enriched.map((item: any) => ({
          fixture: this.simplifyFixture(item.fixture),
          rich: this.simplifyRichContext(item.rich),
        })),
        rule:
          'Para jogos ao vivo, use pressão, posse, finalizações, escanteios, ataques perigosos e odds somente se estiverem em richLiveContext. Se não estiverem, diga claramente que não foram validados. Não invente estatísticas.',
      },
      null,
      2,
    );
    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Responda como analista live profissional da Oddix.
Se houver statisticsSummary/pressureSummary, destaque pressão, posse, finalizações, chutes no gol, escanteios e ataques perigosos.
Se houver oddsSummary, cite as odds validadas.
Se não houver estatísticas oficiais, use statisticsProxy apenas como sinal auxiliar e avise que não é estatística oficial.
Se não houver dados ricos, liste apenas placar/minuto/competição e diga que não há entrada oficial.
Nunca invente posse, escanteios, finalizações, odds ou pressão.`,
    );

    return {
      handled: true,
      answer: answer || this.formatFixturesList(fixtures, '⚡ Jogos ao vivo/ativos na base Oddix'),
      data: {
        fixtures,
        enriched,
        research,
        decision,
      },
      suggestions: fixtures.slice(0, 4).map((game: any) => {
        const home = game?.teams?.home?.name || game?.homeTeam || 'Casa';
        const away = game?.teams?.away?.name || game?.awayTeam || 'Fora';
        return `Como está ${home} x ${away}?`;
      }),
    };
  }

  private async answerTopPicks(
    message: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const research = await this.runResearch(message, decision);
    const fixtures = await this.getTodayFixtures();

    if (!fixtures.length) {
      return {
        handled: true,
        answer:
          '🎯 Não encontrei jogos suficientes na base Oddix para escolher uma entrada de confiança hoje.\n\nSem jogo real, odds e estatísticas mínimas, não vou inventar aposta.',
        data: { waitingForData: true, fixtures: [], research, decision },
      };
    }

    const enriched = await this.enrichFixtures(fixtures.slice(0, 10));
    const candidates = enriched.map((item) => this.scoreCandidate(item)).sort((a, b) => b.score - a.score);

    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        research,
        candidates: candidates.slice(0, 8),
        rule:
          'Escolha a melhor entrada apenas se houver dados suficientes. Sem odds reais ou estatísticas completas, deixe como observação, não como entrada oficial.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Monte uma resposta natural no estilo Oddix:
🏆 Melhor oportunidade
⚽ Jogo
🎯 Mercado observado
📊 Motivo
⚠️ Risco
🧠 Conclusão

Não invente odd. Não invente estatística. Se faltar dado, diga "observação, sem entrada oficial".`,
    );

    return {
      handled: true,
      answer: answer || this.localTopPick(candidates),
      data: { fixtures, research, candidates, decision },
      suggestions: ['Monte uma múltipla segura', 'Quero uma opção mais agressiva', 'Quanto ganho com R$50?'],
    };
  }

  private async answerMultiple(
    message: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const research = await this.runResearch(message, decision);
    const fixtures = await this.getTodayFixtures();
    const enriched = await this.enrichFixtures(fixtures.slice(0, 12));
    const candidates = enriched.map((item) => this.scoreCandidate(item)).sort((a, b) => b.score - a.score);

    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        research,
        candidates: candidates.slice(0, 10),
        rule:
          'Monte múltipla somente com jogos reais fornecidos. Se faltar odds reais, apresente como sugestão observada sem entrada oficial.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Monte uma múltipla estilo bilhete:
🎫 Múltipla Oddix
1.
2.
3.
📊 Risco
⚠️ Observação

Sem inventar odds, estatísticas ou mercados oficiais.`,
    );

    return {
      handled: true,
      answer: answer || this.localMultiple(candidates),
      data: { fixtures, research, candidates, decision },
    };
  }

  private applyMasterRouteToDecision(
    masterRoute: OddixMasterRoute | null,
    decision: OddixBrainDecision,
  ) {
    if (!masterRoute) return;

    const intentByRoute: Partial<Record<OddixMasterRoute['kind'], string>> = {
      FOOTBALL_TODAY_GAMES: 'TODAY_GAMES',
      FOOTBALL_LIVE: 'LIVE',
      FOOTBALL_MATCH_ANALYSIS: 'MATCH_ANALYSIS',
      FOOTBALL_LINEUP: 'MATCH_ANALYSIS',
      FOOTBALL_ODDS: 'MATCH_ANALYSIS',
      FOOTBALL_STANDINGS: 'TEAM',
      FOOTBALL_NEWS: 'NEWS',
      FOOTBALL_TEAM: 'TEAM',
      FOOTBALL_PLAYER: 'PLAYER',
      FOOTBALL_GLOBAL: 'TEAM',
      BETTING_TOP_PICK: 'TOP_PICKS',
      BETTING_MULTIPLE: 'MULTIPLE',
      BETTING_VALUE: 'VALUE_BETS',
      GENERAL_CHAT: 'GENERAL',
      GENERAL_RESEARCH: 'GENERAL',
    };

    const intent = intentByRoute[masterRoute.kind];
    if (intent) (decision as any).intent = intent;

    (decision as any).masterRoute = masterRoute;
    (decision as any).entities = {
      ...(decision as any).entities,
      ...(masterRoute.entities?.team ? { team: masterRoute.entities.team } : {}),
      ...(masterRoute.entities?.player ? { player: masterRoute.entities.player } : {}),
      ...(masterRoute.entities?.homeTeam ? { homeTeam: masterRoute.entities.homeTeam } : {}),
      ...(masterRoute.entities?.awayTeam ? { awayTeam: masterRoute.entities.awayTeam } : {}),
      ...(masterRoute.entities?.competition ? { competition: masterRoute.entities.competition } : {}),
    };
    (decision as any).shouldUseOddixEngine = masterRoute.requiresFootballData;
    (decision as any).shouldUseGlobalAiDirect = masterRoute.kind === 'GENERAL_CHAT';
  }

  private async answerOddsQuestion(
    message: string,
    decision?: OddixBrainDecision,
    masterRoute?: OddixMasterRoute | null,
  ): Promise<OddixDataOrchestratorResponse> {
    const teams =
      this.extractTeams(message, decision) ||
      (masterRoute?.entities?.homeTeam && masterRoute?.entities?.awayTeam
        ? { home: masterRoute.entities.homeTeam, away: masterRoute.entities.awayTeam }
        : null) ||
      this.queryCleaner?.extractTeams(message) ||
      null;

    const teamQuery = !teams
      ? masterRoute?.entities?.team || this.extractLineupTeamQuery(message)
      : '';

    const fixtures = await this.getMatchSearchFixtures(3, 7);
    const match = teams
      ? this.findMatch(fixtures, teams.home, teams.away)
      : teamQuery
        ? this.findFixtureByTeam(fixtures, teamQuery)
        : null;

    const researchQuery = teams
      ? `${teams.home} x ${teams.away} odds futebol`
      : teamQuery
        ? `${teamQuery} odds futebol hoje`
        : 'odds futebol hoje';
    const research = await this.runResearch(message, decision, researchQuery).catch(() => null);

    if (!match) {
      const researchAnswer = await this.answerFromResearchOnly(message, research, decision, 'odds/cotações');
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer:
          '🎯 Odds\n\nNão encontrei uma partida confirmada para buscar odds reais na FlashScore/base Oddix.\n\nMe envie o confronto exato, por exemplo: `odds de Scotland x Brazil`. Sem partida e sem cotação validada, não vou inventar odd.',
        data: {
          waitingForData: true,
          masterRoute,
          teams,
          teamQuery,
          fixtures: fixtures.slice(0, 12).map((game: any) => this.simplifyFixture(game)),
          research,
          decision,
        },
        suggestions: ['Mostrar jogos de hoje', 'Enviar confronto exato', 'Ver jogos ao vivo'],
      };
    }

    const simple = this.simplifyFixture(match);
    const fixtureId = String(simple.externalId || match?.fixture?.externalId || match?.fixture?.id || match?.id || '');
    const richContext = await this.getRichContext(fixtureId, match).catch(() => null);
    const odds = richContext?.odds || simple.odds || this.extractFixtureOdds(match);
    const oddsSummary = this.buildOddsSummary(odds);

    if (oddsSummary.available) {
      return {
        handled: true,
        answer: this.formatOddsAnswer(simple, oddsSummary),
        data: {
          fixture: match,
          richContext,
          odds,
          oddsSummary,
          research,
          masterRoute,
          decision,
        },
        suggestions: [`Analisar ${simple.home} x ${simple.away}`, 'Montar múltipla com cautela', 'Ver escalação desse jogo'],
      };
    }

    const context = JSON.stringify(
      {
        pergunta: message,
        masterRoute,
        jogo: simple,
        richContext: this.simplifyRichContext(richContext),
        research,
        regra:
          'Se odds não estiverem explícitas no contexto, diga que não há odds validadas. Não invente odd, casa de aposta ou mercado.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Responda sobre odds/cotações de forma responsável.\nFormato:\n🎯 Odds\n⚽ Jogo\n📌 Situação\n⚠️ Observação\n\nNunca invente odd. Se não houver cotação real, peça o confronto ou diga que a casa ainda não abriu mercado.`,
    );

    return {
      handled: true,
      answer:
        answer ||
        `🎯 Odds\n\n⚽ ${simple.home} x ${simple.away}\n\nEncontrei a partida, mas não recebi odds reais validadas da FlashScore/base Oddix agora. Sem cotação real, não vou montar entrada oficial nem inventar mercado.`,
      data: {
        waitingForData: true,
        fixture: match,
        richContext,
        odds: null,
        oddsSummary,
        research,
        masterRoute,
        decision,
      },
      suggestions: [`Analisar ${simple.home} x ${simple.away}`, 'Tentar odds novamente', 'Mostrar jogos de hoje'],
    };
  }

  private formatOddsAnswer(simple: any, oddsSummary: any) {
    const options = Array.isArray(oddsSummary?.options) ? oddsSummary.options : [];
    const lines = options
      .slice(0, 12)
      .map((option: any) => `• ${option.name}: ${Number(option.odd).toFixed(2)}`)
      .join('\n');

    return `🎯 Odds validadas\n\n⚽ ${simple.home || 'Casa'} x ${simple.away || 'Fora'}\n🏆 ${simple.league || 'Liga não informada'}\n📌 Mercado: ${oddsSummary.market || '1X2'}\n🏦 Fonte/Casa: ${oddsSummary.bookmaker || oddsSummary.source || 'provider integrado'}\n\n${lines || 'Nenhuma seleção formatada.'}\n\n⚠️ Use como consulta de mercado. A Oddix não garante lucro e não recomenda apostar sem gestão de banca.`;
  }

  private async answerLineupQuestion(
    message: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const teamQuery = this.extractLineupTeamQuery(message);
    const wantsToday = this.mentionsToday(message);
    const fixtures = wantsToday ? await this.getTodayFixtures() : await this.getMatchSearchFixtures(0, 7);
    const match = teamQuery ? this.findFixtureByTeam(fixtures, teamQuery) : null;
    const research = await this.runResearch(message, decision, teamQuery || 'escalação futebol').catch(() => null);

    if (!match) {
      const researchAnswer = await this.answerFromResearchOnly(message, research, decision, 'escalação provável/oficial');
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer:
          `📋 Escalação\n\nNão encontrei uma partida confirmada ${wantsToday ? 'para hoje' : 'na janela atual'} envolvendo ${teamQuery || 'o time citado'} na FlashScore/base Oddix.\n\nSem jogo confirmado e sem escalação oficial/provável validada, não vou inventar titulares.`,
        data: { waitingForData: true, teamQuery, fixtures: fixtures.slice(0, 12).map((game: any) => this.simplifyFixture(game)), research, decision },
        suggestions: ['Mostrar jogos de hoje', 'Buscar jogos ao vivo', 'Enviar o confronto exato'],
      };
    }

    const simple = this.simplifyFixture(match);
    const fixtureId = String(simple.externalId || match?.fixture?.externalId || match?.fixture?.id || match?.id || '');
    const richContext = await this.getRichContext(fixtureId, match).catch(() => null);
    const hasLineups = !!richContext?.lineups;

    const context = JSON.stringify(
      {
        pergunta: message,
        teamQuery,
        jogo: simple,
        lineups: this.safeJsonSample(richContext?.lineups, 6500),
        richContext: this.simplifyRichContext(richContext),
        research,
        regra:
          'Se lineups não tiver dados claros de titulares, responda que escalação oficial/provável não está disponível. Não invente jogador. Diferencie oficial de provável.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Responda como especialista de futebol.\nFormato:\n📋 Escalação\n⚽ Jogo\n✅ Confirmado/provável\n👥 Times\n⚠️ Observação\n\nUse somente dados de lineups/pesquisa fornecidos. Não invente jogadores.`,
    );

    return {
      handled: true,
      answer:
        answer ||
        (hasLineups
          ? `📋 Escalação encontrada para ${simple.home} x ${simple.away}.\n\nRecebi dados de escalação da FlashScore, mas não consegui formatar automaticamente. Verifique o raw em data.lineups.`
          : `📋 ${simple.home} x ${simple.away}\n\nA partida foi encontrada na FlashScore/base Oddix, mas a escalação ainda não está disponível. Normalmente ela aparece perto do início do jogo. Não vou inventar titulares.`),
      data: { decision, teamQuery, fixture: match, lineups: richContext?.lineups || null, richContext, research },
      suggestions: [`Analisar ${simple.home} x ${simple.away}`, 'Ver odds desse jogo', 'Mostrar jogos da Copa hoje'],
    };
  }

  private async answerFollowUp(
    message: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        rule: 'É uma continuação de conversa. Use o contexto salvo pelo Brain quando houver. Se faltar contexto, peça o jogo novamente.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      'Responda como continuação natural. Se a pergunta depender de jogo anterior e ele não estiver nos dados, peça o confronto novamente.',
    );

    return {
      handled: true,
      answer: answer || 'Me manda novamente o jogo ou bilhete para eu continuar a análise com segurança.',
      data: { decision },
    };
  }

  private async answerMatchQuestion(
    message: string,
    homeQuery: string,
    awayQuery: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const research = await this.runResearch(message, decision, `${homeQuery} x ${awayQuery}`);
    const fixtures = await this.getMatchSearchFixtures(3, 7);
    const match = this.findMatch(fixtures, homeQuery, awayQuery);

    if (!match) {
      const researchAnswer = await this.answerFromResearchOnly(message, research, decision, `${homeQuery} x ${awayQuery}`);
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer:
          `⚽ Procurei ${homeQuery} x ${awayQuery} na base Oddix e na pesquisa em tempo real, mas não consegui confirmar dados suficientes.\n\nSem partida real, odds e estatísticas, não libero análise nem entrada oficial.`,
        data: {
          waitingForData: true,
          homeQuery,
          awayQuery,
          research,
          decision,
        },
        suggestions: [
          'Mostrar jogos ao vivo',
          'Mostrar jogos de hoje',
          `Tentar ${homeQuery} x ${awayQuery} novamente`,
        ],
      };
    }

    const fixtureId = String(match?.fixture?.id || match?.id || '');
    const richContext = await this.getRichContext(fixtureId, match);

    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        jogo: this.simplifyFixture(match),
        research,
        contextoRico: this.simplifyRichContext(richContext),
        regra:
          'Use apenas estes dados reais. Se odds, estatísticas, H2H ou escalações estiverem ausentes, diga que não há entrada oficial.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Monte uma análise Oddix profissional.
Formato:
⚽ Jogo
📊 Situação atual
📈 Leitura da partida
🎯 Mercados observados
⚠️ Riscos
🧠 Conclusão Oddix

Nunca invente odds, estatísticas, escalações ou resultado. Se faltar dado real, bloqueie entrada oficial.`,
    );

    return {
      handled: true,
      answer: answer || this.localMatchAnalysis(match, richContext),
      data: {
        fixture: match,
        richContext,
        research,
        waitingForData: !richContext?.ok,
        decision,
      },
      suggestions: [
        'Esse jogo presta?',
        'Me dá uma opção segura',
        'Monte uma múltipla',
        'Quanto ganho com R$50?',
      ],
    };
  }

  private async runResearch(
    message: string,
    decision?: OddixBrainDecision,
    forcedQuery?: string,
  ): Promise<ResearchResult | null> {
    if (!this.researchService && !this.researchAgent) return null;
    const cleanedQuery = this.queryCleaner?.analyze(forcedQuery || message) || null;
    const shouldForce = cleanedQuery?.shouldForceResearch || false;
    if (!this.shouldResearch(decision, message) && !forcedQuery && !shouldForce) return null;

    const query = this.buildResearchQuery(message, decision, forcedQuery);

    try {
      if (this.researchAgent) {
        const agentResult = await this.researchAgent.research(message, query);
        if (agentResult?.items?.length) return agentResult;

        // V21.4: se o agente existe mas retornou vazio/falha parcial, tenta o provider web direto
        // antes de desistir. Isso é essencial quando FlashScore está sem cota.
        if (!this.researchService) return agentResult;
      }

      if (this.researchService?.searchEverything) {
        const direct = await this.researchService.searchEverything(query, 'br');
        if (direct?.items?.length) return direct;
      }

      return await this.researchService!.search(query, 'br');
    } catch (error: any) {
      this.logger.warn(`[ODDIX_RESEARCH] falhou: ${error?.message || error}`);
      return {
        enabled: true,
        query,
        items: [],
        summary: `Pesquisa em tempo real falhou: ${error?.message || 'erro desconhecido'}`,
      };
    }
  }

  private shouldResearch(decision: OddixBrainDecision | undefined, message: string) {
    const intent = decision?.intent || 'GENERAL';
    const text = this.normalize(message);

    const researchIntents = new Set([
      'TODAY_GAMES',
      'LIVE',
      'NEWS',
      'TEAM',
      'PLAYER',
      'MATCH_ANALYSIS',
      'TOP_PICKS',
      'MULTIPLE',
      'VALUE_BETS',
      'FOLLOW_UP',
    ]);

    if (researchIntents.has(intent)) return true;

    return this.hasAny(text, [
      'hoje',
      'agora',
      'ao vivo',
      'jogos',
      'classificacao',
      'classificação',
      'tabela',
      'escalação',
      'escalacao',
      'noticia',
      'notícia',
      'lesao',
      'lesão',
      'desfalque',
      'copa',
      'mundial',
      'world cup',
      'fifa',
      'resultado',
      'proximo jogo',
      'próximo jogo',
      'odds',
      'odd',
      'cotação',
      'cotacao',
      'mercado',
      'classificação',
      'classificacao',
      'standings',
      'artilharia',
      'desfalques',
      'prováveis titulares',
      'provaveis titulares',
    ]);
  }

  private buildResearchQuery(
    message: string,
    decision?: OddixBrainDecision,
    forcedQuery?: string,
  ) {
    const cleanedQuery = this.queryCleaner?.analyze(forcedQuery || message) || null;
    const teams = cleanedQuery?.teams || null;
    const base = this.cleanResearchQuery(
      teams ? `${teams.home} x ${teams.away}` : (cleanedQuery?.cleanMessage || forcedQuery || message),
    );
    const intent = decision?.intent || 'GENERAL';

    if (cleanedQuery?.intentHint === 'MATCH_RESULT' && teams) {
      return `${teams.home} x ${teams.away} resultado placar futebol final score`;
    }

    if (cleanedQuery?.intentHint === 'TODAY_CUP_GAMES') {
      return 'FIFA World Cup Club World Cup jogos hoje futebol fixtures today FlashScore ESPN';
    }

    if (intent === 'TODAY_GAMES') return `${base} futebol jogos hoje calendário partidas oficiais`;
    if (intent === 'LIVE') return `${base} futebol ao vivo placar agora status`;
    if (intent === 'NEWS') return `${base} futebol notícias escalações lesões desfalques hoje`;
    if (intent === 'TEAM') return `${base} futebol próximos jogos classificação notícias elenco`;
    if (intent === 'PLAYER') return `${base} jogador futebol notícias escalação estatísticas`;
    if (intent === 'MATCH_ANALYSIS') return `${base} futebol escalações estatísticas odds notícias`;
    if (intent === 'TOP_PICKS' || intent === 'MULTIPLE') return `${base} futebol jogos hoje odds estatísticas calendário`;

    return `${base} futebol notícias jogos hoje`;
  }

  private cleanResearchQuery(value: string) {
    return String(value || '')
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  private async answerFromResearchOnly(
    message: string,
    research: ResearchResult | null,
    decision: OddixBrainDecision | undefined,
    label: string,
  ): Promise<OddixDataOrchestratorResponse | null> {
    if (!research?.items?.length) return null;

    const context = JSON.stringify(
      {
        label,
        decision,
        research,
        rule:
          'A API de futebol não retornou dados, mas a pesquisa web retornou fontes. Use somente títulos, descrições e fontes abaixo. Não crie placares, odds, escalações ou horários que não estejam explícitos.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Responda usando a pesquisa em tempo real como fonte principal.
Explique que a base Oddix/Football API não confirmou o dado, mas a busca web encontrou estes indícios.
Se os resultados não confirmarem exatamente a pergunta, diga isso com clareza.
Não invente aposta oficial.`,
    );

    const fallback = `🔎 Consultei a pesquisa em tempo real, mas a base Oddix não confirmou ${label} agora.

${research.summary}

⚠️ Sem confirmação completa pelas APIs de futebol, não vou cravar odds, placar, escalação ou entrada oficial.`;

    return {
      handled: true,
      answer: answer || fallback,
      data: {
        waitingForData: true,
        researchOnly: true,
        research,
        decision,
      },
      suggestions: [
        'Mostrar jogos de hoje',
        'Ver jogos ao vivo',
        'Analisar um jogo específico',
      ],
    };
  }


  private async buildStrongWebFixtureFallback(
    message: string,
    decision: OddixBrainDecision | undefined,
    kind: 'live' | 'today' | 'cup_today',
  ): Promise<{ fixtures: any[]; research: ResearchResult | null; queries: string[]; items: ResearchItem[] }> {
    const queries = this.buildStrongWebFallbackQueries(kind, message);
    const results: ResearchResult[] = [];

    const publicSource = await this.fetchPublicFootballSourceFixtures(kind, message).catch((error: any) => {
      this.logger.warn(`[ODDIX_PUBLIC_FOOTBALL_FALLBACK] falhou: ${error?.message || error}`);
      return { fixtures: [], research: null } as { fixtures: any[]; research: ResearchResult | null };
    });

    if (publicSource.fixtures.length) {
      return {
        fixtures: publicSource.fixtures,
        research: publicSource.research,
        queries,
        items: publicSource.research?.items || [],
      };
    }

    for (const query of queries) {
      const result = await this.directWebSearch(message, query).catch((error: any) => ({
        enabled: true,
        query,
        items: [],
        summary: `Falha na pesquisa web forte: ${error?.message || error}`,
        error: error?.message || String(error),
      }) as any);

      if (result) results.push(result as ResearchResult);

      const mergedEarly = this.mergeResearchResults(results, queries);
      const earlyFixtures = this.extractFixturesFromResearchItems(mergedEarly.items || [], kind);
      if (earlyFixtures.length >= (kind === 'live' ? 4 : 8)) {
        return {
          fixtures: earlyFixtures,
          research: mergedEarly,
          queries,
          items: mergedEarly.items || [],
        };
      }
    }

    const merged = this.mergeResearchResults(results, queries);
    return {
      fixtures: this.extractFixturesFromResearchItems(merged.items || [], kind),
      research: merged,
      queries,
      items: merged.items || [],
    };
  }

  private buildStrongWebFallbackQueries(kind: 'live' | 'today' | 'cup_today', message: string) {
    const today = this.todayIso('America/Sao_Paulo');
    const baseMessage = this.cleanResearchQuery(message);

    const liveQueries = [
      `football live scores now ${today}`,
      `soccer live scores today ${today}`,
      `ESPN soccer live scores today ${today}`,
      `SofaScore football live today ${today}`,
      `FlashScore football live scores today ${today}`,
      `365Scores football live today ${today}`,
      `FIFA Club World Cup live scores today ${today}`,
      `placar futebol ao vivo agora ${today}`,
      baseMessage,
    ];

    const cupQueries = [
      `FIFA Club World Cup fixtures ${today}`,
      `FIFA Club World Cup matches today ${today}`,
      `Club World Cup games today ${today}`,
      `FIFA World Cup 2026 matches today ${today}`,
      `ESPN FIFA Club World Cup schedule ${today}`,
      `SofaScore Club World Cup fixtures ${today}`,
      `FlashScore Club World Cup fixtures ${today}`,
      `365Scores Club World Cup fixtures ${today}`,
      `jogos da Copa do Mundo hoje ${today}`,
      baseMessage,
    ];

    const todayQueries = [
      `football matches today ${today}`,
      `soccer fixtures today ${today}`,
      `ESPN soccer schedule today ${today}`,
      `SofaScore football matches today ${today}`,
      `FlashScore football fixtures today ${today}`,
      `365Scores football matches today ${today}`,
      `jogos de futebol hoje ${today}`,
      baseMessage,
    ];

    const selected = kind === 'live' ? liveQueries : kind === 'cup_today' ? cupQueries : todayQueries;
    return Array.from(new Set(selected.map((query) => String(query || '').replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, 10);
  }


  private async fetchPublicFootballSourceFixtures(
    kind: 'live' | 'today' | 'cup_today',
    message: string,
  ): Promise<{ fixtures: any[]; research: ResearchResult | null }> {
    const today = this.todayIso('America/Sao_Paulo');
    const urls = this.buildPublicFootballSourceUrls(kind, today, message);
    const fixtures: any[] = [];
    const items: ResearchItem[] = [];
    const failures: string[] = [];

    for (const source of urls) {
      try {
        const response = await this.publicFetch(source.url, source.type);
        const sourceFixtures =
          source.type === 'json'
            ? this.mapPublicFootballJsonToFixtures(response.data, source.url, kind, today)
            : this.mapPublicFootballTextToFixtures(response.data, source.url, kind, today);

        if (sourceFixtures.length) {
          fixtures.push(...sourceFixtures);
          items.push({
            title: `${source.label}: ${sourceFixtures.length} jogo(s) encontrado(s)`,
            description: sourceFixtures
              .slice(0, 8)
              .map((game) => {
                const simple = this.simplifyFixture(game);
                const score = simple.status?.short && simple.status.short !== 'NS' ? ` (${simple.status.short})` : '';
                return `${simple.home} vs ${simple.away}${score}`;
              })
              .join(' | '),
            url: source.url,
            source: source.label,
          } as any);
        }
      } catch (error: any) {
        failures.push(`${source.label}: ${error?.message || error}`);
      }

      if (fixtures.length >= (kind === 'live' ? 8 : 18)) break;
    }

    const unique = this.sortFixturesByLivePriority(this.uniqueFixtures(fixtures)).slice(0, kind === 'live' ? 20 : 40);
    const research: ResearchResult = {
      enabled: true,
      provider: 'public-football-web-fallback',
      query: urls[0]?.url || '',
      items,
      summary: unique.length
        ? `Fallback público encontrou ${unique.length} jogo(s) em fontes abertas de futebol.`
        : failures.length
          ? `Fallback público acionado, mas sem jogo confirmado. Falhas: ${failures.slice(0, 4).join(' | ')}`
          : 'Fallback público acionado, mas não retornou jogos confirmados.',
      partialFailures: failures.slice(0, 8),
    } as any;

    return { fixtures: unique, research };
  }

  private buildPublicFootballSourceUrls(kind: 'live' | 'today' | 'cup_today', todayIso: string, message: string) {
    const compactDate = todayIso.replace(/-/g, '');
    const urls: Array<{ label: string; url: string; type: 'json' | 'text' }> = [];

    const addJson = (label: string, url: string) => urls.push({ label, url, type: 'json' });
    const addText = (label: string, url: string) => urls.push({ label, url, type: 'text' });

    const espnLeagues = kind === 'cup_today'
      ? ['fifa.world', 'fifa.cwc', 'all']
      : ['all', 'fifa.world', 'fifa.cwc'];

    for (const league of espnLeagues) {
      addJson(
        `ESPN ${league}`,
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${compactDate}&limit=200`,
      );
      addJson(
        `ESPN web ${league}`,
        `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${compactDate}&region=br&lang=pt&limit=200`,
      );
    }

    addText('ESPN scoreboard page', `https://www.espn.com/soccer/scoreboard/_/date/${compactDate}`);

    if (kind !== 'cup_today') {
      addText('LiveScore page', 'https://www.livescore.com/en/football/live/');
      addText('BBC football scores', `https://www.bbc.com/sport/football/scores-fixtures/${todayIso}`);
    }

    return urls.slice(0, 12);
  }

  private async publicFetch(url: string, type: 'json' | 'text') {
    const fetchFn = (globalThis as any).fetch;
    if (typeof fetchFn !== 'function') {
      throw new Error('fetch global indisponível no runtime Node');
    }

    const timeoutMs = Number(process.env.ODDIX_PUBLIC_WEB_TIMEOUT_MS || 8000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          accept: type === 'json' ? 'application/json,text/plain,*/*' : 'text/html,text/plain,*/*',
          'user-agent': 'OddixBot/21.6 (+football fallback; contact: oddix)',
        },
      });

      if (!response?.ok) {
        throw new Error(`HTTP ${response?.status || 'unknown'}`);
      }

      if (type === 'json') {
        const data = await response.json();
        return { ok: true, data };
      }

      const data = await response.text();
      return { ok: true, data };
    } finally {
      clearTimeout(timer);
    }
  }

  private mapPublicFootballJsonToFixtures(data: any, url: string, kind: 'live' | 'today' | 'cup_today', todayIso: string) {
    const events = this.extractPublicEvents(data);
    const fixtures: any[] = [];

    for (const event of events) {
      const fixture = this.mapEspnEventToFixture(event, url, kind, todayIso);
      if (!fixture) continue;
      if (kind === 'live' && !this.isFixtureLiveLike(fixture)) continue;
      if (kind === 'cup_today' && !this.isCupCompetition(fixture)) continue;
      fixtures.push(fixture);
    }

    return fixtures;
  }

  private extractPublicEvents(data: any): any[] {
    const events: any[] = [];
    const visit = (value: any, depth = 0) => {
      if (!value || depth > 5) return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, depth + 1);
        return;
      }
      if (typeof value !== 'object') return;
      if (Array.isArray(value.events)) events.push(...value.events);
      if (Array.isArray(value.matches)) events.push(...value.matches);
      if (Array.isArray(value.fixtures)) events.push(...value.fixtures);
      if (Array.isArray(value.data)) events.push(...value.data);
      for (const key of ['sports', 'leagues', 'groups']) visit(value[key], depth + 1);
    };
    visit(data);
    return events;
  }

  private mapEspnEventToFixture(event: any, url: string, kind: 'live' | 'today' | 'cup_today', todayIso: string) {
    const competition = event?.competitions?.[0] || event?.competition || event;
    const competitors = competition?.competitors || event?.competitors || [];
    if (!Array.isArray(competitors) || competitors.length < 2) return null;

    const homeCompetitor = competitors.find((item: any) => String(item?.homeAway || '').toLowerCase() === 'home') || competitors[0];
    const awayCompetitor = competitors.find((item: any) => String(item?.homeAway || '').toLowerCase() === 'away') || competitors[1];

    const home = this.pickPublicTeamName(homeCompetitor);
    const away = this.pickPublicTeamName(awayCompetitor);
    if (!home || !away) return null;

    const status = event?.status || competition?.status || {};
    const statusType = status?.type || {};
    const statusName = String(statusType?.name || statusType?.shortDetail || statusType?.description || status?.shortDetail || '').trim();
    const state = String(statusType?.state || status?.state || '').toLowerCase();
    const short = this.publicStatusShort(statusName, state, kind);
    const leagueName =
      event?.league?.name ||
      event?.season?.name ||
      event?.leagues?.[0]?.name ||
      competition?.league?.name ||
      this.inferWebCompetition(`${event?.name || ''} ${event?.shortName || ''}`, url, kind);

    return {
      provider: 'public-web-espn',
      source: 'public-web-espn',
      publicSourceUrl: url,
      fixture: {
        id: `espn-${event?.id || this.normalize(`${home}-${away}-${todayIso}`).replace(/\s+/g, '-')}`,
        date: event?.date || competition?.date || todayIso,
        timestamp: event?.date ? Math.floor(new Date(event.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
        status: {
          short,
          long: statusType?.description || statusName || (kind === 'live' ? 'Possível ao vivo' : 'Jogo de hoje'),
          elapsed: this.publicElapsed(status),
        },
      },
      league: {
        name: leagueName || 'Futebol',
        country: event?.league?.country || 'Web',
      },
      teams: {
        home: { name: home },
        away: { name: away },
      },
      goals: {
        home: this.publicScore(homeCompetitor),
        away: this.publicScore(awayCompetitor),
      },
      webFallback: {
        confidence: kind === 'live' && state === 'in' ? 88 : 74,
        sourceUrl: url,
        sourceTitle: event?.name || event?.shortName || `${home} vs ${away}`,
        kind,
      },
    };
  }

  private pickPublicTeamName(competitor: any) {
    return String(
      competitor?.team?.displayName ||
        competitor?.team?.name ||
        competitor?.team?.shortDisplayName ||
        competitor?.displayName ||
        competitor?.name ||
        '',
    ).trim();
  }

  private publicScore(competitor: any) {
    const raw = competitor?.score ?? null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  private publicElapsed(status: any) {
    const raw = status?.period || status?.displayClock || status?.clock || status?.type?.detail || '';
    const match = String(raw).match(/(\d{1,3})/);
    return match ? Number(match[1]) : null;
  }

  private publicStatusShort(statusName: string, state: string, kind: 'live' | 'today' | 'cup_today') {
    const normalized = this.normalize(`${state} ${statusName}`);
    if (state === 'in' || this.hasAny(normalized, ['in progress', 'halftime', '1st half', '2nd half', 'live'])) return 'LIVE';
    if (state === 'pre' || this.hasAny(normalized, ['scheduled', 'pre game', 'not started'])) return 'NS';
    if (state === 'post' || this.hasAny(normalized, ['final', 'ended', 'full time'])) return 'FT';
    return kind === 'live' ? 'WEB-LIVE' : 'WEB';
  }

  private isFixtureLiveLike(fixture: any) {
    const simple = this.simplifyFixture(fixture);
    const status = this.normalize(`${simple.status?.short || ''} ${simple.status?.long || ''}`);
    if (this.hasAny(status, ['live', 'in progress', 'halftime', '1st half', '2nd half', 'intervalo', 'ao vivo'])) return true;
    const elapsed = Number(simple.status?.elapsed || 0);
    return Number.isFinite(elapsed) && elapsed > 0 && elapsed < 130;
  }

  private mapPublicFootballTextToFixtures(text: string, url: string, kind: 'live' | 'today' | 'cup_today', todayIso: string) {
    const item = {
      title: `Public football page ${url}`,
      description: String(text || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').slice(0, 20000),
      url,
      source: 'public-football-page',
    } as any;

    const haystack = this.researchItemTextForFallback(item);
    const pairs = this.extractFixturePairsFromText(haystack);
    return pairs
      .filter((pair) => this.isValidWebFixturePair(pair.home, pair.away, haystack, kind))
      .map((pair) => this.webPairToFixture(pair.home, pair.away, item, haystack, kind, todayIso));
  }

  private async directWebSearch(message: string, query: string): Promise<ResearchResult | null> {
    if (!this.researchService && !this.researchAgent) return null;

    try {
      if (this.researchService?.searchEverything) {
        const result = await this.researchService.searchEverything(query, 'br');
        if (result?.items?.length) return result;
        if ((result as any)?.error && !this.researchAgent) return result;
      }

      if (this.researchAgent) {
        const agentResult = await this.researchAgent.research(message, query);
        if (agentResult?.items?.length) return agentResult;
      }

      if (this.researchService?.search) {
        return await this.researchService.search(query, 'br');
      }
    } catch (error: any) {
      this.logger.warn(`[ODDIX_STRONG_WEB_FALLBACK] query="${query}" falhou: ${error?.message || error}`);
      return {
        enabled: true,
        query,
        items: [],
        summary: `Pesquisa web fallback falhou para "${query}": ${error?.message || 'erro desconhecido'}`,
      } as ResearchResult;
    }

    return null;
  }

  private mergeResearchResults(results: Array<ResearchResult | null>, queries: string[]): ResearchResult {
    const items: ResearchItem[] = [];
    const errors: string[] = [];
    let enabled = false;
    let provider = 'strong-web-fallback';

    for (const result of results) {
      if (!result) continue;
      enabled = enabled || !!result.enabled;
      provider = (result as any)?.provider || provider;
      if ((result as any)?.error) errors.push(String((result as any).error));
      if ((result as any)?.partialFailures?.length) errors.push(...(result as any).partialFailures);
      if (Array.isArray(result.items)) items.push(...result.items);
    }

    const unique = this.uniqueResearchItems(items).slice(0, 80);
    return {
      enabled,
      query: queries[0] || '',
      items: unique,
      provider,
      summary: unique.length
        ? this.buildResearchItemsSummary(unique)
        : errors.length
          ? `Pesquisa web fallback acionada, mas sem item útil. Falhas: ${errors.slice(0, 4).join(' | ')}`
          : 'Pesquisa web fallback acionada, mas não retornou itens úteis.',
      queries,
      partialFailures: errors.slice(0, 8),
    } as any;
  }

  private uniqueResearchItems(items: ResearchItem[]) {
    const seen = new Set<string>();
    return (items || []).filter((item: any) => {
      const text = this.researchItemTextForFallback(item);
      const key = `${item?.url || ''}:${item?.title || ''}:${text.slice(0, 160)}`.toLowerCase();
      if (!text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildResearchItemsSummary(items: ResearchItem[]) {
    return (items || [])
      .slice(0, 12)
      .map((item: any) => {
        const source = item?.source ? ` — ${item.source}` : '';
        const url = item?.url ? `\n  URL: ${item.url}` : '';
        const text = this.researchItemTextForFallback({
          description: item?.description,
          snippet: item?.snippet,
          content: item?.content,
          body: item?.body,
          text: item?.text,
          summary: item?.summary,
        } as any).replace(/\s+/g, ' ').slice(0, 360);
        return `• ${item?.title || 'Resultado web'}${source}${text ? `\n  ${text}` : ''}${url}`;
      })
      .join('\n');
  }

  private extractFixturesFromResearchItems(items: ResearchItem[], kind: 'live' | 'today' | 'cup_today') {
    const fixtures: any[] = [];
    const today = this.todayIso('America/Sao_Paulo');

    for (const item of items || []) {
      const text = this.researchItemTextForFallback(item);
      if (!this.isWebItemCompatibleForFixtures(item, text, kind, today)) continue;

      const pairs = this.extractFixturePairsFromText(text);
      for (const pair of pairs) {
        if (!this.isValidWebFixturePair(pair.home, pair.away, text, kind)) continue;
        fixtures.push(this.webPairToFixture(pair.home, pair.away, item, text, kind, today));
      }
    }

    return this.sortFixturesByLivePriority(this.uniqueFixtures(fixtures)).slice(0, kind === 'live' ? 20 : 40);
  }

  private isWebItemCompatibleForFixtures(item: any, text: string, kind: 'live' | 'today' | 'cup_today', today: string) {
    const normalized = this.normalize(`${text} ${item?.url || ''}`);
    const hasDateSignal = normalized.includes(this.normalize(today)) || this.hasAny(normalized, ['today', 'hoje', 'agora', 'ao vivo', 'live']);

    if (kind === 'cup_today') {
      if (!this.hasAny(normalized, ['world cup', 'club world cup', 'fifa', 'copa do mundo', 'mundial'])) return false;
      return hasDateSignal || this.hasReliableFootballSource(item);
    }

    if (kind === 'live') {
      if (!this.hasAny(normalized, ['live', 'ao vivo', 'placar', 'score', 'scores', 'tempo real', 'match center'])) return false;
      return this.hasReliableFootballSource(item) || hasDateSignal;
    }

    return hasDateSignal || this.hasReliableFootballSource(item);
  }

  private hasReliableFootballSource(item: any) {
    const source = this.normalize(`${item?.source || ''} ${item?.url || ''} ${item?.title || ''}`);
    return this.hasAny(source, ['flashscore', 'sofascore', 'espn', 'fifa', '365scores', 'livescore', 'fotmob', 'onefootball', 'ge globo', 'cbf']);
  }

  private researchItemTextForFallback(item: any): string {
    return [
      item?.title,
      item?.description,
      item?.snippet,
      item?.content,
      item?.body,
      item?.text,
      item?.summary,
      item?.url,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join('\n');
  }

  private extractFixturePairsFromText(text: string) {
    const pairs: Array<{ home: string; away: string }> = [];
    const compact = String(text || '')
      .replace(/[|•]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const team = `[A-ZÀ-Ý0-9][A-Za-zÀ-ÿ0-9 .'’&()/-]{1,55}?`;
    const patterns = [
      new RegExp(`\\b(${team})\\s+(?:vs\\.?|versus|v\\.?)\\s+(${team})(?=\\s|$|[-–—,;:()])`, 'gi'),
      new RegExp(`\\b(${team})\\s+x\\s+(${team})(?=\\s|$|[-–—,;:()])`, 'gi'),
      new RegExp(`\\b(${team})\\s+contra\\s+(${team})(?=\\s|$|[-–—,;:()])`, 'gi'),
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(compact)) !== null) {
        const home = this.cleanWebTeamName(match[1]);
        const away = this.cleanWebTeamName(match[2]);
        pairs.push({ home, away });
      }
    }

    return pairs;
  }

  private cleanWebTeamName(value: string) {
    return String(value || '')
      .replace(/\b(today|tomorrow|yesterday|fixtures?|schedule|matches?|live|scores?|results?|standings|odds|prediction|preview|highlights|watch|stream|jogos?|partidas?|placar|ao vivo|hoje|agora)\b/gi, '')
      .replace(/^[\s:;,.\-–—|]+|[\s:;,.\-–—|]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isValidWebFixturePair(home: string, away: string, text: string, kind: 'live' | 'today' | 'cup_today') {
    if (!home || !away) return false;
    if (home.length < 2 || away.length < 2) return false;
    if (home.length > 55 || away.length > 55) return false;
    if (this.normalize(home) === this.normalize(away)) return false;

    const bad = [
      'club world cup',
      'fifa world cup',
      'world cup',
      'copa do mundo',
      'mundial',
      'fixtures',
      'schedule',
      'matches',
      'results',
      'standings',
      'live scores',
      'football',
      'soccer',
      'today',
      'hoje',
    ];
    const h = this.normalize(home);
    const a = this.normalize(away);
    if (bad.includes(h) || bad.includes(a)) return false;
    if (bad.some((term) => h.startsWith(term + ' ') || a.startsWith(term + ' '))) return false;

    const normalizedText = this.normalize(text);
    if (kind === 'cup_today' && !this.hasAny(normalizedText, ['world cup', 'club world cup', 'fifa', 'copa do mundo', 'mundial'])) return false;
    return true;
  }

  private webPairToFixture(home: string, away: string, item: any, text: string, kind: 'live' | 'today' | 'cup_today', today: string) {
    const confidence = this.webFixtureConfidence(item, text, kind);
    const statusShort = kind === 'live' ? 'WEB-LIVE' : 'WEB';
    return {
      provider: 'web-fallback',
      source: 'web-fallback',
      fixture: {
        id: `web-${this.normalize(`${home}-${away}-${today}`).replace(/\s+/g, '-')}`,
        date: today,
        timestamp: Math.floor(Date.now() / 1000),
        status: {
          short: statusShort,
          long: kind === 'live' ? 'Indício web de jogo ao vivo' : 'Indício web de jogo de hoje',
          elapsed: null,
        },
      },
      league: {
        name: this.inferWebCompetition(text, item?.url, kind),
        country: 'Web',
      },
      teams: {
        home: { name: home },
        away: { name: away },
      },
      goals: {
        home: null,
        away: null,
      },
      webFallback: {
        confidence,
        title: item?.title || null,
        source: item?.source || this.webSourceFromUrl(item?.url),
        url: item?.url || null,
        kind,
      },
    };
  }

  private inferWebCompetition(text: string, url: string | undefined, kind: 'live' | 'today' | 'cup_today') {
    const normalized = this.normalize(`${text} ${url || ''}`);
    if (this.hasAny(normalized, ['club world cup', 'fifa club world cup', 'mundial de clubes'])) return 'FIFA Club World Cup';
    if (this.hasAny(normalized, ['fifa world cup', 'world cup', 'copa do mundo'])) return 'FIFA World Cup';
    if (kind === 'cup_today') return 'Copa/Mundial';
    return kind === 'live' ? 'Futebol ao vivo — web fallback' : 'Futebol — web fallback';
  }

  private webFixtureConfidence(item: any, text: string, kind: 'live' | 'today' | 'cup_today') {
    const normalized = this.normalize(`${text} ${item?.url || ''}`);
    let score = 58;
    if (this.hasReliableFootballSource(item)) score += 12;
    if (this.hasAny(normalized, ['today', 'hoje', this.todayIso('America/Sao_Paulo')])) score += 8;
    if (kind === 'live' && this.hasAny(normalized, ['live', 'ao vivo', 'placar', 'score'])) score += 10;
    if (kind === 'cup_today' && this.hasAny(normalized, ['world cup', 'club world cup', 'fifa', 'copa do mundo', 'mundial'])) score += 10;
    if ((item as any)?.content || (item as any)?.body || (item as any)?.text || (item as any)?.snippet) score += 5;
    return Math.min(score, 88);
  }

  private webSourceFromUrl(url: string | undefined) {
    try {
      return url ? new URL(url).hostname.replace(/^www\./, '') : 'web';
    } catch {
      return 'web';
    }
  }

  private async answerFromWebFixtureFallback(
    message: string,
    decision: OddixBrainDecision | undefined,
    fallback: { fixtures: any[]; research: ResearchResult | null; queries: string[]; items: ResearchItem[] },
    title: string,
    label: string,
  ): Promise<OddixDataOrchestratorResponse> {
    const flashScoreStatus = this.flashScoreFallbackStatus();
    const context = JSON.stringify(
      {
        pergunta: message,
        label,
        decision,
        flashScore: {
          quota: flashScoreStatus.quota,
          reason: flashScoreStatus.reason,
        },
        webQueries: fallback.queries,
        webFixtures: fallback.fixtures.map((game) => this.simplifyFixture(game)),
        research: fallback.research,
        rule:
          'A FlashScore/API principal não confirmou dados, mas o fallback web encontrou confrontos explícitos. Use apenas estes confrontos. Não invente placar, odds, estatísticas ou escalação. Informe fonte web e confiança média.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Responda com transparência: a FlashScore/base principal não retornou dados ou está em limite, então a resposta veio de fallback web.
Liste os jogos/confrontos encontrados, com fonte quando existir.
Não crie placar, odds, horário, estatística ou entrada oficial se não estiver explícito nos dados.
Finalize dizendo que a confiança é média e que a Oddix não inventou dados.`,
    );

    return {
      handled: true,
      answer: answer || this.formatWebFixtureFallback(fallback.fixtures, title, flashScoreStatus.reason),
      data: {
        waitingForData: false,
        webFallback: true,
        fixtures: fallback.fixtures,
        research: fallback.research,
        queries: fallback.queries,
        decision,
        flashScoreDiagnostics: flashScoreStatus.diagnostics,
        flashScoreQuota: flashScoreStatus.quota,
      },
      suggestions: fallback.fixtures.slice(0, 4).map((game: any) => {
        const simple = this.simplifyFixture(game);
        return `Analise ${simple.home} x ${simple.away}`;
      }),
    };
  }

  private formatWebFixtureFallback(fixtures: any[], title: string, flashScoreReason: string) {
    const lines = fixtures.slice(0, 20).map((game: any) => {
      const simple = this.simplifyFixture(game);
      const web = game?.webFallback || {};
      const source = web.source || this.webSourceFromUrl(web.url) || 'web';
      const confidence = web.confidence ? ` | confiança ${web.confidence}%` : '';
      return `• ${simple.home} x ${simple.away} — ${simple.league || 'Futebol'} — fonte: ${source}${confidence}`;
    });

    return `${title}

${flashScoreReason}

Encontrei estes confrontos por fallback web:

${lines.join('\n')}

⚠️ Fonte: pesquisa web/cache. Confiança média. Sem placar, odds, estatísticas ou escalações oficiais validadas pela FlashScore neste momento.`;
  }

  private async humanizeWithDeepSeek(userMessage: string, realContext: string, instruction: string) {
    if (!this.llmService?.isEnabled()) return null;

    const messages: OddixLlmMessage[] = [
      {
        role: 'system',
        content:
          'Você é a IA Oddix Chat V21. Responda em português do Brasil, natural, direto e inteligente. Nunca invente dados atuais. Para futebol, use somente dados reais fornecidos pela pesquisa web e pelas APIs do backend. Se faltar dado, diga claramente.',
      },
      {
        role: 'user',
        content: `${instruction}

Dados reais/contexto do backend:
${realContext}

Pergunta do usuário:
${userMessage}`,
      },
    ];

    return this.llmService.complete(messages);
  }

  private async getTodayFixtures() {
    const today = this.todayIso('America/Sao_Paulo');
    const allFixtures: any[] = [];

    // V20: FlashScore direto é a fonte prioritária quando disponível.
    if (this.flashScoreService?.isEnabled?.() && this.flashScoreService?.hasKey?.()) {
      try {
        const response = await this.flashScoreService.getFixtures(today);
        const fixtures = this.extractFixtureArray(response);
        if (fixtures.length) {
          this.logger.log(`[ODDIX_ORCHESTRATOR] flashscore.getFixtures(${today}) retornou ${fixtures.length} jogos`);
          allFixtures.push(...fixtures);
        } else if (!response.ok) {
          this.logger.warn(`[ODDIX_ORCHESTRATOR] flashscore.getFixtures falhou: ${response.error}`);
        }
      } catch (error: any) {
        this.logger.warn(`[ODDIX_ORCHESTRATOR] flashscore direto falhou: ${error?.message || error}`);
      }
    }

    if (!this.footballService) return this.sortFixtures(this.uniqueFixtures(allFixtures)).slice(0, 300);

    const service: any = this.footballService as any;

    const methods = [
      { name: 'getFixtures', call: () => service.getFixtures?.(today) },
      { name: 'getTodayFixtures', call: () => service.getTodayFixtures?.() },
      { name: 'getTodayMatches', call: () => service.getTodayMatches?.() },
      { name: 'getMatchesByDate', call: () => service.getMatchesByDate?.(today) },
      { name: 'getFlashScoreToday', call: () => service.getFlashScoreToday?.() },
      { name: 'getFlashScoreFixtures', call: () => service.getFlashScoreFixtures?.(today) },
      { name: 'getFlashScoreMatches', call: () => service.getFlashScoreMatches?.(today) },
      { name: 'getAllTodayFixtures', call: () => service.getAllTodayFixtures?.() },
    ];

    for (const method of methods) {
      try {
        const response = await method.call();
        const fixtures = this.extractFixtureArray(response);

        if (fixtures.length) {
          this.logger.log(`[ODDIX_ORCHESTRATOR] ${method.name} retornou ${fixtures.length} jogos`);
          allFixtures.push(...fixtures);
        }
      } catch (error: any) {
        this.logger.warn(
          `[ODDIX_ORCHESTRATOR] fonte ${method.name} falhou: ${error?.message || error}`,
        );
      }
    }

    return this.sortFixtures(this.uniqueFixtures(allFixtures)).slice(0, 300);
  }

  private async getLiveFixtures() {
    const allFixtures: any[] = [];

    if (this.flashScoreService?.isEnabled?.() && this.flashScoreService?.hasKey?.()) {
      try {
        const response = await this.flashScoreService.getLiveFixtures();
        const fixtures = this.extractFixtureArray(response);
        if (fixtures.length) allFixtures.push(...fixtures);
      } catch (error: any) {
        this.logger.warn(`[ODDIX_ORCHESTRATOR] flashscore live falhou: ${error?.message || error}`);
      }
    }

    if (!this.footballService) return this.uniqueFixtures(allFixtures).slice(0, 80);

    const service: any = this.footballService as any;

    const methods = [
      () => service.getLiveFixturesFromFlashScore?.(),
      () => service.getLiveFixtures?.(),
      () => service.getLiveMatches?.(),
      () => service.getLive?.(),
    ];

    for (const method of methods) {
      try {
        const response = await method();
        const fixtures = this.extractFixtureArray(response);
        if (fixtures.length) allFixtures.push(...fixtures);
      } catch {}
    }

    return this.uniqueFixtures(allFixtures).slice(0, 80);
  }

  private async getFixturesWindow(daysBack = 3, daysForward = 7) {
    const dates: string[] = [];
    for (let i = -daysBack; i <= daysForward; i += 1) {
      dates.push(this.shiftIsoDate(this.todayIso('America/Sao_Paulo'), i));
    }

    const all: any[] = [];

    if (this.flashScoreService?.isEnabled?.() && this.flashScoreService?.hasKey?.()) {
      for (const date of dates) {
        try {
          const response = await this.flashScoreService.getFixtures(date);
          all.push(...this.extractFixtureArray(response));
        } catch {}
      }
    }

    if (this.footballService) {
      for (const date of dates) {
        try {
          const response =
            typeof (this.footballService as any).getFixtures === 'function'
              ? await (this.footballService as any).getFixtures(date)
              : null;

          all.push(...this.extractFixtureArray(response));
        } catch {}
      }
    }

    return this.uniqueFixtures(all);
  }


  private async getMatchSearchFixtures(daysBack = 3, daysForward = 7) {
    const service: any = this.footballService as any;
    const buckets: any[][] = [];

    const safeCollect = async (label: string, fn: () => Promise<any> | any) => {
      try {
        const response = await fn();
        const fixtures = this.extractFixtureArray(response);
        if (fixtures.length) {
          this.logger.log(`[ORCH_MATCH_SEARCH] ${label} retornou ${fixtures.length} jogos`);
          buckets.push(fixtures);
        }
      } catch (error: any) {
        this.logger.warn(`[ORCH_MATCH_SEARCH] ${label} falhou: ${error?.message || error}`);
      }
    };

    if (this.flashScoreService?.isEnabled?.() && this.flashScoreService?.hasKey?.()) {
      await safeCollect('flashscore.direct.live', () => this.flashScoreService?.getLiveFixtures());
      for (let i = -daysBack; i <= daysForward; i += 1) {
        const date = this.shiftIsoDate(this.todayIso('America/Sao_Paulo'), i);
        await safeCollect(`flashscore.direct.fixtures.${date}`, () => this.flashScoreService?.getFixtures(date));
      }
    }

    await safeCollect('live.flashscore', () => service?.getLiveFixturesFromFlashScore?.());
    await safeCollect('live.default', () => service?.getLiveFixtures?.());
    await safeCollect('live.matches', () => service?.getLiveMatches?.());
    await safeCollect('live.generic', () => service?.getLive?.());
    await safeCollect('fixtures.today.noarg', () => service?.getFixtures?.());
    await safeCollect('today.fixtures', () => service?.getTodayFixtures?.());
    await safeCollect('today.matches', () => service?.getTodayMatches?.());
    await safeCollect('cache.all', () => service?.getFixturesFromCache?.());
    await safeCollect('cache.cached', () => service?.getCachedFixtures?.());
    await safeCollect('all.today', () => service?.getAllTodayFixtures?.());

    const windowFixtures = await this.getFixturesWindow(daysBack, daysForward).catch((error: any) => {
      this.logger.warn(`[ORCH_MATCH_SEARCH] window falhou: ${error?.message || error}`);
      return [];
    });
    if (windowFixtures.length) buckets.push(windowFixtures);

    return this.uniqueFixtures(buckets.flat());
  }

  private sortFixturesByLivePriority(fixtures: any[]) {
    return [...(fixtures || [])].sort((a: any, b: any) => {
      const scoreA = this.fixtureLivePriorityScore(a);
      const scoreB = this.fixtureLivePriorityScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;

      const timeA = this.fixtureTimestampSafe(a);
      const timeB = this.fixtureTimestampSafe(b);
      return timeB - timeA;
    });
  }

  private fixtureLivePriorityScore(game: any) {
    const provider = String(game?.provider || game?.source || '').toLowerCase();
    const status = String(
      game?.fixture?.status?.short ||
        game?.status?.short ||
        game?.fixture?.status?.long ||
        game?.status?.long ||
        '',
    ).toUpperCase();

    const elapsed = Number(
      game?.fixture?.status?.elapsed ??
        game?.status?.elapsed ??
        game?.fixture?.status?.minute ??
        game?.minute ??
        0,
    );

    const hasScore =
      game?.goals?.home !== undefined ||
      game?.goals?.away !== undefined ||
      game?.score?.fulltime?.home !== undefined ||
      game?.score?.fulltime?.away !== undefined ||
      game?.placar?.['tempo integral']?.casa !== undefined ||
      game?.gols?.casa !== undefined;

    const hasOdds = !!(
      game?.odds?.options?.length ||
      game?.odds?.opções?.length ||
      game?.odds?.market ||
      game?.odds?.mercado
    );

    const providerBonus = provider.includes('flashscore')
      ? 5000
      : provider.includes('sportscore6')
        ? 100
        : provider.includes('sportscore')
          ? 80
          : 0;

    const oddsBonus = hasOdds ? 800 : 0;

    if (['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'P', 'PEN_LIVE'].includes(status)) return providerBonus + 3000 + elapsed + oddsBonus;
    if (status === 'HT' || status.includes('HALF') || status.includes('INTERVAL')) return providerBonus + 2800 + oddsBonus;
    if (elapsed > 0 && elapsed < 130) return providerBonus + 2500 + elapsed + oddsBonus;
    if (['NS', 'TBD', 'SCHEDULED'].includes(status)) return providerBonus + 300 + oddsBonus;
    if (['FT', 'AET', 'PEN'].includes(status)) return providerBonus + 100 + (hasScore ? 50 : 0) + oddsBonus;
    return providerBonus + oddsBonus;
  }

  private fixtureTimestampSafe(game: any) {
    const rawTimestamp = Number(game?.fixture?.timestamp || game?.timestamp || 0);
    if (Number.isFinite(rawTimestamp) && rawTimestamp > 0) return rawTimestamp;

    const rawDate = game?.fixture?.date || game?.date || game?.startTime || game?.start_time;
    const parsed = rawDate ? new Date(rawDate).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async enrichFixtures(fixtures: any[]) {
    const enriched: any[] = [];

    for (const fixture of fixtures) {
      const id = String(fixture?.fixture?.id || fixture?.id || '');
      const rich = id ? await this.getRichContext(id, fixture).catch(() => null) : null;
      enriched.push({ fixture, rich });
    }

    return enriched;
  }

  private async getRichContext(fixtureId: string, fixture: any) {
    if (!fixtureId && !fixture) return null;

    const provider = String(fixture?.provider || fixture?.source || '').toLowerCase();
    const isFlashScoreFixture = provider.includes('flashscore') || !!fixture?.flashScoreRaw;
    const flashScoreId = this.getFlashScoreMatchId(fixtureId, fixture);

    // V20: usa FlashScoreService diretamente quando a fixture veio da FlashScore.
    if (this.flashScoreService && isFlashScoreFixture && flashScoreId) {
      const errors: string[] = [];
      const [statsResult, lineupsResult, h2hResult, oddsResult] = await Promise.all([
        this.flashScoreService.getStats(flashScoreId).catch((error: any) => ({ ok: false, data: null, error: error?.message || error })),
        this.flashScoreService.getLineups(flashScoreId).catch((error: any) => ({ ok: false, data: null, error: error?.message || error })),
        this.flashScoreService.getH2H(flashScoreId).catch((error: any) => ({ ok: false, data: null, error: error?.message || error })),
        this.flashScoreService.getOdds(flashScoreId).catch((error: any) => ({ ok: false, data: null, error: error?.message || error })),
      ]);

      if (!statsResult.ok) errors.push(`stats: ${statsResult.error}`);
      if (!lineupsResult.ok) errors.push(`lineups: ${lineupsResult.error}`);
      if (!h2hResult.ok) errors.push(`h2h: ${h2hResult.error}`);
      if (!oddsResult.ok) errors.push(`odds: ${oddsResult.error}`);

      const mappedStats = statsResult.ok
        ? this.flashScoreService.mapStatsToOddix(flashScoreId, statsResult.data)
        : null;

      return this.enrichRichContext(
        {
          ok: !!(statsResult.ok || lineupsResult.ok || h2hResult.ok || oddsResult.ok),
          source: 'flashscore',
          fixture,
          fixtureId,
          flashScoreExternalId: flashScoreId,
          statistics: mappedStats,
          odds: oddsResult.ok ? oddsResult.data : this.extractFixtureOdds(fixture) || null,
          h2h: h2hResult.ok ? h2hResult.data : null,
          lineups: lineupsResult.ok ? lineupsResult.data : null,
          errors,
        },
        fixture,
        this.flashScoreService,
        flashScoreId,
      );
    }

    if (!this.footballService) {
      const fixtureOdds = this.extractFixtureOdds(fixture);
      return fixtureOdds
        ? this.enrichRichContext(
            {
              ok: true,
              source: provider || 'fixture',
              fixture,
              fixtureId,
              flashScoreExternalId: flashScoreId,
              statistics: null,
              odds: fixtureOdds,
              h2h: null,
              lineups: null,
              errors: [],
            },
            fixture,
            undefined,
            fixtureId,
          )
        : null;
    }

    const service: any = this.footballService as any;

    if (!isFlashScoreFixture) {
      const fixtureOdds = this.extractFixtureOdds(fixture);
      return this.enrichRichContext(
        {
          ok: !!fixtureOdds,
          source: provider || 'non-flashscore',
          fixture,
          fixtureId,
          flashScoreExternalId: null,
          statistics: null,
          odds: fixtureOdds || null,
          h2h: null,
          lineups: null,
          errors: [`Provider ${provider || 'desconhecido'} não possui ID compatível com FlashScore. Rich context FlashScore bloqueado.`],
        },
        fixture,
        service,
        fixtureId,
      );
    }

    if (typeof service.getFlashScoreRichContext === 'function') {
      const rich = await service.getFlashScoreRichContext(fixtureId, fixture);
      const fixtureOdds = this.extractFixtureOdds(fixture);
      return this.enrichRichContext(
        {
          ...(rich || {}),
          fixture: rich?.fixture || fixture,
          odds: rich?.odds || fixtureOdds || null,
        },
        fixture,
        service,
        fixtureId,
      );
    }

    if (typeof service.getStatistics === 'function') {
      const statistics = await service.getStatistics(fixtureId).catch(() => null);

      return this.enrichRichContext(
        {
          ok: !!statistics,
          fixture,
          fixtureId,
          statistics,
          odds: fixture?.odds || null,
          h2h: null,
          lineups: null,
        },
        fixture,
        service,
        fixtureId,
      );
    }

    return null;
  }

  private localDecision(message: string): OddixBrainDecision {
    const text = this.normalize(message);
    const cleanedQuery = this.queryCleaner?.analyze(message) || null;
    let intent: any = 'GENERAL';

    if (this.hasAny(text, ['jogos de hoje', 'quais jogos', 'copa hoje', 'jogos da copa'])) intent = 'TODAY_GAMES';
    if (cleanedQuery?.intentHint === 'TODAY_CUP_GAMES') intent = 'TODAY_GAMES';
    if (this.hasAny(text, ['ao vivo', 'live', 'placar'])) intent = 'LIVE';
    if (cleanedQuery?.intentHint === 'MATCH_RESULT') intent = 'MATCH_ANALYSIS';
    if (this.hasAny(text, ['melhor entrada', 'maior confianca', 'maior confiança', 'top pick', 'o que apostar'])) intent = 'TOP_PICKS';
    if (this.extractTeams(message, null) || cleanedQuery?.teams) intent = 'MATCH_ANALYSIS';

    return {
      intent,
      userMessage: message,
      normalizedQuestion: text,
      confidence: 0.75,
      riskMode: 'balanced',
      entities: {} as any,
      reference: 'none',
      userWants: intent,
      shouldUseOddixEngine: intent !== 'GENERAL',
      shouldUseGlobalAiDirect: intent === 'GENERAL',
      shouldHumanizeWithGemini: false,
      safetyNotes: ['Fallback local do orquestrador.'],
      source: 'local',
    };
  }

  private stripContextualQuestionTerms(value: string) {
    return String(value || '')
      .replace(/[?!.]+/g, ' ')
      .replace(/\bvale\s+entrar\b/gi, ' ')
      .replace(/\bvale\s+a\s+pena\b/gi, ' ')
      .replace(/\bposso\s+entrar\b/gi, ' ')
      .replace(/\bentraria\b/gi, ' ')
      .replace(/\bqual\s+mercado\b/gi, ' ')
      .replace(/\bque\s+mercado\b/gi, ' ')
      .replace(/\bquais\s+s[aã]o\s+as\s+odds\b/gi, ' ')
      .replace(/\bquais\s+odds\b/gi, ' ')
      .replace(/\bqual\s+odd\b/gi, ' ')
      .replace(/\bo\s+que\s+voc[eê]\s+faria\b/gi, ' ')
      .replace(/\bo\s+que\s+voce\s+faria\b/gi, ' ')
      .replace(/\bo\s+que\s+faria\b/gi, ' ')
      .replace(/\bquem\s+est[aá]\s+melhor\b/gi, ' ')
      .replace(/\bquem\s+ta\s+melhor\b/gi, ' ')
      .replace(/\bquem\s+t[aá]\s+melhor\b/gi, ' ')
      .replace(/\bpr[oó]ximo\s+gol\b/gi, ' ')
      .replace(/\bproximo\s+gol\b/gi, ' ')
      .replace(/\btem\s+entrada\b/gi, ' ')
      .replace(/\bme\s+d[aá]\s+uma\s+entrada\b/gi, ' ')
      .replace(/\bnesse\s+jogo\b/gi, ' ')
      .replace(/\bdesse\s+jogo\b/gi, ' ')
      .replace(/\bnessa\s+partida\b/gi, ' ')
      .replace(/\bdesse\s+confronto\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTeams(message: string, decision?: OddixBrainDecision | null): { home: string; away: string } | null {
    if (decision?.entities?.homeTeam && decision?.entities?.awayTeam) {
      return {
        home: this.cleanTeamName(decision.entities.homeTeam),
        away: this.cleanTeamName(decision.entities.awayTeam),
      };
    }

    const cleanedByQueryCleaner = this.queryCleaner?.cleanFootballQuestion(String(message || '')) || String(message || '');
    const sanitized = this.stripContextualQuestionTerms(cleanedByQueryCleaner)
      .replace(/[–—]/g, ' ')
      .replace(/\b\d+\s*x\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*-\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*:\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\b/g, ' ')
      .replace(/analisa|analisar|analise|análise/gi, '')
      .replace(/\s+e\s+/gi, ' x ')
      .replace(/\s+/g, ' ')
      .trim();

    const normalizedOriginal = sanitized.toLowerCase();

    for (const separator of [' x ', ' vs ', ' v ', ' versus ', ' contra ']) {
      if (normalizedOriginal.includes(separator)) {
        const parts = normalizedOriginal.split(separator);
        if (parts[0]?.trim() && parts[1]?.trim()) {
          return {
            home: this.cleanTeamName(parts[0]),
            away: this.cleanTeamName(parts[1]),
          };
        }
      }
    }

    return null;
  }

  private findMatch(fixtures: any[], homeQueryRaw: string, awayQueryRaw: string) {
    const homeAliases = this.buildTeamSearchAliases(homeQueryRaw);
    const awayAliases = this.buildTeamSearchAliases(awayQueryRaw);

    if (!homeAliases.length || !awayAliases.length) return null;

    const candidates = this.sortFixturesByLivePriority(
      this.uniqueFixtures(fixtures || []),
    );

    const match = candidates.find((item: any) => {
      const fixtureHomeAliases = this.buildTeamSearchAliases(this.getFixtureHomeName(item));
      const fixtureAwayAliases = this.buildTeamSearchAliases(this.getFixtureAwayName(item));

      if (!fixtureHomeAliases.length || !fixtureAwayAliases.length) return false;

      const direct =
        this.teamAliasMatch(homeAliases, fixtureHomeAliases) &&
        this.teamAliasMatch(awayAliases, fixtureAwayAliases);

      const swapped =
        this.teamAliasMatch(homeAliases, fixtureAwayAliases) &&
        this.teamAliasMatch(awayAliases, fixtureHomeAliases);

      if (direct || swapped) return true;

      const queryCombined = `${homeAliases.join(' ')} ${awayAliases.join(' ')}`.trim();
      const queryReversed = `${awayAliases.join(' ')} ${homeAliases.join(' ')}`.trim();
      const fixtureCombined = `${fixtureHomeAliases.join(' ')} ${fixtureAwayAliases.join(' ')}`.trim();
      const fixtureReversed = `${fixtureAwayAliases.join(' ')} ${fixtureHomeAliases.join(' ')}`.trim();

      return (
        fixtureCombined.includes(queryCombined) ||
        fixtureReversed.includes(queryCombined) ||
        queryCombined.includes(fixtureCombined) ||
        queryCombined.includes(fixtureReversed) ||
        queryReversed.includes(fixtureCombined) ||
        queryReversed.includes(fixtureReversed) ||
        this.teamTokenMatch(queryCombined, fixtureCombined) ||
        this.teamTokenMatch(queryCombined, fixtureReversed)
      );
    }) || null;

    if (!match) {
      this.logger.warn(
        `[ORCH_MATCH_FINDER] não encontrou ${homeQueryRaw} x ${awayQueryRaw}. candidates=${candidates.length}. sample=${candidates
          .slice(0, 12)
          .map((item: any) => `${this.getFixtureHomeName(item)} x ${this.getFixtureAwayName(item)}`)
          .join(' | ')}`,
      );
    }

    return match;
  }

  private buildTeamSearchAliases(value: any): string[] {
    const base = this.normalize(this.cleanTeamName(value));
    if (!base) return [];

    const aliases = new Set<string>([base]);
    const aliasMap: Record<string, string[]> = {
      brasil: ['brazil', 'brasil selecao', 'selecao brasileira', 'seleção brasileira'],
      brazil: ['brasil', 'brasil selecao', 'selecao brasileira', 'seleção brasileira'],
      'selecao brasileira': ['brasil', 'brazil'],
      croacia: ['croácia', 'croatia', 'hrvatska'],
      croatia: ['croacia', 'croácia', 'hrvatska'],
      hrvatska: ['croacia', 'croatia'],
      panama: ['panamá', 'panama'],
      canada: ['canadá'],
      suica: ['suíça', 'switzerland'],
      switzerland: ['suica', 'suíça'],
      marrocos: ['morocco'],
      morocco: ['marrocos'],
      haiti: ['haití'],
      escocia: ['escócia', 'scotland'],
      scotland: ['escocia', 'escócia'],
      qatar: ['catar'],
      catar: ['qatar'],
      'africa do sul': ['áfrica do sul', 'south africa'],
      'south africa': ['africa do sul', 'áfrica do sul'],
      'estados unidos': ['usa', 'united states', 'united states of america'],
      usa: ['estados unidos', 'united states', 'united states of america'],
      'estados unidos da america': ['usa', 'united states'],
      inglaterra: ['england'],
      england: ['inglaterra'],
      alemanha: ['germany'],
      germany: ['alemanha'],
      franca: ['france'],
      france: ['franca'],
      espanha: ['spain'],
      spain: ['espanha'],
      japao: ['japan'],
      japan: ['japao'],
      'coreia do sul': ['south korea', 'korea republic'],
      'south korea': ['coreia do sul', 'korea republic'],
      'korea republic': ['coreia do sul', 'south korea'],
    };

    for (const alias of aliasMap[base] || []) {
      aliases.add(this.normalize(alias));
    }

    for (const [key, values] of Object.entries(aliasMap)) {
      const normalizedValues = values.map((item) => this.normalize(item));
      if (normalizedValues.includes(base)) aliases.add(this.normalize(key));
    }

    return Array.from(aliases).filter((item) => item.length >= 2);
  }

  private teamAliasMatch(queryAliases: string[], fixtureAliases: string[]) {
    return queryAliases.some((query) =>
      fixtureAliases.some((fixture) => {
        if (!query || !fixture) return false;
        if (fixture === query) return true;
        if (fixture.includes(query) && query.length >= 3) return true;
        if (query.includes(fixture) && fixture.length >= 3) return true;
        return this.teamTokenMatch(query, fixture);
      }),
    );
  }

  private teamTokenMatch(query: string, fixture: string) {
    const queryTokens = query.split(' ').filter((token) => token.length >= 3);
    const fixtureTokens = fixture.split(' ').filter((token) => token.length >= 3);
    if (!queryTokens.length || !fixtureTokens.length) return false;

    const hits = queryTokens.filter((token) =>
      fixtureTokens.some((fixtureToken) => fixtureToken === token || fixtureToken.includes(token) || token.includes(fixtureToken)),
    ).length;

    return hits >= Math.min(queryTokens.length, fixtureTokens.length);
  }

    private getFixtureHomeName(game: any) {
    return (
      game?.teams?.home?.name ||
      game?.times?.home?.name ||
      game?.times?.casa?.nome ||
      game?.times?.casa?.name ||
      game?.homeTeam ||
      game?.home ||
      game?.casa ||
      ''
    );
  }

  private getFixtureAwayName(game: any) {
    return (
      game?.teams?.away?.name ||
      game?.times?.away?.name ||
      game?.times?.away?.nome ||
      game?.times?.fora?.nome ||
      game?.times?.fora?.name ||
      game?.awayTeam ||
      game?.away ||
      game?.fora ||
      ''
    );
  }

  private scoreCandidate(item: any) {
    const fixture = item.fixture;
    const rich = item.rich;
    const simple = this.simplifyFixture(fixture);

    let score = 60;
    if (rich?.ok) score += 10;
    if (rich?.statistics || rich?.prematchStats) score += 10;
    if (rich?.odds) score += 10;
    if (rich?.h2h) score += 5;
    if (rich?.lineups) score += 5;

    const status = simple.status?.short || simple.status?.long || '';
    if (String(status).toUpperCase() === 'NS') score += 3;

    return {
      game: `${simple.home} x ${simple.away}`,
      league: simple.league,
      date: simple.date,
      status: simple.status,
      score: Math.min(score, 96),
      confidenceLabel: score >= 85 ? 'alta' : score >= 75 ? 'moderada' : 'baixa',
      hasStats: !!(rich?.statistics || rich?.prematchStats),
      hasOdds: !!(rich?.oddsSummary?.available || rich?.odds),
      hasH2H: !!rich?.h2h,
      hasLineups: !!rich?.lineups,
      officialEntry: !!(rich?.oddsSummary?.available || rich?.odds) && !!(rich?.statisticsSummary?.available || rich?.statistics || rich?.prematchStats),
    };
  }

  private buildFixturesContext(
    fixtures: any[],
    label: string,
    decision?: OddixBrainDecision,
    research?: ResearchResult | null,
  ) {
    return JSON.stringify(
      {
        label,
        decision,
        research,
        total: fixtures.length,
        fixtures: fixtures.slice(0, 30).map((game: any) => this.simplifyFixture(game)),
      },
      null,
      2,
    );
  }

  private simplifyFixture(game: any) {
    return {
      id: game?.fixture?.id || game?.id,
      externalId:
        game?.fixture?.externalId ||
        game?.fixture?.external_id ||
        game?.externalId ||
        null,
      home: this.getFixtureHomeName(game),
      away: this.getFixtureAwayName(game),
      league: game?.league?.name || game?.liga?.nome || game?.leagueName || game?.league,
      country: game?.league?.country || game?.liga?.país || game?.liga?.pais || game?.country,
      date: game?.fixture?.date || game?.date || game?.kickoff,
      status: game?.fixture?.status || game?.status,
      goals: game?.goals || game?.gols,
      score: game?.score || game?.placar,
      odds: this.extractFixtureOdds(game),
      oddsSummary: this.buildOddsSummary(this.extractFixtureOdds(game)),
      provider: game?.provider,
    };
  }

  private simplifyRichContext(rich: any) {
    if (!rich) return null;

    return {
      ok: rich?.ok,
      source: rich?.source,
      hasStatistics: !!rich?.statisticsSummary?.available || !!rich?.statistics,
      hasPrematchStats: !!rich?.prematchStats,
      hasOdds: !!rich?.oddsSummary?.available || !!rich?.odds,
      hasH2H: !!rich?.h2h,
      hasLineups: !!rich?.lineups,
      statisticsSummary: rich?.statisticsSummary || this.buildStatisticsSummary(this.normalizeRichStatistics(rich?.statistics)),
      pressureSummary: rich?.pressureSummary || null,
      statisticsProxy: rich?.statisticsProxy || null,
      statsUnavailableReason: rich?.statsUnavailableReason || null,
      contextQuality: rich?.contextQuality || null,
      oddsSummary: rich?.oddsSummary || null,
      prematchStats: rich?.prematchStats || null,
      errors: rich?.errors || [],
    };
  }

  private async enrichRichContext(rich: any, fixture: any, service?: any, fixtureId?: string) {
    if (!rich) return null;

    const resolvedFixture = rich.fixture || fixture;
    const bestStats = await this.resolveBestLiveStatistics(
      service,
      fixtureId || String(resolvedFixture?.fixture?.id || ''),
      resolvedFixture,
      rich.statistics,
    );
    const normalizedStats = this.normalizeRichStatistics(bestStats || rich.statistics);
    const statisticsSummary = this.buildStatisticsSummary(normalizedStats);
    const pressureSummary = this.buildPressureSummary(statisticsSummary, resolvedFixture);
    const fixtureOdds = this.extractFixtureOdds(resolvedFixture || fixture);
    const resolvedOdds = rich.odds || fixtureOdds || null;
    const oddsSummary = this.buildOddsSummary(resolvedOdds);
    const statisticsProxy = statisticsSummary.available ? null : this.buildLiveProxySignal(resolvedFixture, oddsSummary);
    const contextQuality = statisticsSummary.available && oddsSummary.available
      ? 'FULL'
      : statisticsSummary.available || rich.h2h || rich.lineups || rich.prematchStats?.available
        ? 'PARTIAL'
        : oddsSummary.available
          ? 'ODDS_ONLY'
          : resolvedFixture
            ? 'BASIC'
            : 'NONE';

    return {
      ...rich,
      fixture: resolvedFixture,
      statistics: normalizedStats || rich.statistics || null,
      statisticsSummary,
      pressureSummary,
      statisticsProxy,
      statsUnavailableReason: statisticsSummary.available
        ? null
        : 'Provider não entregou posse, finalizações, escanteios ou ataques perigosos oficiais para este jogo.',
      contextQuality,
      odds: resolvedOdds,
      oddsSummary,
      ok: !!(rich.ok || statisticsSummary.available || oddsSummary.available || rich.h2h || rich.lineups || rich.prematchStats?.available),
    };
  }

  private async resolveBestLiveStatistics(service: any, fixtureId: string, fixture: any, currentStatistics: any) {
    const currentSummary = this.buildStatisticsSummary(this.normalizeRichStatistics(currentStatistics));
    if (currentSummary.available) return currentStatistics;

    if (!service) return this.extractStatisticsFromFixtureRaw(fixture);

    const externalId =
      fixture?.fixture?.externalId ||
      fixture?.fixture?.external_id ||
      fixture?.fixture?.matchId ||
      fixture?.fixture?.match_id ||
      fixture?.flashScoreRaw?.id ||
      fixture?.flashScoreRaw?.match_id ||
      null;

    const ids = Array.from(new Set([fixtureId, externalId].filter(Boolean).map(String)));
    const methods = ['getStatistics', 'getStatisticsFromFlashScore', 'getLiveStatistics', 'getFixtureStatistics'];

    for (const id of ids) {
      for (const method of methods) {
        if (typeof service?.[method] !== 'function') continue;

        try {
          const response = await service[method](id);
          const normalized = this.normalizeRichStatistics(response);
          const summary = this.buildStatisticsSummary(normalized);
          if (summary.available) return normalized || response;
        } catch {
          // Continua tentando a próxima fonte.
        }
      }
    }

    return this.extractStatisticsFromFixtureRaw(fixture) || currentStatistics || null;
  }

  private extractStatisticsFromFixtureRaw(fixture: any) {
    if (!fixture) return null;

    const candidates = [
      fixture?.statistics,
      fixture?.stats,
      fixture?.matchStats,
      fixture?.match_stats,
      fixture?.flashScoreRaw?.statistics,
      fixture?.flashScoreRaw?.stats,
      fixture?.flashScoreRaw?.matchStats,
      fixture?.raw?.statistics,
      fixture?.raw?.stats,
    ].filter(Boolean);

    for (const candidate of candidates) {
      const normalized = this.normalizeRichStatistics(candidate);
      const summary = this.buildStatisticsSummary(normalized);
      if (summary.available) return normalized;
    }

    return null;
  }

  private buildLiveProxySignal(fixture: any, oddsSummary: any) {
    const status = fixture?.fixture?.status || {};
    const elapsed = Number(status?.elapsed ?? status?.decorrido ?? 0);
    const homeGoals = Number(fixture?.goals?.home ?? fixture?.score?.fulltime?.home ?? fixture?.gols?.casa ?? 0);
    const awayGoals = Number(fixture?.goals?.away ?? fixture?.score?.fulltime?.away ?? fixture?.gols?.fora ?? 0);
    const odds = Array.isArray(oddsSummary?.options) ? oddsSummary.options : [];
    const favorite = odds.length ? [...odds].sort((a: any, b: any) => Number(a.odd) - Number(b.odd))[0] : null;
    const urgency = elapsed >= 75 ? 'alta' : elapsed >= 55 ? 'média' : 'baixa';
    const favoriteText = favorite ? `Mercado aponta ${favorite.name} como favorito (${Number(favorite.odd).toFixed(2)}).` : 'Sem favorito validado por odds.';

    return {
      available: true,
      official: false,
      source: 'proxy-score-odds-clock',
      elapsed: Number.isFinite(elapsed) ? elapsed : null,
      score: { home: homeGoals, away: awayGoals, diff: Math.abs(homeGoals - awayGoals) },
      favorite,
      urgency,
      reading: `Sem estatísticas oficiais de pressão. Sinal auxiliar usa apenas placar, minuto e odds. ${favoriteText} Urgência live: ${urgency}.`,
      warning: 'Sinal auxiliar não substitui estatísticas oficiais. Não liberar entrada oficial só por proxy.',
    };
  }

  private normalizeRichStatistics(statistics: any) {
    if (!statistics) return null;
    if (statistics?.data?.available || Array.isArray(statistics?.data?.teams)) return statistics.data;
    if (statistics?.available !== undefined || Array.isArray(statistics?.teams)) return statistics;
    if (statistics?.ok && statistics?.data) return statistics.data;
    return statistics;
  }

  private emptyStatisticsSummary(): {
    available: boolean;
    source: string;
    home: {
      possession: number | null;
      totalShots: number | null;
      shotsOnGoal: number | null;
      corners: number | null;
      attacks: number | null;
      dangerousAttacks: number | null;
    };
    away: {
      possession: number | null;
      totalShots: number | null;
      shotsOnGoal: number | null;
      corners: number | null;
      attacks: number | null;
      dangerousAttacks: number | null;
    };
    rawAvailableStats: string[];
  } {
    return {
      available: false,
      source: 'none',
      home: { possession: null, totalShots: null, shotsOnGoal: null, corners: null, attacks: null, dangerousAttacks: null },
      away: { possession: null, totalShots: null, shotsOnGoal: null, corners: null, attacks: null, dangerousAttacks: null },
      rawAvailableStats: [],
    };
  }

  private buildStatisticsSummary(statistics: any) {
    const summary = this.emptyStatisticsSummary();
    if (!statistics) return summary;

    const teams = Array.isArray(statistics?.teams) ? statistics.teams : Array.isArray(statistics?.response) ? statistics.response : [];
    const homeRows = this.extractStatisticRows(teams?.[0]);
    const awayRows = this.extractStatisticRows(teams?.[1]);

    const read = (rows: any[], names: string[]) => {
      for (const row of rows) {
        const type = this.normalizeStatLabel(row?.type || row?.name || row?.label || row?.key);
        if (!names.some((name) => type.includes(name))) continue;
        const value = this.toStatNumber(row?.value ?? row?.display ?? row?.stat);
        if (value !== null && value !== undefined) return value;
      }
      return null;
    };

    summary.home.possession = read(homeRows, ['ball possession', 'possession', 'posse']);
    summary.away.possession = read(awayRows, ['ball possession', 'possession', 'posse']);
    summary.home.totalShots = read(homeRows, ['total shots', 'shots', 'finalizacoes']);
    summary.away.totalShots = read(awayRows, ['total shots', 'shots', 'finalizacoes']);
    summary.home.shotsOnGoal = read(homeRows, ['shots on goal', 'shots on target', 'chutes no gol']);
    summary.away.shotsOnGoal = read(awayRows, ['shots on goal', 'shots on target', 'chutes no gol']);
    summary.home.corners = read(homeRows, ['corner kicks', 'corners', 'escanteios']);
    summary.away.corners = read(awayRows, ['corner kicks', 'corners', 'escanteios']);
    summary.home.attacks = read(homeRows, ['attacks', 'ataques']);
    summary.away.attacks = read(awayRows, ['attacks', 'ataques']);
    summary.home.dangerousAttacks = read(homeRows, ['dangerous attacks', 'ataques perigosos']);
    summary.away.dangerousAttacks = read(awayRows, ['dangerous attacks', 'ataques perigosos']);

    summary.available = [
      summary.home.possession, summary.away.possession, summary.home.totalShots, summary.away.totalShots,
      summary.home.shotsOnGoal, summary.away.shotsOnGoal, summary.home.corners, summary.away.corners,
      summary.home.attacks, summary.away.attacks, summary.home.dangerousAttacks, summary.away.dangerousAttacks,
    ].some((value) => value !== null && value !== undefined);

    summary.source = statistics?.source || 'flashscore';
    summary.rawAvailableStats = [...homeRows, ...awayRows].map((row: any) => row?.type || row?.name || row?.label || row?.key).filter(Boolean).slice(0, 20);
    return summary;
  }

  private extractStatisticRows(teamStats: any): any[] {
    if (!teamStats) return [];
    if (Array.isArray(teamStats)) return teamStats;
    if (Array.isArray(teamStats?.statistics)) return teamStats.statistics;
    if (Array.isArray(teamStats?.stats)) return teamStats.stats;
    if (Array.isArray(teamStats?.items)) return teamStats.items;
    if (Array.isArray(teamStats?.rows)) return teamStats.rows;
    return [];
  }

  private normalizeStatLabel(value: any) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private toStatNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(String(value).replace(',', '.').replace('%', '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private buildPressureSummary(statisticsSummary: any, fixture: any) {
    if (!statisticsSummary?.available) {
      return { available: false, leader: null, homeScore: 0, awayScore: 0, homeLevel: 'BAIXA', awayLevel: 'BAIXA', reading: 'Sem estatísticas reais suficientes para medir pressão.' };
    }

    const score = (team: any) => Number(((Number(team.possession || 0) * 0.25) + (Number(team.totalShots || 0) * 3) + (Number(team.shotsOnGoal || 0) * 7) + (Number(team.corners || 0) * 4) + (Number(team.attacks || 0) * 0.15) + (Number(team.dangerousAttacks || 0) * 0.45)).toFixed(1));
    const homeScore = score(statisticsSummary.home || {});
    const awayScore = score(statisticsSummary.away || {});
    const homeName = fixture?.teams?.home?.name || 'Mandante';
    const awayName = fixture?.teams?.away?.name || 'Visitante';
    const diff = Math.abs(homeScore - awayScore);
    const leader = diff < 8 ? 'equilibrado' : homeScore > awayScore ? homeName : awayName;
    const level = (value: number) => value >= 85 ? 'MUITO ALTA' : value >= 65 ? 'ALTA' : value >= 42 ? 'MÉDIA' : 'BAIXA';

    return {
      available: true,
      leader,
      homeScore,
      awayScore,
      homeLevel: level(homeScore),
      awayLevel: level(awayScore),
      reading: leader === 'equilibrado' ? 'Jogo equilibrado em pressão pelos dados disponíveis.' : `${leader} tem maior pressão pelos dados ao vivo.`,
    };
  }

  private extractFixtureOdds(fixture: any) {
    if (!fixture) return null;

    return (
      this.readLoose(fixture, ['odds']) ||
      this.readLoose(fixture, ['odd']) ||
      this.readLoose(fixture, ['cotacoes']) ||
      this.readLoose(fixture, ['cotações']) ||
      this.readLoose(fixture, ['matchOdds']) ||
      this.readLoose(fixture, ['prematchOdds']) ||
      null
    );
  }

  private readLoose(obj: any, keys: string[]) {
    if (!obj || typeof obj !== 'object') return undefined;

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    }

    const normalizedTargets = new Set(
      keys.map((key) =>
        String(key)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, ''),
      ),
    );

    for (const [rawKey, value] of Object.entries(obj)) {
      const normalizedKey = String(rawKey)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

      if (normalizedTargets.has(normalizedKey) && value !== undefined && value !== null && value !== '') {
        return value;
      }
    }

    return undefined;
  }

  private buildOddsSummary(odds: any) {
    const options = this.extractOddsOptions(odds);
    if (!options.length) return { available: false, source: 'none', market: null, options: [], reading: 'Odds não validadas.' };

    return {
      available: true,
      source: this.readLoose(odds, ['source', 'fonte', 'provider']) || this.readLoose(odds, ['bookmaker', 'casa de apostas']) || 'football-provider',
      market: this.readLoose(odds, ['market', 'marketName', 'mercado']) || '1X2',
      bookmaker: this.readLoose(odds, ['bookmaker', 'casa de apostas']) || this.readLoose(odds, ['source', 'fonte']) || null,
      options,
      reading: 'Odds validadas por provider/fonte integrada.',
    };
  }

  private extractOddsOptions(input: any): Array<{ name: string; odd: number }> {
    if (!input) return [];

    const directCandidates = [
      this.readLoose(input, ['options', 'opções', 'opcoes', 'selections', 'outcomes']),
      Array.isArray(input) ? input : null,
    ];

    for (const direct of directCandidates) {
      if (!Array.isArray(direct)) continue;

      const normalized: Array<{ name: string; odd: number }> = direct
        .map((item: any) => {
          const name = String(this.readLoose(item, ['name', 'nome', 'label', 'selection', 'market', 'mercado']) || '').trim();
          const odd = this.toOddNumber(this.readLoose(item, ['odd', 'odds', 'value', 'price', 'cotacao', 'cotação']));
          return { name, odd };
        })
        .filter((item: { name: string; odd: number | null }): item is { name: string; odd: number } => {
          return !!item.name && typeof item.odd === 'number' && Number.isFinite(item.odd) && item.odd > 1;
        });

      if (normalized.length) return normalized.slice(0, 12);
    }

    const fallback: Array<{ name: string; odd: number }> = [];
    const add = (name: string, value: any) => { const odd = this.toOddNumber(value); if (odd && odd > 1) fallback.push({ name, odd }); };
    add('1', this.readLoose(input, ['home', 'homeWin', 'casa', 'mandante', '1']));
    add('X', this.readLoose(input, ['draw', 'empate', 'x', 'X']));
    add('2', this.readLoose(input, ['away', 'awayWin', 'fora', 'visitante', '2']));
    add('Over 1.5', this.readLoose(input, ['over15', 'over_1_5', 'over 1.5']));
    add('Over 2.5', this.readLoose(input, ['over25', 'over_2_5', 'over 2.5']));
    add('BTTS', this.readLoose(input, ['btts', 'bothTeamsScore', 'ambas marcam']));
    return fallback.slice(0, 12);
  }

  private toOddNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) && value > 1 ? Number(value.toFixed(2)) : null;
    const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 1 ? Number(parsed.toFixed(2)) : null;
  }

  private asksForLineup(message: string) {
    const text = this.normalize(message);
    return this.hasAny(text, [
      'escalação',
      'escalacao',
      'provavel escalação',
      'provavel escalacao',
      'prováveis titulares',
      'provaveis titulares',
      'time titular',
      'lineup',
      'lineups',
      'starting xi',
      'titulares',
      'desfalques',
    ]);
  }

  private mentionsToday(message: string) {
    const text = this.normalize(message);
    return this.hasAny(text, ['hoje', 'agora', 'de hoje', 'pra hoje', 'para hoje', 'today']);
  }

  private extractLineupTeamQuery(message: string) {
    const normalized = this.normalize(message);
    const commonTeams: Record<string, string> = {
      'selecao brasileira': 'Brazil',
      'seleção brasileira': 'Brazil',
      brasil: 'Brazil',
      brazil: 'Brazil',
      argentina: 'Argentina',
      franca: 'France',
      france: 'France',
      espanha: 'Spain',
      spain: 'Spain',
      inglaterra: 'England',
      england: 'England',
      alemanha: 'Germany',
      germany: 'Germany',
      escocia: 'Scotland',
      scotland: 'Scotland',
      suica: 'Switzerland',
      switzerland: 'Switzerland',
      marrocos: 'Morocco',
      morocco: 'Morocco',
      haiti: 'Haiti',
      canada: 'Canada',
      qatar: 'Qatar',
      catar: 'Qatar',
      flamengo: 'Flamengo',
      palmeiras: 'Palmeiras',
      corinthians: 'Corinthians',
      vasco: 'Vasco',
      botafogo: 'Botafogo',
      fluminense: 'Fluminense',
    };

    // Primeiro tenta entidades conhecidas. Isso evita o bug antigo que removia letras
    // soltas de palavras como "Brasil" e gerava consultas quebradas tipo "br sil".
    for (const [key, value] of Object.entries(commonTeams).sort((a, b) => b[0].length - a[0].length)) {
      if (normalized.includes(this.normalize(key))) return value;
    }

    const text = String(message || '')
      .replace(/[?!.:,;]+/g, ' ')
      .replace(/(?:qual|quais|quem|seria|sera|será|tem|vai|vai ser|e|é|a|o|os|as|do|da|dos|das|de|para|pra|hoje|agora|time|titular|escalação|escalacao|provavel|provável|provaveis|prováveis|titulares|lineup|lineups|starting|xi|desfalques|seleção|selecao)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return this.cleanTeamName(text);
  }

  private findFixtureByTeam(fixtures: any[], teamQuery: string) {
    const aliases = this.buildTeamSearchAliases(teamQuery);
    if (!aliases.length) return null;

    const candidates = this.sortFixturesByLivePriority(this.uniqueFixtures(fixtures || []));

    return candidates.find((game: any) => {
      const homeAliases = this.buildTeamSearchAliases(this.getFixtureHomeName(game));
      const awayAliases = this.buildTeamSearchAliases(this.getFixtureAwayName(game));
      return this.teamAliasMatch(aliases, homeAliases) || this.teamAliasMatch(aliases, awayAliases);
    }) || null;
  }

  private getFlashScoreMatchId(fixtureId: string, fixture: any) {
    return String(
      fixture?.fixture?.externalId ||
        fixture?.fixture?.external_id ||
        fixture?.fixture?.matchId ||
        fixture?.fixture?.match_id ||
        fixture?.flashScoreRaw?.match_id ||
        fixture?.flashScoreRaw?.id ||
        fixture?.externalId ||
        fixtureId ||
        '',
    ).trim();
  }

  private todayIso(timeZone = 'America/Sao_Paulo') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
  }

  private shiftIsoDate(baseIso: string, days: number) {
    const date = new Date(`${baseIso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private safeJsonSample(value: any, maxLength = 5000) {
    if (!value) return null;
    try {
      const json = JSON.stringify(value, null, 2);
      return json.length > maxLength ? `${json.slice(0, maxLength)}\n...TRUNCADO...` : json;
    } catch {
      return String(value).slice(0, maxLength);
    }
  }

  private asksForCup(message: string) {
    const text = this.normalize(message);

    return this.hasAny(text, [
      'copa',
      'mundial',
      'world cup',
      'club world cup',
      'fifa',
      'copa do mundo',
      'mundial de clubes',
    ]);
  }

  private isCupCompetition(game: any) {
    const simple = this.simplifyFixture(game);
    const league = this.normalize(simple.league || '');
    const country = this.normalize(simple.country || '');

    const haystack = `${league} ${country}`;

    return [
      'world cup',
      'fifa world cup',
      'club world cup',
      'fifa club world cup',
      'copa do mundo',
      'mundial de clubes',
      'fifa',
      'world',
      'cup',
    ].some((term) => haystack.includes(this.normalize(term)));
  }

  private sortFixtures(fixtures: any[]) {
    return fixtures.sort((a, b) => {
      const aSimple = this.simplifyFixture(a);
      const bSimple = this.simplifyFixture(b);

      const aCup = this.isCupCompetition(a) ? 1 : 0;
      const bCup = this.isCupCompetition(b) ? 1 : 0;

      if (aCup !== bCup) return bCup - aCup;

      const aDate = new Date(aSimple.date || 0).getTime();
      const bDate = new Date(bSimple.date || 0).getTime();

      return aDate - bDate;
    });
  }

  private formatFixturesList(fixtures: any[], title: string) {
    const lines = fixtures.slice(0, 18).map((game: any, index: number) => {
      const simple = this.simplifyFixture(game);
      const home = simple.home || 'Casa';
      const away = simple.away || 'Fora';
      const league = simple.league || 'Liga não informada';
      const status = simple.status?.elapsed ? `${simple.status.elapsed}'` : simple.status?.short || 'NS';
      const homeGoals = simple.goals?.home ?? 0;
      const awayGoals = simple.goals?.away ?? 0;

      return `${index + 1}. ${home} ${homeGoals} x ${awayGoals} ${away} (${status})\n   🏆 ${league}`;
    });

    return `${title}:\n\n${lines.join('\n\n')}`;
  }

  private localTopPick(candidates: any[]) {
    const top = candidates[0];

    if (!top) {
      return '🎯 Não encontrei jogos suficientes para apontar a melhor entrada hoje.';
    }

    return `🏆 Melhor oportunidade observada

⚽ ${top.game}
🏆 ${top.league || 'Liga não informada'}
📊 Confiança Oddix: ${top.score}%
🎯 Status: ${top.officialEntry ? 'Entrada oficial possível' : 'Observação, sem entrada oficial'}

⚠️ Sem odds reais e estatísticas completas, eu não cravo aposta oficial.`;
  }

  private localMultiple(candidates: any[]) {
    const picks = candidates.slice(0, 3);

    if (!picks.length) {
      return '🎫 Não encontrei jogos suficientes para montar múltipla hoje.';
    }

    return `🎫 Múltipla Oddix observada

${picks.map((pick, index) => `${index + 1}. ${pick.game}\n   Confiança: ${pick.score}% | ${pick.officialEntry ? 'dados mínimos OK' : 'dados pendentes'}`).join('\n\n')}

⚠️ Sem odds reais completas, trate como pré-lista de observação, não como entrada oficial.`;
  }

  private localMatchAnalysis(match: any, richContext: any) {
    const simple = this.simplifyFixture(match);
    const home = simple.home || 'Casa';
    const away = simple.away || 'Fora';
    const league = simple.league || 'Liga não informada';
    const status = simple.status?.elapsed ? `${simple.status.elapsed}'` : simple.status?.short || 'NS';
    const homeGoals = simple.goals?.home ?? 0;
    const awayGoals = simple.goals?.away ?? 0;

    return `⚽ ${home} x ${away}

🏆 ${league}
⏱️ Status: ${status}
📊 Placar: ${homeGoals} x ${awayGoals}

📌 Contexto real:
${richContext?.statistics || richContext?.prematchStats ? '✅ Estatísticas disponíveis' : '⚠️ Estatísticas pendentes'}
${richContext?.odds ? '✅ Odds disponíveis' : '⚠️ Odds pendentes'}
${richContext?.h2h ? '✅ H2H disponível' : '⚠️ H2H pendente'}
${richContext?.lineups ? '✅ Escalações disponíveis' : '⚠️ Escalações pendentes'}

🧠 Conclusão Oddix:
Sem odds reais e estatísticas completas, não libero entrada oficial.`;
  }

  private extractFixtureArray(response: any) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.fixtures)) return response.fixtures;
    if (Array.isArray(response?.games)) return response.games;
    if (Array.isArray(response?.matches)) return response.matches;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.response)) return response.response;
    return [];
  }

  private uniqueFixtures(fixtures: any[]) {
    const seen = new Set<string>();

    return fixtures.filter((game: any) => {
      const simple = this.simplifyFixture(game);
      const id = String(simple.id || `${simple.home}-${simple.away}-${simple.date}`);

      if (!simple.home || !simple.away) return false;
      if (seen.has(id)) return false;

      seen.add(id);
      return true;
    });
  }

  private cleanTeamName(value: string) {
    return String(value || '')
      .replace(/\b\d+\b/g, '')
      .replace(/\bao vivo\b/gi, '')
      .replace(/\blive\b/gi, '')
      .replace(/\bhoje\b/gi, '')
      .replace(/\bagora\b/gi, '')
      .replace(/[?!.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasAny(text: string, terms: string[]) {
    return terms.some((term) => text.includes(this.normalize(term)));
  }

  private normalize(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
