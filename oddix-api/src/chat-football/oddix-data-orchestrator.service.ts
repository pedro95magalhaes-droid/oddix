import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import { FootballResearchService, ResearchResult } from './football-research.service';
import { OddixLlmService, OddixLlmMessage } from './oddix-llm.service';
import { OddixBrainService, OddixBrainDecision } from './oddix-brain.service';

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
    @Optional() private readonly researchService?: FootballResearchService,
    @Optional() private readonly llmService?: OddixLlmService,
    @Optional() private readonly brainService?: OddixBrainService,
  ) {}

  async answer(message: string, sessionId = 'anonymous'): Promise<OddixDataOrchestratorResponse> {
    const decision =
      (await this.brainService?.think(message, sessionId).catch(() => null)) ||
      this.localDecision(message);

    try {
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
        const teams = this.extractTeams(message, decision);
        if (teams) return this.answerMatchQuestion(message, teams.home, teams.away, decision);
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
    const research = await this.runResearch(message, decision);
    let fixtures = await this.getTodayFixtures();

    if (this.asksForCup(message)) {
      const cupFixtures = fixtures.filter((game) => this.isCupCompetition(game));

      if (cupFixtures.length) {
        fixtures = cupFixtures;
      }
    }

    if (!fixtures.length) {
      const researchAnswer = await this.answerFromResearchOnly(message, research, decision, 'jogos de hoje');
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer:
          '⚽ Não encontrei jogos reais confirmados na base Oddix nem consegui validar pela pesquisa em tempo real agora. Não vou inventar partidas.',
        data: {
          waitingForData: true,
          fixtures: [],
          research,
          decision,
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
Se a pergunta mencionar Copa/Mundial/FIFA, liste apenas jogos de competições com Copa/World Cup/FIFA/Mundial/Club World Cup quando existirem.
Não invente partidas.
Se não houver Copa nos dados filtrados, diga que a base não confirmou jogos de Copa/Mundial hoje.`,
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
      const researchAnswer = await this.answerFromResearchOnly(message, research, decision, 'jogos ao vivo');
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer:
          '⚡ Não encontrei jogos ao vivo/ativos na base Oddix nem consegui validar pela pesquisa em tempo real agora. Não vou inventar placar.',
        data: {
          waitingForData: true,
          fixtures: [],
          research,
          decision,
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
    if (!this.researchService) return null;
    if (!this.shouldResearch(decision, message) && !forcedQuery) return null;

    const query = this.buildResearchQuery(message, decision, forcedQuery);

    try {
      return await this.researchService.search(query);
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
    ]);
  }

  private buildResearchQuery(
    message: string,
    decision?: OddixBrainDecision,
    forcedQuery?: string,
  ) {
    const base = this.cleanResearchQuery(forcedQuery || message);
    const intent = decision?.intent || 'GENERAL';

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

  private async humanizeWithDeepSeek(userMessage: string, realContext: string, instruction: string) {
    if (!this.llmService?.isEnabled()) return null;

    const messages: OddixLlmMessage[] = [
      {
        role: 'system',
        content:
          'Você é a IA Oddix Chat V13. Responda em português do Brasil, natural, direto e inteligente. Nunca invente dados atuais. Para futebol, use somente dados reais fornecidos pela pesquisa web e pelas APIs do backend. Se faltar dado, diga claramente.',
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
    if (!this.footballService) return [];

    const today = new Date().toISOString().slice(0, 10);
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

    const allFixtures: any[] = [];

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
    if (!this.footballService) return [];

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
        if (fixtures.length) return this.uniqueFixtures(fixtures).slice(0, 50);
      } catch {}
    }

    return [];
  }

  private async getFixturesWindow(daysBack = 3, daysForward = 7) {
    if (!this.footballService) return [];

    const dates: string[] = [];
    const now = new Date();

    for (let i = -daysBack; i <= daysForward; i += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }

    const all: any[] = [];

    for (const date of dates) {
      try {
        const response =
          typeof (this.footballService as any).getFixtures === 'function'
            ? await (this.footballService as any).getFixtures(date)
            : null;

        all.push(...this.extractFixtureArray(response));
      } catch {}
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
    if (!fixtureId || !this.footballService) return null;

    const service: any = this.footballService as any;
    const provider = String(fixture?.provider || fixture?.source || '').toLowerCase();
    const isFlashScoreFixture = provider.includes('flashscore') || !!fixture?.flashScoreRaw;

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
    let intent: any = 'GENERAL';

    if (this.hasAny(text, ['jogos de hoje', 'quais jogos', 'copa hoje', 'jogos da copa'])) intent = 'TODAY_GAMES';
    if (this.hasAny(text, ['ao vivo', 'live', 'placar'])) intent = 'LIVE';
    if (this.hasAny(text, ['melhor entrada', 'maior confianca', 'maior confiança', 'top pick', 'o que apostar'])) intent = 'TOP_PICKS';
    if (this.extractTeams(message, null)) intent = 'MATCH_ANALYSIS';

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

  private extractTeams(message: string, decision?: OddixBrainDecision | null): { home: string; away: string } | null {
    if (decision?.entities?.homeTeam && decision?.entities?.awayTeam) {
      return {
        home: this.cleanTeamName(decision.entities.homeTeam),
        away: this.cleanTeamName(decision.entities.awayTeam),
      };
    }

    const sanitized = String(message || '')
      .replace(/[–—]/g, ' ')
      .replace(/\b\d+\s*x\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*-\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*:\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\b/g, ' ')
      .replace(/analisa|analisar|analise|análise/gi, '')
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
      croacia: ['croácia', 'croatia', 'hrvatska'],
      croatia: ['croacia', 'croácia', 'hrvatska'],
      hrvatska: ['croacia', 'croatia'],
      panama: ['panamá', 'panama'],
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
    };

    for (const alias of aliasMap[base] || []) {
      aliases.add(this.normalize(alias));
    }

    for (const [key, values] of Object.entries(aliasMap)) {
      if (values.includes(base)) aliases.add(this.normalize(key));
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
