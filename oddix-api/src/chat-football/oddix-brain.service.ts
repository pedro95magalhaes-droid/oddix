import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { OddixEntityExtractorService, OddixEntities } from './oddix-entity-extractor.service';
import { OddixContextMemoryService, OddixConversationContext } from './oddix-context-memory.service';

export type OddixBrainIntent =
  | 'GENERAL'
  | 'TOP_PICKS'
  | 'MATCH_ANALYSIS'
  | 'LIVE'
  | 'MULTIPLE'
  | 'BANKROLL'
  | 'NEWS'
  | 'TEAM'
  | 'PLAYER'
  | 'VIRTUAL'
  | 'VALUE_BETS'
  | 'EXPLAIN'
  | 'FOLLOW_UP';

export type OddixBrainRiskMode = 'safe' | 'balanced' | 'aggressive';

export type OddixBrainDecision = {
  intent: OddixBrainIntent;
  userMessage: string;
  normalizedQuestion: string;
  confidence: number;
  riskMode: OddixBrainRiskMode;
  entities: OddixEntities;
  reference?: 'lastMatch' | 'lastTicket' | 'lastTeam' | 'none';
  userWants?: string;
  shouldUseOddixEngine: boolean;
  shouldUseGlobalAiDirect: boolean;
  shouldHumanizeWithGemini: boolean;
  safetyNotes: string[];
  source: 'gemini' | 'local';
};

type GeminiBrainJson = {
  intent?: string;
  confidence?: number;
  riskMode?: string;
  homeTeam?: string;
  awayTeam?: string;
  team?: string;
  player?: string;
  league?: string;
  market?: string;
  stake?: number;
  odd?: number;
  reference?: string;
  userWants?: string;
  shouldUseOddixEngine?: boolean;
  shouldUseGlobalAiDirect?: boolean;
};

@Injectable()
export class OddixBrainService {
  private readonly logger = new Logger(OddixBrainService.name);
  private readonly ai: GoogleGenAI | null;

