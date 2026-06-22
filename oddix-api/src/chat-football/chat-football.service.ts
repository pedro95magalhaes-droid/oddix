import { Injectable, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import { FootballResearchService, ResearchResult } from './football-research.service';
import { FootballAgentsService } from './football-agents.service';
import type {
  ChatFootballRequest,
  ChatFootballResponse,
  ChatHistoryMessage,
  ChatIntent,
  ChatTicket,
} from './chat-football.types';

type OddixBrain = {
  message: string;
  text: string;
  intent: ChatIntent;
  teams: { home: string; away: string } | null;
  topicTeam: string | null;
  lastContext: string | null;
};

type BetCalc = {
  stake: number;
  odd: number;
  retorno: number;
  lucro: number;
};

type FlashScoreRichContext = {
  ok?: boolean;
  source?: string;
  fixture?: any;
  fixtureId?: string;
  flashScoreExternalId?: string | null;
  statistics?: any;
  odds?: any;
  h2h?: any;
  lineups?: any;
  prematchStats?: any;
  raw?: any;
  errors?: string[];
};


@Injectable()
export class ChatFootballService {
  constructor(
    @Optional()
    private readonly footballService?: FootballService,

    @Optional()
    private readonly researchService?: FootballResearchService,

    @Optional()
    private readonly agentsService?: FootballAgentsService,
  ) {}

  async handleMessage(payload: ChatFootballRequest | any): Promise<ChatFootballResponse> {
    const message = this.readMessage(payload);
    const history = this.readHistory(payload);
    const lastTicket = this.findLastTicket(history);
    const brain = this.buildBrain(message, history);

    if (!message.trim()) return this.buildSmartWelcome();

    const betCalc = this.extractBetCalculation(message, lastTicket);
    if (betCalc) return this.buildBetCalculatorResponse(betCalc, message);

    if (brain.intent === 'EXPLAIN_LAST') {
      if (!lastTicket) return this.buildNoContextResponse('EXPLAIN_LAST');
      return this.explainLastTicket(lastTicket);
    }

    if (brain.intent === 'RISK_EXPLAIN') {
      if (!lastTicket) return this.buildNoContextResponse('RISK_EXPLAIN');
      return this.explainRisk(lastTicket);
    }

    if (this.isContextFollowUp(brain.text)) {
      return this.buildContextualResponse(message, brain.lastContext, lastTicket);
    }

    if (brain.intent === 'LIST_MATCHES' || this.shouldListGames(message)) {
      return this.listRealGames(brain.intent);
    }

    if (brain.intent === 'TOP_PICKS' || brain.intent === 'ASK_RECOMMENDATION') {
      return this.buildTopPicksResponse();
    }

    if (brain.intent === 'MULTIPLE') return this.buildMultipleRequestResponse();

    if (brain.intent === 'PLAYER_PROPS') return this.buildPlayerPropsResponse(message);

    if (brain.intent === 'LIVE') return this.buildLiveResponse();

    if (brain.intent === 'VIRTUAL') return this.buildVirtualResponse();

    if (brain.topicTeam) {
      const teamOverview = await this.buildTeamOverview(brain.topicTeam);
      if (teamOverview) return teamOverview;
    }

    const realAnalysis = await this.analyzeRealMatch(message, brain.intent);
    if (realAnalysis) return realAnalysis;

    if (brain.intent === 'SIMPLE') return this.buildSimpleBetResponse();

    if (brain.intent === 'BANKROLL') return this.explainBankroll(message, lastTicket);

    return this.buildSmartFallback(message);
  }

  private readMessage(payload: any) {
    if (typeof payload === 'string') return payload;

    return String(
      payload?.message ||
        payload?.text ||
        payload?.prompt ||
        payload?.question ||
        payload?.content ||
        '',
    );
  }

  private readHistory(payload: any): ChatHistoryMessage[] {
    const history = Array.isArray(payload?.history) ? payload.history : [];
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];

    return [...history, ...messages] as ChatHistoryMessage[];
  }

  private buildBrain(message: string, history: ChatHistoryMessage[]): OddixBrain {
    const text = this.clean(message);
    const intent = this.detectIntent(message);
    const teams = this.extractTeams(message);
    const topicTeam = teams ? null : this.extractTeamTopic(message);
    const lastContext = this.findLastUserContext(history);

    return {
      message,
      text,
      intent,
      teams,
      topicTeam,
      lastContext,
    };
  }

  private detectIntent(message: string): ChatIntent {
    const text = this.clean(message);

    if (
      text.includes('quanto ganho') ||
      text.includes('quanto retorna') ||
      text.includes('retorno') ||
      text.includes('lucro') ||
      text.includes('odd') && text.includes('r')
    ) {
      return 'BANKROLL';
    }

    if (
      text.includes('jogos de hoje') ||
      text.includes('mostrar jogos') ||
      text.includes('mostra jogos') ||
      text.includes('quais jogos') ||
      text.includes('lista jogos') ||
      text.includes('listar jogos') ||
      text.includes('jogos disponiveis') ||
      text.includes('tem jogos') ||
      text.includes('tem partida') ||
      text.includes('tem partidas') ||
      text === 'jogos' ||
      text === 'partidas'
    ) {
      return 'LIST_MATCHES';
    }

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
      text.includes('me indica uma entrada') ||
      text.includes('me recomenda uma aposta') ||
      text.includes('tem jogo bom') ||
      text.includes('o que tem para apostar')
    ) {
      return 'TOP_PICKS';
    }

    if (
      text.includes('multipla') ||
      text.includes('múltipla') ||
      text.includes('bilhete') ||
      text.includes('combinada')
    ) {
      return 'MULTIPLE';
    }

    if (
      text.includes('player') ||
      text.includes('jogador') ||
      text.includes('chute') ||
      text.includes('finalizacao') ||
      text.includes('finalização') ||
      text.includes('marca gol')
    ) {
      return 'PLAYER_PROPS';
    }

    if (text.includes('ao vivo') || text.includes('live')) return 'LIVE';
    if (text.includes('virtual')) return 'VIRTUAL';

    if (text.includes('risco') || text.includes('arriscada') || text.includes('vale a pena')) {
      return 'RISK_EXPLAIN';
    }

    if (
      text.includes('explica') ||
      text.includes('explique') ||
      text.includes('por que') ||
      text.includes('porque')
    ) {
      return 'EXPLAIN_LAST';
    }

    if (text.includes('mais segura') || text.includes('conservadora')) return 'MAKE_SAFER';
    if (text.includes('mais agressiva') || text.includes('odd maior')) return 'MAKE_AGGRESSIVE';

    if (text.includes('simples') || text.includes('aposta segura')) return 'SIMPLE';

    if (
      text.includes('analisa') ||
      text.includes('analisar') ||
      text.includes('analise') ||
      text.includes('análise') ||
      text.includes(' x ') ||
      text.includes(' vs ') ||
      text.includes('contra')
    ) {
      return 'ANALYZE';
    }

    return 'GENERAL';
  }

  private async buildTopPicksResponse(): Promise<ChatFootballResponse> {
    if (!this.footballService) {
      return {
        success: true,
        intent: 'TOP_PICKS',
        answer:
`🏆 ODDIX IA — TOP PICKS

Eu entendi que você quer os melhores palpites de hoje.

⚠️ No momento o módulo de jogos reais não está disponível neste serviço.

Posso seguir por estes caminhos:
• analisar um jogo específico;
• montar uma múltipla segura;
• calcular retorno;
• explicar risco;
• avaliar mercado e value bet.

Exemplo:
"Analise Flamengo x Palmeiras"
"Quanto ganho com R$20 na odd 1.85?"`,
        data: { waitingForData: true, suggestions: this.waitingSuggestions() },
      };
    }

    try {
      const response: any = await this.footballService.getFixtures();
      const fixtures = this.extractFixtureArray(response)
        .filter((game: any) => game?.teams?.home?.name && game?.teams?.away?.name)
        .filter((game: any) => !this.isFinished(game))
        .slice(0, 40);

      if (!fixtures.length) {
        return {
          success: true,
          intent: 'TOP_PICKS',
          answer:
`🏆 ODDIX IA — TOP PICKS

Eu procurei jogos reais na base atual, mas ainda não encontrei partidas elegíveis.

❌ Não vou inventar palpite.

Tente:
• "mostrar jogos de hoje"
• "analisa Flamengo x Palmeiras"
• "monte uma múltipla segura"`,
          data: { waitingForData: true, suggestions: this.waitingSuggestions() },
        };
      }

      const ranked = fixtures
        .map((game: any) => ({
          game,
          score: this.scoreFixtureForTopPick(game),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      const picksText = ranked
        .map(({ game, score }, index) => {
          const home = game?.teams?.home?.name || 'Casa';
          const away = game?.teams?.away?.name || 'Fora';
          const league = game?.league?.name || 'Liga não informada';
          const kickoff = this.formatKickoff(game?.fixture?.date);
          const status = game?.fixture?.status?.short || 'NS';

          const confidence = Math.min(88, Math.max(62, score));
          const risk = confidence >= 82 ? 'Médio controlado' : 'Alto até validar estatísticas';

          return `${index + 1}️⃣ ${home} x ${away}
🏆 ${league}
⏰ ${kickoff}
📌 Status: ${status}
🧠 Score de triagem: ${confidence}/100
⚠️ Risco: ${risk}
🎯 Próximo passo: pedir "analisa ${home} x ${away}"`;
        })
        .join('\n\n');

      return {
        success: true,
        intent: 'TOP_PICKS',
        answer:
`🏆 ODDIX IA — TOP PICKS DE HOJE

Entendi seu pedido: você quer os melhores palpites de hoje.

Eu fiz uma triagem inicial dos jogos reais disponíveis e separei os melhores candidatos.

${picksText}

━━━━━━━━━━━━━━
⚠️ Importante:
Isso ainda é triagem, não entrada oficial.

Para liberar palpite profissional, preciso validar:
✅ estatísticas reais
✅ odds reais
✅ mercado disponível
✅ risco x confiança

Mande:
"analisa Nome do Time x Nome do Time"

Aí eu ativo os agents completos:
Research, H2H, Trend, Momentum, Tactical, News, Statistics, ValueBet, Prediction e FinalDecision.`,
        data: {
          fixtures: ranked.map((item) => item.game),
          suggestions: ranked.slice(0, 4).map(({ game }) => {
            const home = game?.teams?.home?.name || 'Casa';
            const away = game?.teams?.away?.name || 'Fora';
            return `🎯 Analisa ${home} x ${away}`;
          }),
        },
      };
    } catch (error: any) {
      return {
        success: true,
        intent: 'TOP_PICKS',
        answer:
`🏆 ODDIX IA — TOP PICKS

Tentei buscar os jogos reais, mas a consulta falhou agora.

Motivo:
${error?.message || 'Falha ao consultar FootballService'}

❌ Nenhum palpite inventado.`,
        data: { waitingForData: true, suggestions: this.waitingSuggestions() },
      };
    }
  }

  private scoreFixtureForTopPick(game: any): number {
    let score = 55;

    const league = this.normalize(game?.league?.name);
    const home = this.normalize(game?.teams?.home?.name);
    const away = this.normalize(game?.teams?.away?.name);

    const premiumTerms = [
      'brasileirao',
      'serie a',
      'libertadores',
      'sul americana',
      'champions',
      'europa league',
      'premier league',
      'la liga',
      'serie a',
      'bundesliga',
      'ligue 1',
      'primeira liga',
      'eredivisie',
      'mls',
      'argentina',
      'mexico',
    ];

    if (premiumTerms.some((term) => league.includes(term))) score += 18;

    const blockedTerms = [
      'u17',
      'u19',
      'u20',
      'u21',
      'u23',
      'women',
      'feminino',
      'reserves',
      'reserve',
      'amateur',
      'friendly',
      'amistoso',
      'esoccer',
      'virtual',
    ];

    if (blockedTerms.some((term) => league.includes(term) || home.includes(term) || away.includes(term))) {
      score -= 25;
    }

    if (game?.fixture?.date) score += 5;
    if (game?.league?.name) score += 5;
    if (game?.teams?.home?.logo && game?.teams?.away?.logo) score += 4;

    return Math.max(0, Math.min(95, score));
  }

  private buildPlayerPropsResponse(message: string): ChatFootballResponse {
    const teams = this.extractTeams(message);

    return {
      success: true,
      intent: 'PLAYER_PROPS',
      answer:
`👤 ODDIX IA — PLAYER PROPS

Entendi que você quer análise de jogadores.

Para Player Props eu preciso validar:
✅ partida real
✅ escalações prováveis
✅ estatísticas de jogadores
✅ odds reais
✅ mercado disponível

${teams ? `Jogo detectado: ${teams.home} x ${teams.away}` : 'Ainda não detectei o jogo.'}

Mercados que consigo avaliar:
• 1+ chute no gol
• 2+ finalizações
• jogador para marcar
• cartões
• participação ofensiva

Mande assim:
"Player Props Flamengo x Palmeiras"

ou:
"Analisa Flamengo x Palmeiras e veja jogador para chute no gol"`,
      data: {
        waitingForData: !teams,
        suggestions: [
          '👤 Quero Player Props',
          '🏆 Mostrar jogos de hoje',
          '🎯 Quero uma aposta simples',
          '🔥 Monte uma múltipla segura',
        ],
      },
    };
  }

  private buildLiveResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'LIVE',
      answer:
`⚡ ODDIX IA — ANÁLISE AO VIVO

No live eu penso diferente do pré-jogo.

Eu priorizo:
• pressão ofensiva;
• finalizações;
• chutes no gol;
• escanteios;
• ataques perigosos;
• posse com perigo;
• minuto do jogo;
• odd subindo ou caindo.

Mercados possíveis:
• próximo gol;
• over gols;
• escanteios;
• dupla chance live;
• proteção contra zebra.

Mande:
"analise jogos ao vivo"
ou
"analisa Time A x Time B ao vivo"`,
      data: {
        suggestions: [
          '📈 Jogos ao vivo',
          '⚡ Próximo gol',
          '📊 Escanteios live',
          '🎯 Melhor entrada live',
        ],
      },
    };
  }

  private buildSimpleBetResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'SIMPLE',
      answer:
`🎯 ODDIX IA — APOSTA SIMPLES

Para uma aposta simples segura, eu sigo esta ordem:

1️⃣ jogo real
2️⃣ estatística real
3️⃣ odd real
4️⃣ risco controlado
5️⃣ confiança acima do padrão

Mercados mais seguros:
• dupla chance;
• over 0.5;
• over 1.5;
• time marca 1+ gol;
• handicap +1.5.

Mande:
"analisa Time A x Time B"

Aí eu digo se existe entrada ou se é melhor ficar fora.`,
      data: {
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '🎯 Quero uma aposta simples',
          '🔥 Monte uma múltipla segura',
          '💰 Quanto ganho com R$20?',
        ],
      },
    };
  }

  private buildContextualResponse(
    message: string,
    lastContext: string | null,
    ticket: ChatTicket | null,
  ): ChatFootballResponse {
    const text = this.clean(message);

    if (!lastContext && !ticket) {
      return this.buildNoContextResponse('GENERAL');
    }

    if (text.includes('mais segura') || text.includes('conservadora')) {
      return {
        success: true,
        intent: 'MAKE_SAFER',
        answer:
`🛡️ ODDIX IA — VERSÃO MAIS SEGURA

Entendi. Você quer reduzir risco.

Contexto anterior:
${lastContext || 'bilhete anterior'}

Para deixar mais seguro:
• reduzir mercados agressivos;
• evitar odds acima de 2.00;
• priorizar dupla chance;
• usar over baixo;
• evitar múltiplas longas;
• manter gestão de banca baixa.

Modelo recomendado:
✅ Dupla chance
✅ Over 0.5 ou Over 1.5
✅ Handicap +1.5
✅ No máximo 2 ou 3 seleções

⚠️ Para ajustar com precisão, preciso do jogo ou bilhete específico.`,
        data: { suggestions: this.ticketSuggestions() },
      };
    }

    if (text.includes('mais agressiva') || text.includes('odd maior')) {
      return {
        success: true,
        intent: 'MAKE_AGGRESSIVE',
        answer:
`🚀 ODDIX IA — VERSÃO MAIS AGRESSIVA

Dá para buscar odd maior, mas o risco sobe.

Contexto anterior:
${lastContext || 'bilhete anterior'}

Caminhos agressivos:
• Over 2.5;
• ambas marcam;
• jogador para marcar;
• handicap;
• múltipla com 3+ seleções.

⚠️ Eu só recomendo agressiva quando:
✅ estatísticas sustentam
✅ odd tem valor
✅ risco está claro
✅ banca está protegida.`,
        data: { suggestions: this.ticketSuggestions() },
      };
    }

    return {
      success: true,
      intent: 'GENERAL',
      answer:
`🧠 ODDIX IA — CONTEXTO ENTENDIDO

Você está continuando a conversa anterior.

Contexto identificado:
${lastContext || 'bilhete/análise anterior'}

Posso continuar por estes caminhos:
• explicar a entrada;
• calcular retorno;
• deixar mais segura;
• deixar mais agressiva;
• montar múltipla;
• buscar outro mercado.

Exemplos:
"deixe mais segura"
"quanto ganho com R$20 na odd 1.85?"
"me dê outra opção"`,
      data: { suggestions: this.ticketSuggestions() },
    };
  }

  private async buildTeamOverview(teamName: string): Promise<ChatFootballResponse | null> {
    if (!this.footballService) return this.waitingForRealData('ANALYZE');

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
        .sort((a: any, b: any) => {
          const da = new Date(a?.fixture?.date || 0).getTime();
          const db = new Date(b?.fixture?.date || 0).getTime();
          return da - db;
        });

      const teamAgent =
        this.agentsService?.buildTeamResearchAgent({
          teamName,
          fixtures: teamGames,
          research,
        }) || this.formatResearchBlock(research);

      if (!teamGames.length) {
        return {
          success: true,
          intent: 'ANALYZE',
          answer:
`🔥 ODDIX IA — PESQUISA DA EQUIPE

Você perguntou sobre:
${teamName}

${teamAgent}

━━━━━━━━━━━━━━
📊 Base Oddix:
Ainda não encontrei jogos dessa equipe na janela de partidas recentes/próximas.

⚠️ Regra Oddix:
Mesmo com notícias, eu só libero palpite quando houver estatísticas reais + odds reais.

❌ Nenhuma entrada aprovada no momento.`,
          data: {
            waitingForData: true,
            research,
            suggestions: [
              '🏆 Mostrar jogos de hoje',
              '🔥 Monte uma múltipla segura',
              '🎮 Futebol Virtual',
              '📈 Jogos ao vivo',
            ],
          },
        };
      }

      const nextGame =
        teamGames.find((game: any) => !this.isFinished(game)) || teamGames[teamGames.length - 1];

      return {
        success: true,
        intent: 'ANALYZE',
        answer:
`🔥 ODDIX IA — VISÃO DA EQUIPE

${teamAgent}

━━━━━━━━━━━━━━
📅 Jogo de referência:
${nextGame?.teams?.home?.name || 'Casa'} x ${nextGame?.teams?.away?.name || 'Fora'}
🏆 ${nextGame?.league?.name || 'Liga não informada'}
⏰ ${this.formatKickoff(nextGame?.fixture?.date)}
📌 Status: ${nextGame?.fixture?.status?.short || 'NS'}

━━━━━━━━━━━━━━
⚠️ Regra Oddix:
Notícias ajudam contexto, mas palpite só sai com estatísticas reais e odds reais.

✅ Posso fazer agora:
🎯 analisar o jogo de referência
🔥 procurar múltiplas
👤 avaliar Player Props
💰 calcular retorno`,
        data: {
          fixture: nextGame,
          fixtures: teamGames,
          research,
          suggestions: [
            `🎯 Analisa ${nextGame?.teams?.home?.name || ''} x ${
              nextGame?.teams?.away?.name || ''
            }`.trim(),
            '🏆 Mostrar jogos de hoje',
            '🔥 Monte uma múltipla segura',
            '💰 Quanto ganho com R$20?',
          ],
        },
      };
    } catch (error: any) {
      return {
        success: true,
        intent: 'ANALYZE',
        answer:
`📡 ODDIX IA

Tentei buscar dados da equipe, mas não consegui concluir agora.

Motivo:
${error?.message || 'Falha ao consultar dados reais'}

❌ Nenhuma análise inventada.`,
        data: {
          waitingForData: true,
          suggestions: this.waitingSuggestions(),
        },
      };
    }
  }

  private async analyzeRealMatch(
    message: string,
    intent: ChatIntent,
  ): Promise<ChatFootballResponse | null> {
    if (!this.footballService) return null;

    const teams = this.extractTeams(message);
    if (!teams) return null;

    try {
      const fixtures = await this.getFixturesWindow(3, 7);
      const research = await this.researchMatchSafe(teams.home, teams.away);

      const homeQuery = this.normalize(teams.home);
      const awayQuery = this.normalize(teams.away);

      const match = fixtures.find((item: any) => {
        const home = this.normalize(item?.teams?.home?.name);
        const away = this.normalize(item?.teams?.away?.name);

        return (
          (home.includes(homeQuery) && away.includes(awayQuery)) ||
          (home.includes(awayQuery) && away.includes(homeQuery))
        );
      });

      if (!match) {
        const discoveryAgent =
          this.agentsService?.buildMatchDiscoveryAgent({
            homeTeam: teams.home,
            awayTeam: teams.away,
            fixtures,
            research,
          }) || this.formatResearchBlock(research);

        return {
          success: true,
          intent,
          answer:
`📡 PARTIDA NÃO ENCONTRADA

${discoveryAgent}

⚠️ Mesmo com notícias, não vou liberar palpite sem estatísticas e odds reais.`,
          data: {
            waitingForData: true,
            research,
            suggestions: this.waitingSuggestions(),
          },
        };
      }

      const fixtureId = String(match?.fixture?.id || '');
      if (!fixtureId) return this.waitingForRealData(intent);

      const richContext = await this.getFlashScoreRichContextSafe(fixtureId, match);
      const statsResponse: any = richContext?.statistics || (await this.footballService.getStatistics(fixtureId));

      const hasRealStats =
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

      const stats = statsResponse?.data || statsResponse;
      const enrichedMatch = richContext?.fixture || match;

      if (!hasRealStats) {
        const matchAgent =
          this.agentsService?.buildMatchResearchAgent({
            homeTeam: match?.teams?.home?.name || teams.home,
            awayTeam: match?.teams?.away?.name || teams.away,
            fixtures,
            fixture: enrichedMatch,
            statistics: stats?.simulated ? null : stats,
            research,
            richContext,
            h2h: richContext?.h2h,
            odds: richContext?.odds,
            lineups: richContext?.lineups,
            prematchStats: richContext?.prematchStats,
          } as any) || this.formatResearchBlock(research);

        return {
          success: true,
          intent,
          answer:
`⚽ ${match?.teams?.home?.name || teams.home} x ${match?.teams?.away?.name || teams.away}

Encontrei a partida. ✅
🏆 ${match?.league?.name || 'Liga não informada'}

${this.buildRichContextSummary(richContext)}

${matchAgent}

📡 Status:
⚠️ AINDA SEM CONFIRMAÇÃO COMPLETA PARA ENTRADA OFICIAL

❌ Nenhuma entrada aprovada agora.`,
          data: {
            waitingForData: true,
            fixture: enrichedMatch,
            research,
            richContext,
            suggestions: this.waitingSuggestions(),
          },
        };
      }

      return this.buildRealMatchAnalysis(enrichedMatch, fixtures, stats, intent, research, richContext);
    } catch (error: any) {
      return {
        success: true,
        intent,
        answer:
`📡 ODDIX IA

Tentei buscar dados reais, mas não consegui validar agora.

Motivo:
${error?.message || 'Falha ao consultar dados reais'}

❌ Sem entrada aprovada.`,
        data: {
          waitingForData: true,
          suggestions: this.waitingSuggestions(),
        },
      };
    }
  }

  private buildRealMatchAnalysis(
    match: any,
    fixtures: any[],
    stats: any,
    intent: ChatIntent,
    research?: ResearchResult | null,
    richContext?: FlashScoreRichContext | null,
  ): ChatFootballResponse {
    const home = match?.teams?.home?.name || 'Casa';
    const away = match?.teams?.away?.name || 'Fora';

    const matchAgent =
      this.agentsService?.buildMatchResearchAgent({
        homeTeam: home,
        awayTeam: away,
        fixtures,
        fixture: match,
        statistics: stats,
        research,
        richContext,
        h2h: richContext?.h2h,
        odds: richContext?.odds,
        lineups: richContext?.lineups,
        prematchStats: richContext?.prematchStats,
      } as any) || this.formatResearchBlock(research || null);

    return {
      success: true,
      intent,
      answer:
`⚽ ANÁLISE REAL ODDIX IA

${this.buildRichContextSummary(richContext)}

${matchAgent}

━━━━━━━━━━━━━━
🎯 Agora posso:
• gerar aposta simples
• gerar múltiplas
• avaliar player props
• calcular gestão de banca`,
      data: {
        fixture: match,
        statistics: stats,
        research,
        richContext,
        suggestions: [
          '🎯 Quero uma aposta simples',
          '🔥 Monte uma múltipla segura',
          '👤 Quero Player Props',
          '💰 Quanto ganho com R$20?',
        ],
      },
    };
  }

  private async listRealGames(intent: ChatIntent): Promise<ChatFootballResponse> {
    if (!this.footballService) return this.waitingForRealData(intent);

    try {
      const response: any = await this.footballService.getFixtures();
      const fixtures = this.extractFixtureArray(response)
        .filter((item: any) => item?.teams?.home?.name && item?.teams?.away?.name)
        .slice(0, 20);

      if (!fixtures.length) {
        return {
          success: true,
          intent,
          answer:
`📡 ODDIX IA — AGUARDANDO JOGOS REAIS

Ainda não encontrei jogos disponíveis na base atual.

❌ Nenhuma entrada aprovada no momento.`,
          data: {
            waitingForData: true,
            suggestions: this.waitingSuggestions(),
          },
        };
      }

      const gamesText = fixtures
        .map((item: any, index: number) => {
          const home = item?.teams?.home?.name || 'Casa';
          const away = item?.teams?.away?.name || 'Fora';
          const league = item?.league?.name || 'Liga não informada';
          const status = item?.fixture?.status?.short || 'NS';
          const kickoff = this.formatKickoff(item?.fixture?.date);

          return `${index + 1}️⃣ ${home} x ${away}
🏆 ${league}
⏰ ${kickoff}
📌 Status: ${status}`;
        })
        .join('\n\n');

      return {
        success: true,
        intent,
        answer:
`🏆 JOGOS REAIS ENCONTRADOS

Encontrei ${fixtures.length} jogos na base Oddix.

${gamesText}

━━━━━━━━━━━━━━
Agora me pergunte assim:

⚽ "Analisa Time A x Time B"
🔥 "Monte uma múltipla segura"
🎯 "Qual melhor entrada?"
👤 "Tem Player Props?"

⚠️ Só libero palpite com estatísticas e odds reais.`,
        data: {
          fixtures,
          suggestions: [
            '🔄 Atualizar jogos',
            '🔥 Monte uma múltipla segura',
            '📈 Jogos ao vivo',
            '🎮 Futebol Virtual',
          ],
        },
      };
    } catch (error: any) {
      return {
        success: true,
        intent,
        answer:
`📡 ODDIX IA — ERRO AO BUSCAR JOGOS

Motivo:
${error?.message || 'Falha ao consultar FootballService'}

❌ Nenhuma entrada aprovada no momento.`,
        data: {
          waitingForData: true,
          suggestions: this.waitingSuggestions(),
        },
      };
    }
  }

  private buildSmartWelcome(): ChatFootballResponse {
    return {
      success: true,
      intent: 'ASK_RECOMMENDATION',
      answer:
`🔥 Fala, Pedro! Agora a Oddix IA está com cérebro V8.

Eu consigo entender perguntas naturais como:

🏆 "Mostre os melhores palpites de hoje"
⚽ "Analisa Flamengo x Palmeiras"
🔥 "Monte uma múltipla segura"
💰 "Quanto ganho com R$20 na odd 1.85?"
🧠 "Esse jogo vale a pena?"
🛡️ "Me dá uma opção mais segura"

Como eu penso:
1️⃣ entendo a intenção
2️⃣ busco contexto
3️⃣ ativo agents
4️⃣ avalio risco
5️⃣ respondo como assistente, não como bot

Manda sua pergunta.`,
      data: {
        suggestions: [
          '🏆 Melhores palpites de hoje',
          '🔥 Monte uma múltipla segura',
          '⚽ Analisa Flamengo x Palmeiras',
          '💰 Quanto ganho com R$20 na odd 1.85?',
        ],
      },
    };
  }

  private buildMultipleRequestResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'MULTIPLE',
      answer:
`🔥 ODDIX IA — MÚLTIPLA

Entendi. Você quer montar uma múltipla.

Eu não vou jogar qualquer seleção no bilhete. Vou montar com lógica:

🛡️ Segura:
• odds baixas;
• mercados protegidos;
• até 2 ou 3 jogos.

⚖️ Balanceada:
• odds moderadas;
• risco controlado;
• seleção por tendência.

🚀 Agressiva:
• odd maior;
• risco alto;
• só com banca pequena.

Para montar de verdade, preciso dos jogos reais.

Mande:
"Mostrar jogos de hoje"

ou:
"Monte uma múltipla segura com jogos de hoje"`,
      data: {
        waitingForData: true,
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '🔥 Múltipla segura',
          '⚖️ Múltipla balanceada',
          '🚀 Múltipla agressiva',
        ],
      },
    };
  }

  private buildSmartFallback(message: string): ChatFootballResponse {
    return {
      success: true,
      intent: 'GENERAL',
      answer:
`🧠 ODDIX IA

Entendi sua pergunta:

"${message}"

Ainda preciso transformar isso em uma intenção de aposta.

Você pode pedir assim:

🏆 "Mostre os melhores palpites de hoje"
⚽ "Analisa Flamengo x Palmeiras"
🔥 "Monte uma múltipla segura"
📈 "Analise mercado e odds"
👤 "Quero Player Props"
💰 "Quanto ganho com R$20 na odd 1.85?"

Se você falar "esse jogo", "essa múltipla" ou "continua", eu tento usar o contexto anterior.`,
      data: {
        suggestions: [
          '🏆 Melhores palpites de hoje',
          '🔥 Monte uma múltipla segura',
          '📈 Jogos ao vivo',
          '💰 Quanto ganho com R$20?',
        ],
      },
    };
  }

  private buildNoContextResponse(intent: ChatIntent): ChatFootballResponse {
    return {
      success: true,
      intent,
      answer:
`🧠 Ainda não tenho contexto suficiente.

Me mande primeiro:
"Analisa Time A x Time B"

ou:
"Mostrar jogos de hoje"

Depois eu consigo entender:
• esse jogo;
• essa múltipla;
• continua;
• deixe mais seguro;
• quanto ganho com R$20.`,
      data: {
        suggestions: this.waitingSuggestions(),
      },
    };
  }

  private waitingForRealData(intent: ChatIntent): ChatFootballResponse {
    return {
      success: true,
      intent,
      answer:
`📡 ODDIX IA — AGUARDANDO DADOS REAIS

Ainda não tenho dados reais suficientes para liberar uma entrada.

❌ Nenhum palpite inventado.
✅ Assim que tiver estatísticas e odds reais, eu analiso.`,
      data: {
        waitingForData: true,
        suggestions: this.waitingSuggestions(),
      },
    };
  }

  private buildVirtualResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'VIRTUAL',
      answer:
`🎮 ODDIX VIRTUAL IA

No futebol virtual eu analiso padrões repetitivos:

✅ Over 1.5
✅ Over 2.5
✅ Ambas marcam
✅ Dupla chance
✅ Top Picks Virtuais

Manda:
"Quero top pick virtual"`,
      data: {
        suggestions: ['🎮 Top Pick Virtual', '🔥 Múltipla Virtual', '📊 ROI Virtual'],
      },
    };
  }

  private buildBetCalculatorResponse(calc: BetCalc, message: string): ChatFootballResponse {
    return {
      success: true,
      intent: 'BANKROLL',
      answer:
`💰 ODDIX CALCULADORA

Você perguntou:
"${message}"

Valor apostado: R$${this.money(calc.stake)}
Odd: ${calc.odd.toFixed(2)}

📊 Retorno total:
R$${this.money(calc.retorno)}

📈 Lucro líquido:
R$${this.money(calc.lucro)}

Fórmula:
Retorno = valor apostado x odd

⚠️ Gestão:
Evite colocar mais de 1% a 3% da banca em entradas de risco.`,
      data: {
        amount: calc.stake,
        odd: calc.odd,
        potentialReturn: calc.retorno,
        profit: calc.lucro,
        suggestions: [
          '🛡️ Gestão conservadora',
          '🔥 Calcular múltipla',
          '⚠️ Explicar risco',
          '🏆 Mostrar top picks',
        ],
      },
    };
  }

  private explainBankroll(message: string, ticket: ChatTicket | null): ChatFootballResponse {
    const amount = this.extractMoney(message) || 20;
    const odd = this.extractOdd(message) || ticket?.oddTotal || 1;
    const potentialReturn = amount * odd;
    const profit = potentialReturn - amount;

    return {
      success: true,
      intent: 'BANKROLL',
      data: {
        amount,
        odd,
        potentialReturn,
        profit,
        ...(ticket ? { ticket } : {}),
        suggestions: this.ticketSuggestions(),
      },
      answer:
`💰 Gestão Oddix IA

Com R$${this.money(amount)}:
📊 Odd: ${odd.toFixed(2)}
💵 Retorno: R$${this.money(potentialReturn)}
📈 Lucro: R$${this.money(profit)}

🟢 Conservadora: R$${this.money(amount * 0.25)}
🟡 Moderada: R$${this.money(amount * 0.5)}
🔴 Agressiva: R$${this.money(amount)}

⚠️ Eu evitaria mais de 3% da banca em múltiplas.`,
    };
  }

  private explainLastTicket(ticket: ChatTicket): ChatFootballResponse {
    return {
      success: true,
      intent: 'EXPLAIN_LAST',
      data: { ticket, suggestions: this.ticketSuggestions() },
      answer:
`🧠 Explicando o último bilhete:

${ticket.selections
  .map(
    (item, index) => `${index + 1}️⃣ ${item.game}
✅ ${item.markets.join('\n✅ ')}
Confiança: ${item.confidence}%
Risco: ${item.risk}
Motivo: ${item.reason}`,
  )
  .join('\n\n')}

📊 Odd total: ${ticket.oddTotal.toFixed(2)}
🤖 Confiança geral: ${ticket.confidence}%`,
    };
  }

  private explainRisk(ticket: ChatTicket): ChatFootballResponse {
    return {
      success: true,
      intent: 'RISK_EXPLAIN',
      data: { ticket, suggestions: this.ticketSuggestions() },
      answer:
`⚠️ Risco do bilhete:

📊 Odd total: ${ticket.oddTotal.toFixed(2)}
🤖 Confiança: ${ticket.confidence}%
Status: ${ticket.status}

${ticket.selections.map((item) => `• ${item.game}: ${item.risk} — ${item.confidence}%`).join('\n')}`,
    };
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

    const match =
      normalized.match(/odd\s*(\d+(\.\d+)?)/i) ||
      normalized.match(/@(\d+(\.\d+)?)/i) ||
      normalized.match(/\b(\d+\.\d{2})\b/i);

    const value = Number(match?.[1]);
    return Number.isFinite(value) && value > 1 ? value : null;
  }

  private extractMoney(message: string): number | null {
    const normalized = String(message || '').replace(',', '.');

    const match =
      normalized.match(/r\$\s*(\d+(\.\d+)?)/i) ||
      normalized.match(/(\d+(\.\d+)?)\s*reais/i) ||
      normalized.match(/com\s+(\d+(\.\d+)?)/i);

    const value = Number(match?.[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }


  private async getFlashScoreRichContextSafe(
    fixtureId: string,
    fixture: any,
  ): Promise<FlashScoreRichContext | null> {
    try {
      const service: any = this.footballService as any;
      if (!service?.getFlashScoreRichContext) return null;
      return await service.getFlashScoreRichContext(String(fixtureId), fixture);
    } catch (error: any) {
      return {
        ok: false,
        fixture,
        fixtureId: String(fixtureId),
        errors: [error?.message || 'Falha ao montar contexto FlashScore'],
      };
    }
  }

  private buildRichContextSummary(context?: FlashScoreRichContext | null) {
    if (!context) {
      return `📡 Contexto FlashScore:
⚠️ Rich context ainda não disponível.`;
    }

    const checks = [
      `📊 Estatísticas: ${context.statistics?.available ? '✅ reais' : context.prematchStats?.available ? '🟡 pré-jogo/H2H' : '⚠️ indisponíveis'}`,
      `💰 Odds: ${context.odds?.available ? '✅ reais' : '⚠️ não localizadas'}`,
      `🤝 H2H: ${context.h2h?.available ? `✅ ${context.h2h.totalMatches || 0} jogos` : '⚠️ insuficiente'}`,
      `👥 Lineups: ${context.lineups ? '✅ recebidas' : '⚠️ indisponíveis'}`,
    ];

    const oddsText = context.odds?.available
      ? `
1: ${context.odds.home || '-'} | X: ${context.odds.draw || '-'} | 2: ${context.odds.away || '-'}`
      : '';

    const h2hText = context.h2h?.available
      ? `
H2H: média gols ${context.h2h.avgGoals ?? '-'} | over 2.5 ${context.h2h.over25Rate ?? '-'}% | BTTS ${context.h2h.bttsRate ?? '-'}%`
      : '';

    return `📡 FlashScore Rich Context:
${checks.map((item) => `• ${item}`).join('\n')}${oddsText}${h2hText}`;
  }

  private async researchTeamSafe(teamName: string): Promise<ResearchResult | null> {
    if (!this.researchService) return null;

    try {
      return await this.researchService.researchTeam(teamName);
    } catch {
      return null;
    }
  }

  private async researchMatchSafe(home: string, away: string): Promise<ResearchResult | null> {
    if (!this.researchService) return null;

    try {
      return await this.researchService.researchMatch(home, away);
    } catch {
      return null;
    }
  }

  private formatResearchBlock(research: ResearchResult | null) {
    if (!research) {
      return `📰 Pesquisa externa:
⚠️ Agente de notícias ainda não configurado.`;
    }

    if (!research.enabled) {
      return `📰 Pesquisa externa:
⚠️ ${research.summary}`;
    }

    if (!research.items.length) {
      return `📰 Pesquisa externa:
⚠️ ${research.summary}`;
    }

    const items = research.items
      .slice(0, 5)
      .map(
        (item) =>
          `${item.position}️⃣ ${item.title}${item.source ? `\nFonte: ${item.source}` : ''}${
            item.description ? `\nResumo: ${item.description}` : ''
          }`,
      )
      .join('\n\n');

    return `📰 Notícias e contexto encontrados:

${items}`;
  }

  private async getFixturesWindow(daysBack = 3, daysForward = 7): Promise<any[]> {
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
        const response: any = await this.footballService?.getFixtures(date);
        all.push(...this.extractFixtureArray(response));
      } catch {
        // continua
      }
    }

    const seen = new Set<string>();

    return all.filter((game: any) => {
      const id = String(
        game?.fixture?.id ||
          `${game?.teams?.home?.name}-${game?.teams?.away?.name}-${game?.fixture?.date}`,
      );

      if (seen.has(id)) return false;

      seen.add(id);
      return true;
    });
  }

  private shouldListGames(message: string) {
    const text = this.clean(message);

    return (
      text.includes('jogos de hoje') ||
      text.includes('mostrar jogos') ||
      text.includes('mostra jogos') ||
      text.includes('quais jogos') ||
      text.includes('lista jogos') ||
      text.includes('listar jogos') ||
      text.includes('jogos disponiveis') ||
      text.includes('tem jogos') ||
      text.includes('tem partida') ||
      text.includes('tem partidas') ||
      text === 'jogos' ||
      text === 'partidas'
    );
  }

  private isContextFollowUp(text: string) {
    return (
      text.includes('esse jogo') ||
      text.includes('essa partida') ||
      text.includes('essa multipla') ||
      text.includes('essa múltipla') ||
      text.includes('continua') ||
      text.includes('outra opcao') ||
      text.includes('outra opção') ||
      text.includes('mais segura') ||
      text.includes('mais agressiva') ||
      text.includes('vale a pena')
    );
  }

  private findLastUserContext(history: ChatHistoryMessage[]): string | null {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const item: any = history[index];

      if (item?.role === 'user' && item?.content) return String(item.content);
      if (item?.role === 'user' && item?.message) return String(item.message);
      if (item?.content && typeof item.content === 'string') return item.content;
      if (item?.message && typeof item.message === 'string') return item.message;
    }

    return null;
  }

  private findLastTicket(history: ChatHistoryMessage[]): ChatTicket | null {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const ticket = history[index]?.data?.ticket;
      if (ticket?.selections?.length) return ticket;
    }

    return null;
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

  private extractTeams(message: string) {
    const cleaned = String(message || '')
      .replace(/analisa/gi, '')
      .replace(/analisar/gi, '')
      .replace(/analise/gi, '')
      .replace(/análise/gi, '')
      .trim();

    for (const separator of [' x ', ' vs ', ' versus ', ' contra ']) {
      const normalized = cleaned.toLowerCase();

      if (normalized.includes(separator)) {
        const parts = normalized.split(separator);
        if (parts[0]?.trim() && parts[1]?.trim()) {
          return { home: parts[0].trim(), away: parts[1].trim() };
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
      if (names.some((name) => text.includes(this.clean(name)))) {
        return canonical;
      }
    }

    const naturalTriggers = [
      'como esta',
      'como está',
      'me fale',
      'fala do',
      'fale do',
      'fale da',
      'fale de',
      'sobre o',
      'sobre a',
      'noticias',
      'notícias',
      'estatisticas',
      'estatísticas',
      'proximo jogo',
      'próximo jogo',
      'selecao',
      'seleção',
      'time do',
      'time da',
    ];

    const hasTrigger = naturalTriggers.some((trigger) => text.includes(this.clean(trigger)));
    if (!hasTrigger) return null;

    const cleaned = text
      .replace(/chat/g, '')
      .replace(/me fale/g, '')
      .replace(/fala/g, '')
      .replace(/fale/g, '')
      .replace(/sobre/g, '')
      .replace(/como esta/g, '')
      .replace(/como está/g, '')
      .replace(/a selecao/g, '')
      .replace(/a seleção/g, '')
      .replace(/selecao/g, '')
      .replace(/seleção/g, '')
      .replace(/do/g, '')
      .replace(/da/g, '')
      .replace(/de/g, '')
      .replace(/o time/g, '')
      .replace(/time/g, '')
      .trim();

    return cleaned.length >= 3 ? cleaned : null;
  }

  private teamAliases(): Record<string, string[]> {
    return {
      espanha: ['espanha', 'seleção da espanha', 'selecao da espanha', 'spain'],
      brasil: ['brasil', 'seleção do brasil', 'selecao do brasil', 'brazil'],
      argentina: ['argentina'],
      portugal: ['portugal'],
      uruguai: ['uruguai', 'uruguay', 'seleção do uruguai', 'selecao do uruguai'],
      egito: ['egito', 'egypt', 'seleção do egito', 'selecao do egito'],
      franca: ['franca', 'frança', 'france'],
      inglaterra: ['inglaterra', 'england'],
      alemanha: ['alemanha', 'germany'],
      italia: ['italia', 'itália', 'italy'],
      holanda: ['holanda', 'netherlands', 'países baixos', 'paises baixos'],
      belgica: ['belgica', 'bélgica', 'belgium'],
      japao: ['japao', 'japão', 'japan'],
      suecia: ['suecia', 'suécia', 'sweden'],
      croacia: ['croacia', 'croácia', 'croatia'],
      marrocos: ['marrocos', 'morocco'],
      mexico: ['mexico', 'méxico'],
      colombia: ['colombia', 'colômbia'],
      goias: ['goias', 'goiás'],
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

  private ticketSuggestions() {
    return [
      '🧠 Explique a múltipla',
      '🛡️ Deixe mais segura',
      '🚀 Deixe mais agressiva',
      '➕ Adicione mais mercados',
      '💰 Quanto ganho com R$20?',
      '⚠️ Essa múltipla está arriscada?',
    ];
  }

  private waitingSuggestions() {
    return [
      '🔄 Tentar novamente',
      '🏆 Mostrar jogos de hoje',
      '🎮 Futebol Virtual',
      '📈 Jogos ao vivo',
    ];
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