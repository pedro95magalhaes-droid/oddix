import { Injectable, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import type {
  ChatFootballRequest,
  ChatFootballResponse,
  ChatHistoryMessage,
  ChatIntent,
  ChatTicket,
} from './chat-football.types';

@Injectable()
export class ChatFootballService {
  constructor(
    @Optional()
    private readonly footballService?: FootballService,
  ) {}

  async handleMessage(payload: ChatFootballRequest | any): Promise<ChatFootballResponse> {
    const message =
      typeof payload === 'string'
        ? payload
        : String(
            payload?.message ||
              payload?.text ||
              payload?.prompt ||
              payload?.question ||
              '',
          );

    const history: ChatHistoryMessage[] = Array.isArray(payload?.history)
      ? payload.history
      : [];

    const intent = this.detectIntent(message);
    const lastTicket = this.findLastTicket(history);

    if (!message.trim()) {
      return this.buildRecommendationResponse();
    }

    if (intent === 'LIST_MATCHES') {
      return this.listRealGames(intent);
    }

    if (intent === 'ASK_RECOMMENDATION') {
      return this.buildRecommendationResponse();
    }

    if (intent === 'MULTIPLE') {
      return this.buildMultipleRequestResponse();
    }

    if (this.shouldListGames(message)) {
      return this.listRealGames(intent);
    }

    const realAnalysis = await this.analyzeRealMatch(message, intent);
    if (realAnalysis) return realAnalysis;

    if (intent === 'EXPLAIN_LAST') {
      if (!lastTicket) return this.waitingForRealData('EXPLAIN_LAST');
      return this.explainLastTicket(lastTicket);
    }

    if (intent === 'RISK_EXPLAIN') {
      if (!lastTicket) return this.waitingForRealData('RISK_EXPLAIN');
      return this.explainRisk(lastTicket);
    }

    if (intent === 'BANKROLL') {
      return this.explainBankroll(message, lastTicket);
    }

    if (intent === 'VIRTUAL') {
      return this.buildVirtualResponse();
    }

    return this.waitingForRealData(intent);
  }

  private buildRecommendationResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'ASK_RECOMMENDATION',
      answer:
`🔥 Fala! Posso te ajudar com:

🏆 Jogos de hoje
🔥 Múltiplas
🎯 Apostas simples
👤 Player Props
📈 Jogos ao vivo
🎮 Futebol Virtual
💰 Gestão de banca

Me diga algo como:

• "Mostrar jogos de hoje"
• "Monte uma múltipla segura"
• "Analisa Flamengo x Palmeiras"
• "Quero Player Props"`,
      data: {
        suggestions: [
          '🏆 Mostrar jogos de hoje',
          '🔥 Monte uma múltipla segura',
          '🎯 Quero uma aposta simples',
          '👤 Quero Player Props',
        ],
      },
    };
  }

  private buildMultipleRequestResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'MULTIPLE',
      answer:
`🔥 MÚLTIPLAS ODDIX IA

Posso montar múltiplas, mas seguindo a regra profissional da Oddix:

✅ Só uso jogos reais
✅ Só libero entrada com estatísticas reais
✅ Só monto bilhete com odds reais
❌ Não vou inventar múltipla baseada em suposição

Para eu montar uma múltipla agora, primeiro preciso carregar os jogos disponíveis.

Clique em:
🏆 Mostrar jogos de hoje

Ou mande:
"Mostrar jogos de hoje"`,
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
    if (!this.footballService) {
      return this.waitingForRealData(intent);
    }

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

Status:
⚠️ AGUARDANDO DADOS REAIS

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

Encontrei ${fixtures.length} jogos disponíveis na base Oddix.

${gamesText}

━━━━━━━━━━━━━━
📌 Para analisar um jogo, mande assim:

"Analisa Time A x Time B"

⚠️ Importante:
Eu só libero palpite se tiver estatísticas reais e odds reais suficientes.`,
        data: {
          fixtures,
          suggestions: [
            '🔄 Atualizar jogos',
            '📈 Jogos ao vivo',
            '🎮 Futebol Virtual',
            '🔥 Monte uma múltipla segura',
          ],
        },
      };
    } catch (error: any) {
      return {
        success: true,
        intent,
        answer:
`📡 ODDIX IA — ERRO AO BUSCAR JOGOS

Tentei consultar os jogos reais, mas ainda não consegui carregar a lista.