  constructor(
    private readonly entityExtractor: OddixEntityExtractorService,
    private readonly contextMemory: OddixContextMemoryService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY não configurada. Oddix Brain usará modo local.');
    }
  }

  async think(userMessage: string, sessionId = 'anonymous'): Promise<OddixBrainDecision> {
    const message = String(userMessage || '').trim();
    const context = this.contextMemory.get(sessionId);
    const localDecision = this.localThink(message, context);

    if (!this.ai || !message) {
      return localDecision;
    }

    try {
      const prompt = this.buildBrainPrompt(message, context);
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const raw = response.text || '';
      const json = this.safeParseJson(raw);

      if (!json) return localDecision;

      const decision = this.normalizeGeminiDecision(message, context, json, localDecision);

      this.contextMemory.remember(sessionId, {
        lastIntent: decision.intent,
        lastUserMessage: message,
        lastEntities: decision.entities,
        lastTeam: decision.entities.team || context.lastTeam,
        lastMatch:
          decision.entities.homeTeam && decision.entities.awayTeam
            ? {
                home: decision.entities.homeTeam,
                away: decision.entities.awayTeam,
                label: `${decision.entities.homeTeam} x ${decision.entities.awayTeam}`,
              }
            : context.lastMatch,
      });

      return decision;
    } catch (error: any) {
      this.logger.warn(`Oddix Brain Gemini falhou. Usando local. Motivo: ${error?.message || error}`);
      return localDecision;
    }
  }

  private buildBrainPrompt(message: string, context: OddixConversationContext) {
    return `
Você é o Oddix Brain, o cérebro de interpretação da Oddix IA.

Sua tarefa é entender QUALQUER mensagem do usuário e retornar SOMENTE JSON válido.

A Oddix é um assistente de futebol e apostas.
Você NÃO cria apostas, odds ou estatísticas.
Você apenas entende intenção e entidades para o Oddix Engine executar.

CONTEXTO DA CONVERSA:
${JSON.stringify(context || {}, null, 2)}

INTENTS:
- GENERAL: pergunta geral fora de futebol/apostas.
- TOP_PICKS: melhores palpites, maior confiança, entradas do dia.
- MATCH_ANALYSIS: análise de confronto específico.
- LIVE: placar, como está o jogo, quem está ganhando, status ao vivo.
- MULTIPLE: múltipla, combinada, bilhete.
- BANKROLL: cálculo de retorno, lucro, banca, stake.
- NEWS: notícias.
- TEAM: pergunta sobre time/seleção sem jogo específico.
- PLAYER: jogador, player props, chute, finalização, gol.
- VIRTUAL: futebol virtual.
- VALUE_BETS: value bet, valor de mercado.
- EXPLAIN: explicar análise, risco, mercado ou bilhete.
- FOLLOW_UP: continuações como "e agora?", "esse jogo presta?", "continua", usando contexto.

REGRAS IMPORTANTES:
1. "como tá o jogo da frança?" = LIVE, team "France".
2. "como está o jogo da seleção da frança?" = LIVE, team "France".
3. "quanto tá o brasil?" = LIVE, team "Brazil".
4. "fortaleza e ceará hoje" = MATCH_ANALYSIS, homeTeam "Fortaleza", awayTeam "Ceará".
5. "esse jogo presta?" = MATCH_ANALYSIS ou LIVE usando reference "lastMatch".
6. "e se eu colocar 50?" = BANKROLL, stake 50, reference "lastTicket".
7. "crie uma legenda" = GENERAL.
8. "quem descobriu o Brasil?" = GENERAL.
9. Se for futebol/apostas, shouldUseOddixEngine = true.
10. Se for geral, shouldUseGlobalAiDirect = true.
11. Se mencionar jogo, placar, seleção, time, odds ou aposta, NÃO classifique como GENERAL.

FORMATO:
{
  "intent": "LIVE",
  "confidence": 0.92,
  "riskMode": "balanced",
  "homeTeam": null,
  "awayTeam": null,
  "team": "France",
  "player": null,
  "league": null,
  "market": null,
  "stake": null,
  "odd": null,
  "reference": "none",
  "userWants": "saber o status atual do jogo da França",
  "shouldUseOddixEngine": true,
  "shouldUseGlobalAiDirect": false
}

MENSAGEM DO USUÁRIO:
${message}
`;
  }

  private normalizeGeminiDecision(
    message: string,
    context: OddixConversationContext,
    json: GeminiBrainJson,
    local: OddixBrainDecision,
  ): OddixBrainDecision {
    const intent = this.normalizeIntent(json.intent) || local.intent;
    const riskMode = this.normalizeRiskMode(json.riskMode) || local.riskMode;

    const entities = this.entityExtractor.extract(message, {
      homeTeam: this.cleanText(json.homeTeam) || local.entities.homeTeam,
      awayTeam: this.cleanText(json.awayTeam) || local.entities.awayTeam,
      team: this.cleanText(json.team) || local.entities.team,
      player: this.cleanText(json.player) || local.entities.player,
      league: this.cleanText(json.league) || local.entities.league,
      market: this.cleanText(json.market) || local.entities.market,
      stake: this.safeNumber(json.stake) ?? local.entities.stake,
      odd: this.safeNumber(json.odd) ?? local.entities.odd,
    });

    const confidence = this.safeNumber(json.confidence);
    const shouldUseGlobalAiDirect = json.shouldUseGlobalAiDirect === true || intent === 'GENERAL';
    const shouldUseOddixEngine = json.shouldUseOddixEngine === true || !shouldUseGlobalAiDirect;
    const reference = this.normalizeReference(json.reference, context, intent);

    return {
      intent,
      userMessage: message,
      normalizedQuestion: this.normalize(message),
      confidence: confidence !== undefined ? Math.max(0, Math.min(1, confidence)) : local.confidence,
      riskMode,
      entities,
      reference,
      userWants: this.cleanText(json.userWants) || local.userWants,
      shouldUseOddixEngine,
      shouldUseGlobalAiDirect,
      shouldHumanizeWithGemini: shouldUseOddixEngine,
      safetyNotes: [
        'Gemini apenas interpreta a pergunta.',
        'Oddix Engine decide futebol/apostas.',
        'Sem dados reais/odds reais = sem entrada oficial.',
      ],
      source: 'gemini',
    };
  }

  private localThink(message: string, context: OddixConversationContext): OddixBrainDecision {
    const entities = this.entityExtractor.extract(message);
    const text = this.normalize(message);

    let intent: OddixBrainIntent = 'GENERAL';
    let reference: OddixBrainDecision['reference'] = 'none';

    const asksLiveStatus =
      text.includes('ao vivo') ||
      text.includes('live') ||
      text.includes('como ta') ||
      text.includes('como esta') ||
      text.includes('quanto ta') ||
      text.includes('placar') ||
      text.includes('quem ta ganhando') ||
      text.includes('quem esta ganhando') ||
      text.includes('jogo da selecao') ||
      text.includes('jogo da seleção') ||
      text.includes('selecao da') ||
      text.includes('seleção da');

    if (entities.stake || text.includes('quanto ganho') || text.includes('retorno') || text.includes('lucro')) {
      intent = 'BANKROLL';
      reference = context.lastTicket ? 'lastTicket' : 'none';
    } else if (asksLiveStatus) {
      intent = 'LIVE';
    } else if (entities.homeTeam && entities.awayTeam) {
      intent = 'MATCH_ANALYSIS';
    } else if (text.includes('multipla') || text.includes('múltipla') || text.includes('bilhete') || text.includes('combinada')) {
      intent = 'MULTIPLE';
    } else if (text.includes('top pick') || text.includes('melhor entrada') || text.includes('maior confianca') || text.includes('melhores palpites')) {
      intent = 'TOP_PICKS';
    } else if (text.includes('noticia') || text.includes('noticias') || text.includes('news')) {
      intent = 'NEWS';
    } else if (text.includes('virtual')) {
      intent = 'VIRTUAL';
    } else if (text.includes('value') || text.includes('valor de mercado')) {
      intent = 'VALUE_BETS';
    } else if (text.includes('jogador') || text.includes('player') || text.includes('chute') || text.includes('finalizacao')) {
      intent = 'PLAYER';
    } else if (text.includes('esse jogo') || text.includes('essa partida') || text.includes('continua') || text === 'e agora') {
      intent = 'FOLLOW_UP';
      reference = context.lastMatch ? 'lastMatch' : 'none';
    } else if (entities.team) {
      intent = 'TEAM';
    }

    const riskMode = this.detectRiskMode(text);
    const shouldUseGlobalAiDirect = intent === 'GENERAL';
    const shouldUseOddixEngine = !shouldUseGlobalAiDirect;

    return {
      intent,
      userMessage: message,
      normalizedQuestion: text,
      confidence: intent === 'GENERAL' ? 0.65 : 0.85,
      riskMode,
      entities,
      reference,
      userWants: this.describeIntent(intent, entities),
      shouldUseOddixEngine,
      shouldUseGlobalAiDirect,
      shouldHumanizeWithGemini: shouldUseOddixEngine,
      safetyNotes: ['Fallback local usado.', 'Oddix Engine mantém regra de dados reais.'],
      source: 'local',
    };
  }

  private describeIntent(intent: OddixBrainIntent, entities: OddixEntities) {
    if (intent === 'LIVE') return `saber status ao vivo${entities.team ? ` de ${entities.team}` : ''}`;
    if (intent === 'MATCH_ANALYSIS') return 'analisar confronto';
    if (intent === 'MULTIPLE') return 'montar múltipla';
    if (intent === 'BANKROLL') return 'calcular retorno/lucro';
    if (intent === 'TOP_PICKS') return 'encontrar melhores entradas';
    if (intent === 'GENERAL') return 'responder pergunta geral';
    return 'entender solicitação do usuário';
  }

  private normalizeIntent(value?: string): OddixBrainIntent | null {
    const intent = String(value || '').trim().toUpperCase();

    const map: Record<string, OddixBrainIntent> = {
      GENERAL: 'GENERAL',
      TOP_PICKS: 'TOP_PICKS',
      TOP_PICK: 'TOP_PICKS',
      MATCH_ANALYSIS: 'MATCH_ANALYSIS',
      ANALYZE: 'MATCH_ANALYSIS',
      ANALISE: 'MATCH_ANALYSIS',
      MATCH: 'MATCH_ANALYSIS',
      LIVE: 'LIVE',
      MULTIPLE: 'MULTIPLE',
      MULTIPLA: 'MULTIPLE',
      MÚLTIPLA: 'MULTIPLE',
      BANKROLL: 'BANKROLL',
      NEWS: 'NEWS',
      TEAM: 'TEAM',
      PLAYER: 'PLAYER',
      PLAYER_PROPS: 'PLAYER',
      VIRTUAL: 'VIRTUAL',
      VALUE_BETS: 'VALUE_BETS',
      EXPLAIN: 'EXPLAIN',
      FOLLOW_UP: 'FOLLOW_UP',
    };

    return map[intent] || null;
  }

  private normalizeRiskMode(value?: string): OddixBrainRiskMode | null {
    const text = this.normalize(value || '');

    if (text.includes('safe') || text.includes('segur') || text.includes('conservador')) return 'safe';
    if (text.includes('aggressive') || text.includes('agressiv') || text.includes('alto risco')) return 'aggressive';
    if (text.includes('balanced') || text.includes('balancead') || text.includes('moderad')) return 'balanced';

    return null;
  }

  private detectRiskMode(text: string): OddixBrainRiskMode {
    if (text.includes('segura') || text.includes('conservadora') || text.includes('baixo risco')) return 'safe';
    if (text.includes('agressiva') || text.includes('odd maior') || text.includes('alto risco')) return 'aggressive';
    return 'balanced';
  }

  private normalizeReference(
    value: string | undefined,
    context: OddixConversationContext,
    intent: OddixBrainIntent,
  ): OddixBrainDecision['reference'] {
    const text = this.normalize(value || '');

    if (text.includes('lastmatch') || text.includes('ultimo jogo') || text.includes('esse jogo')) return 'lastMatch';
    if (text.includes('lastticket') || text.includes('ultimo bilhete')) return 'lastTicket';
    if (text.includes('lastteam') || text.includes('ultimo time')) return 'lastTeam';

    if ((intent === 'FOLLOW_UP' || intent === 'LIVE' || intent === 'MATCH_ANALYSIS') && context.lastMatch) {
      return 'lastMatch';
    }

    if (intent === 'BANKROLL' && context.lastTicket) return 'lastTicket';

    return 'none';
  }

  private safeParseJson(raw: string): GeminiBrainJson | null {
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match?.[0]) return null;

      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  private cleanText(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return undefined;
    return text;
  }

  private safeNumber(value: unknown): number | undefined {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
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
