import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import { FootballResearchService, ResearchResult } from './football-research.service';
import { FootballAgentsService } from './football-agents.service';
import { OddixMemoryService } from './oddix-memory.service';
import { OddixResponseBuilderService } from './oddix-response-builder.service';
import { OddixRouterService } from './oddix-router.service';
import { OddixGlobalAiService } from './oddix-global-ai.service';
import { OddixIntentParserService } from './oddix-intent-parser.service';
import { OddixBrainService, OddixBrainDecision } from './oddix-brain.service';
import { OddixDataOrchestratorService } from './oddix-data-orchestrator.service';
import type {
  BetCalc,
  ChatFootballRequest,
  ChatFootballResponse,
  ChatHistoryMessage,
  ChatIntent,
  ChatTicket,
  ConversationMemory,
  OddixBrain,
  UserBetProfile,
} from './chat-football.types';

type FlashScoreRichContext = {
  ok?: boolean;
  source?: string;
  fixture?: any;
  fixtureId?: string;
  flashScoreExternalId?: string | null;
  statistics?: any;
  statisticsSummary?: any;
  pressureSummary?: any;
  odds?: any;
  oddsSummary?: any;
  h2h?: any;
  lineups?: any;
  prematchStats?: any;
  raw?: any;
  errors?: string[];
};

@Injectable()
export class ChatFootballService {
  private readonly logger = new Logger(ChatFootballService.name);

  private static readonly backendConversationStore = new Map<
    string,
    ChatHistoryMessage[]
  >();

  private readonly backendConversationLimit = Number(
    process.env.ODDIX_BACKEND_MEMORY_LIMIT || 12,
  );


  constructor(
    @Optional() private readonly footballService?: FootballService,
    @Optional() private readonly researchService?: FootballResearchService,
    @Optional() private readonly agentsService?: FootballAgentsService,
    @Optional() private readonly memoryService?: OddixMemoryService,
    @Optional() private readonly responseBuilder?: OddixResponseBuilderService,
    @Optional() private readonly routerService?: OddixRouterService,
    @Optional() private readonly globalAi?: OddixGlobalAiService,
    @Optional() private readonly intentParser?: OddixIntentParserService,
    @Optional() private readonly brainService?: OddixBrainService,
    @Optional() private readonly dataOrchestrator?: OddixDataOrchestratorService,
  ) {}

  async handleMessage(payload: ChatFootballRequest | any): Promise<ChatFootballResponse> {
    const message = this.readMessage(payload);
    const sessionId =
      payload?.sessionId ||
      payload?.conversationId ||
      payload?.chatId ||
      'anonymous';

    const incomingHistory = this.readHistory(payload);
    const history = this.mergeBackendHistory(sessionId, incomingHistory);
    const memory =
      this.memoryService?.buildMemory(payload, history) ||
      this.buildMemoryFallback(history);
    const profile =
      this.memoryService?.buildProfile(payload, memory) ||
      this.buildProfileFallback(payload);

    let parsedIntent: any = null;
    let brainDecision: OddixBrainDecision | undefined;

    if (message.trim()) {
      if (this.brainService) {
        brainDecision = await this.brainService.think(message, sessionId);
      } else if (this.intentParser) {
        parsedIntent = await this.intentParser.parse(message);
      }
    }

    if (!message.trim()) {
      return this.rememberAndReturn(
        sessionId,
        message,
        this.direct(
          'ASK_RECOMMENDATION',
          this.buildWelcomeText(),
          memory,
          profile,
        ),
      );
    }

    const isGlobalFollowUp =
      this.isGlobalConversationFollowUp(message, history, memory);

    if (this.dataOrchestrator) {
      const orchestrated = await this.dataOrchestrator.answer(message, sessionId);

      if (orchestrated.handled) {
        return this.rememberAndReturn(
          sessionId,
          message,
          {
            success: true,
            intent: brainDecision?.intent === 'GENERAL' ? 'ANALYZE' : this.mapBrainIntentToChatIntent(brainDecision?.intent || 'GENERAL'),
            answer: orchestrated.answer,
            data: {
              ...(orchestrated.data || {}),
              suggestions: orchestrated.suggestions || this.defaultSuggestions('ANALYZE'),
              memory,
              profile,
            },
          } as ChatFootballResponse,
        );
      }
    }

    const shouldUseGlobalAi =
      isGlobalFollowUp ||
      (
        (brainDecision?.shouldUseGlobalAiDirect ||
          (parsedIntent?.intent === 'GENERAL' && this.globalAi)) &&
        !this.isOddixFootballQuestion(message)
      );

    if (shouldUseGlobalAi && this.globalAi) {
      const response = await this.globalAi.answer(
        this.buildGlobalContextQuestion(message, history, memory),
      );

      return this.rememberAndReturn(
        sessionId,
        message,
        {
          success: true,
          intent: 'GENERAL',
          answer: response.answer,
          data: {
            suggestions: response.suggestions || [
              '⚽ Mostrar jogos de hoje',
              '🏆 Top Picks',
              '🔥 Monte uma múltipla',
            ],
            memory,
            profile,
          },
        } as ChatFootballResponse,
      );
    }

    const brain = this.buildBrain(message, history, memory);
    if (brainDecision?.intent && brainDecision.intent !== 'GENERAL') {
      brain.intent = this.mapBrainIntentToChatIntent(brainDecision.intent);
      brain.topicTeam = brainDecision.entities.team || brain.topicTeam;
      brain.isFollowUp =
        brain.isFollowUp ||
        brainDecision.intent === 'FOLLOW_UP' ||
        brainDecision.reference === 'lastMatch';
    } else if (parsedIntent?.intent && parsedIntent.intent !== 'GENERAL') {
      brain.intent =
        parsedIntent.intent === 'MATCH_ANALYSIS'
          ? 'ANALYZE'
          : (parsedIntent.intent as any);
    }

    const routed = this.routerService?.resolve(
      message,
      brain.intent,
      memory,
    );

    if (routed?.intent) {
      brain.intent = routed.intent as any;
    }

    const lastTicket = memory.lastTicket || this.findLastTicket(history);

    const brainRoute = await this.routeBrainDecision(
      brainDecision,
      message,
      memory,
      profile,
      lastTicket,
      sessionId,
    );

    if (brainRoute) return this.rememberAndReturn(sessionId, message, brainRoute);

    const calc = this.extractBetCalculation(message, lastTicket);
    if (calc) return this.buildBetCalculatorResponse(calc, message, memory, profile);

    if (brain.isFollowUp && memory.lastMatch) {
      const response = await this.analyzeRealMatch(
        `${memory.lastMatch.home} x ${memory.lastMatch.away}`,
        brain.intent,
        memory,
        profile,
        message,
      );

      if (response) return response;
    }

    if (brain.intent === 'EXPLAIN_LAST') {
      if (!lastTicket) return this.noContext('EXPLAIN_LAST', memory, profile);
      return this.direct('EXPLAIN_LAST', this.formatTicketExplanation(lastTicket), memory, profile, {
        ticket: lastTicket,
      });
    }

    if (brain.intent === 'RISK_EXPLAIN') {
      if (!lastTicket && !memory.lastMatch) return this.noContext('RISK_EXPLAIN', memory, profile);
      if (lastTicket) {
        return this.direct('RISK_EXPLAIN', this.formatTicketRisk(lastTicket), memory, profile, {
          ticket: lastTicket,
        });
      }
    }

    if (brain.intent === 'LIST_MATCHES' || this.shouldListGames(message)) {
      return this.listRealGames(brain.intent, memory, profile);
    }

    if (brain.intent === 'TOP_PICKS' || brain.intent === 'ASK_RECOMMENDATION') {
      return this.buildTopPicksResponse(memory, profile);
    }

    if (brain.intent === 'MULTIPLE') return this.buildMultipleResponse(memory, profile);
    if (brain.intent === 'PLAYER_PROPS') return this.buildPlayerPropsResponse(message, memory, profile);
    if (brain.intent === 'LIVE') return this.buildLiveResponse(memory, profile);
    if (brain.intent === 'VIRTUAL') return this.buildVirtualResponse(memory, profile);

    if (brain.topicTeam) {
      const teamOverview = await this.buildTeamOverview(brain.topicTeam, memory, profile);
      if (teamOverview) return teamOverview;
    }

    const realAnalysis = await this.analyzeRealMatch(message, brain.intent, memory, profile);
    if (realAnalysis) return realAnalysis;

    if (brain.intent === 'SIMPLE') return this.buildSimpleBetResponse(memory, profile);
    if (brain.intent === 'BANKROLL') return this.explainBankroll(message, lastTicket, memory, profile);

    return this.rememberAndReturn(sessionId, message, this.direct('GENERAL', this.buildFallbackText(message, memory), memory, profile));
  }


  private async routeBrainDecision(
    brainDecision: OddixBrainDecision | undefined,
    message: string,
    memory: ConversationMemory,
    profile: UserBetProfile,
    lastTicket: ChatTicket | null,
    sessionId: string,
  ): Promise<ChatFootballResponse | null> {
    if (!brainDecision) return null;

    if (brainDecision.intent === 'GENERAL' && this.globalAi) {
      const response = await this.globalAi.answer(
        this.buildGlobalContextQuestion(message, [], memory),
      );

      return {
        success: true,
        intent: 'GENERAL',
        answer: response.answer,
        data: {
          suggestions: response.suggestions || this.defaultSuggestions('GENERAL'),
          brain: brainDecision,
        },
      } as ChatFootballResponse;
    }

    if (brainDecision.intent === 'BANKROLL') {
      const stake = brainDecision.entities.stake || this.extractMoney(message);
      const odd =
        brainDecision.entities.odd ||
        this.extractOdd(message) ||
        lastTicket?.oddTotal ||
        null;

      if (stake && odd && odd > 1) {
        return this.buildBetCalculatorResponse(
          {
            stake,
            odd,
            retorno: stake * odd,
            lucro: stake * odd - stake,
          },
          message,
          memory,
          profile,
        );
      }
    }

    if (brainDecision.intent === 'LIVE') {
      const hasTeam =
        !!brainDecision.entities.team ||
        !!brainDecision.entities.homeTeam ||
        !!brainDecision.entities.awayTeam;

      if (!hasTeam) {
        return this.showLiveMatches(memory, profile, brainDecision);
      }

      return this.handleBrainLiveIntent(brainDecision, memory, profile, sessionId);
    }

    if (brainDecision.intent === 'FOLLOW_UP' && memory.lastMatch) {
      return this.analyzeRealMatch(
        `${memory.lastMatch.home} x ${memory.lastMatch.away}`,
        'ANALYZE',
        memory,
        profile,
        message,
      );
    }

    if (
      brainDecision.intent === 'MATCH_ANALYSIS' &&
      brainDecision.entities.homeTeam &&
      brainDecision.entities.awayTeam
    ) {
      return this.analyzeRealMatch(
        `${brainDecision.entities.homeTeam} x ${brainDecision.entities.awayTeam}`,
        'ANALYZE',
        memory,
        profile,
        message,
      );
    }

    if (brainDecision.intent === 'TEAM' && brainDecision.entities.team) {
      return this.buildTeamOverview(brainDecision.entities.team, memory, profile);
    }

    return null;
  }


