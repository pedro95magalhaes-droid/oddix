import { Injectable } from '@nestjs/common';
import type {
  ChatFootballRequest,
  ChatFootballResponse,
  ChatHistoryMessage,
  ChatIntent,
  ChatRisk,
  ChatSeal,
  ChatSelection,
  ChatTicket,
} from './chat-football.types';

@Injectable()
export class ChatFootballService {
  async handleMessage(payload: ChatFootballRequest): Promise<ChatFootballResponse> {
    const message = payload?.message || '';
    const history = payload?.history || [];
    const intent = this.detectIntent(message);
    const mode = payload?.mode || this.detectMode(message);

    if (!message.trim()) {
      return {
        success: false,
        intent: 'GENERAL',
        answer: 'Manda sua pergunta que a Oddix IA já analisa pra você. 🔥',
      };
    }

    const lastTicket = this.findLastTicket(history);

    if (intent === 'EXPLAIN_LAST') {
      return this.explainLastTicket(lastTicket);
    }

    if (intent === 'MORE_MARKETS') {
      return this.addMoreMarkets(lastTicket);
    }

    if (intent === 'MAKE_SAFER') {
      return this.makeTicketSafer(lastTicket);
    }

    if (intent === 'MAKE_AGGRESSIVE') {
      return this.makeTicketAggressive(lastTicket);
    }

    switch (intent) {
      case 'MULTIPLE':
        return this.buildMultipleResponse(mode);

      case 'PLAYER_PROPS':
        return this.buildPlayerPropsResponse();

      case 'LIVE':
        return this.buildLiveResponse();

      case 'VIRTUAL':
        return this.buildVirtualResponse();

      case 'TOP_PICKS':
        return this.buildTopPicksResponse();

      case 'SIMPLE':
        return this.buildSimpleResponse();

      case 'ANALYZE':
        return this.buildAnalyzeResponse(message);

      default:
        return this.buildWelcomeResponse();
    }
  }

