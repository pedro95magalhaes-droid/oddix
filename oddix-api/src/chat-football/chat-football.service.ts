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
    const history: ChatHistoryMessage[] = Array.isArray(payload?.history) ? payload.history : [];
    const brain = this.buildBrain(message);
    const lastTicket = this.findLastTicket(history);

    if (!message.trim()) return this.buildSmartRecommendation();

    if (brain.topicTeam) {
      const teamOverview = await this.buildTeamOverview(brain.topicTeam);
      if (teamOverview) return teamOverview;
    }

    if (brain.intent === 'LIST_MATCHES' || this.shouldListGames(message)) {
      return this.listRealGames(brain.intent);
    }

    if (brain.intent === 'ASK_RECOMMENDATION') return this.buildSmartRecommendation();
    if (brain.intent === 'MULTIPLE') return this.buildMultipleRequestResponse();

    const realAnalysis = await this.analyzeRealMatch(message, brain.intent);
    if (realAnalysis) return realAnalysis;

    if (brain.intent === 'EXPLAIN_LAST') {
      if (!lastTicket) return this.buildNoContextResponse('EXPLAIN_LAST');
      return this.explainLastTicket(lastTicket);
    }

    if (brain.intent === 'RISK_EXPLAIN') {
      if (!lastTicket) return this.buildNoContextResponse('RISK_EXPLAIN');
      return this.explainRisk(lastTicket);
    }

    if (brain.intent === 'BANKROLL') return this.explainBankroll(message, lastTicket);
    if (brain.intent === 'VIRTUAL') return this.buildVirtualResponse();

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

  private buildBrain(message: string): OddixBrain {
    const text = this.clean(message);
    const intent = this.detectIntent(message);
    const teams = this.extractTeams(message);
    const topicTeam = teams ? null : this.extractTeamTopic(message);

    return {
      message,
      text,
      intent,
      teams,
      topicTeam,
    };
  }

  private extractTeamTopic(message: string): string | null {
    const text = this.clean(message);

    if (text.includes(' x ') || text.includes(' vs ')) return null;

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
    const aliases = this.teamAliases();

    for (const [canonical, names] of Object.entries(aliases)) {
      if (names.some((name) => text.includes(this.clean(name)))) {
        return canonical;
      }
    }

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
        // ignora falha de uma data e continua
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

      const statsResponse: any = await this.footballService.getStatistics(fixtureId);

      const hasRealStats =
        statsResponse?.ok === true ||
        statsResponse?.success === true ||
        statsResponse?.available === true ||
        statsResponse?.data?.available === true ||
        statsResponse?.data?.realStatsAvailable === true ||
        statsResponse?.realStatsAvailable === true;

      const stats = statsResponse?.data || statsResponse;

      if (!hasRealStats) {
        const matchAgent =
          this.agentsService?.buildMatchResearchAgent({
            homeTeam: match?.teams?.home?.name || teams.home,
            awayTeam: match?.teams?.away?.name || teams.away,
            fixtures,
            fixture: match,
            research,
          }) || this.formatResearchBlock(research);

        return {
          success: true,
          intent,
          answer:
`⚽ ${match?.teams?.home?.name || teams.home} x ${match?.teams?.away?.name || teams.away}

Encontrei a partida. ✅
🏆 ${match?.league?.name || 'Liga não informada'}

${matchAgent}

📡 Status:
⚠️ AGUARDANDO DADOS REAIS

❌ Nenhuma entrada aprovada agora.`,
          data: {
            waitingForData: true,
            fixture: match,
            research,
            suggestions: this.waitingSuggestions(),
          },
        };
      }

      return this.buildRealMatchAnalysis(match, fixtures, stats, intent, research);
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
      }) || this.formatResearchBlock(research || null);

    return {
      success: true,
      intent,
      answer:
`⚽ ANÁLISE REAL ODDIX IA

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
        suggestions: [
          '🎯 Quero uma aposta simples',
          '🔥 Monte uma múltipla segura',
          '👤 Quero Player Props',
          '💰 Quanto ganho com R$20?',
        ],
      },
    };
  }

  private detectIntent(message: string): ChatIntent {
    const text = this.clean(message);

    if (
      text.includes('tem jogos') ||
      text.includes('quais jogos') ||
      text.includes('mostrar jogos') ||
      text.includes('mostra jogos') ||
      text.includes('jogos de hoje') ||
      text.includes('analise de partidas') ||
      text.includes('analisar partidas')
    ) {
      return 'LIST_MATCHES';
    }

    if (
      text.includes('o que tem para apostar') ||
      text.includes('tem jogo bom') ||
      text.includes('me indica uma entrada') ||
      text.includes('me recomenda uma aposta') ||
      text.includes('quero uma recomendacao') ||
      text.includes('qual melhor entrada') ||
      text.includes('qual a melhor aposta')
    ) {
      return 'ASK_RECOMMENDATION';
    }

    if (
      text.includes('multipla') ||
      text.includes('bilhete') ||
      text.includes('combinada') ||
      text.includes('tem multiplas') ||
      text.includes('tem multipla')
    ) {
      return 'MULTIPLE';
    }

    if (text.includes('quanto ganho') || text.includes('retorno') || text.includes('banca')) {
      return 'BANKROLL';
    }

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

    if (text.includes('mais mercado') || text.includes('adiciona mercado')) return 'MORE_MARKETS';
    if (text.includes('mais segura') || text.includes('conservadora')) return 'MAKE_SAFER';
    if (text.includes('mais agressiva') || text.includes('odd maior')) return 'MAKE_AGGRESSIVE';

    if (
      text.includes('player') ||
      text.includes('jogador') ||
      text.includes('chute') ||
      text.includes('marca gol')
    ) {
      return 'PLAYER_PROPS';
    }

    if (text.includes('ao vivo') || text.includes('live')) return 'LIVE';
    if (text.includes('virtual')) return 'VIRTUAL';
    if (text.includes('top pick') || text.includes('melhores entradas')) return 'TOP_PICKS';
    if (text.includes('simples') || text.includes('aposta segura')) return 'SIMPLE';

    if (
      text.includes('analisa') ||
      text.includes('analisar') ||
      text.includes('analise') ||
      text.includes(' x ') ||
      text.includes(' vs ')
    ) {
      return 'ANALYZE';
    }

    return 'GENERAL';
  }

  private buildSmartRecommendation(): ChatFootballResponse {
    return {
      success: true,
      intent: 'ASK_RECOMMENDATION',
      answer:
`🔥 Fala, Pedro! Bora caçar valor com calma.

Agora a Oddix IA trabalha assim:

1️⃣ entende sua pergunta
2️⃣ busca jogos reais
3️⃣ pesquisa notícias/contexto
4️⃣ ativa agentes de análise
5️⃣ só libera entrada se tiver dados suficientes

Você pode perguntar naturalmente:

🇧🇷 "Como está seleção do Brasil?"
🇺🇾 "Me fale do Uruguai"
🏆 "Mostrar jogos de hoje"
🔥 "Tem múltiplas?"
🎯 "Qual melhor entrada?"
💰 "Quanto ganho com R$20?"`,
      data: {
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '🔥 Monte uma múltipla segura',
          '🇧🇷 Como está seleção do Brasil?',
          '🇺🇾 Me fale do Uruguai',
        ],
      },
    };
  }

  private buildMultipleRequestResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'MULTIPLE',
      answer:
`🔥 Boa! Você quer múltipla.

Eu consigo montar, mas vou seguir a regra profissional da Oddix:

✅ buscar jogos reais
✅ conferir estatísticas reais
✅ conferir odds reais
✅ evitar mercados inventados
❌ sem dados = sem bilhete fake

Para começar, clique ou mande:

🏆 "Mostrar jogos de hoje"

Depois eu filtro:
🛡️ múltipla segura
⚖️ múltipla balanceada
🚀 múltipla agressiva`,
      data: {
        waitingForData: true,
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '📈 Jogos ao vivo',
          '🎮 Futebol Virtual',
          '🎯 Quero uma aposta simples',
        ],
      },
    };
  }

  private buildSmartFallback(message: string): ChatFootballResponse {
    return {
      success: true,
      intent: 'GENERAL',
      answer:
`🧠 Entendi sua pergunta:

"${message}"

Ainda não tenho informação suficiente para transformar isso em análise, mas posso buscar pelo caminho certo.

Tente assim:

🇧🇷 "Como está seleção do Brasil?"
🇺🇾 "Me fale do Uruguai"
⚽ "Analisa Brasil x Argentina"
🏆 "Mostrar jogos de hoje"
🔥 "Tem múltiplas?"
👤 "Quero Player Props"`,
      data: {
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '🔥 Monte uma múltipla segura',
          '🇧🇷 Como está seleção do Brasil?',
          '🇺🇾 Me fale do Uruguai',
        ],
      },
    };
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
      text.includes('analise de partidas') ||
      text.includes('analisar partidas') ||
      text === 'jogos' ||
      text === 'partidas'
    );
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

  private buildNoContextResponse(intent: ChatIntent): ChatFootballResponse {
    return {
      success: true,
      intent,
      answer:
`🧠 Ainda não tenho um jogo ou bilhete anterior para usar como contexto.

Me manda primeiro:
"Analisa Time A x Time B"
ou
"Mostrar jogos de hoje"`,
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

  private explainBankroll(message: string, ticket: ChatTicket | null): ChatFootballResponse {
    const amount = this.extractMoney(message) || 20;
    const odd = ticket?.oddTotal || 1;
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

  private findLastTicket(history: ChatHistoryMessage[]): ChatTicket | null {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const ticket = history[index]?.data?.ticket;
      if (ticket?.selections?.length) return ticket;
    }

    return null;
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

  private extractMoney(message: string): number | null {
    const normalized = String(message || '').replace(',', '.');
    const match =
      normalized.match(/r\$\s*(\d+(\.\d+)?)/i) ||
      normalized.match(/(\d+(\.\d+)?)\s*reais/i) ||
      normalized.match(/com\s+(\d+(\.\d+)?)/i);

    const value = Number(match?.[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
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