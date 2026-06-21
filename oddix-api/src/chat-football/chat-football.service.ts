import { Injectable, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import type {
  ChatFootballRequest,
  ChatFootballResponse,
  ChatHistoryMessage,
  ChatIntent,
  ChatTicket,
} from './chat-football.types';

type OddixChatBrain = {
  message: string;
  text: string;
  intent: ChatIntent;
  topicTeam: string | null;
  teams: { home: string; away: string } | null;
};

@Injectable()
export class ChatFootballService {
  constructor(
    @Optional()
    private readonly footballService?: FootballService,
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

    if (brain.intent === 'ASK_RECOMMENDATION') {
      return this.buildSmartRecommendation();
    }

    if (brain.intent === 'MULTIPLE') {
      return this.buildMultipleRequestResponse();
    }

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

    if (brain.intent === 'BANKROLL') {
      return this.explainBankroll(message, lastTicket);
    }

    if (brain.intent === 'VIRTUAL') {
      return this.buildVirtualResponse();
    }

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

  private buildBrain(message: string): OddixChatBrain {
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

    const triggers = [
      'como esta',
      'como está',
      'me fale sobre',
      'fale sobre',
      'situacao',
      'situação',
      'noticias',
      'notícias',
      'estatisticas',
      'estatísticas',
      'proximo jogo',
      'próximo jogo',
      'selecao da',
      'seleção da',
      'time do',
      'time da',
    ];

    const hasTrigger = triggers.some((trigger) => text.includes(this.clean(trigger)));
    if (!hasTrigger) return null;

    const knownTeams = [
      'espanha',
      'brasil',
      'argentina',
      'portugal',
      'franca',
      'frança',
      'inglaterra',
      'alemanha',
      'italia',
      'itália',
      'holanda',
      'uruguai',
      'belgica',
      'bélgica',
      'japao',
      'japão',
      'suecia',
      'suécia',
      'croacia',
      'croácia',
      'marrocos',
      'mexico',
      'méxico',
      'estados unidos',
      'colombia',
      'colômbia',
      'goias',
      'goiás',
      'flamengo',
      'palmeiras',
      'corinthians',
      'sao paulo',
      'são paulo',
      'santos',
      'vasco',
      'gremio',
      'grêmio',
      'internacional',
      'botafogo',
      'fluminense',
      'cruzeiro',
      'atletico mineiro',
      'atlético mineiro',
    ];

    for (const team of knownTeams) {
      if (text.includes(this.clean(team))) return team;
    }

    const cleaned = message
      .replace(/chat/gi, '')
      .replace(/me fale/gi, '')
      .replace(/fale/gi, '')
      .replace(/sobre/gi, '')
      .replace(/como está/gi, '')
      .replace(/como esta/gi, '')
      .replace(/a seleção da/gi, '')
      .replace(/a selecao da/gi, '')
      .replace(/seleção da/gi, '')
      .replace(/selecao da/gi, '')
      .replace(/o time do/gi, '')
      .replace(/o time da/gi, '')
      .trim();

    return cleaned.length >= 3 ? cleaned : null;
  }

  private async buildTeamOverview(teamName: string): Promise<ChatFootballResponse | null> {
    if (!this.footballService) {
      return this.waitingForRealData('ANALYZE');
    }

    try {
      const response: any = await this.footballService.getFixtures();
      const fixtures = this.extractFixtureArray(response);
      const teamKey = this.normalize(teamName);

      const teamGames = fixtures
        .filter((game: any) => {
          const home = this.normalize(game?.teams?.home?.name);
          const away = this.normalize(game?.teams?.away?.name);
          return home.includes(teamKey) || away.includes(teamKey);
        })
        .sort((a: any, b: any) => {
          const da = new Date(a?.fixture?.date || 0).getTime();
          const db = new Date(b?.fixture?.date || 0).getTime();
          return da - db;
        });

      if (!teamGames.length) {
        return {
          success: true,
          intent: 'ANALYZE',
          answer:
`🧠 ODDIX IA

Procurei por dados recentes de:

${teamName}

Ainda não encontrei jogos dessa equipe na base atual do Oddix.

Isso pode acontecer quando:
⚠️ o jogo ainda não entrou no provedor
⚠️ a competição não está no filtro principal
⚠️ as estatísticas ainda não foram liberadas

❌ Não vou inventar notícias ou estatísticas.

Me manda assim:
"Mostrar jogos de hoje"
ou
"Analisa Espanha x Uruguai"`,
          data: {
            waitingForData: true,
            suggestions: this.waitingSuggestions(),
          },
        };
      }

      const nextGame = teamGames.find((game: any) => !this.isFinished(game)) || teamGames[0];
      const recentGames = teamGames.slice(0, 5);

      const gamesText = recentGames
        .map((game: any, index: number) => {
          const home = game?.teams?.home?.name || 'Casa';
          const away = game?.teams?.away?.name || 'Fora';
          const league = game?.league?.name || 'Liga não informada';
          const status = game?.fixture?.status?.short || 'NS';
          const score = this.formatScore(game);
          const kickoff = this.formatKickoff(game?.fixture?.date);

          return `${index + 1}️⃣ ${home} x ${away}
🏆 ${league}
⏰ ${kickoff}
📌 Status: ${status}${score ? `\n⚽ Placar: ${score}` : ''}`;
        })
        .join('\n\n');

      const statsBlock = await this.tryGetGameStats(nextGame);

      return {
        success: true,
        intent: 'ANALYZE',
        answer:
`🔥 ODDIX IA — VISÃO DA EQUIPE

Você perguntou sobre:
${teamName}

Encontrei dados reais na base Oddix. Agora sim dá para analisar sem inventar. ✅

📅 Jogo de referência:
${nextGame?.teams?.home?.name || 'Casa'} x ${nextGame?.teams?.away?.name || 'Fora'}
🏆 ${nextGame?.league?.name || 'Liga não informada'}
⏰ ${this.formatKickoff(nextGame?.fixture?.date)}
📌 Status: ${nextGame?.fixture?.status?.short || 'NS'}

━━━━━━━━━━━━━━
📊 Jogos encontrados:

${gamesText}

━━━━━━━━━━━━━━
${statsBlock}

━━━━━━━━━━━━━━
📰 Notícias:
No momento o Chat Oddix ainda não está conectado a uma fonte de notícias em tempo real. Então eu não vou inventar notícia.

✅ O que eu consigo fazer agora:
• analisar os jogos encontrados
• buscar estatísticas pelo fixture
• avaliar mercados
• montar leitura de risco
• sugerir onde esperar dados reais

🎯 Quer que eu analise o jogo de referência?`,
        data: {
          fixture: nextGame,
          fixtures: teamGames,
          suggestions: [
            `🎯 Analisa ${nextGame?.teams?.home?.name || ''} x ${nextGame?.teams?.away?.name || ''}`.trim(),
            '🏆 Mostrar jogos de hoje',
            '🔥 Monte uma múltipla segura',
            '💰 Gestão de banca',
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

  private async tryGetGameStats(game: any) {
    try {
      const fixtureId = String(game?.fixture?.id || '');
      if (!fixtureId || !this.footballService) {
        return '📊 Estatísticas detalhadas: aguardando fixture válido.';
      }

      const statsResponse: any = await this.footballService.getStatistics(fixtureId);

      const hasStats =
        statsResponse?.ok === true ||
        statsResponse?.success === true ||
        statsResponse?.available === true ||
        statsResponse?.data?.available === true ||
        statsResponse?.data?.realStatsAvailable === true ||
        statsResponse?.realStatsAvailable === true;

      if (!hasStats) {
        return `📊 Estatísticas detalhadas:
⚠️ Ainda aguardando estatísticas reais suficientes.

❌ Sem estatística real = sem palpite.`;
      }

      return `📊 Estatísticas detalhadas:
✅ Dados reais encontrados para esta partida.

Agora posso avaliar:
🎯 gols
🔥 dupla chance
📈 BTTS
🚩 escanteios
👤 player props
⚠️ risco da entrada`;
    } catch {
      return `📊 Estatísticas detalhadas:
⚠️ Não consegui validar estatísticas agora.`;
    }
  }

  private buildSmartRecommendation(): ChatFootballResponse {
    return {
      success: true,
      intent: 'ASK_RECOMMENDATION',
      answer:
`🔥 Fechado, Pedro! Agora a Oddix IA trabalha assim:

Primeiro eu busco os jogos reais.
Depois verifico se tem estatísticas e odds.
Só então eu libero entrada.

Me manda uma dessas:

🏆 "Mostrar jogos de hoje"
⚽ "Analisa Espanha x Uruguai"
🔥 "Monte uma múltipla segura"
👤 "Quero Player Props"
💰 "Quanto ganho com R$20?"

Se você perguntar:
"Como está a seleção da Espanha?"

eu vou buscar jogos da Espanha, estatísticas disponíveis e te dar uma visão completa sem inventar dados.`,
      data: {
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '🔥 Monte uma múltipla segura',
          '🎯 Quero uma aposta simples',
          '🇪🇸 Como está a seleção da Espanha?',
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

✅ Buscar jogos reais
✅ Conferir estatísticas reais
✅ Conferir odds reais
✅ Evitar mercados inventados
❌ Sem dados = sem bilhete fake

Para começar, me manda ou clique:

🏆 "Mostrar jogos de hoje"

Depois eu posso filtrar:
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

Ainda não tenho informação suficiente para transformar isso em entrada, mas posso buscar pelo caminho certo.

Tente perguntar assim:

⚽ "Analisa Espanha x Uruguai"
🏆 "Mostrar jogos de hoje"
🇪🇸 "Como está a seleção da Espanha?"
🔥 "Tem múltiplas?"
👤 "Quero Player Props"
💰 "Quanto ganho com R$20?"

A Oddix IA vai buscar os dados reais antes de responder com palpite.`,
      data: {
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '🔥 Monte uma múltipla segura',
          '🇪🇸 Como está a seleção da Espanha?',
          '🎮 Futebol Virtual',
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
      const fixturesResponse: any = await this.footballService.getFixtures();
      const fixtures = this.extractFixtureArray(fixturesResponse);

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
        return {
          success: true,
          intent,
          answer:
`📡 PARTIDA NÃO ENCONTRADA

Não encontrei:
⚽ ${teams.home} x ${teams.away}

Me peça:
"Mostrar jogos de hoje"

Aí eu listo os jogos reais disponíveis.`,
          data: {
            waitingForData: true,
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
        return {
          success: true,
          intent,
          answer:
`⚽ ${match?.teams?.home?.name || teams.home} x ${match?.teams?.away?.name || teams.away}

Encontrei a partida. ✅
🏆 ${match?.league?.name || 'Liga não informada'}

Mas ainda não tenho estatísticas reais suficientes para liberar palpite.

📡 Status:
⚠️ AGUARDANDO DADOS REAIS

❌ Nenhuma entrada aprovada agora.

Posso:
🏆 mostrar outros jogos
🎮 analisar futebol virtual
💰 calcular gestão de banca`,
          data: {
            waitingForData: true,
            fixture: match,
            suggestions: this.waitingSuggestions(),
          },
        };
      }

      return this.buildRealMatchAnalysis(match, stats, intent);
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

  private buildRealMatchAnalysis(match: any, stats: any, intent: ChatIntent): ChatFootballResponse {
    const home = match?.teams?.home?.name || 'Casa';
    const away = match?.teams?.away?.name || 'Fora';
    const league = match?.league?.name || 'Liga não informada';

    const oddOptions = match?.odds?.options || [];
    const oddsText = oddOptions.length
      ? oddOptions.map((item: any) => `${item.name}: ${Number(item.odd || 0).toFixed(2)}`).join(' | ')
      : 'Odds 1X2 ainda não disponíveis';

    return {
      success: true,
      intent,
      answer:
`⚽ ANÁLISE REAL ODDIX IA

${home} x ${away}
🏆 ${league}

📊 Estatísticas reais carregadas.
✅ Agora posso analisar com segurança.

Odds:
${oddsText}

Leitura da IA:
🔥 Dados suficientes encontrados.
Agora posso avaliar mercados como gols, dupla chance, BTTS, escanteios e player props.

Me diga:
🎯 "Quero uma aposta simples"
🔥 "Monte uma múltipla"
👤 "Quero Player Props"
💰 "Quanto ganho com R$20?"`,
      data: {
        fixture: match,
        statistics: stats,
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
    ) return 'LIST_MATCHES';

    if (
      text.includes('o que tem para apostar') ||
      text.includes('tem jogo bom') ||
      text.includes('me indica uma entrada') ||
      text.includes('me recomenda uma aposta') ||
      text.includes('quero uma recomendacao')
    ) return 'ASK_RECOMMENDATION';

    if (
      text.includes('multipla') ||
      text.includes('bilhete') ||
      text.includes('combinada') ||
      text.includes('tem multiplas') ||
      text.includes('tem multipla')
    ) return 'MULTIPLE';

    if (text.includes('quanto ganho') || text.includes('retorno') || text.includes('banca')) return 'BANKROLL';
    if (text.includes('risco') || text.includes('arriscada') || text.includes('vale a pena')) return 'RISK_EXPLAIN';
    if (text.includes('explica') || text.includes('explique') || text.includes('por que') || text.includes('porque')) return 'EXPLAIN_LAST';
    if (text.includes('mais mercado') || text.includes('adiciona mercado')) return 'MORE_MARKETS';
    if (text.includes('mais segura') || text.includes('conservadora')) return 'MAKE_SAFER';
    if (text.includes('mais agressiva') || text.includes('odd maior')) return 'MAKE_AGGRESSIVE';
    if (text.includes('player') || text.includes('jogador') || text.includes('chute') || text.includes('marca gol')) return 'PLAYER_PROPS';
    if (text.includes('ao vivo') || text.includes('live')) return 'LIVE';
    if (text.includes('virtual')) return 'VIRTUAL';
    if (text.includes('top pick') || text.includes('melhores entradas')) return 'TOP_PICKS';
    if (text.includes('simples') || text.includes('aposta segura')) return 'SIMPLE';
    if (text.includes('analisa') || text.includes('analisar') || text.includes('analise') || text.includes(' x ') || text.includes(' vs ')) return 'ANALYZE';

    return 'GENERAL';
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

  private formatScore(game: any) {
    const home = game?.goals?.home;
    const away = game?.goals?.away;

    if (home === null || home === undefined || away === null || away === undefined) return '';

    return `${home} x ${away}`;
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