  private detectIntent(message: string): ChatIntent {
    const text = this.clean(message);

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
      text.includes('arriscada')
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

  private detectMode(message: string): 'safe' | 'balanced' | 'aggressive' {
    const text = this.clean(message);

    if (
      text.includes('agressiva') ||
      text.includes('alta odd') ||
      text.includes('odd alta') ||
      text.includes('arriscada')
    ) {
      return 'aggressive';
    }

    if (
      text.includes('segura') ||
      text.includes('conservadora') ||
      text.includes('baixo risco')
    ) {
      return 'safe';
    }

    return 'balanced';
  }

  private buildWelcomeResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'GENERAL',
      answer:
`🤖 Fala, Pedro! Bora pra cima. 🔥

Eu sou a Oddix IA, seu assistente de futebol e apostas.

Posso fazer agora:

🎯 Criar aposta simples
🔥 Montar múltipla segura ou agressiva
👤 Buscar Player Props
📈 Analisar jogo ao vivo
🎮 Analisar futebol virtual
🏆 Encontrar Top Picks

Manda assim:
"Monte uma múltipla segura"
"Analisa Flamengo x Palmeiras"
"Quero Player Props"
"Explique a múltipla"`,
    };
  }

  private buildSimpleResponse(): ChatFootballResponse {
    const selection: ChatSelection = {
      game: 'Espanha x Arábia Saudita',
      markets: ['Over 1.5 gols'],
      odd: 1.35,
      confidence: 88,
      risk: 'BAIXO',
      seal: this.getSeal(88),
      reason:
        'A Espanha tem superioridade técnica, bom volume ofensivo e tendência forte de pelo menos dois gols no jogo.',
    };

    const ticket: ChatTicket = {
      type: 'simple',
      title: '🎯 APOSTA SIMPLES ODDIX IA',
      oddTotal: selection.odd,
      confidence: selection.confidence,
      risk: 'Baixo',
      status: 'APROVADA',
      selections: [selection],
    };

    return {
      success: true,
      intent: 'SIMPLE',
      data: { ticket },
      answer:
`🎯 APOSTA SIMPLES ODDIX IA

🔥 Encontrei uma entrada bem interessante!

Jogo:
${selection.game}

Mercado:
✅ ${selection.markets[0]}

Odd ideal:
Acima de ${selection.odd.toFixed(2)}

Confiança:
${selection.confidence}%

Risco:
${this.formatRisk(selection.risk)}

Selo:
${this.formatSeal(selection.seal)}

🧠 Por que gostei?
${selection.reason}

✅ Entrada aprovada pela Oddix IA.`,
    };
  }

  private buildAnalyzeResponse(message: string): ChatFootballResponse {
    const game = this.extractGameName(message) || 'Jogo solicitado';

    return {
      success: true,
      intent: 'ANALYZE',
      answer:
`🎯 ANÁLISE ODDIX IA

Jogo:
${game}

🔥 Gostei mais destes mercados:

✅ Over 1.5 gols — 87%
✅ Over 4.5 escanteios — 82%
✅ Ambas marcam — 78%
✅ Jogador destaque 1+ chute no gol — 80%

❌ Eu evitaria:
❌ Placar correto
❌ Handicap muito esticado
❌ Over 3.5 gols sem odd de valor

🧠 Leitura da IA:
Vejo tendência de jogo aberto, bom volume ofensivo e mercados com menor variância.

🏆 Melhor entrada:
Over 1.5 gols

✅ Status: APROVADA`,
    };
  }

  private buildMultipleResponse(mode: 'safe' | 'balanced' | 'aggressive'): ChatFootballResponse {
    const baseSelections: ChatSelection[] = [
      {
        game: 'Espanha x Arábia Saudita',
        markets: [
          'Espanha vence',
          'Over 1.5 gols',
          'Lamine Yamal 1+ chute no gol',
        ],
        odd: 1.88,
        confidence: 90,
        risk: 'MEDIO',
        seal: this.getSeal(90),
        reason:
          'Espanha é superior tecnicamente, deve controlar o jogo e Yamal tem alto envolvimento ofensivo.',
      },
      {
        game: 'Bélgica x Irã',
        markets: [
          'Over 1.5 gols',
          'Jérémy Doku 1+ chute no gol',
        ],
        odd: 1.72,
        confidence: 84,
        risk: 'MEDIO',
        seal: this.getSeal(84),
        reason:
          'Bélgica cria bastante, Doku acelera muito pelos lados e o cenário favorece finalizações.',
      },
      {
        game: 'Uruguai x Cabo Verde',
        markets: [
          'Over 4.5 escanteios',
          'Over 0.5 gol no 1º tempo',
        ],
        odd: 1.61,
        confidence: 81,
        risk: 'MEDIO',
        seal: this.getSeal(81),
        reason:
          'Uruguai tende a pressionar cedo, gerando escanteios e boas chances no primeiro tempo.',
      },
    ];

    const selections = this.filterMultipleSelections(baseSelections, mode);
    const ticket = this.createTicket(selections, 'multiple');

    return {
      success: true,
      intent: 'MULTIPLE',
      data: { ticket },
      answer: this.formatMultipleAnswer(ticket, mode),
    };
  }

  private buildPlayerPropsResponse(): ChatFootballResponse {
    const selections: ChatSelection[] = [
      {
        game: 'Espanha x Arábia Saudita',
        markets: ['Lamine Yamal 1+ chute no gol'],
        odd: 1.45,
        confidence: 86,
        risk: 'MEDIO',
        seal: this.getSeal(86),
        reason:
          'Yamal participa muito das jogadas ofensivas e costuma finalizar quando recebe em zonas avançadas.',
      },
      {
        game: 'Bélgica x Irã',
        markets: ['Romelu Lukaku para marcar'],
        odd: 1.80,
        confidence: 81,
        risk: 'MEDIO_ALTO',
        seal: this.getSeal(81),
        reason:
          'Lukaku tem presença de área forte, mas o mercado de gol do jogador sempre tem variância maior.',
      },
    ];

    const ticket = this.createTicket(selections, 'player_props');

    return {
      success: true,
      intent: 'PLAYER_PROPS',
      data: { ticket },
      answer:
`👤 PLAYER PROPS ODDIX IA

🔥 Achei props interessantes, mas aqui a IA precisa ser mais exigente.

${selections
  .map(
    (item, index) => `━━━━━━━━━━━━━━
${index + 1}️⃣ ${item.game}

✅ ${item.markets.join('\n✅ ')}

Odd ideal:
${item.odd.toFixed(2)}+

Confiança:
${item.confidence}%

Selo:
${this.formatSeal(item.seal)}

🧠 Análise:
${item.reason}`,
  )
  .join('\n\n')}

⚠️ Regra Oddix:
Player Prop só passa quando existe boa chance de titularidade, minutos prováveis e padrão estatístico forte.`,
    };
  }

  private buildLiveResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'LIVE',
      answer:
`📈 AO VIVO ODDIX IA

🔥 Manda o jogo ao vivo que eu analiso pra você.

Eu vou olhar:

⚽ posse
🎯 finalizações
🥅 chutes no gol
🚩 escanteios
🟨 cartões
🔥 pressão ofensiva
⏱️ minuto do jogo

Exemplo:
"Analisa ao vivo Flamengo x Palmeiras"`,
    };
  }

  private buildVirtualResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'VIRTUAL',
      answer:
