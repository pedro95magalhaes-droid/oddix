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

  async handleMessage(payload: ChatFootballRequest): Promise<ChatFootballResponse> {
    const message = payload?.message || '';
    const history = payload?.history || [];
    const intent = this.detectIntent(message);
    const lastTicket = this.findLastTicket(history);

    if (!message.trim()) {
      return this.waitingForRealData('GENERAL');
    }

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

  private detectIntent(message: string): ChatIntent {
    const text = this.clean(message);

    if (
      text.includes('quanto ganho') ||
      text.includes('quanto retorna') ||
      text.includes('retorno') ||
      text.includes('gestao') ||
      text.includes('gestão') ||
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
      text.includes('está boa') ||
      text.includes('vale a pena')
    ) {
      return 'RISK_EXPLAIN';
    }

    if (
      text.includes('explica') ||
      text.includes('explique') ||
      text.includes('porque') ||
      text.includes('por que') ||
      text.includes('motivo') ||
      text.includes('entender a multipla') ||
      text.includes('entender o bilhete')
    ) {
      return 'EXPLAIN_LAST';
    }

    if (
      text.includes('mais mercado') ||
      text.includes('mais mercados') ||
      text.includes('adiciona mercado') ||
      text.includes('coloca mais') ||
      text.includes('inserir mercado')
    ) {
      return 'MORE_MARKETS';
    }

    if (
      text.includes('mais segura') ||
      text.includes('deixa segura') ||
      text.includes('reduz risco') ||
      text.includes('conservadora')
    ) {
      return 'MAKE_SAFER';
    }

    if (
      text.includes('mais agressiva') ||
      text.includes('aumenta odd') ||
      text.includes('odd maior') ||
      text.includes('agressiva')
    ) {
      return 'MAKE_AGGRESSIVE';
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
      text.includes('marca gol') ||
      text.includes('para marcar')
    ) {
      return 'PLAYER_PROPS';
    }

    if (text.includes('ao vivo') || text.includes('live') || text.includes('tempo real')) {
      return 'LIVE';
    }

    if (text.includes('virtual') || text.includes('futebol virtual')) {
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
      text.includes('análise') ||
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

❌ Nenhuma entrada aprovada no momento.

Quando os dados reais estiverem disponíveis, eu consigo gerar:

🎯 Aposta simples
🔥 Múltipla
👤 Player Props
📈 Análise ao vivo
🧠 Explicação completa`,
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
      '🏆 Ver Top Picks',
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

  private clean(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}