Motivo técnico:
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
`📡 ODDIX IA — PARTIDA NÃO ENCONTRADA

Não encontrei essa partida na base atual de jogos.

Busca feita:
⚽ ${teams.home} x ${teams.away}

Status:
⚠️ AGUARDANDO DADOS REAIS

❌ Nenhuma entrada aprovada no momento.`,
          data: {
            waitingForData: true,
            suggestions: this.waitingSuggestions(),
          },
        };
      }

      const fixtureId = String(match?.fixture?.id || '');

      if (!fixtureId) {
        return this.waitingForRealData(intent);
      }

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
`📡 ODDIX IA — AGUARDANDO DADOS REAIS

Encontrei a partida:

⚽ ${match?.teams?.home?.name || teams.home} x ${match?.teams?.away?.name || teams.away}
🏆 ${match?.league?.name || 'Liga não informada'}

Mas ainda não tenho estatísticas reais suficientes para gerar uma análise confiável.

Status:
⚠️ AGUARDANDO DADOS REAIS

❌ Nenhuma entrada aprovada no momento.`,
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
`📡 ODDIX IA — AGUARDANDO DADOS REAIS

Tentei buscar os dados reais desta partida, mas ainda não consegui validar estatísticas suficientes.

Motivo técnico:
${error?.message || 'Falha ao consultar dados reais'}

❌ Nenhuma entrada aprovada no momento.`,
        data: {
          waitingForData: true,
          suggestions: this.waitingSuggestions(),
        },
      };
    }
  }

  private buildRealMatchAnalysis(
    match: any,
    stats: any,
    intent: ChatIntent,
  ): ChatFootballResponse {
    const home = match?.teams?.home?.name || 'Casa';
    const away = match?.teams?.away?.name || 'Fora';
    const league = match?.league?.name || 'Liga não informada';

    const oddOptions = match?.odds?.options || [];
    const oddsText = oddOptions.length
      ? oddOptions
          .map((item: any) => `${item.name}: ${Number(item.odd || 0).toFixed(2)}`)
          .join(' | ')
      : 'Odds 1X2 ainda não disponíveis';

    return {
      success: true,
      intent,
      answer:
`⚽ ANÁLISE REAL ODDIX IA

Jogo:
${home} x ${away}

Liga:
${league}

📊 Estatísticas reais carregadas com sucesso.
✅ A análise foi liberada porque existem dados reais disponíveis.

Odds:
${oddsText}

Leitura inicial:
🧠 A Oddix IA encontrou dados suficientes para avaliar mercados com mais segurança.

Mercados que posso analisar agora:

🎯 Aposta simples
🔥 Múltipla
👤 Player Props
📈 Ao vivo
💰 Gestão de banca

Próximo passo:
Peça assim:
"Monte uma entrada para esse jogo"
"Explique os melhores mercados"
"Quero uma aposta simples"
"Quero player props"`,
      data: {
        fixture: match,
        statistics: stats,
        suggestions: [
          '🎯 Quero uma aposta simples',
          '🔥 Monte uma múltipla segura',
          '👤 Quero Player Props',
          '💰 Quanto ganho com R$20?',
          '⚠️ Essa entrada está arriscada?',
        ],
      },
    };
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
      .replace(/quero/gi, '')
      .replace(/uma/gi, '')
      .replace(/aposta/gi, '')
      .replace(/simples/gi, '')
      .replace(/segura/gi, '')
      .trim();

    const separators = [' x ', ' vs ', ' versus ', ' contra '];

    for (const separator of separators) {
      const normalized = cleaned.toLowerCase();

      if (normalized.includes(separator)) {
        const parts = normalized.split(separator);

        if (parts[0]?.trim() && parts[1]?.trim()) {
          return {
            home: parts[0].trim(),
            away: parts[1].trim(),
          };
        }
      }
    }

    return null;
  }

  private detectIntent(message: string): ChatIntent {
    const text = this.clean(message);

    if (
      text.includes('tem jogos') ||
      text.includes('tem partida') ||
      text.includes('tem partidas') ||
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
      text.includes('quero uma recomendacao')
    ) {
      return 'ASK_RECOMMENDATION';
    }

    if (
      text.includes('quanto ganho') ||
      text.includes('quanto retorna') ||
      text.includes('retorno') ||
      text.includes('gestao') ||
      text.includes('banca') ||
      text.includes('com r$') ||
      (text.includes('com ') && text.includes(' reais'))
    ) {
      return 'BANKROLL';
    }

    if (
      text.includes('risco') ||
      text.includes('arriscada') ||
      text.includes('perigosa') ||
      text.includes('ta boa') ||
      text.includes('vale a pena')
    ) {
      return 'RISK_EXPLAIN';
    }

    if (
      text.includes('explica') ||
      text.includes('explique') ||
      text.includes('porque') ||
      text.includes('por que') ||
      text.includes('motivo')
    ) {
      return 'EXPLAIN_LAST';
    }

    if (
      text.includes('mais mercado') ||
      text.includes('mais mercados') ||
      text.includes('adiciona mercado') ||
      text.includes('coloca mais')
    ) {
      return 'MORE_MARKETS';
    }

    if (
      text.includes('mais segura') ||
      text.includes('reduz risco') ||
      text.includes('conservadora')
    ) {
      return 'MAKE_SAFER';
    }

    if (
      text.includes('mais agressiva') ||
      text.includes('aumenta odd') ||
      text.includes('odd maior')
    ) {
      return 'MAKE_AGGRESSIVE';
    }

    if (
      text.includes('multipla') ||
      text.includes('bilhete') ||
      text.includes('combinada') ||
      text.includes('tem multipla') ||
      text.includes('tem multiplas') ||
      text.includes('me mostra uma multipla')
    ) {
      return 'MULTIPLE';
    }

    if (
      text.includes('player') ||
      text.includes('jogador') ||
      text.includes('chute') ||
      text.includes('finalizacao') ||
      text.includes('marca gol') ||
      text.includes('para marcar')
    ) {
      return 'PLAYER_PROPS';
    }

    if (
      text.includes('ao vivo') ||
      text.includes('live') ||
      text.includes('tempo real')
    ) {
      return 'LIVE';
    }

    if (
      text.includes('virtual') ||
      text.includes('futebol virtual')
    ) {
      return 'VIRTUAL';
    }

    if (
      text.includes('top pick') ||
      text.includes('top picks') ||
      text.includes('melhores entradas')
    ) {
      return 'TOP_PICKS';
    }

    if (
      text.includes('simples') ||
      text.includes('aposta segura') ||
      text.includes('entrada segura')
    ) {
      return 'SIMPLE';
    }

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

  private waitingForRealData(intent: ChatIntent): ChatFootballResponse {
    return {
      success: true,
      intent,
      answer:
`📡 ODDIX IA — AGUARDANDO DADOS REAIS

Ainda não tenho estatísticas reais suficientes para gerar uma análise confiável.

Para manter a qualidade da Oddix IA, eu não vou inventar palpite nem montar bilhete baseado em suposição.

Status:
⚠️ AGUARDANDO DADOS REAIS

Para liberar uma entrada, preciso de:

✅ Estatísticas reais
✅ Odds reais
✅ Dados recentes da partida
✅ Mercado disponível
✅ Confiança mínima da IA

❌ Nenhuma entrada aprovada no momento.`,
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

No futebol virtual eu trabalho com padrões estatísticos próprios do módulo virtual.

Posso analisar:

✅ Over 1.5 gols
✅ Over 2.5 gols
✅ Ambas marcam
✅ Dupla chance
✅ Virtual Boost
✅ Top Picks Virtuais

Manda:
"Quero top pick virtual"
"Monte uma múltipla virtual"`,
      data: {
        suggestions: [
          '🎮 Top Pick Virtual',
          '🔥 Múltipla Virtual',
          '📊 ROI Virtual',
          '🏆 Hall da Fama Virtual',
        ],
      },
    };
  }

  private explainLastTicket(ticket: ChatTicket): ChatFootballResponse {
    return {
      success: true,
      intent: 'EXPLAIN_LAST',
      data: {
        ticket,
        suggestions: this.ticketSuggestions(),
      },
      answer:
`🧠 Explicando o último bilhete.

Importante:
Esta explicação só é válida se o bilhete foi gerado com dados reais.

${ticket.selections
  .map(
    (item, index) => `━━━━━━━━━━━━━━
${index + 1}️⃣ ${item.game}

Mercados:
✅ ${item.markets.join('\n✅ ')}

Confiança:
${item.confidence}%

Risco:
${item.risk}

Motivo:
${item.reason}`,
  )
  .join('\n\n')}

📊 Odd total: ${ticket.oddTotal.toFixed(2)}
🤖 Confiança geral: ${ticket.confidence}%
⚠️ Risco geral: ${ticket.risk}`,
    };
  }

  private explainRisk(ticket: ChatTicket): ChatFootballResponse {
    return {
      success: true,
      intent: 'RISK_EXPLAIN',
      data: {
        ticket,
        suggestions: this.ticketSuggestions(),
      },
      answer:
`⚠️ Análise de risco do bilhete

📊 Odd total: ${ticket.oddTotal.toFixed(2)}
🤖 Confiança geral: ${ticket.confidence}%
🔥 Status: ${ticket.status}

Leitura da Oddix IA:

${ticket.confidence >= 87
  ? '🟢 Bilhete equilibrado, mas ainda exige stake controlada.'
  : ticket.confidence >= 80
    ? '🟡 Bilhete bom, porém com risco médio-alto por ter várias seleções.'
    : '🔴 Bilhete agressivo. Eu só entraria com valor pequeno.'}

Pontos de atenção:
${ticket.selections
  .map((item) => `• ${item.game}: ${item.risk} — ${item.confidence}%`)
  .join('\n')}`,
    };
  }

  private explainBankroll(message: string, ticket: ChatTicket | null): ChatFootballResponse {
    const amount = this.extractMoney(message) || 20;
    const odd = ticket?.oddTotal || 1;
    const potentialReturn = amount * odd;
    const profit = potentialReturn - amount;

    const conservative = Math.max(1, amount * 0.25);
    const moderate = amount * 0.5;
    const aggressive = amount;

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

📊 Odd usada: ${odd.toFixed(2)}
💵 Retorno potencial: R$${this.money(potentialReturn)}
📈 Lucro líquido: R$${this.money(profit)}

Minha gestão recomendada:

🟢 Entrada conservadora:
R$${this.money(conservative)}

🟡 Entrada moderada:
R$${this.money(moderate)}

🔴 Entrada agressiva:
R$${this.money(aggressive)}

⚠️ Regra Oddix:
Valor menor = conservador.
Valor médio = moderado.
Valor total/maior = agressivo.

🚨 Eu evitaria colocar mais de 3% da banca em uma múltipla.`,
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