  private async showLiveMatches(
    memory: ConversationMemory,
    profile: UserBetProfile,
    brainDecision?: OddixBrainDecision,
  ): Promise<ChatFootballResponse> {
    if (!this.footballService) {
      return this.direct(
        'LIVE',
        '⚽ Entendi que você quer ver os jogos ao vivo, mas o módulo de futebol real não está disponível agora.',
        memory,
        profile,
        {
          waitingForData: true,
          brain: brainDecision,
        },
      );
    }

    try {
      const flashScoreLiveResponse: any =
        typeof (this.footballService as any)?.getLiveFixturesFromFlashScore === 'function'
          ? await (this.footballService as any).getLiveFixturesFromFlashScore()
          : null;

      let fixtures = this.extractFixtureArray(flashScoreLiveResponse);

      if (!fixtures.length) {
        const fallbackResponse: any =
          typeof (this.footballService as any)?.getLiveFixtures === 'function'
            ? await (this.footballService as any).getLiveFixtures()
            : null;

        fixtures = this.extractFixtureArray(fallbackResponse);
      }

      if (!fixtures.length) {
        const windowFixtures = await this.getFixturesWindow(0, 0);
        const liveStatuses = [
          '1H',
          '2H',
          'HT',
          'ET',
          'P',
          'LIVE',
          'IN_PLAY',
          'INT',
          'SUSP',
          'SUSPENDED',
          'PST',
          'POSTPONED',
          'DELAYED',
          'BT',
          'ABD',
        ];

        fixtures = windowFixtures.filter((game: any) => {
          const status = String(game?.fixture?.status?.short || '').toUpperCase();
          const statusLong = String(game?.fixture?.status?.long || '').toLowerCase();

          return (
            liveStatuses.includes(status) ||
            statusLong.includes('live') ||
            statusLong.includes('in play') ||
            statusLong.includes('suspended') ||
            statusLong.includes('postponed') ||
            statusLong.includes('delayed')
          );
        });
      }

      const cleanFixtures = fixtures
        .filter((game: any) => game?.teams?.home?.name && game?.teams?.away?.name)
        .slice(0, 25);

      if (!cleanFixtures.length) {
        return this.direct(
          'LIVE',
          '⚽ Não encontrei jogos ao vivo na base Oddix neste momento.\n\nPode ser atraso da API, pausa entre partidas ou indisponibilidade temporária do FlashScore.',
          memory,
          profile,
          {
            waitingForData: true,
            brain: brainDecision,
          },
        );
      }

      const lines = cleanFixtures
        .slice(0, 15)
        .map((game: any, index: number) => {
          const home = game?.teams?.home?.name || 'Casa';
          const away = game?.teams?.away?.name || 'Fora';
          const homeGoals =
            game?.goals?.home ??
            game?.score?.fulltime?.home ??
            0;
          const awayGoals =
            game?.goals?.away ??
            game?.score?.fulltime?.away ??
            0;
          const statusShort = String(game?.fixture?.status?.short || 'LIVE').toUpperCase();
          const elapsed = game?.fixture?.status?.elapsed;
          const clock =
            elapsed !== null && elapsed !== undefined
              ? `${elapsed}'`
              : statusShort;

          const league = game?.league?.name || 'Liga não informada';

          return `${index + 1}. ${home} ${homeGoals} x ${awayGoals} ${away} (${clock})\n   🏆 ${league}`;
        })
        .join('\n\n');

      return this.direct(
        'LIVE',
        `⚽ Existem ${cleanFixtures.length} jogos ao vivo/ativos na base Oddix neste momento:\n\n${lines}\n\nDigite o nome de um jogo para eu analisar com mais profundidade.`,
        memory,
        profile,
        {
          fixtures: cleanFixtures,
          brain: brainDecision,
          suggestions: cleanFixtures.slice(0, 4).map((game: any) => {
            const home = game?.teams?.home?.name || 'Casa';
            const away = game?.teams?.away?.name || 'Fora';
            return `⚡ Como está ${home} x ${away}?`;
          }),
        },
      );
    } catch (error: any) {
      return this.direct(
        'LIVE',
        `⚠️ Não consegui consultar os jogos ao vivo agora.\n\nMotivo: ${error?.message || 'falha ao consultar FlashScore Live'}`,
        memory,
        profile,
        {
          waitingForData: true,
          brain: brainDecision,
        },
      );
    }
  }


  private async handleBrainLiveIntent(
    brainDecision: OddixBrainDecision,
    memory: ConversationMemory,
    profile: UserBetProfile,
    sessionId: string,
  ): Promise<ChatFootballResponse> {
    const team = this.resolveTeamAlias(
      brainDecision.entities.team ||
        brainDecision.entities.homeTeam ||
        brainDecision.entities.awayTeam ||
        memory.lastTeam ||
        '',
    );

    if (!team) {
      return this.showLiveMatches(memory, profile, brainDecision);
    }

    if (!this.footballService) {
      return this.direct(
        'LIVE',
        `⚡ Entendi que você quer o jogo ao vivo de ${team}, mas o módulo de futebol real não está disponível agora.`,
        memory,
        profile,
        {
          waitingForData: true,
          team,
          brain: brainDecision,
        },
      );
    }

    try {
      const flashScoreLiveResponse: any =
        typeof (this.footballService as any)?.getLiveFixturesFromFlashScore === 'function'
          ? await (this.footballService as any).getLiveFixturesFromFlashScore()
          : null;

      const flashScoreLiveFixtures = this.extractFixtureArray(flashScoreLiveResponse);

      const fallbackFixtures =
        flashScoreLiveFixtures.length > 0
          ? []
          : await this.getFixturesWindow(1, 1);

      const fixtures = [...flashScoreLiveFixtures, ...fallbackFixtures];

      const liveStatuses = [
        '1H',
        '2H',
        'HT',
        'ET',
        'P',
        'LIVE',
        'IN_PLAY',
        'INT',
        'SUSP',
        'SUSPENDED',
        'PST',
        'POSTPONED',
        'DELAYED',
        'BT',
        'ABD',
      ];

      const liveCandidates = fixtures.filter((game: any) => {
        const status = String(game?.fixture?.status?.short || '').toUpperCase();
        const statusLong = String(game?.fixture?.status?.long || '').toLowerCase();

        return (
          liveStatuses.includes(status) ||
          statusLong.includes('live') ||
          statusLong.includes('in play') ||
          statusLong.includes('suspended') ||
          statusLong.includes('postponed') ||
          statusLong.includes('delayed')
        );
      });

      const candidates = liveCandidates.length ? liveCandidates : fixtures;
      const match =
        this.findTeamMatch(candidates, team) ||
        this.findTeamMatch(fixtures, team);

      if (!match) {
        return this.direct(
          'LIVE',
          `⚡ Procurei jogo ao vivo envolvendo ${team}, mas ainda não encontrei uma partida ativa na base Oddix.\n\nSe você está vendo esse jogo em outra fonte, pode ser atraso da API ou diferença de nome da equipe. Não vou inventar placar.`,
          memory,
          profile,
          {
            waitingForData: true,
            team,
            brain: brainDecision,
          },
        );
      }

      const home = match?.teams?.home?.name || 'Casa';
      const away = match?.teams?.away?.name || 'Fora';
      const statusShort = String(match?.fixture?.status?.short || 'NS').toUpperCase();
      const elapsed = match?.fixture?.status?.elapsed;
      const homeGoals = match?.goals?.home ?? match?.score?.fulltime?.home ?? 0;
      const awayGoals = match?.goals?.away ?? match?.score?.fulltime?.away ?? 0;
      const fixtureId = String(match?.fixture?.id || '');
      const richContext = await this.getFlashScoreRichContextSafe(fixtureId, match);

      const updatedMemory: ConversationMemory = {
        ...memory,
        lastIntent: 'LIVE',
        lastTeam: team,
        lastMatch: {
          home,
          away,
          label: `${home} x ${away}`,
        },
        lastFixture: match,
        lastRichContext: richContext,
      };

      this.memoryService?.remember({ sessionId }, updatedMemory);

      const clock =
        statusShort === 'NS'
          ? 'pré-jogo'
          : elapsed
            ? `${elapsed}'`
            : statusShort;

      const answer = `⚡ **${home} x ${away}**

⏱️ Status: ${clock}
📊 Placar: ${homeGoals} x ${awayGoals}

${this.buildRichContextSummary(richContext)}

Leitura Oddix: ${this.describeLiveStatus(statusShort)}

⚠️ Entrada oficial só é liberada se houver pressão, estatísticas reais e odds validadas.`;

      return this.human({
        intent: 'LIVE',
        userMessage: brainDecision.userMessage,
        baseAnswer: answer,
        memory: updatedMemory,
        profile,
        facts: { fixture: match, richContext, brain: brainDecision },
        data: {
          fixture: match,
          richContext,
          brain: brainDecision,
          waitingForData: statusShort === 'NS',
        },
        suggestions: [
          'Esse jogo presta?',
          'Me dá uma opção segura',
          'Quanto ganho com R$50?',
          'Continua a análise',
        ],
      });
    } catch (error: any) {
      return this.direct(
        'LIVE',
        `⚡ Tentei buscar o jogo ao vivo de ${team}, mas não consegui validar agora.\n\nMotivo: ${error?.message || 'falha ao consultar dados reais'}\n\nSem placar inventado e sem entrada oficial.`,
        memory,
        profile,
        {
          waitingForData: true,
          team,
          brain: brainDecision,
        },
      );
    }
  }

  private mapBrainIntentToChatIntent(intent: OddixBrainDecision['intent']): ChatIntent {
    const map: Record<string, ChatIntent> = {
      TOP_PICKS: 'TOP_PICKS',
      MATCH_ANALYSIS: 'ANALYZE',
      LIVE: 'LIVE',
      MULTIPLE: 'MULTIPLE',
      BANKROLL: 'BANKROLL',
      NEWS: 'NEWS',
      TEAM: 'ANALYZE',
      PLAYER: 'PLAYER_PROPS',
      VIRTUAL: 'VIRTUAL',
      VALUE_BETS: 'VALUE_BETS',
      EXPLAIN: 'EXPLAIN_LAST',
      FOLLOW_UP: 'ANALYZE',
      GENERAL: 'GENERAL',
    };

    return map[intent] || 'GENERAL';
  }

  private findTeamMatch(fixtures: any[], teamName: string) {
    const query = this.normalizeTeamSearch(this.resolveTeamAlias(teamName));

    return fixtures.find((game: any) => {
      const home = this.normalizeTeamSearch(game?.teams?.home?.name);
      const away = this.normalizeTeamSearch(game?.teams?.away?.name);

      return (
        home.includes(query) ||
        away.includes(query) ||
        query.includes(home) ||
        query.includes(away)
      );
    });
  }

