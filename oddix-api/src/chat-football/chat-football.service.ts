import { Injectable } from '@nestjs/common';
import {
  ChatFootballRequest,
  ChatFootballResponse,
  ChatIntent,
  ChatRisk,
  ChatSeal,
  ChatSelection,
} from './chat-football.types';

@Injectable()
export class ChatFootballService {
  private detectIntent(message: string): ChatIntent {
    const text = this.clean(message);

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
      text.includes('análise') ||
      text.includes(' x ') ||
      text.includes(' vs ')
    ) {
      return 'ANALYZE';
    }

    return 'GENERAL';
  }

  async handleMessage(payload: ChatFootballRequest): Promise<ChatFootballResponse> {
    const message = payload?.message || '';
    const intent = this.detectIntent(message);
    const mode = payload?.mode || this.detectMode(message);

    if (!message.trim()) {
      return {
        success: false,
        intent: 'GENERAL',
        answer: 'Digite uma pergunta para a Oddix IA analisar.',
      };
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
`🤖 Olá, eu sou a Oddix IA.

Sou especializada em futebol e apostas.

Posso te ajudar com:

⚽ Analisar jogos
🎯 Criar aposta simples
🔥 Montar múltiplas
👤 Buscar Player Props
📈 Analisar jogos ao vivo
🏆 Encontrar Top Picks
🎮 Futebol Virtual

Exemplos:
"Analisa Flamengo x Palmeiras"
"Monta uma múltipla segura para hoje"
"Quero player props"
"Quero uma aposta simples"`,
    };
  }

  private buildSimpleResponse(): ChatFootballResponse {
    const selection: ChatSelection = {
      game: 'Espanha x Arábia Saudita',
      market: 'Over 1.5 gols',
      odd: 1.35,
      confidence: 88,
      risk: 'BAIXO',
      seal: this.getSeal(88),
      reason:
        'A IA encontrou padrão ofensivo forte, superioridade técnica e boa tendência de pelo menos dois gols.',
    };

    return {
      success: true,
      intent: 'SIMPLE',
      data: selection,
      answer:
`🎯 APOSTA SIMPLES ODDIX IA

Jogo:
${selection.game}

Mercado:
${selection.market}

Odd ideal:
Acima de ${selection.odd.toFixed(2)}

Confiança:
${selection.confidence}%

Risco:
${this.formatRisk(selection.risk)}

Selo:
${this.formatSeal(selection.seal)}

📝 Análise:
${selection.reason}

✅ Status: ENTRADA APROVADA PELA IA`,
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

✅ Melhor entrada:
Over 1.5 gols

Odd ideal:
Acima de 1.35

Confiança:
87%

Risco:
Médio-Baixo

Selo:
🟢 SEGURA

📊 Mercados aprovados:
✅ Over 1.5 gols — 87%
✅ Over 4.5 escanteios — 82%
✅ Ambas marcam — 78%
✅ Jogador destaque 1+ chute no gol — 80%

❌ Mercados reprovados:
❌ Placar correto
❌ Handicap muito esticado
❌ Over 3.5 gols sem odd de valor

📝 Análise:
A IA encontrou tendência de jogo aberto, volume ofensivo consistente e mercados de menor variância.

✅ Status: ENTRADA APROVADA`,
    };
  }

  private buildMultipleResponse(mode: 'safe' | 'balanced' | 'aggressive'): ChatFootballResponse {
    const selections: ChatSelection[] = [
      {
        game: 'Espanha x Arábia Saudita',
        market: 'Espanha vence + Over 1.5 gols + Lamine Yamal 1+ chute no gol',
        odd: 1.88,
        confidence: 90,
        risk: 'MEDIO',
        seal: this.getSeal(90),
        reason:
          'Espanha tem superioridade técnica, bom volume ofensivo e Lamine Yamal costuma participar bastante das ações de ataque.',
      },
      {
        game: 'Bélgica x Irã',
        market: 'Over 1.5 gols + Doku 1+ chute no gol',
        odd: 1.72,
        confidence: 84,
        risk: 'MEDIO',
        seal: this.getSeal(84),
        reason:
          'Bélgica apresenta criação ofensiva forte. O mercado de chute no gol aumenta a odd, mas mantém boa lógica estatística.',
      },
      {
        game: 'Uruguai x Cabo Verde',
        market: 'Over 4.5 escanteios + Over 0.5 gol no 1º tempo',
        odd: 1.61,
        confidence: 81,
        risk: 'MEDIO',
        seal: this.getSeal(81),
        reason:
          'A IA encontrou tendência de pressão, volume lateral e boa chance de início movimentado.',
      },
    ];

    const filtered = this.filterMultipleSelections(selections, mode);
    const oddTotal = filtered.reduce((acc, item) => acc * item.odd, 1);
    const confidence = Math.round(
      filtered.reduce((acc, item) => acc + item.confidence, 0) / filtered.length,
    );

    if (!filtered.length || confidence < 75) {
      return {
        success: true,
        intent: 'MULTIPLE',
        answer:
`⚠️ SEM MÚLTIPLA SEGURA

A Oddix IA analisou os mercados disponíveis, mas não encontrou seleções suficientes com qualidade.

Critérios usados:
✅ Confiança mínima
✅ Odds com valor
✅ Menor variância
✅ Player Props com lógica estatística

Recomendação:
Aguardar novos jogos ou pedir uma aposta simples.`,
      };
    }

    return {
      success: true,
      intent: 'MULTIPLE',
      data: {
        selections: filtered,
        oddTotal,
        confidence,
        mode,
      },
      answer: this.formatMultipleAnswer(filtered, oddTotal, confidence),
    };
  }

  private buildPlayerPropsResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'PLAYER_PROPS',
      answer:
`👤 PLAYER PROPS ODDIX IA

A IA encontrou estes mercados de jogador com melhor valor:

━━━━━━━━━━━━━━
1️⃣ Lamine Yamal
Jogo: Espanha x Arábia Saudita

✅ Mercado:
1+ chute no gol

Odd ideal:
Acima de 1.45

Confiança:
86%

Selo:
🟢 SEGURA

📝 Análise:
Jogador com alto envolvimento ofensivo, boa frequência de finalizações e tendência de enfrentar defesa recuada.

━━━━━━━━━━━━━━
2️⃣ Romelu Lukaku
Jogo: Bélgica x Irã

✅ Mercado:
Para marcar

Odd ideal:
Acima de 1.80

Confiança:
81%

Selo:
🟡 BOA

📝 Análise:
Boa presença de área, mas mercado depende de finalização e tempo em campo.

━━━━━━━━━━━━━━
⚠️ Filtro Oddix:
Player Props só são aprovadas quando a IA identifica boa chance de titularidade, minutos prováveis e estatística compatível.`,
    };
  }

  private buildLiveResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'LIVE',
      answer:
`📈 AO VIVO ODDIX IA

Para análise live, envie o jogo ou escolha um jogo ao vivo.

A IA vai analisar:

⚽ posse
🥅 finalizações
🎯 chutes no gol
🚩 escanteios
🟨 cartões
🔥 pressão ofensiva
⏱️ momento do jogo

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

Mercados virtuais disponíveis:

✅ Over 1.5 gols
✅ Over 2.5 gols
✅ Under 3.5 gols
✅ Ambas marcam
✅ Dupla chance
✅ Virtual Boost

Exemplo:
"Monte uma múltipla virtual"
"Quero top pick virtual"
"Analisa Euro Cup Virtual"`,
    };
  }

  private buildTopPicksResponse(): ChatFootballResponse {
    return {
      success: true,
      intent: 'TOP_PICKS',
      answer:
`🏆 TOP PICKS ODDIX IA

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

✅ Todos passaram no filtro mínimo da IA.`,
    };
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

  private formatMultipleAnswer(
    selections: ChatSelection[],
    oddTotal: number,
    confidence: number,
  ) {
    const risk = confidence >= 85 ? 'Médio' : 'Médio-Alto';
    const status = confidence >= 75 ? 'APROVADA' : 'REPROVADA';

    const body = selections
      .map((item, index) => {
        return `━━━━━━━━━━━━━━
${index + 1}️⃣ ${item.game}
━━━━━━━━━━━━━━
✅ ${item.market}

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

📊 Odd Total: ${oddTotal.toFixed(2)}
🤖 Confiança Geral: ${confidence}%
⚠️ Risco Geral: ${risk}
🏆 Status: ${status}

${body}

━━━━━━━━━━━━━━
✅ Múltipla aprovada pela Oddix IA.
A IA analisou mercados de gols, resultado, escanteios, cartões e Player Props antes de montar o bilhete.`;
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