`🎮 ODDIX VIRTUAL IA

🔥 No virtual eu busco padrões repetitivos e mercados de menor variância.

Mercados que analiso:

✅ Over 1.5 gols
✅ Over 2.5 gols
✅ Under 3.5 gols
✅ Ambas marcam
✅ Dupla chance
✅ Virtual Boost

Manda:
"Monte uma múltipla virtual"
"Quero top pick virtual"`,
    };
  }

  private buildTopPicksResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'TOP_PICKS',
      answer:
`🏆 TOP PICKS ODDIX IA

🔥 Separei as melhores entradas do momento:

1️⃣ Espanha x Arábia Saudita
✅ Over 1.5 gols
Confiança: 88%
Selo: 🟢 SEGURA

2️⃣ Bélgica x Irã
✅ Over 4.5 escanteios
Confiança: 82%
Selo: 🟡 BOA

3️⃣ Uruguai x Cabo Verde
✅ Over 0.5 gol no 1º tempo
Confiança: 80%
Selo: 🟡 BOA

✅ Todas passaram no filtro mínimo da Oddix IA.`,
    };
  }

  private explainLastTicket(ticket: ChatTicket | null): ChatFootballResponse {
    if (!ticket) {
      return {
        success: true,
        intent: 'EXPLAIN_LAST',
        answer:
`Claro! 🔥

Mas eu ainda não encontrei uma múltipla anterior nesta conversa.

Manda:
"Monte uma múltipla segura"

Aí depois você pode perguntar:
"Explica essa múltipla"
"Deixa mais segura"
"Adiciona mais mercados"`,
      };
    }

    return {
      success: true,
      intent: 'EXPLAIN_LAST',
      data: { ticket },
      answer:
`Claro! 😄 Vou explicar a múltipla ponto por ponto.

${ticket.selections
  .map(
    (item, index) => `━━━━━━━━━━━━━━
${index + 1}️⃣ ${item.game}

Mercados escolhidos:
✅ ${item.markets.join('\n✅ ')}

Confiança:
${item.confidence}%

Risco:
${this.formatRisk(item.risk)}

Selo:
${this.formatSeal(item.seal)}

🧠 Por que entrou?
${item.reason}`,
  )
  .join('\n\n')}

━━━━━━━━━━━━━━
📊 Odd total: ${ticket.oddTotal.toFixed(2)}
🤖 Confiança geral: ${ticket.confidence}%
⚠️ Risco geral: ${ticket.risk}

🔥 Resumo da IA:
A múltipla foi montada buscando equilíbrio entre valor e segurança. Eu evitei mercados muito voláteis e priorizei gols, favoritos, escanteios e props com lógica ofensiva.`,
    };
  }

  private addMoreMarkets(ticket: ChatTicket | null): ChatFootballResponse {
    if (!ticket) {
      return this.buildMultipleResponse('balanced');
    }

    const upgraded: ChatTicket = {
      ...ticket,
      selections: ticket.selections.map((item, index) => ({
        ...item,
        markets: [
          ...item.markets,
          index === 0
            ? 'Over 4.5 escanteios'
            : index === 1
              ? 'Over 0.5 cartões'
              : 'Dupla chance 12',
        ],
        odd: Number((item.odd * 1.18).toFixed(2)),
        confidence: Math.max(75, item.confidence - 3),
        risk: item.risk === 'BAIXO' ? 'MEDIO' : item.risk,
      })),
    };

    const recalculated = this.createTicket(upgraded.selections, 'multiple');

    return {
      success: true,
      intent: 'MORE_MARKETS',
      data: { ticket: recalculated },
      answer:
`🔥 Boa! Adicionei mais mercados e recalculei a múltipla.

⚠️ Aviso da IA:
Mais mercados aumentam a odd, mas também aumentam o risco.

${this.formatMultipleAnswer(recalculated, 'aggressive')}`,
    };
  }

  private makeTicketSafer(ticket: ChatTicket | null): ChatFootballResponse {
    if (!ticket) {
      return this.buildMultipleResponse('safe');
    }

    const saferSelections = ticket.selections
      .map((item) => ({
        ...item,
        markets: item.markets.slice(0, 1),
        odd: Number(Math.max(1.25, item.odd * 0.72).toFixed(2)),
        confidence: Math.min(96, item.confidence + 5),
        risk: 'BAIXO' as ChatRisk,
        seal: this.getSeal(Math.min(96, item.confidence + 5)),
      }))
      .filter((item) => item.confidence >= 85);

    const saferTicket = this.createTicket(saferSelections, 'multiple');

    return {
      success: true,
      intent: 'MAKE_SAFER',
      data: { ticket: saferTicket },
      answer:
`🛡️ Fechado! Deixei a múltipla mais segura.

Removi mercados mais arriscados e mantive apenas os que têm maior confiança.

${this.formatMultipleAnswer(saferTicket, 'safe')}`,
    };
  }

  private makeTicketAggressive(ticket: ChatTicket | null): ChatFootballResponse {
    if (!ticket) {
      return this.buildMultipleResponse('aggressive');
    }

    return this.addMoreMarkets(ticket);
  }

  private createTicket(selections: ChatSelection[], type: ChatTicket['type']): ChatTicket {
    const oddTotal = selections.reduce((acc, item) => acc * item.odd, 1);
    const confidence = Math.round(
      selections.reduce((acc, item) => acc + item.confidence, 0) / Math.max(selections.length, 1),
    );

    return {
      type,
      title: type === 'simple' ? '🎯 APOSTA SIMPLES ODDIX IA' : '🔥 MÚLTIPLA ODDIX IA',
      oddTotal: Number(oddTotal.toFixed(2)),
      confidence,
      risk: confidence >= 87 ? 'Médio' : confidence >= 80 ? 'Médio-Alto' : 'Alto',
      status: confidence >= 75 ? 'APROVADA' : 'REPROVADA',
      selections,
    };
  }

  private formatMultipleAnswer(ticket: ChatTicket, mode: 'safe' | 'balanced' | 'aggressive') {
    const modeLabel =
      mode === 'safe' ? 'Conservadora' : mode === 'aggressive' ? 'Agressiva' : 'Balanceada';

    const body = ticket.selections
      .map((item, index) => {
        return `━━━━━━━━━━━━━━
${index + 1}️⃣ ${item.game}
━━━━━━━━━━━━━━
✅ ${item.markets.join('\n✅ ')}

Odd:
${item.odd.toFixed(2)}

🤖 Confiança IA:
${item.confidence}%

⚠️ Risco:
${this.formatRisk(item.risk)}

Selo:
${this.formatSeal(item.seal)}

📝 Análise:
${item.reason}`;
      })
      .join('\n\n');

    return `🔥 MÚLTIPLA ODDIX IA

💎 Perfil: ${modeLabel}
📊 Odd Total: ${ticket.oddTotal.toFixed(2)}
🤖 Confiança Geral: ${ticket.confidence}%
⚠️ Risco Geral: ${ticket.risk}
🏆 Status: ${ticket.status}

${body}

━━━━━━━━━━━━━━
✅ Bilhete aprovado pela Oddix IA.

Quer que eu:
🧠 explique a múltipla?
🛡️ deixe mais segura?
🚀 deixe mais agressiva?
➕ adicione mais mercados?`;
  }

  private filterMultipleSelections(
    selections: ChatSelection[],
    mode: 'safe' | 'balanced' | 'aggressive',
  ) {
    if (mode === 'safe') {
      return selections.filter((item) => item.confidence >= 85).slice(0, 3);
    }

    if (mode === 'aggressive') {
      return selections.filter((item) => item.confidence >= 75).slice(0, 6);
    }

    return selections.filter((item) => item.confidence >= 80).slice(0, 4);
  }

  private findLastTicket(history: ChatHistoryMessage[]): ChatTicket | null {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const data = history[index]?.data;
      const ticket = data?.ticket;

      if (ticket?.selections?.length) {
        return ticket;
      }
    }

    return null;
  }

  private getSeal(confidence: number): ChatSeal {
    if (confidence >= 95) return 'ELITE';
    if (confidence >= 85) return 'SEGURA';
    if (confidence >= 75) return 'BOA';
    if (confidence >= 60) return 'ARRISCADA';
    return 'REPROVADA';
  }

  private formatSeal(seal: ChatSeal) {
    const map: Record<ChatSeal, string> = {
      ELITE: '👑 ELITE',
      SEGURA: '🟢 SEGURA',
      BOA: '🟡 BOA',
      ARRISCADA: '🟠 ARRISCADA',
      REPROVADA: '🔴 REPROVADA',
    };

    return map[seal];
  }

  private formatRisk(risk: ChatRisk) {
    const map: Record<ChatRisk, string> = {
      BAIXO: 'Baixo',
      MEDIO: 'Médio',
      MEDIO_ALTO: 'Médio-Alto',
      ALTO: 'Alto',
    };

    return map[risk];
  }

  private extractGameName(message: string) {
    const cleaned = message
      .replace(/analisa/gi, '')
      .replace(/analisar/gi, '')
      .replace(/análise/gi, '')
      .replace(/analise/gi, '')
      .trim();

    return cleaned || null;
  }

  private clean(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}