  private normalizeTeamSearch(value: any) {
    return this.normalize(value)
      .replace(/national team/g, '')
      .replace(/olympic/g, '')
      .replace(/u23/g, '')
      .replace(/u 23/g, '')
      .replace(/sub 23/g, '')
      .replace(/sub23/g, '')
      .replace(/selecao/g, '')
      .replace(/team/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveTeamAlias(value: string) {
    const key = this.normalize(value);

    const aliases: Record<string, string> = {
      franca: 'France',
      frança: 'France',
      france: 'France',
      'france national team': 'France',
      'france olympic': 'France',
      'france u23': 'France',
      brasil: 'Brazil',
      brazil: 'Brazil',
      argentina: 'Argentina',
      portugal: 'Portugal',
      espanha: 'Spain',
      spain: 'Spain',
      inglaterra: 'England',
      england: 'England',
      alemanha: 'Germany',
      germany: 'Germany',
      italia: 'Italy',
      italy: 'Italy',
      fortaleza: 'Fortaleza',
      ceara: 'Ceará',
      ceará: 'Ceará',
      flamengo: 'Flamengo',
      palmeiras: 'Palmeiras',
      corinthians: 'Corinthians',
      santos: 'Santos',
      vasco: 'Vasco',
      botafogo: 'Botafogo',
      fluminense: 'Fluminense',
      cruzeiro: 'Cruzeiro',
      gremio: 'Grêmio',
      grêmio: 'Grêmio',
      internacional: 'Internacional',
    };

    return aliases[key] || value;
  }

  private describeLiveStatus(statusShort: string) {
    const status = String(statusShort || '').toUpperCase();

    if (['1H', '2H', 'ET', 'P', 'LIVE', 'INT', 'IN_PLAY'].includes(status)) {
      return 'partida em andamento. Agora eu preciso de pressão real, finalizações e odds para validar qualquer entrada.';
    }

    if (status === 'HT') {
      return 'intervalo. Bom momento para revisar pressão, volume ofensivo e linha de gols ao vivo.';
    }

    if (status === 'SUSP' || status === 'SUSPENDED') {
      return 'partida suspensa. Não recomendo entrada até a confirmação de retorno do jogo.';
    }

    if (status === 'PST' || status === 'POSTPONED') {
      return 'partida adiada. Não existe entrada ao vivo válida enquanto o jogo não retornar para a grade.';
    }

    if (status === 'DELAYED') {
      return 'partida atrasada. Aguarde confirmação de início/retorno antes de qualquer leitura ao vivo.';
    }

    if (status === 'ABD') {
      return 'partida interrompida/abandonada. Não recomendo qualquer entrada.';
    }

    if (status === 'NS') {
      return 'pré-jogo. Ainda preciso confirmar escalações, odds e estatísticas recentes.';
    }

    return 'status identificado, mas ainda preciso validar estatísticas e odds antes de qualquer entrada.';
  }





  private mergeBackendHistory(
    sessionId: string,
    incomingHistory: ChatHistoryMessage[],
  ): ChatHistoryMessage[] {
    const backendHistory =
      ChatFootballService.backendConversationStore.get(sessionId) || [];

    const merged = [...backendHistory, ...(incomingHistory || [])];

    const seen = new Set<string>();
    const deduped = merged.filter((item: any) => {
      const role = item?.role || item?.type || item?.sender || 'message';
      const content =
        item?.content ||
        item?.message ||
        item?.text ||
        item?.answer ||
        '';

      const key = `${role}:${String(content).slice(0, 160)}`;
      if (!content || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.slice(-this.backendConversationLimit);
  }

  private rememberBackendMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ) {
    if (!sessionId || !content?.trim()) return;

    const current =
      ChatFootballService.backendConversationStore.get(sessionId) || [];

    const next = [
      ...current,
      {
        role,
        content: String(content).slice(0, 3000),
      } as any,
    ].slice(-this.backendConversationLimit);

    ChatFootballService.backendConversationStore.set(sessionId, next);
  }

  private rememberAndReturn(
    sessionId: string,
    userMessage: string,
    response: ChatFootballResponse,
  ): ChatFootballResponse {
    this.rememberBackendMessage(sessionId, 'user', userMessage);
    this.rememberBackendMessage(sessionId, 'assistant', response?.answer || '');
    return response;
  }


  private isGlobalConversationFollowUp(
    message: string,
    history: ChatHistoryMessage[],
    memory: ConversationMemory,
  ) {
    const text = this.clean(message);

    const globalFollowUpTerms = [
      'quem jogou',
      'quem fez gol',
      'quem fez os gols',
      'de quem foi os gols',
      'quem marcou',
      'quando foi',
      'onde foi',
      'qual foi o placar',
      'quanto foi',
      'e depois',
      'me fala mais',
      'me explica melhor',
      'quem perdeu',
      'quem participou',
      'final foi contra quem',
    ];

    if (!globalFollowUpTerms.some((term) => text.includes(this.clean(term)))) {
      return false;
    }

    const lastMessages = Array.isArray(history) ? history.slice(-6) : [];
    const lastText = lastMessages
      .map((item: any) => String(item?.content || item?.message || item?.text || item?.answer || ''))
      .join(' ')
      .toLowerCase();

    const globalContextTerms = [
      'copa do mundo de 2002',
      'copa do mundo',
      'mundial',
      'história',
      'historia',
      'quem ganhou',
      'quem venceu',
    ];

    return (
      memory?.lastIntent === 'GENERAL' ||
      globalContextTerms.some((term) => lastText.includes(this.clean(term)))
    );
  }


  private buildGlobalContextQuestion(
    message: string,
    history: ChatHistoryMessage[],
    memory: ConversationMemory,
  ) {
    const compactHistory = this.compactHistoryForGlobal(history);
    const lastContext = {
      lastIntent: memory?.lastIntent || null,
      lastTeam: memory?.lastTeam || null,
      lastMatch: memory?.lastMatch || null,
      lastTicket: memory?.lastTicket
        ? {
            oddTotal: memory.lastTicket.oddTotal,
            confidence: memory.lastTicket.confidence,
            status: memory.lastTicket.status,
          }
        : null,
    };

    if (
      !compactHistory &&
      !lastContext.lastIntent &&
      !lastContext.lastTeam &&
      !lastContext.lastMatch &&
      !lastContext.lastTicket
    ) {
      return message;
    }

    return `Contexto da conversa Oddix:
${compactHistory || 'Sem histórico textual disponível.'}

Memória estruturada:
${JSON.stringify(lastContext, null, 2)}

Pergunta atual do usuário:
${message}

Responda à pergunta atual considerando o contexto anterior quando ela for curta, ambígua ou de continuação.`;
  }

  private compactHistoryForGlobal(history: ChatHistoryMessage[]) {
    if (!Array.isArray(history) || !history.length) return '';

    return history
      .slice(-8)
      .map((item: any) => {
        const role = item?.role || item?.type || item?.sender || 'message';
        const content =
          item?.content ||
          item?.message ||
          item?.text ||
          item?.answer ||
          '';

        if (!content) return null;

        return `${role}: ${String(content).slice(0, 500)}`;
      })
      .filter(Boolean)
      .join('\n');
  }


  private readMessage(payload: any) {
    if (typeof payload === 'string') return payload;
    return String(payload?.message || payload?.text || payload?.prompt || payload?.question || payload?.content || '');
  }

  private readHistory(payload: any): ChatHistoryMessage[] {
    const history = Array.isArray(payload?.history) ? payload.history : [];
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    return [...history, ...messages] as ChatHistoryMessage[];
  }

  private buildBrain(message: string, history: ChatHistoryMessage[], memory: ConversationMemory): OddixBrain {
    const text = this.clean(message);
    const teams = this.extractTeams(message);
    const isFollowUp = this.isContextFollowUp(text);
    const topicTeam = teams ? null : this.extractTeamTopic(message);
    const intent = this.detectIntent(message, isFollowUp, memory);

    return {
      message,
      text,
      intent,
      teams,
      topicTeam,
      isFollowUp,
      wantsSafer: text.includes('mais segura') || text.includes('conservadora') || text.includes('baixo risco'),
      wantsAggressive: text.includes('mais agressiva') || text.includes('odd maior') || text.includes('arriscar'),
    };
  }

  private detectIntent(message: string, isFollowUp = false, memory?: ConversationMemory): ChatIntent {
    const text = this.clean(message);

    if (this.extractBetCalculation(message, memory?.lastTicket || null)) return 'BANKROLL';

    if (
      text.includes('jogos de hoje') ||
      text.includes('mostrar jogos') ||
      text.includes('mostra jogos') ||
      text.includes('quais jogos') ||
      text.includes('lista jogos') ||
      text.includes('listar jogos') ||
      text === 'jogos' ||
      text === 'partidas'
    ) return 'LIST_MATCHES';

    if (
      text.includes('top pick') ||
      text.includes('top picks') ||
      text.includes('melhores palpites') ||
      text.includes('melhor palpite') ||
      text.includes('melhores entradas') ||
      text.includes('melhor entrada') ||
      text.includes('palpites de hoje') ||
      text.includes('entrada de hoje') ||
      text.includes('qual melhor aposta') ||
      text.includes('qual a melhor aposta') ||
      text.includes('o que apostar') ||
      text.includes('tem algo bom') ||
      text.includes('tem jogo bom') ||
      text.includes('me indica uma entrada') ||
      text.includes('me recomenda uma aposta')
    ) return 'TOP_PICKS';

    if (text.includes('multipla') || text.includes('múltipla') || text.includes('bilhete') || text.includes('combinada')) {
      return 'MULTIPLE';
    }

    if (text.includes('player') || text.includes('jogador') || text.includes('chute') || text.includes('finalizacao') || text.includes('finalização') || text.includes('marca gol')) {
      return 'PLAYER_PROPS';
    }

    if (text.includes('noticia') || text.includes('notícias') || text.includes('news')) return 'NEWS';
    if (text.includes('value') || text.includes('valor') || text.includes('mercado') || text.includes('odds')) return 'VALUE_BETS';
    if (text.includes('ao vivo') || text.includes('live')) return 'LIVE';
    if (text.includes('virtual')) return 'VIRTUAL';

    if (text.includes('risco') || text.includes('arriscada') || text.includes('vale a pena')) {
      return isFollowUp ? 'RISK_EXPLAIN' : 'ANALYZE';
    }

    if (text.includes('explica') || text.includes('explique') || text.includes('por que') || text.includes('porque')) return 'EXPLAIN_LAST';
    if (text.includes('mais segura') || text.includes('conservadora')) return 'MAKE_SAFER';
    if (text.includes('mais agressiva') || text.includes('odd maior')) return 'MAKE_AGGRESSIVE';

    if (text.includes('simples') || text.includes('aposta segura')) return 'SIMPLE';

    if (text.includes('analisa') || text.includes('analisar') || text.includes('analise') || text.includes('análise') || text.includes(' x ') || text.includes(' vs ') || text.includes('contra')) {
      return 'ANALYZE';
    }

    return isFollowUp ? memory?.lastIntent || 'GENERAL' : 'GENERAL';
  }

  private async buildTopPicksResponse(memory: ConversationMemory, profile: UserBetProfile): Promise<ChatFootballResponse> {
    if (!this.footballService) {
      return this.direct('TOP_PICKS', 'Eu entendi que você quer os melhores palpites de hoje, mas o módulo de jogos reais ainda não está disponível neste serviço.', memory, profile, {
        waitingForData: true,
      });
    }

    try {
      const response: any = await this.footballService.getFixtures();
      const fixtures = this.extractFixtureArray(response)
        .filter((game: any) => game?.teams?.home?.name && game?.teams?.away?.name)
        .filter((game: any) => !this.isFinished(game))
        .slice(0, 50);

      if (!fixtures.length) {
        return this.direct('TOP_PICKS', 'Procurei jogos reais na base atual, mas ainda não encontrei partidas elegíveis. Não vou inventar palpite.', memory, profile, {
          waitingForData: true,
        });
      }

      const ranked = fixtures
        .map((game: any) => ({ game, score: this.scoreFixtureForTopPick(game, profile) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      const text = ranked
        .map(({ game, score }, index) => {
          const home = game?.teams?.home?.name || 'Casa';
          const away = game?.teams?.away?.name || 'Fora';
          const league = game?.league?.name || 'Liga não informada';
          const kickoff = this.formatKickoff(game?.fixture?.date);
          const confidence = Math.min(90, Math.max(60, score));
          return `${index + 1}️⃣ ${home} x ${away}
🏆 ${league}
⏰ ${kickoff}
🧠 Triagem: ${confidence}/100
🎯 Para aprofundar: "analisa ${home} x ${away}"`;
        })
        .join('\n\n');

      return this.human({
        intent: 'TOP_PICKS',
        userMessage: 'Top Picks',
        baseAnswer: `🏆 Encontrei os melhores candidatos de hoje:\n\n${text}\n\nIsso é triagem inicial. A entrada oficial só sai depois de validar estatísticas reais, odds reais e risco.`,
        memory,
        profile,
        facts: { ranked: ranked.map((item) => item.game) },
        data: { fixtures: ranked.map((item) => item.game) },
        suggestions: ranked.slice(0, 4).map(({ game }) => `🎯 Analisa ${game?.teams?.home?.name || 'Casa'} x ${game?.teams?.away?.name || 'Fora'}`),
      });
    } catch (error: any) {
      return this.direct('TOP_PICKS', `Tentei buscar os jogos reais, mas a consulta falhou agora.\n\nMotivo: ${error?.message || 'Falha ao consultar FootballService'}\n\nNão vou inventar palpite.`, memory, profile, {
        waitingForData: true,
      });
    }
  }

  private async analyzeRealMatch(
    message: string,
    intent: ChatIntent,
    memory: ConversationMemory,
    profile: UserBetProfile,
    originalQuestion?: string,
  ): Promise<ChatFootballResponse | null> {
    if (!this.footballService) return null;

    const teams = this.extractTeams(message);
    if (!teams) return null;

    try {
      const fixtures = await this.getMatchSearchFixtures(3, 7);
      const research = await this.researchMatchSafe(teams.home, teams.away);
      const match = this.findMatch(fixtures, teams.home, teams.away);

      if (!match) {
        const discovery =
          this.agentsService?.buildMatchDiscoveryAgent({
            homeTeam: teams.home,
            awayTeam: teams.away,
            fixtures,
            research,
          } as any) || this.formatResearchBlock(research);

        return this.human({
          intent,
          userMessage: originalQuestion || message,
          baseAnswer: `Não encontrei essa partida na base Oddix agora.\n\n${discovery}\n\nMesmo com notícia externa, não libero entrada sem partida, odds e estatísticas reais.`,
          memory: { ...memory, lastMatch: { ...teams, label: `${teams.home} x ${teams.away}` } },
          profile,
          facts: { research },
          data: { waitingForData: true, research },
          suggestions: this.waitingSuggestions(),
        });
      }

      const fixtureId = String(match?.fixture?.id || '');
      const richContext = await this.getFlashScoreRichContextSafe(fixtureId, match);
      const statsResponse: any = richContext?.statistics || (fixtureId ? await this.footballService.getStatistics(fixtureId) : null);
      const stats = statsResponse?.data || statsResponse;

      const hasRealContext =
        richContext?.ok === true ||
        statsResponse?.ok === true ||
        statsResponse?.success === true ||
        statsResponse?.available === true ||
        statsResponse?.data?.available === true ||
        statsResponse?.data?.realStatsAvailable === true ||
        statsResponse?.realStatsAvailable === true ||
        richContext?.prematchStats?.available === true ||
        richContext?.odds?.available === true ||
        richContext?.h2h?.available === true;

      const enrichedMatch = richContext?.fixture || match;

      this.logger.log(
        JSON.stringify(
          {
            tag: 'ODDIX_MATCH_IDS',
            fixtureId: enrichedMatch?.fixture?.id,
            externalId: enrichedMatch?.fixture?.externalId,
            external_id: enrichedMatch?.fixture?.external_id,
            matchId: enrichedMatch?.fixture?.matchId,
            match_id: enrichedMatch?.fixture?.match_id,
            eventId: enrichedMatch?.fixture?.eventId,
            status: enrichedMatch?.fixture?.status,
            provider: enrichedMatch?.provider,
            league: enrichedMatch?.league?.name,
            home: enrichedMatch?.teams?.home?.name,
            away: enrichedMatch?.teams?.away?.name,
          },
          null,
          2,
        ),
      );

      this.logger.log(
        JSON.stringify(
          {
            tag: 'ODDIX_RICH_CONTEXT_STATUS',
            ok: richContext?.ok,
            source: richContext?.source,
            fixtureId: richContext?.fixtureId,
            flashScoreExternalId: richContext?.flashScoreExternalId,
            hasStats: !!richContext?.statistics,
            hasOdds: !!richContext?.odds,
            hasH2H: !!richContext?.h2h,
            hasLineups: !!richContext?.lineups,
            hasPrematchStats: !!richContext?.prematchStats,
            statsKeys: Object.keys(richContext?.statistics || {}),
            oddsKeys: Object.keys(richContext?.odds || {}),
            h2hType: Array.isArray(richContext?.h2h) ? 'array' : typeof richContext?.h2h,
            h2hLength: Array.isArray(richContext?.h2h) ? richContext?.h2h.length : null,
            lineupsType: Array.isArray(richContext?.lineups) ? 'array' : typeof richContext?.lineups,
            lineupsLength: Array.isArray(richContext?.lineups) ? richContext?.lineups.length : null,
            errors: richContext?.errors || [],
          },
          null,
          2,
        ),
      );

      const agentContext: any = {
        homeTeam: enrichedMatch?.teams?.home?.name || teams.home,
        awayTeam: enrichedMatch?.teams?.away?.name || teams.away,
        fixtures,
        fixture: enrichedMatch,
        statistics: stats?.simulated ? null : stats,
        research,
        richContext,
        h2h: richContext?.h2h,
        odds: richContext?.odds,
        lineups: richContext?.lineups,
        prematchStats: richContext?.prematchStats,
      };

      const agents = this.agentsService?.buildMatchResearchAgent(agentContext) || this.formatResearchBlock(research);
      const updatedMemory: ConversationMemory = {
        ...memory,
        lastIntent: intent,
        lastMatch: {
          home: enrichedMatch?.teams?.home?.name || teams.home,
          away: enrichedMatch?.teams?.away?.name || teams.away,
          label: `${enrichedMatch?.teams?.home?.name || teams.home} x ${enrichedMatch?.teams?.away?.name || teams.away}`,
        },
        lastFixture: enrichedMatch,
        lastRichContext: richContext,
      };

      this.memoryService?.remember({ sessionId: 'anonymous' }, updatedMemory);

      const statusText = hasRealContext
        ? 'Contexto real encontrado. A análise pode ser feita, mas entrada oficial ainda depende de odds e confirmação estatística.'
        : 'Partida encontrada, mas ainda falta contexto real completo para liberar entrada oficial.';

      const premiumAnalysis = await this.buildPremiumMatchAnalysis(
        enrichedMatch,
        richContext,
        stats,
        research,
        agents,
        statusText,
        hasRealContext,
      );

      return this.human({
        intent,
        userMessage: originalQuestion || message,
        baseAnswer: premiumAnalysis,
        memory: updatedMemory,
        profile,
        facts: {
          fixture: enrichedMatch,
          statistics: stats,
          richContext,
          research,
          agentsRaw: agents,
          statusText,
          hasRealContext,
        },
        data: {
          waitingForData: !hasRealContext,
          fixture: enrichedMatch,
          statistics: stats,
          richContext,
          research,
        },
        suggestions: ['🛡️ Deixe mais seguro', '🚀 Opção mais agressiva', '💰 Quanto ganho com R$20 na odd 1.85?', '🔥 Monte múltipla com esse jogo'],
      });
    } catch (error: any) {
      return this.direct(intent, `Tentei buscar dados reais, mas não consegui validar agora.\n\nMotivo: ${error?.message || 'Falha ao consultar dados reais'}\n\nSem entrada aprovada.`, memory, profile, {
        waitingForData: true,
      });
    }
  }


  private async buildPremiumMatchAnalysis(
    fixture: any,
    richContext: FlashScoreRichContext | null,
    stats: any,
    research: ResearchResult | null,
    agentsRaw: string,
    statusText: string,
    hasRealContext: boolean,
  ): Promise<string> {
    const home = fixture?.teams?.home?.name || 'Casa';
    const away = fixture?.teams?.away?.name || 'Fora';
    const league = fixture?.league?.name || 'Liga não informada';
    const country = fixture?.league?.country || '';
    const statusShort = String(fixture?.fixture?.status?.short || 'NS').toUpperCase();
    const elapsed = fixture?.fixture?.status?.elapsed;
    const clock =
      elapsed !== null && elapsed !== undefined
        ? `${elapsed}'`
        : statusShort === 'NS'
          ? 'Pré-jogo'
          : statusShort;

    const homeGoals =
      fixture?.goals?.home ??
      fixture?.score?.fulltime?.home ??
      0;
    const awayGoals =
      fixture?.goals?.away ??
      fixture?.score?.fulltime?.away ??
      0;

    const statsSummary = this.buildStatsSummary(stats, richContext);
    const oddsSummary = this.buildFixtureOddsSummary(fixture, richContext);
    const newsSummary = this.buildNewsSummary(research);
    const engineSummary = this.extractEngineSummary(agentsRaw);

    const officialEntry =
      hasRealContext && oddsSummary.hasOdds
        ? 'Ainda assim, só libero entrada oficial se o mercado tiver preço justo e risco aceitável.'
        : 'Sem odds reais completas e validação final, não libero entrada oficial.';

    return `⚽ **${home} x ${away}**

🏆 ${league}${country ? ` — ${country}` : ''}
⏱️ Status: ${clock}
📊 Placar: ${homeGoals} x ${awayGoals}

📌 **Contexto FlashScore**
${this.buildRichContextSummary(richContext)}

📈 **Leitura da partida**
${this.describeMatchScenario(fixture, richContext, stats)}
${statusText}

📊 **Dados reais disponíveis**
${statsSummary.text}

💹 **Odds e mercado**
${oddsSummary.text}

📰 **Notícias / contexto externo**
${newsSummary}

🎯 **Mercados para monitorar**
${this.suggestMarketsFromContext(fixture, richContext, stats).map((item) => `• ${item}`).join('\n')}

⚠️ **Risco Oddix**
${this.buildRiskReading(hasRealContext, oddsSummary.hasOdds, statsSummary.hasStats)}

🧠 **Conclusão Oddix**
${engineSummary}
${officialEntry}`;
  }

  private buildStatsSummary(stats: any, richContext?: FlashScoreRichContext | null) {
    const source = stats || richContext?.statistics || richContext?.prematchStats || null;
    const available =
      !!source &&
      source?.simulated !== true &&
      (
        source?.available === true ||
        source?.realStatsAvailable === true ||
        Array.isArray(source?.statistics) ||
        Array.isArray(source?.data) ||
        Object.keys(source || {}).length > 0
      );

    if (!available) {
      return {
        hasStats: false,
        text: '⚠️ Estatísticas completas ainda não confirmadas. Vou tratar como cenário de observação, não como entrada validada.',
      };
    }

    const compact = this.compactObjectForText(source, 8);

    return {
      hasStats: true,
      text: `✅ Estatísticas reais recebidas.\n${compact ? `Resumo técnico: ${compact}` : 'Os dados foram recebidos, mas estão em formato bruto.'}`,
    };
  }

  private buildFixtureOddsSummary(fixture: any, richContext?: FlashScoreRichContext | null) {
    const odds =
      this.extractFixtureOdds(fixture) ||
      richContext?.odds ||
      this.extractFixtureOdds(richContext?.fixture) ||
      richContext?.prematchStats?.odds ||
      null;

    const options =
      Array.isArray(odds?.options)
        ? odds.options
        : [
            { name: '1', odd: odds?.home },
            { name: 'X', odd: odds?.draw },
            { name: '2', odd: odds?.away },
          ].filter((item: any) => Number(item.odd) > 1);

    if (!odds || !options?.length) {
      return {
        hasOdds: false,
        text: '⚠️ Odds reais ainda não detectadas. Sem preço de mercado, não existe entrada oficial.',
      };
    }

    const text = options
      .slice(0, 6)
      .map((item: any) => {
        const name = item?.name || item?.selection || item?.label || 'Mercado';
        const odd = Number(item?.odd || item?.odds || item?.value || 0);
        return Number.isFinite(odd) && odd > 1 ? `${name}: ${odd.toFixed(2)}` : null;
      })
      .filter(Boolean)
      .join(' • ');

    return {
      hasOdds: true,
      text: `✅ Odds reais detectadas${text ? `: ${text}` : '.'}`,
    };
  }

  private buildNewsSummary(research: ResearchResult | null) {
    if (!research) return 'Sem pesquisa externa relevante no momento.';
    if (!research.enabled) return research.summary || 'Pesquisa externa indisponível.';
    if (!research.items?.length) return research.summary || 'Nenhuma notícia relevante encontrada agora.';

    return research.items
      .slice(0, 3)
      .map((item) => `• ${item.title}${item.source ? ` — ${item.source}` : ''}`)
      .join('\n');
  }

  private suggestMarketsFromContext(fixture: any, richContext: FlashScoreRichContext | null, stats: any) {
    const status = String(fixture?.fixture?.status?.short || '').toUpperCase();
    const elapsed = Number(fixture?.fixture?.status?.elapsed || 0);
    const totalGoals =
      Number(fixture?.goals?.home ?? fixture?.score?.fulltime?.home ?? 0) +
      Number(fixture?.goals?.away ?? fixture?.score?.fulltime?.away ?? 0);

    const markets: string[] = [];

    if (status === 'NS') {
      markets.push('Over 1.5 gols se as estatísticas pré-jogo confirmarem volume ofensivo');
      markets.push('Dupla chance para reduzir variância');
      markets.push('Ambas marcam apenas se H2H/formas sustentarem');
    } else {
      if (totalGoals >= 2) markets.push('Over ao vivo apenas se a pressão continuar e a odd tiver valor');
      if (elapsed >= 45) markets.push('Mercado de próximo gol com cautela');
      markets.push('Escanteios ao vivo se houver pressão lateral e volume ofensivo');
      markets.push('Evitar entrada se odds estiverem esmagadas pelo placar');
    }

    if (richContext?.lineups) markets.push('Player Props se escalações e função tática estiverem confirmadas');
    if (!stats && !richContext?.statistics) markets.push('Aguardar estatísticas reais antes de qualquer entrada oficial');

    return markets.slice(0, 5);
  }

  private describeMatchScenario(fixture: any, richContext: FlashScoreRichContext | null, stats: any) {
    const status = String(fixture?.fixture?.status?.short || '').toUpperCase();
    const elapsed = Number(fixture?.fixture?.status?.elapsed || 0);
    const home = fixture?.teams?.home?.name || 'mandante';
    const away = fixture?.teams?.away?.name || 'visitante';
    const homeGoals = Number(fixture?.goals?.home ?? fixture?.score?.fulltime?.home ?? 0);
    const awayGoals = Number(fixture?.goals?.away ?? fixture?.score?.fulltime?.away ?? 0);

    if (status === 'SUSP' || status === 'SUSPENDED') {
      return 'A partida está suspensa. Nesse cenário, qualquer entrada ao vivo fica bloqueada até confirmação de retorno.';
    }

    if (status === 'PST' || status === 'POSTPONED') {
      return 'A partida está adiada. Não há leitura ao vivo válida enquanto o jogo não for retomado.';
    }

    if (status === 'NS') {
      return 'Cenário pré-jogo. A leitura depende de escalações, odds, H2H e estatísticas recentes.';
    }

    if (homeGoals > awayGoals) {
      return `${home} está em vantagem no placar. A leitura principal é entender se o time mantém controle ou se ${away} aumentou pressão para buscar reação.`;
    }

    if (awayGoals > homeGoals) {
      return `${away} está em vantagem no placar. A leitura principal é medir se ${home} tem volume real para reagir ou se o jogo está controlado pelo visitante.`;
    }

    if (elapsed > 0) {
      return `Jogo em andamento e empatado. A prioridade é medir pressão, finalizações, posse ofensiva e movimento de odds antes de qualquer entrada.`;
    }

    return 'Ainda não há cenário consolidado. Preciso de dados reais para transformar em leitura profissional.';
  }

  private buildRiskReading(hasRealContext: boolean, hasOdds: boolean, hasStats: boolean) {
    if (!hasRealContext) {
      return 'ALTO — faltam dados reais completos. A Oddix não recomenda entrada oficial.';
    }

    if (!hasOdds && !hasStats) {
      return 'ALTO — sem odds e sem estatísticas confirmadas.';
    }

    if (!hasOdds) {
      return 'MÉDIO/ALTO — existem dados de jogo, mas sem preço de mercado não dá para validar valor.';
    }

    if (!hasStats) {
      return 'MÉDIO/ALTO — há odds, mas faltam estatísticas para confirmar pressão e tendência.';
    }

    return 'MÉDIO — existem dados reais, mas a entrada depende do preço e do momento exato do jogo.';
  }

  private extractEngineSummary(agentsRaw: string) {
    const text = String(agentsRaw || '');

    const confidenceMatch =
      text.match(/Confian[cç]a(?: consolidada)?:?\s*(\d+)%/i) ||
      text.match(/ConfidenceEngineAgent:[\s\S]*?(\d+)%/i);

    const scoreMatch = text.match(/Score:\s*(\d+)\/100/i);
    const riskMatch = text.match(/Risco:?\s*([A-ZÀ-ÿ]+)/i);

    const confidence = confidenceMatch?.[1] ? Number(confidenceMatch[1]) : null;
    const score = scoreMatch?.[1] ? Number(scoreMatch[1]) : null;
    const risk = riskMatch?.[1] || null;

    if (confidence || score || risk) {
      return `Motor Oddix: ${score ? `score ${score}/100` : 'score em validação'}${confidence ? `, confiança ${confidence}%` : ''}${risk ? `, risco ${risk}` : ''}.`;
    }

    return 'Motor Oddix em modo de validação: vou priorizar dados reais, odds confirmadas e segurança antes de sugerir qualquer entrada.';
  }

  private compactObjectForText(input: any, maxItems = 8) {
    if (!input || typeof input !== 'object') return '';

    const entries: string[] = [];

    const walk = (obj: any, prefix = '', depth = 0) => {
      if (!obj || typeof obj !== 'object' || depth > 2 || entries.length >= maxItems) return;

      for (const [key, value] of Object.entries(obj)) {
        if (entries.length >= maxItems) break;
        if (value === null || value === undefined || value === '') continue;

        const label = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
          const stringValue = String(value);
          if (stringValue.length <= 40) entries.push(`${label}: ${stringValue}`);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          walk(value, label, depth + 1);
        }
      }
    };

    walk(input);

    return entries.join(' • ');
  }


  private async buildTeamOverview(teamName: string, memory: ConversationMemory, profile: UserBetProfile): Promise<ChatFootballResponse | null> {
    if (!this.footballService) return this.direct('ANALYZE', 'Módulo de futebol indisponível no momento.', memory, profile, { waitingForData: true });

    try {
      const fixtures = await this.getFixturesWindow(7, 10);
      const research = await this.researchTeamSafe(teamName);
      const aliases = this.teamAliases()[this.normalize(teamName)] || [teamName];
      const normalizedAliases = aliases.map((item) => this.normalize(item));

      const teamGames = fixtures
        .filter((game: any) => {
          const home = this.normalize(game?.teams?.home?.name);
          const away = this.normalize(game?.teams?.away?.name);
          return normalizedAliases.some((alias) => home.includes(alias) || away.includes(alias));
        })
        .sort((a: any, b: any) => new Date(a?.fixture?.date || 0).getTime() - new Date(b?.fixture?.date || 0).getTime());

      const teamAgent =
        this.agentsService?.buildTeamResearchAgent({
          teamName,
          fixtures: teamGames,
          research,
        } as any) || this.formatResearchBlock(research);

      const nextGame = teamGames.find((game: any) => !this.isFinished(game)) || teamGames[teamGames.length - 1];

      return this.human({
        intent: 'ANALYZE',
        userMessage: teamName,
        baseAnswer: `${teamAgent}\n\n${nextGame ? `Jogo de referência: ${nextGame?.teams?.home?.name} x ${nextGame?.teams?.away?.name}` : 'Ainda não encontrei jogo dessa equipe na janela atual.'}`,
        memory: { ...memory, lastTeam: teamName },
        profile,
        facts: { fixtures: teamGames, research },
        data: { fixture: nextGame, fixtures: teamGames, research, waitingForData: !teamGames.length },
        suggestions: nextGame
          ? [`🎯 Analisa ${nextGame?.teams?.home?.name} x ${nextGame?.teams?.away?.name}`, '🔥 Monte uma múltipla segura', '💰 Quanto ganho com R$20?']
          : this.waitingSuggestions(),
      });
    } catch (error: any) {
      return this.direct('ANALYZE', `Tentei buscar dados da equipe, mas não consegui concluir agora.\n\nMotivo: ${error?.message || 'Falha ao consultar dados reais'}`, memory, profile, {
        waitingForData: true,
      });
    }
  }

  private buildMultipleResponse(memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    const text =
      profile.mode === 'safe'
        ? 'Vou montar como múltipla segura: até 2 ou 3 seleções, odds baixas e mercados protegidos.'
        : profile.mode === 'aggressive'
          ? 'Vou montar como múltipla agressiva: odd maior, mas com risco claro e banca pequena.'
          : 'Vou montar como múltipla balanceada: risco controlado e odds sem exagero.';

    return this.direct('MULTIPLE', `🔥 Entendi. Você quer múltipla.\n\n${text}\n\nPara montar com jogos reais, mande "mostrar jogos de hoje" ou escolha os jogos.`, memory, profile, {
      waitingForData: true,
    });
  }

  private buildPlayerPropsResponse(message: string, memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    const teams = this.extractTeams(message);
    return this.direct('PLAYER_PROPS', `👤 Entendi que você quer Player Props.\n\n${teams ? `Jogo detectado: ${teams.home} x ${teams.away}` : 'Ainda não detectei o jogo.'}\n\nEu preciso validar partida real, escalações, estatísticas de jogadores e odds reais.`, memory, profile, {
      waitingForData: !teams,
    });
  }

  private buildLiveResponse(memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    return this.direct('LIVE', '⚡ No live eu olho pressão, finalizações, chutes no gol, escanteios, minuto do jogo e movimento de odds. Mande o jogo ao vivo ou peça "analise jogos ao vivo".', memory, profile);
  }

  private buildVirtualResponse(memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    return this.direct('VIRTUAL', '🎮 No futebol virtual eu analiso padrões repetitivos: Over 1.5, Over 2.5, BTTS, dupla chance, ROI e histórico virtual.', memory, profile);
  }

  private buildSimpleBetResponse(memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    return this.direct('SIMPLE', '🎯 Para aposta simples segura, eu priorizo dupla chance, over 0.5, over 1.5, time marca 1+ gol e handicap +1.5. Mande o jogo para validar com dados reais.', memory, profile);
  }

  private buildBetCalculatorResponse(calc: BetCalc, message: string, memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    return this.direct('BANKROLL', `💰 Você perguntou: "${message}"\n\nValor apostado: R$${this.money(calc.stake)}\nOdd: ${calc.odd.toFixed(2)}\n\nRetorno total: R$${this.money(calc.retorno)}\nLucro líquido: R$${this.money(calc.lucro)}\n\nFórmula: retorno = valor apostado x odd.`, memory, profile, {
      amount: calc.stake,
      odd: calc.odd,
      potentialReturn: calc.retorno,
      profit: calc.lucro,
    });
  }

  private explainBankroll(message: string, ticket: ChatTicket | null, memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    const amount = this.extractMoney(message) || 20;
    const odd = this.extractOdd(message) || ticket?.oddTotal || 1;
    return this.buildBetCalculatorResponse(
      { stake: amount, odd, retorno: amount * odd, lucro: amount * odd - amount },
      message,
      memory,
      profile,
    );
  }

  private direct(intent: ChatIntent, answer: string, memory: ConversationMemory, profile: UserBetProfile, data: Record<string, any> = {}): ChatFootballResponse {
    if (this.responseBuilder) {
      return this.responseBuilder.buildDirect({ intent, answer, memory, profile, data });
    }

    return { success: true, intent, answer, data: { ...data, memory, profile, suggestions: this.defaultSuggestions(intent) } };
  }

  private async human(input: {
    intent: ChatIntent;
    userMessage: string;
    baseAnswer: string;
    memory: ConversationMemory;
    profile: UserBetProfile;
    facts?: any;
    suggestions?: string[];
    data?: Record<string, any>;
  }): Promise<ChatFootballResponse> {
    if (this.responseBuilder) return this.responseBuilder.buildHumanAnswer(input);
    return this.direct(input.intent, input.baseAnswer, input.memory, input.profile, input.data || {});
  }

  private noContext(intent: ChatIntent, memory: ConversationMemory, profile: UserBetProfile): ChatFootballResponse {
    return this.direct(intent, 'Ainda não tenho um jogo ou bilhete anterior para usar como contexto. Me mande primeiro: "Analisa Time A x Time B" ou "Mostrar jogos de hoje".', memory, profile, {
      waitingForData: true,
    });
  }

  private buildWelcomeText() {
    return `🔥 Fala, Pedro! A Oddix IA agora trabalha em modo conversa.

Pode perguntar naturalmente:
• "Mostre os melhores palpites de hoje"
• "Analisa Flamengo x Palmeiras"
• "Esse jogo vale over?"
• "Me dá uma opção mais segura"
• "Quanto ganho com R$20 na odd 1.85?"

Eu entendo intenção, uso memória da conversa, busco dados reais e respondo sem inventar entrada.`;
  }

  private buildFallbackText(message: string, memory: ConversationMemory) {
    return `Entendi sua pergunta: "${message}".\n\nAinda preciso transformar isso em análise de aposta. ${memory.lastMatch ? `Posso continuar do contexto: ${memory.lastMatch.label}.` : 'Você pode me mandar um jogo específico ou pedir os melhores palpites de hoje.'}`;
  }

  private formatTicketExplanation(ticket: ChatTicket) {
    return `🧠 Explicando o último bilhete:\n\n${ticket.selections
      .map((item, index) => `${index + 1}️⃣ ${item.game}\n✅ ${item.markets.join('\n✅ ')}\nConfiança: ${item.confidence}%\nRisco: ${item.risk}\nMotivo: ${item.reason}`)
      .join('\n\n')}\n\nOdd total: ${ticket.oddTotal.toFixed(2)}\nConfiança geral: ${ticket.confidence}%`;
  }

  private formatTicketRisk(ticket: ChatTicket) {
    return `⚠️ Risco do bilhete:\n\nOdd total: ${ticket.oddTotal.toFixed(2)}\nConfiança: ${ticket.confidence}%\nStatus: ${ticket.status}\n\n${ticket.selections.map((item) => `• ${item.game}: ${item.risk} — ${item.confidence}%`).join('\n')}`;
  }

  private async getFixturesWindow(daysBack = 3, daysForward = 7): Promise<any[]> {
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
        const response: any = await this.footballService.getFixtures(date);
        all.push(...this.extractFixtureArray(response));
      } catch {
        // ignora falha pontual
      }
    }

    const seen = new Set<string>();
    return all.filter((game: any) => {
      const id = String(game?.fixture?.id || `${game?.teams?.home?.name}-${game?.teams?.away?.name}-${game?.fixture?.date}`);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }


  private async getMatchSearchFixtures(daysBack = 3, daysForward = 7): Promise<any[]> {
    const windowFixtures = await this.getFixturesWindow(daysBack, daysForward);
    const service: any = this.footballService as any;
    const liveFixtures: any[] = [];
    const liveMethods = [
      () => service?.getLiveFixturesFromFlashScore?.(),
      () => service?.getLiveFixtures?.(),
      () => service?.getLiveMatches?.(),
      () => service?.getLive?.(),
    ];

    for (const method of liveMethods) {
      try {
        const response = await method();
        liveFixtures.push(...this.extractFixtureArray(response));
      } catch {
        // ignora fonte live indisponível
      }
    }

    const seen = new Set<string>();
    return [...liveFixtures, ...windowFixtures].filter((game: any) => {
      const id = String(
        game?.fixture?.id ||
          game?.fixture?.externalId ||
          game?.fixture?.external_id ||
          `${this.getFixtureHomeName(game)}-${this.getFixtureAwayName(game)}-${game?.fixture?.date || ''}`,
      );
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private async getFlashScoreRichContextSafe(fixtureId: string, fixture: any): Promise<FlashScoreRichContext | null> {
    if (!fixtureId || !this.footballService) return null;

    const service: any = this.footballService as any;

    try {
      let rich: FlashScoreRichContext | null = null;

      if (typeof service.getFlashScoreRichContext === 'function') {
        rich = await service.getFlashScoreRichContext(fixtureId, fixture);
      }

      if (!rich) {
        const statistics = typeof service.getStatistics === 'function' ? await service.getStatistics(fixtureId) : null;

        rich = {
          ok: !!(
            statistics?.available ||
            statistics?.ok ||
            statistics?.success ||
            statistics?.data?.available ||
            fixture?.odds
          ),
          source: 'football-service',
          fixture,
          fixtureId,
          statistics,
          odds: fixture?.odds || null,
          h2h: null,
          lineups: null,
          prematchStats: null,
          errors: [],
        };
      }

      const resolvedFixture = rich.fixture || fixture;
      const resolvedOdds =
        rich.odds ||
        this.extractFixtureOdds(resolvedFixture) ||
        this.extractFixtureOdds(fixture) ||
        null;

      const normalizedStats = this.normalizeRichStatistics(rich.statistics);
      const statisticsSummary = this.buildStatisticsSummary(normalizedStats);
      const pressureSummary = this.buildPressureSummary(statisticsSummary, resolvedFixture);
      const oddsSummary = this.buildOddsSummary(resolvedOdds);

      return {
        ...rich,
        ok: !!(
          rich.ok ||
          statisticsSummary.available ||
          oddsSummary.available ||
          rich.h2h ||
          rich.lineups ||
          rich.prematchStats?.available
        ),
        fixture: resolvedFixture,
        fixtureId: rich.fixtureId || fixtureId,
        statistics: normalizedStats || rich.statistics || null,
        statisticsSummary,
        pressureSummary,
        oddsSummary,
        odds: resolvedOdds,
        errors: rich.errors || [],
      };
    } catch (error: any) {
      return {
        ok: false,
        source: 'football-service',
        fixture,
        fixtureId,
        statisticsSummary: this.emptyStatisticsSummary(),
        pressureSummary: this.emptyPressureSummary(),
        oddsSummary: this.emptyOddsSummary(),
        errors: [error?.message || 'Falha ao montar contexto rico'],
      };
    }
  }

  private normalizeRichStatistics(statistics: any) {
    if (!statistics) return null;

    if (statistics?.data?.available || Array.isArray(statistics?.data?.teams)) {
      return statistics.data;
    }

    if (statistics?.available !== undefined || Array.isArray(statistics?.teams)) {
      return statistics;
    }

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
      home: {
        possession: null,
        totalShots: null,
        shotsOnGoal: null,
        corners: null,
        attacks: null,
        dangerousAttacks: null,
      },
      away: {
        possession: null,
        totalShots: null,
        shotsOnGoal: null,
        corners: null,
        attacks: null,
        dangerousAttacks: null,
      },
      rawAvailableStats: [],
    };
  }

  private emptyPressureSummary() {
    return {
      available: false,
      leader: null,
      homeScore: 0,
      awayScore: 0,
      homeLevel: 'BAIXA',
      awayLevel: 'BAIXA',
      reading: 'Sem estatísticas reais suficientes para medir pressão.',
    };
  }

  private emptyOddsSummary() {
    return {
      available: false,
      source: 'none',
      market: null,
      options: [],
      reading: 'Odds não validadas.',
    };
  }

  private buildStatisticsSummary(statistics: any) {
    const summary = this.emptyStatisticsSummary();

    if (!statistics) return summary;

    const teams = Array.isArray(statistics?.teams)
      ? statistics.teams
      : Array.isArray(statistics?.response)
        ? statistics.response
        : [];

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

    summary.home.totalShots = read(homeRows, ['total shots', 'shots', 'finalizacoes', 'finalizacoes totais']);
    summary.away.totalShots = read(awayRows, ['total shots', 'shots', 'finalizacoes', 'finalizacoes totais']);

    summary.home.shotsOnGoal = read(homeRows, ['shots on goal', 'shots on target', 'chutes no gol']);
    summary.away.shotsOnGoal = read(awayRows, ['shots on goal', 'shots on target', 'chutes no gol']);

    summary.home.corners = read(homeRows, ['corner kicks', 'corners', 'escanteios']);
    summary.away.corners = read(awayRows, ['corner kicks', 'corners', 'escanteios']);

    summary.home.attacks = read(homeRows, ['attacks', 'ataques']);
    summary.away.attacks = read(awayRows, ['attacks', 'ataques']);

    summary.home.dangerousAttacks = read(homeRows, ['dangerous attacks', 'ataques perigosos']);
    summary.away.dangerousAttacks = read(awayRows, ['dangerous attacks', 'ataques perigosos']);

    summary.available = [
      summary.home.possession,
      summary.away.possession,
      summary.home.totalShots,
      summary.away.totalShots,
      summary.home.shotsOnGoal,
      summary.away.shotsOnGoal,
      summary.home.corners,
      summary.away.corners,
      summary.home.attacks,
      summary.away.attacks,
      summary.home.dangerousAttacks,
      summary.away.dangerousAttacks,
    ].some((value) => value !== null && value !== undefined);

    summary.source = statistics?.source || 'flashscore';
    summary.rawAvailableStats = [...homeRows, ...awayRows]
      .map((row: any) => row?.type || row?.name || row?.label || row?.key)
      .filter(Boolean)
      .slice(0, 20);

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
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toStatNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const raw = String(value).replace(',', '.');
    const parsed = Number(raw.replace('%', '').replace(/[^0-9.-]/g, ''));

    return Number.isFinite(parsed) ? parsed : null;
  }

  private buildPressureSummary(statisticsSummary: any, fixture: any) {
    if (!statisticsSummary?.available) return this.emptyPressureSummary();

    const home = statisticsSummary.home || {};
    const away = statisticsSummary.away || {};

    const score = (team: any) => {
      const possession = Number(team.possession || 0);
      const shots = Number(team.totalShots || 0);
      const onGoal = Number(team.shotsOnGoal || 0);
      const corners = Number(team.corners || 0);
      const attacks = Number(team.attacks || 0);
      const dangerous = Number(team.dangerousAttacks || 0);

      return Number((
        possession * 0.25 +
        shots * 3 +
        onGoal * 7 +
        corners * 4 +
        attacks * 0.15 +
        dangerous * 0.45
      ).toFixed(1));
    };

    const homeScore = score(home);
    const awayScore = score(away);
    const homeName = fixture?.teams?.home?.name || 'Mandante';
    const awayName = fixture?.teams?.away?.name || 'Visitante';
    const diff = Math.abs(homeScore - awayScore);
    const leader = diff < 8 ? 'equilibrado' : homeScore > awayScore ? homeName : awayName;

    const level = (value: number) => {
      if (value >= 85) return 'MUITO ALTA';
      if (value >= 65) return 'ALTA';
      if (value >= 42) return 'MÉDIA';
      return 'BAIXA';
    };

    return {
      available: true,
      leader,
      homeScore,
      awayScore,
      homeLevel: level(homeScore),
      awayLevel: level(awayScore),
      reading:
        leader === 'equilibrado'
          ? 'Jogo equilibrado em pressão pelos dados disponíveis.'
          : `${leader} tem maior pressão pelos dados ao vivo.`,
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

    if (!options.length) return this.emptyOddsSummary();

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
          const name = String(
            this.readLoose(item, ['name', 'nome', 'label', 'selection', 'market', 'mercado']) || '',
          ).trim();
          const odd = this.toOddNumber(
            this.readLoose(item, ['odd', 'odds', 'value', 'price', 'cotacao', 'cotação']),
          );

          return { name, odd };
        })
        .filter((item: { name: string; odd: number | null }): item is { name: string; odd: number } => {
          return !!item.name && typeof item.odd === 'number' && Number.isFinite(item.odd) && item.odd > 1;
        });

      if (normalized.length) return normalized.slice(0, 12);
    }

    const fallback: Array<{ name: string; odd: number }> = [];
    const add = (name: string, value: any) => {
      const odd = this.toOddNumber(value);
      if (odd && odd > 1) fallback.push({ name, odd });
    };

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

  private buildRichContextSummary(rich?: FlashScoreRichContext | null) {
    if (!rich) return '🧠 Contexto rico: ainda não disponível.';

    const stats = rich.statisticsSummary || this.buildStatisticsSummary(this.normalizeRichStatistics(rich.statistics));
    const pressure = rich.pressureSummary || this.buildPressureSummary(stats, rich.fixture);
    const odds = rich.oddsSummary || this.buildOddsSummary(rich.odds || this.extractFixtureOdds(rich.fixture));

    const home = rich.fixture?.teams?.home?.name || 'Mandante';
    const away = rich.fixture?.teams?.away?.name || 'Visitante';

    if (!stats?.available) {
      const oddsLine = odds?.available
        ? `✅ Odds validadas (${odds.market || '1X2'}): ${odds.options.map((item: any) => `${item.name} ${item.odd}`).join(' | ')}`
        : '⚠️ Odds pendentes';

      return `🧠 Contexto real:
⚠️ Estatísticas ao vivo pendentes
${oddsLine}
${rich.h2h ? '✅ H2H' : '⚠️ H2H pendente'}
${rich.lineups ? '✅ Escalações' : '⚠️ Escalações pendentes'}

Leitura: sem posse, finalizações, escanteios ou ataques perigosos validados. Não liberar entrada oficial baseada em pressão. Se houver odds validadas, use apenas como cotação observada, não como entrada oficial.`;
    }

    const fmt = (value: any, suffix = '') => value !== null && value !== undefined ? `${value}${suffix}` : '—';
    const oddsLine = odds?.available
      ? `✅ Odds: ${odds.options.map((item: any) => `${item.name} ${item.odd}`).join(' | ')}`
      : '⚠️ Odds pendentes';

    return `🧠 Contexto real validado:
📊 Posse: ${home} ${fmt(stats.home.possession, '%')} x ${fmt(stats.away.possession, '%')} ${away}
🎯 Finalizações: ${fmt(stats.home.totalShots)} x ${fmt(stats.away.totalShots)}
🥅 Chutes no gol: ${fmt(stats.home.shotsOnGoal)} x ${fmt(stats.away.shotsOnGoal)}
🚩 Escanteios: ${fmt(stats.home.corners)} x ${fmt(stats.away.corners)}
🔥 Ataques perigosos: ${fmt(stats.home.dangerousAttacks)} x ${fmt(stats.away.dangerousAttacks)}
⚡ Pressão: ${pressure.reading} (${home}: ${pressure.homeLevel} / ${away}: ${pressure.awayLevel})
${oddsLine}
${rich.h2h ? '✅ H2H' : '⚠️ H2H pendente'}
${rich.lineups ? '✅ Escalações' : '⚠️ Escalações pendentes'}`;
  }

  private findMatch(fixtures: any[], homeQueryRaw: string, awayQueryRaw: string) {
    const homeQuery = this.normalizeTeamSearch(this.cleanMatchTeamName(homeQueryRaw));
    const awayQuery = this.normalizeTeamSearch(this.cleanMatchTeamName(awayQueryRaw));

    if (!homeQuery || !awayQuery) return null;

    return fixtures.find((item: any) => {
      const home = this.normalizeTeamSearch(this.getFixtureHomeName(item));
      const away = this.normalizeTeamSearch(this.getFixtureAwayName(item));
      const combined = `${home} ${away}`.trim();
      const reversed = `${away} ${home}`.trim();
      const queryCombined = `${homeQuery} ${awayQuery}`.trim();
      const queryReversed = `${awayQuery} ${homeQuery}`.trim();

      return (
        (home.includes(homeQuery) && away.includes(awayQuery)) ||
        (home.includes(awayQuery) && away.includes(homeQuery)) ||
        (homeQuery.includes(home) && awayQuery.includes(away)) ||
        (homeQuery.includes(away) && awayQuery.includes(home)) ||
        combined.includes(queryCombined) ||
        reversed.includes(queryCombined) ||
        queryCombined.includes(combined) ||
        queryCombined.includes(reversed) ||
        queryReversed.includes(combined) ||
        queryReversed.includes(reversed) ||
        (queryCombined.includes(home) && queryCombined.includes(away) && home.length >= 3 && away.length >= 3) ||
        (queryReversed.includes(home) && queryReversed.includes(away) && home.length >= 3 && away.length >= 3)
      );
    }) || null;
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

  private async listRealGames(intent: ChatIntent, memory: ConversationMemory, profile: UserBetProfile): Promise<ChatFootballResponse> {
    if (!this.footballService) return this.direct(intent, 'Módulo de jogos reais indisponível.', memory, profile, { waitingForData: true });

    try {
      const response: any = await this.footballService.getFixtures();
      const fixtures = this.extractFixtureArray(response)
        .filter((item: any) => item?.teams?.home?.name && item?.teams?.away?.name)
        .slice(0, 20);

      if (!fixtures.length) return this.direct(intent, 'Ainda não encontrei jogos disponíveis na base atual.', memory, profile, { waitingForData: true });

      const gamesText = fixtures
        .map((item: any, index: number) => `${index + 1}️⃣ ${item?.teams?.home?.name || 'Casa'} x ${item?.teams?.away?.name || 'Fora'}\n🏆 ${item?.league?.name || 'Liga não informada'}\n⏰ ${this.formatKickoff(item?.fixture?.date)}\n📌 ${item?.fixture?.status?.short || 'NS'}`)
        .join('\n\n');

      return this.direct(intent, `Encontrei ${fixtures.length} jogos na base Oddix.\n\n${gamesText}\n\nAgora me diga qual jogo quer analisar.`, memory, profile, {
        fixtures,
      });
    } catch (error: any) {
      return this.direct(intent, `Erro ao buscar jogos: ${error?.message || 'Falha ao consultar FootballService'}`, memory, profile, {
        waitingForData: true,
      });
    }
  }

  private scoreFixtureForTopPick(game: any, profile: UserBetProfile): number {
    let score = 55;
    const league = this.normalize(game?.league?.name);
    const home = this.normalize(game?.teams?.home?.name);
    const away = this.normalize(game?.teams?.away?.name);

    const premium = ['brasileirao', 'serie a', 'libertadores', 'sul americana', 'champions', 'europa league', 'premier league', 'la liga', 'bundesliga', 'ligue 1', 'primeira liga', 'eredivisie', 'mls', 'argentina', 'mexico'];
    const blocked = ['u17', 'u19', 'u20', 'u21', 'u23', 'women', 'feminino', 'reserves', 'reserve', 'amateur', 'friendly', 'amistoso', 'esoccer', 'virtual'];

    if (premium.some((term) => league.includes(term))) score += 18;
    if (blocked.some((term) => league.includes(term) || home.includes(term) || away.includes(term))) score -= 25;
    if (game?.fixture?.date) score += 5;
    if (game?.teams?.home?.logo && game?.teams?.away?.logo) score += 4;
    if (profile.mode === 'safe') score -= 3;
    if (profile.mode === 'aggressive') score += 3;

    return Math.max(0, Math.min(95, score));
  }

  private extractBetCalculation(message: string, ticket: ChatTicket | null): BetCalc | null {
    const amount = this.extractMoney(message);
    const odd = this.extractOdd(message) || ticket?.oddTotal || null;

    if (!amount || !odd || odd <= 1) return null;

    return {
      stake: amount,
      odd,
      retorno: amount * odd,
      lucro: amount * odd - amount,
    };
  }

  private extractOdd(message: string): number | null {
    const normalized = String(message || '').replace(',', '.');
    const match = normalized.match(/odd\s*(\d+(\.\d+)?)/i) || normalized.match(/@(\d+(\.\d+)?)/i) || normalized.match(/\b(\d+\.\d{2})\b/i);
    const value = Number(match?.[1]);
    return Number.isFinite(value) && value > 1 ? value : null;
  }

  private extractMoney(message: string): number | null {
    const normalized = String(message || '').replace(',', '.');
    const match = normalized.match(/r\$\s*(\d+(\.\d+)?)/i) || normalized.match(/(\d+(\.\d+)?)\s*reais/i) || normalized.match(/com\s+(\d+(\.\d+)?)/i);
    const value = Number(match?.[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private isOddixFootballQuestion(message: string) {
    const text = this.clean(message);

    const footballKeywords = [
      'jogo',
      'jogos',
      'partida',
      'partidas',
      'time',
      'times',
      'futebol',
      'gol',
      'gols',
      'escanteio',
      'escanteios',
      'cartao',
      'cartão',
      'chute',
      'finalizacao',
      'finalização',
      'odd',
      'odds',
      'aposta',
      'apostas',
      'palpite',
      'palpites',
      'entrada',
      'entradas',
      'top pick',
      'top picks',
      'multipla',
      'múltipla',
      'bilhete',
      'combinada',
      'ao vivo',
      'live',
      'virtual',
      'value',
      'mercado',
      'banca',
      'retorno',
      'lucro',
      'quanto ganho',
      'over',
      'under',
      'btts',
      'ambas marcam',
      'dupla chance',
      'handicap',
      'player props',
      'jogador',
      'flamengo',
      'palmeiras',
      'corinthians',
      'santos',
      'vasco',
      'botafogo',
      'fluminense',
      'sao paulo',
      'são paulo',
      'cruzeiro',
      'gremio',
      'grêmio',
      'internacional',
      'atletico',
      'atlético',
      'real madrid',
      'barcelona',
      'psg',
      'manchester',
      'liverpool',
      'arsenal',
      'chelsea',
      'bayern',
      'juventus',
      'milan',
      'inter de milao',
      'inter de milão',
      'brasil',
      'argentina',
      'espanha',
      'portugal',
      'franca',
      'frança',
      'inglaterra',
      'alemanha',
      'italia',
      'itália',
    ];

    if (footballKeywords.some((keyword) => text.includes(this.clean(keyword)))) {
      return true;
    }

    return !!this.extractTeams(message);
  }

  private shouldListGames(message: string) {
    const text = this.clean(message);
    return text.includes('jogos de hoje') || text.includes('mostrar jogos') || text.includes('mostra jogos') || text.includes('quais jogos') || text.includes('lista jogos') || text === 'jogos' || text === 'partidas';
  }

  private isContextFollowUp(text: string) {
    return text.includes('esse jogo') || text.includes('essa partida') || text.includes('essa multipla') || text.includes('essa múltipla') || text.includes('continua') || text.includes('segunda opcao') || text.includes('segunda opção') || text.includes('outra opcao') || text.includes('outra opção') || text.includes('mais segura') || text.includes('mais agressiva') || text.includes('vale a pena');
  }

  private extractFixtureArray(response: any) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.fixtures)) return response.fixtures;
    if (Array.isArray(response?.games)) return response.games;
    if (Array.isArray(response?.matches)) return response.matches;
    if (Array.isArray(response?.items)) return response.items;
    return [];
  }


  private sanitizeMatchQuery(message: string) {
    return String(message || '')
      .replace(/[–—]/g, ' ')
      .replace(/\b\d+\s*x\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*-\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*:\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanMatchTeamName(value: any) {
    return String(value || '')
      .replace(/\b\d+\b/g, '')
      .replace(/\bplacar\b/gi, '')
      .replace(/\bao vivo\b/gi, '')
      .replace(/\blive\b/gi, '')
      .replace(/\bhoje\b/gi, '')
      .replace(/\bagora\b/gi, '')
      .replace(/\bminuto\b/gi, '')
      .replace(/\btempo\b/gi, '')
      .replace(/[?!.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTeams(message: string) {
    const sanitized = this.sanitizeMatchQuery(message);

    const cleaned = sanitized
      .replace(/analisa/gi, '')
      .replace(/analisar/gi, '')
      .replace(/analise/gi, '')
      .replace(/análise/gi, '')
      .replace(/player props/gi, '')
      .trim();

    for (const separator of [' x ', ' vs ', ' v ', ' versus ', ' contra ']) {
      const normalized = cleaned.toLowerCase();
      if (normalized.includes(separator)) {
        const parts = normalized.split(separator);
        if (parts[0]?.trim() && parts[1]?.trim()) {
          return {
            home: this.cleanMatchTeamName(parts[0]),
            away: this.cleanMatchTeamName(parts[1]),
          };
        }
      }
    }

    return null;
  }

  private extractTeamTopic(message: string): string | null {
    const text = this.clean(message);
    if (text.includes(' x ') || text.includes(' vs ')) return null;

    const aliases = this.teamAliases();
    for (const [canonical, names] of Object.entries(aliases)) {
      if (names.some((name) => text.includes(this.clean(name)))) return canonical;
    }

    const triggers = ['como esta', 'como está', 'me fale', 'fala do', 'fale do', 'fale da', 'sobre o', 'sobre a', 'noticias', 'notícias', 'estatisticas', 'estatísticas', 'proximo jogo', 'próximo jogo', 'selecao', 'seleção', 'time do', 'time da'];
    if (!triggers.some((trigger) => text.includes(this.clean(trigger)))) return null;

    const cleaned = text
      .replace(/chat|me fale|fala|fale|sobre|como esta|como está|a selecao|a seleção|selecao|seleção|do|da|de|o time|time/g, '')
      .trim();

    return cleaned.length >= 3 ? cleaned : null;
  }

  private teamAliases(): Record<string, string[]> {
    return {
      espanha: ['espanha', 'seleção da espanha', 'selecao da espanha', 'spain'],
      brasil: ['brasil', 'seleção do brasil', 'selecao do brasil', 'brazil'],
      argentina: ['argentina'],
      portugal: ['portugal'],
      uruguai: ['uruguai', 'uruguay'],
      franca: ['franca', 'frança', 'france'],
      inglaterra: ['inglaterra', 'england'],
      alemanha: ['alemanha', 'germany'],
      italia: ['italia', 'itália', 'italy'],
      flamengo: ['flamengo'],
      palmeiras: ['palmeiras'],
      corinthians: ['corinthians'],
      santos: ['santos'],
      vasco: ['vasco'],
      botafogo: ['botafogo'],
      fluminense: ['fluminense'],
      cruzeiro: ['cruzeiro'],
      gremio: ['gremio', 'grêmio'],
      internacional: ['internacional'],
      'sao paulo': ['sao paulo', 'são paulo'],
      'atletico mineiro': ['atletico mineiro', 'atlético mineiro'],
    };
  }

  private async researchTeamSafe(teamName: string): Promise<ResearchResult | null> {
    if (!this.researchService) return null;
    try { return await this.researchService.researchTeam(teamName); } catch { return null; }
  }

  private async researchMatchSafe(home: string, away: string): Promise<ResearchResult | null> {
    if (!this.researchService) return null;
    try { return await this.researchService.researchMatch(home, away); } catch { return null; }
  }

  private formatResearchBlock(research: ResearchResult | null) {
    if (!research) return '📰 Pesquisa externa: agente ainda não configurado.';
    if (!research.enabled || !research.items?.length) return `📰 Pesquisa externa: ${research.summary || 'sem notícia relevante agora.'}`;
    return `📰 Notícias:\n\n${research.items.slice(0, 5).map((item) => `• ${item.title}${item.source ? ` — ${item.source}` : ''}${item.description ? `\n  ${item.description}` : ''}`).join('\n\n')}`;
  }

  private findLastTicket(history: ChatHistoryMessage[]): ChatTicket | null {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const ticket = history[index]?.data?.ticket;
      if (ticket?.selections?.length) return ticket;
    }
    return null;
  }

  private buildMemoryFallback(history: ChatHistoryMessage[]): ConversationMemory {
    return { topicStack: [], lastTicket: this.findLastTicket(history) };
  }

  private buildProfileFallback(payload: ChatFootballRequest | any): UserBetProfile {
    return {
      mode: payload?.mode || 'balanced',
      maxOdd: 3,
      stakeLimitPercent: 2,
      preferredMarkets: ['over 1.5', 'dupla chance'],
      blockedMarkets: [],
      language: 'pt-BR',
    };
  }

  private defaultSuggestions(intent: ChatIntent) {
    if (intent === 'TOP_PICKS') return ['🎯 Analise o melhor jogo', '🔥 Monte múltipla segura', '💰 Quanto ganho com R$20?', '📈 Jogos ao vivo'];
    return ['🏆 Melhores palpites de hoje', '⚽ Analisa um jogo', '🔥 Monte uma múltipla', '💰 Calcular retorno'];
  }

  private waitingSuggestions() {
    return ['🔄 Tentar novamente', '🏆 Mostrar jogos de hoje', '🎮 Futebol Virtual', '📈 Jogos ao vivo'];
  }

  private isFinished(game: any) {
    const short = String(game?.fixture?.status?.short || '').toUpperCase();
    return ['FT', 'AET', 'PEN', 'CANC', 'PST'].includes(short);
  }

  private formatKickoff(value: any) {
    if (!value) return 'Horário não informado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Horário não informado';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private money(value: number) {
    return Number(value || 0).toFixed(2).replace('.', ',');
  }

  private normalize(value: any) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private clean(value: string) {
    return this.normalize(value);
  }
}
