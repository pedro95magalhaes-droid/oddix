import { Injectable, Logger, Optional } from "@nestjs/common";
import { FootballService } from "../football/football.service";
import {
  FootballResearchService,
  ResearchResult,
  WebOddsResult,
} from "./football-research.service";
import { OddixLlmService, OddixLlmMessage } from "./oddix-llm.service";
import { OddixBrainService, OddixBrainDecision } from "./oddix-brain.service";

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

  async answer(
    message: string,
    sessionId = "anonymous",
  ): Promise<OddixDataOrchestratorResponse> {
    const decision =
      (await this.brainService?.think(message, sessionId).catch(() => null)) ||
      this.localDecision(message);

    try {
      if (decision.intent === "GENERAL") {
        if (this.shouldResearch(decision, message)) {
          return this.answerGeneralFootball(message, decision);
        }

        return this.answerGeneral(message);
      }

      if (decision.intent === "LIVE") {
        return this.answerLiveGames(message, decision);
      }

      if (decision.intent === "TODAY_GAMES") {
        return this.answerTodayGames(message, decision);
      }

      if (decision.intent === "TOP_PICKS") {
        return this.answerTopPicks(message, decision);
      }

      if (decision.intent === "MATCH_ANALYSIS") {
        const teams = this.extractTeams(message, decision);
        if (teams)
          return this.answerMatchQuestion(
            message,
            teams.home,
            teams.away,
            decision,
          );
        return this.answerTodayGames(message, decision);
      }

      if (decision.intent === "MULTIPLE") {
        return this.answerMultiple(message, decision);
      }

      if (decision.intent === "FOLLOW_UP") {
        return this.answerFollowUp(message, decision);
      }

      if (
        [
          "TEAM",
          "NEWS",
          "PLAYER",
          "VALUE_BETS",
          "VIRTUAL",
          "EXPLAIN",
          "BANKROLL",
        ].includes(decision.intent)
      ) {
        return this.answerGeneralFootball(message, decision);
      }

      return this.answerGeneral(message);
    } catch (error: any) {
      this.logger.warn(
        `[ODDIX_ORCHESTRATOR] falhou: ${error?.message || error}`,
      );

      return {
        handled: true,
        answer:
          "⚠️ Tentei buscar dados reais agora, mas não consegui validar a base Oddix neste momento. Não vou inventar jogos, odds ou estatísticas.",
        data: {
          waitingForData: true,
          error: error?.message || "orchestrator_failed",
          decision,
        },
      };
    }
  }

  private async answerGeneral(
    message: string,
  ): Promise<OddixDataOrchestratorResponse> {
    const answer = await this.humanizeWithDeepSeek(
      message,
      "Pergunta geral, sem necessidade obrigatória de dados atuais de futebol.",
      `Responda como um assistente inteligente e natural.
Se a pergunta for sobre apostas ou jogos atuais, avise que precisa consultar a base Oddix.
Se for conhecimento geral, responda normalmente.`,
    );

    return {
      handled: true,
      answer:
        answer ||
        "Posso te ajudar com futebol, apostas, análise de jogos, múltiplas, gestão de banca ou perguntas gerais. Me diga o que você quer analisar.",
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
        todayFixtures: fixtures
          .slice(0, 20)
          .map((fixture) => this.simplifyFixture(fixture)),
        rule: "Use primeiro a pesquisa web quando a pergunta pedir informação factual atual. Use os jogos das APIs somente se forem relevantes. Se faltar dado, diga claramente.",
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      "Responda de forma natural, como ChatGPT. Para informação factual atual, use a pesquisa web e/ou APIs fornecidas. Não invente dado fora do contexto.",
    );

    return {
      handled: true,
      answer:
        answer ||
        "Não consegui montar uma resposta completa com dados reais agora.",
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
      const cupFixtures = fixtures.filter((game) =>
        this.isCupCompetition(game),
      );

      if (cupFixtures.length) {
        fixtures = cupFixtures;
      }
    }

    if (!fixtures.length) {
      const researchAnswer = await this.answerFromResearchOnly(
        message,
        research,
        decision,
        "jogos de hoje",
      );
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer:
          "⚽ Não encontrei jogos reais confirmados na base Oddix nem consegui validar pela pesquisa em tempo real agora. Não vou inventar partidas.",
        data: {
          waitingForData: true,
          fixtures: [],
          research,
          decision,
        },
        suggestions: [
          "Mostrar jogos ao vivo",
          "Top Picks de hoje",
          "Analisar um jogo específico",
        ],
      };
    }

    const context = this.buildFixturesContext(
      fixtures,
      "jogos de hoje",
      decision,
      research,
    );
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
      answer:
        answer ||
        this.formatFixturesList(
          fixtures,
          "⚽ Jogos encontrados hoje na base Oddix",
        ),
      data: {
        fixtures,
        research,
        decision,
      },
      suggestions: fixtures.slice(0, 4).map((game: any) => {
        const home = game?.teams?.home?.name || game?.homeTeam || "Casa";
        const away = game?.teams?.away?.name || game?.awayTeam || "Fora";
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
      const researchAnswer = await this.answerFromResearchOnly(
        message,
        research,
        decision,
        "jogos ao vivo",
      );
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer:
          "⚡ Não encontrei jogos ao vivo/ativos na base Oddix nem consegui validar pela pesquisa em tempo real agora. Não vou inventar placar.",
        data: {
          waitingForData: true,
          fixtures: [],
          research,
          decision,
        },
        suggestions: [
          "Mostrar jogos de hoje",
          "Top Picks de hoje",
          "Analisar um jogo específico",
        ],
      };
    }

    const context = this.buildFixturesContext(
      fixtures,
      "jogos ao vivo",
      decision,
      research,
    );
    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      "Liste os jogos ao vivo encontrados usando apenas os dados fornecidos. Inclua placar, minuto/status e competição quando disponível. Não invente partidas.",
    );

    return {
      handled: true,
      answer:
        answer ||
        this.formatFixturesList(
          fixtures,
          "⚡ Jogos ao vivo/ativos na base Oddix",
        ),
      data: {
        fixtures,
        research,
        decision,
      },
      suggestions: fixtures.slice(0, 4).map((game: any) => {
        const home = game?.teams?.home?.name || game?.homeTeam || "Casa";
        const away = game?.teams?.away?.name || game?.awayTeam || "Fora";
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
          "🎯 Não encontrei jogos suficientes na base Oddix para escolher uma entrada de confiança hoje.\n\nSem jogo real, odds e estatísticas mínimas, não vou inventar aposta.",
        data: { waitingForData: true, fixtures: [], research, decision },
      };
    }

    const enriched = await this.enrichFixtures(fixtures.slice(0, 10));
    const candidates = enriched
      .map((item) => this.scoreCandidate(item))
      .sort((a, b) => b.score - a.score);

    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        research,
        candidates: candidates.slice(0, 8),
        rule: "Escolha a melhor entrada apenas se houver dados suficientes. Sem odds reais ou estatísticas completas, deixe como observação, não como entrada oficial.",
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
      suggestions: [
        "Monte uma múltipla segura",
        "Quero uma opção mais agressiva",
        "Quanto ganho com R$50?",
      ],
    };
  }

  private async answerMultiple(
    message: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const research = await this.runResearch(message, decision);
    const fixtures = await this.getTodayFixtures();
    const enriched = await this.enrichFixtures(fixtures.slice(0, 12));
    const candidates = enriched
      .map((item) => this.scoreCandidate(item))
      .sort((a, b) => b.score - a.score);

    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        research,
        candidates: candidates.slice(0, 10),
        rule: "Monte múltipla somente com jogos reais fornecidos. Se faltar odds reais, apresente como sugestão observada sem entrada oficial.",
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
        rule: "É uma continuação de conversa. Use o contexto salvo pelo Brain quando houver. Se faltar contexto, peça o jogo novamente.",
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      "Responda como continuação natural. Se a pergunta depender de jogo anterior e ele não estiver nos dados, peça o confronto novamente.",
    );

    return {
      handled: true,
      answer:
        answer ||
        "Me manda novamente o jogo ou bilhete para eu continuar a análise com segurança.",
      data: { decision },
    };
  }

  private async answerMatchQuestion(
    message: string,
    homeQuery: string,
    awayQuery: string,
    decision?: OddixBrainDecision,
  ): Promise<OddixDataOrchestratorResponse> {
    const research = await this.runResearch(
      message,
      decision,
      `${homeQuery} x ${awayQuery}`,
    );
    const fixtures = await this.getFixturesWindow(3, 7);
    const match = this.findMatch(fixtures, homeQuery, awayQuery);

    if (!match) {
      const researchAnswer = await this.answerFromResearchOnly(
        message,
        research,
        decision,
        `${homeQuery} x ${awayQuery}`,
      );
      if (researchAnswer) return researchAnswer;

      return {
        handled: true,
        answer: `⚽ Procurei ${homeQuery} x ${awayQuery} na base Oddix e na pesquisa em tempo real, mas não consegui confirmar dados suficientes.\n\nSem partida real, odds e estatísticas, não libero análise nem entrada oficial.`,
        data: {
          waitingForData: true,
          homeQuery,
          awayQuery,
          research,
          decision,
        },
        suggestions: [
          "Mostrar jogos de hoje",
          "Mostrar jogos ao vivo",
          "Top Picks de hoje",
        ],
      };
    }

    const fixtureId = String(match?.fixture?.id || match?.id || "");
    const richContext = await this.getRichContext(fixtureId, match);
    const webOdds = await this.getWebOddsFallback(
      homeQuery,
      awayQuery,
      richContext,
      research,
    );

    const context = JSON.stringify(
      {
        pergunta: message,
        decision,
        jogo: this.simplifyFixture(match),
        research,
        webOdds,
        contextoRico: this.simplifyRichContext(richContext),
        regra:
          "Use dados reais da API e, quando odds da API faltarem, use webOdds somente se found=true. Se odds não existirem em API nem webOdds, bloqueie entrada oficial. Nunca invente mercado ou odd.",
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

Nunca invente odds, estatísticas, escalações ou resultado. Se faltar odd real em API e webOdds, bloqueie entrada oficial. Se usar webOdds, avise para confirmar a cotação na casa de apostas.`,
    );

    return {
      handled: true,
      answer: answer || this.localMatchAnalysis(match, richContext, webOdds),
      data: {
        fixture: match,
        richContext,
        research,
        webOdds,
        waitingForData: !richContext?.ok && !webOdds?.found,
        decision,
      },
      suggestions: [
        "Esse jogo presta?",
        "Me dá uma opção segura",
        "Monte uma múltipla",
        "Quanto ganho com R$50?",
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
        summary: `Pesquisa em tempo real falhou: ${error?.message || "erro desconhecido"}`,
      };
    }
  }

  private shouldResearch(
    decision: OddixBrainDecision | undefined,
    message: string,
  ) {
    const intent = decision?.intent || "GENERAL";
    const text = this.normalize(message);

    const researchIntents = new Set([
      "TODAY_GAMES",
      "LIVE",
      "NEWS",
      "TEAM",
      "PLAYER",
      "MATCH_ANALYSIS",
      "TOP_PICKS",
      "MULTIPLE",
      "VALUE_BETS",
      "FOLLOW_UP",
    ]);

    if (researchIntents.has(intent)) return true;

    return this.hasAny(text, [
      "hoje",
      "agora",
      "ao vivo",
      "jogos",
      "classificacao",
      "classificação",
      "tabela",
      "escalação",
      "escalacao",
      "noticia",
      "notícia",
      "lesao",
      "lesão",
      "desfalque",
      "copa",
      "mundial",
      "world cup",
      "fifa",
      "resultado",
      "proximo jogo",
      "próximo jogo",
    ]);
  }

  private buildResearchQuery(
    message: string,
    decision?: OddixBrainDecision,
    forcedQuery?: string,
  ) {
    const base = this.cleanResearchQuery(forcedQuery || message);
    const intent = decision?.intent || "GENERAL";

    if (intent === "TODAY_GAMES")
      return `${base} futebol jogos hoje calendário partidas oficiais`;
    if (intent === "LIVE") return `${base} futebol ao vivo placar agora status`;
    if (intent === "NEWS")
      return `${base} futebol notícias escalações lesões desfalques hoje`;
    if (intent === "TEAM")
      return `${base} futebol próximos jogos classificação notícias elenco`;
    if (intent === "PLAYER")
      return `${base} jogador futebol notícias escalação estatísticas`;
    if (intent === "MATCH_ANALYSIS")
      return `${base} futebol escalações estatísticas odds notícias`;
    if (intent === "TOP_PICKS" || intent === "MULTIPLE")
      return `${base} futebol jogos hoje odds estatísticas calendário`;

    return `${base} futebol notícias jogos hoje`;
  }

  private cleanResearchQuery(value: string) {
    return String(value || "")
      .replace(/[\n\r\t]+/g, " ")
      .replace(/\s+/g, " ")
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
        rule: "A API de futebol não retornou dados, mas a pesquisa web retornou fontes. Use somente títulos, descrições e fontes abaixo. Não crie placares, odds, escalações ou horários que não estejam explícitos.",
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
        "Mostrar jogos de hoje",
        "Ver jogos ao vivo",
        "Analisar um jogo específico",
      ],
    };
  }

  private async humanizeWithDeepSeek(
    userMessage: string,
    realContext: string,
    instruction: string,
  ) {
    if (!this.llmService?.isEnabled()) return null;

    const messages: OddixLlmMessage[] = [
      {
        role: "system",
        content:
          "Você é a IA Oddix Chat V13. Responda em português do Brasil, natural, direto e inteligente. Nunca invente dados atuais. Para futebol, use somente dados reais fornecidos pela pesquisa web e pelas APIs do backend. Se faltar dado, diga claramente.",
      },
      {
        role: "user",
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
      { name: "getFixtures", call: () => service.getFixtures?.(today) },
      { name: "getTodayFixtures", call: () => service.getTodayFixtures?.() },
      { name: "getTodayMatches", call: () => service.getTodayMatches?.() },
      {
        name: "getMatchesByDate",
        call: () => service.getMatchesByDate?.(today),
      },
      {
        name: "getFlashScoreToday",
        call: () => service.getFlashScoreToday?.(),
      },
      {
        name: "getFlashScoreFixtures",
        call: () => service.getFlashScoreFixtures?.(today),
      },
      {
        name: "getFlashScoreMatches",
        call: () => service.getFlashScoreMatches?.(today),
      },
      {
        name: "getAllTodayFixtures",
        call: () => service.getAllTodayFixtures?.(),
      },
    ];

    const allFixtures: any[] = [];

    for (const method of methods) {
      try {
        const response = await method.call();
        const fixtures = this.extractFixtureArray(response);

        if (fixtures.length) {
          this.logger.log(
            `[ODDIX_ORCHESTRATOR] ${method.name} retornou ${fixtures.length} jogos`,
          );
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
          typeof (this.footballService as any).getFixtures === "function"
            ? await (this.footballService as any).getFixtures(date)
            : null;

        all.push(...this.extractFixtureArray(response));
      } catch {}
    }

    return this.uniqueFixtures(all);
  }

  private async enrichFixtures(fixtures: any[]) {
    const enriched: any[] = [];

    for (const fixture of fixtures) {
      const id = String(fixture?.fixture?.id || fixture?.id || "");
      const rich = id
        ? await this.getRichContext(id, fixture).catch(() => null)
        : null;
      const simple = this.simplifyFixture(fixture);
      const webOdds = await this.getWebOddsFallback(
        simple.home,
        simple.away,
        rich,
        null,
      );
      enriched.push({ fixture, rich, webOdds });
    }

    return enriched;
  }

  private async getRichContext(fixtureId: string, fixture: any) {
    if (!fixtureId || !this.footballService) return null;

    const service: any = this.footballService as any;

    if (typeof service.getFlashScoreRichContext === "function") {
      const externalId =
        fixture?.fixture?.externalId ||
        fixture?.fixture?.external_id ||
        fixture?.fixture?.matchId ||
        fixture?.fixture?.match_id ||
        fixture?.externalId ||
        null;

      return service.getFlashScoreRichContext(fixtureId, externalId);
    }

    if (typeof service.getStatistics === "function") {
      const statistics = await service
        .getStatistics(fixtureId)
        .catch(() => null);

      return {
        ok: !!statistics,
        fixture,
        fixtureId,
        statistics,
        odds: fixture?.odds || null,
        h2h: null,
        lineups: null,
      };
    }

    return null;
  }

  private async getWebOddsFallback(
    home?: string,
    away?: string,
    richContext?: any,
    existingResearch?: ResearchResult | null,
  ): Promise<WebOddsResult | null> {
    if (!home || !away || !this.researchService) return null;

    const apiHasOdds = !!richContext?.odds || !!richContext?.fixture?.odds;
    if (apiHasOdds) {
      return {
        found: false,
        source: "none",
        query: `${home} x ${away}`,
        markets: {},
        evidence: [],
        warning:
          "Odds já disponíveis pela API principal; fallback web não foi usado.",
      };
    }

    try {
      if (typeof (this.researchService as any).researchOdds === "function") {
        return await (this.researchService as any).researchOdds(home, away);
      }

      if (existingResearch?.items?.length) {
        return {
          found: false,
          source: "none",
          query: existingResearch.query,
          markets: {},
          evidence: [],
          warning: "Research service sem extrator de odds ativo.",
        };
      }
    } catch (error: any) {
      this.logger.warn(`[ODDIX_WEB_ODDS] falhou: ${error?.message || error}`);
    }

    return null;
  }

  private hasValidatedOdds(rich: any, webOdds?: WebOddsResult | null) {
    return !!rich?.odds || !!webOdds?.found;
  }

  private formatWebOddsSummary(webOdds?: WebOddsResult | null) {
    if (!webOdds?.found) return "Odds web: não encontrada.";

    const markets = Object.entries(webOdds.markets || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ");

    return `Odds web: ${markets || "mercado não identificado"} | Fonte: ${webOdds.bookmaker || "pesquisa web"}`;
  }

  private localDecision(message: string): OddixBrainDecision {
    const text = this.normalize(message);
    let intent: any = "GENERAL";

    if (
      this.hasAny(text, [
        "jogos de hoje",
        "quais jogos",
        "copa hoje",
        "jogos da copa",
      ])
    )
      intent = "TODAY_GAMES";
    if (this.hasAny(text, ["ao vivo", "live", "placar"])) intent = "LIVE";
    if (
      this.hasAny(text, [
        "melhor entrada",
        "maior confianca",
        "maior confiança",
        "top pick",
        "o que apostar",
      ])
    )
      intent = "TOP_PICKS";
    if (this.extractTeams(message, null)) intent = "MATCH_ANALYSIS";

    return {
      intent,
      userMessage: message,
      normalizedQuestion: text,
      confidence: 0.75,
      riskMode: "balanced",
      entities: {} as any,
      reference: "none",
      userWants: intent,
      shouldUseOddixEngine: intent !== "GENERAL",
      shouldUseGlobalAiDirect: intent === "GENERAL",
      shouldHumanizeWithGemini: false,
      safetyNotes: ["Fallback local do orquestrador."],
      source: "local",
    };
  }

  private extractTeams(
    message: string,
    decision?: OddixBrainDecision | null,
  ): { home: string; away: string } | null {
    if (decision?.entities?.homeTeam && decision?.entities?.awayTeam) {
      return {
        home: this.cleanTeamName(decision.entities.homeTeam),
        away: this.cleanTeamName(decision.entities.awayTeam),
      };
    }

    const sanitized = String(message || "")
      .replace(/\b\d+\s*x\s*\d+\b/gi, " x ")
      .replace(/\b\d+\s*-\s*\d+\b/gi, " x ")
      .replace(/\b\d+\s*:\s*\d+\b/gi, " x ")
      .replace(/analisa|analisar|analise|análise/gi, "")
      .trim();

    const normalizedOriginal = sanitized.toLowerCase();

    for (const separator of [" x ", " vs ", " versus ", " contra "]) {
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

  private findMatch(
    fixtures: any[],
    homeQueryRaw: string,
    awayQueryRaw: string,
  ) {
    const homeQuery = this.normalize(this.cleanTeamName(homeQueryRaw));
    const awayQuery = this.normalize(this.cleanTeamName(awayQueryRaw));

    return fixtures.find((item: any) => {
      const home = this.normalize(
        item?.teams?.home?.name || item?.homeTeam || item?.home || "",
      );
      const away = this.normalize(
        item?.teams?.away?.name || item?.awayTeam || item?.away || "",
      );

      return (
        (home.includes(homeQuery) && away.includes(awayQuery)) ||
        (home.includes(awayQuery) && away.includes(homeQuery)) ||
        (homeQuery.includes(home) && awayQuery.includes(away)) ||
        (homeQuery.includes(away) && awayQuery.includes(home))
      );
    });
  }

  private scoreCandidate(item: any) {
    const fixture = item.fixture;
    const rich = item.rich;
    const webOdds: WebOddsResult | null = item.webOdds || null;
    const simple = this.simplifyFixture(fixture);

    let score = 60;
    if (rich?.ok) score += 10;
    if (rich?.statistics || rich?.prematchStats) score += 10;
    if (rich?.odds) score += 10;
    else if (webOdds?.found) score += 7;
    if (rich?.h2h) score += 5;
    if (rich?.lineups) score += 5;

    const status = simple.status?.short || simple.status?.long || "";
    if (String(status).toUpperCase() === "NS") score += 3;

    return {
      game: `${simple.home} x ${simple.away}`,
      league: simple.league,
      date: simple.date,
      status: simple.status,
      score: Math.min(score, 96),
      confidenceLabel:
        score >= 85 ? "alta" : score >= 75 ? "moderada" : "baixa",
      hasStats: !!(rich?.statistics || rich?.prematchStats),
      hasOdds: this.hasValidatedOdds(rich, webOdds),
      oddsSource: rich?.odds ? "api" : webOdds?.found ? "web-research" : "none",
      webOdds: webOdds || null,
      hasH2H: !!rich?.h2h,
      hasLineups: !!rich?.lineups,
      officialEntry:
        this.hasValidatedOdds(rich, webOdds) &&
        !!(rich?.statistics || rich?.prematchStats),
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
        fixtures: fixtures
          .slice(0, 30)
          .map((game: any) => this.simplifyFixture(game)),
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
      home: game?.teams?.home?.name || game?.homeTeam || game?.home,
      away: game?.teams?.away?.name || game?.awayTeam || game?.away,
      league: game?.league?.name || game?.leagueName || game?.league,
      country: game?.league?.country || game?.country,
      date: game?.fixture?.date || game?.date || game?.kickoff,
      status: game?.fixture?.status || game?.status,
      goals: game?.goals,
      score: game?.score,
      provider: game?.provider,
    };
  }

  private simplifyRichContext(rich: any) {
    if (!rich) return null;

    return {
      ok: rich?.ok,
      source: rich?.source,
      hasStatistics: !!rich?.statistics,
      hasPrematchStats: !!rich?.prematchStats,
      hasOdds: !!rich?.odds,
      hasH2H: !!rich?.h2h,
      hasLineups: !!rich?.lineups,
      prematchStats: rich?.prematchStats || null,
      errors: rich?.errors || [],
    };
  }

  private asksForCup(message: string) {
    const text = this.normalize(message);

    return this.hasAny(text, [
      "copa",
      "mundial",
      "world cup",
      "club world cup",
      "fifa",
      "copa do mundo",
      "mundial de clubes",
    ]);
  }

  private isCupCompetition(game: any) {
    const simple = this.simplifyFixture(game);
    const league = this.normalize(simple.league || "");
    const country = this.normalize(simple.country || "");

    const haystack = `${league} ${country}`;

    return [
      "world cup",
      "fifa world cup",
      "club world cup",
      "fifa club world cup",
      "copa do mundo",
      "mundial de clubes",
      "fifa",
      "world",
      "cup",
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
      const home = simple.home || "Casa";
      const away = simple.away || "Fora";
      const league = simple.league || "Liga não informada";
      const status = simple.status?.elapsed
        ? `${simple.status.elapsed}'`
        : simple.status?.short || "NS";
      const homeGoals = simple.goals?.home ?? 0;
      const awayGoals = simple.goals?.away ?? 0;

      return `${index + 1}. ${home} ${homeGoals} x ${awayGoals} ${away} (${status})\n   🏆 ${league}`;
    });

    return `${title}:\n\n${lines.join("\n\n")}`;
  }

  private localTopPick(candidates: any[]) {
    const top = candidates[0];

    if (!top) {
      return "🎯 Não encontrei jogos suficientes para apontar a melhor entrada hoje.";
    }

    return `🏆 Melhor oportunidade observada

⚽ ${top.game}
🏆 ${top.league || "Liga não informada"}
📊 Confiança Oddix: ${top.score}%
🎯 Status: ${top.officialEntry ? "Entrada oficial possível" : "Observação, sem entrada oficial"}

${top.webOdds?.found ? `🌐 ${this.formatWebOddsSummary(top.webOdds)}\n⚠️ Odd encontrada via pesquisa web: confirme na casa antes de apostar.` : "⚠️ Sem odds reais e estatísticas completas, eu não cravo aposta oficial."}`;
  }

  private localMultiple(candidates: any[]) {
    const picks = candidates.slice(0, 3);

    if (!picks.length) {
      return "🎫 Não encontrei jogos suficientes para montar múltipla hoje.";
    }

    return `🎫 Múltipla Oddix observada

${picks.map((pick, index) => `${index + 1}. ${pick.game}\n   Confiança: ${pick.score}% | ${pick.officialEntry ? "dados mínimos OK" : "dados pendentes"} | Odds: ${pick.oddsSource || "none"}`).join("\n\n")}

⚠️ Sem odds reais completas, trate como pré-lista de observação, não como entrada oficial.`;
  }

  private localMatchAnalysis(
    match: any,
    richContext: any,
    webOdds?: WebOddsResult | null,
  ) {
    const simple = this.simplifyFixture(match);
    const home = simple.home || "Casa";
    const away = simple.away || "Fora";
    const league = simple.league || "Liga não informada";
    const status = simple.status?.elapsed
      ? `${simple.status.elapsed}'`
      : simple.status?.short || "NS";
    const homeGoals = simple.goals?.home ?? 0;
    const awayGoals = simple.goals?.away ?? 0;

    return `⚽ ${home} x ${away}

🏆 ${league}
⏱️ Status: ${status}
📊 Placar: ${homeGoals} x ${awayGoals}

📌 Contexto real:
${richContext?.statistics || richContext?.prematchStats ? "✅ Estatísticas disponíveis" : "⚠️ Estatísticas pendentes"}
${richContext?.odds ? "✅ Odds disponíveis via API" : webOdds?.found ? "🌐 Odds encontradas via pesquisa web" : "⚠️ Odds pendentes"}
${richContext?.h2h ? "✅ H2H disponível" : "⚠️ H2H pendente"}
${richContext?.lineups ? "✅ Escalações disponíveis" : "⚠️ Escalações pendentes"}
${
  webOdds?.found
    ? `
🌐 ${this.formatWebOddsSummary(webOdds)}
⚠️ Confirme a cotação na casa antes de apostar.`
    : ""
}

🧠 Conclusão Oddix:
${this.hasValidatedOdds(richContext, webOdds) ? "Existe odd validada por API ou pesquisa web, mas a entrada oficial ainda depende de estatísticas reais suficientes." : "Sem odds reais em API ou web, não libero entrada oficial."}`;
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
      const id = String(
        simple.id || `${simple.home}-${simple.away}-${simple.date}`,
      );

      if (!simple.home || !simple.away) return false;
      if (seen.has(id)) return false;

      seen.add(id);
      return true;
    });
  }

  private cleanTeamName(value: string) {
    return String(value || "")
      .replace(/\b\d+\b/g, "")
      .replace(/\bao vivo\b/gi, "")
      .replace(/\blive\b/gi, "")
      .replace(/\bhoje\b/gi, "")
      .replace(/\bagora\b/gi, "")
      .replace(/[?!.]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private hasAny(text: string, terms: string[]) {
    return terms.some((term) => text.includes(this.normalize(term)));
  }

  private normalize(value: string) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
