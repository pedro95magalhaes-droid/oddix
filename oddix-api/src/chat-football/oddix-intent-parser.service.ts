import { Injectable, Logger, Optional } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { OddixGlobalAiService } from './oddix-global-ai.service';
import { OddixIntentService, OddixIntent } from './oddix-intent.service';

export type OddixRiskMode = 'safe' | 'balanced' | 'aggressive';

export type ParsedOddixIntent = {
  intent: OddixIntent;
  homeTeam?: string;
  awayTeam?: string;
  riskMode: OddixRiskMode;
  market?: string;
  originalMessage: string;
  source: 'gemini' | 'local' | 'fallback';
  confidence?: number;
};

type GeminiIntentPayload = {
  intent?: string;
  homeTeam?: string;
  awayTeam?: string;
  riskMode?: string;
  market?: string;
  confidence?: number;
};

@Injectable()
export class OddixIntentParserService {
  private readonly logger = new Logger(OddixIntentParserService.name);
  private readonly ai: GoogleGenAI | null;

  constructor(
    @Optional()
    private readonly globalAi: OddixGlobalAiService | undefined,
    private readonly intentService: OddixIntentService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;

    this.ai = apiKey
      ? new GoogleGenAI({ apiKey })
      : null;

    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY não configurada. Intent Parser usará fallback local.',
      );
    }
  }

  async parse(message: string): Promise<ParsedOddixIntent> {
    const originalMessage = String(message || '').trim();

    if (!originalMessage) {
      return this.buildLocalIntent(originalMessage, 'fallback');
    }

    const geminiResult = await this.parseWithGemini(originalMessage);

    if (geminiResult) {
      return geminiResult;
    }

    return this.buildLocalIntent(originalMessage, 'local');
  }

  private async parseWithGemini(
    message: string,
  ): Promise<ParsedOddixIntent | null> {
    if (!this.ai) return null;

    try {
      const prompt = `
Você é o Gemini Intent Parser da Oddix IA.

Sua tarefa é converter a mensagem do usuário em JSON puro para o motor Oddix.

Responda SOMENTE JSON válido.
Não use markdown.
Não explique nada.

INTENTS PERMITIDOS:
- GENERAL: pergunta geral fora de futebol/apostas.
- TODAY_GAMES: lista de jogos/partidas de hoje, incluindo Copa/Mundial/World Cup/Club World Cup.
- TOP_PICKS: melhores palpites, maior confiança, entradas do dia.
- MATCH_ANALYSIS: análise de jogo específico.
- MULTIPLE: múltipla, combinada, bilhete.
- LIVE: jogos ao vivo.
- NEWS: notícias.
- TEAM: pergunta sobre time/seleção.
- PLAYER: jogador, player props, chute, finalização, gol.
- BANKROLL: cálculo de retorno, lucro, banca, stake.
- VALUE_BETS: odds de valor, odd justa, mercado de valor.
- VIRTUAL: futebol virtual.
- EXPLAIN: explicação de conceito, mercado ou análise anterior.

RISK MODES:
- safe
- balanced
- aggressive

MERCADOS EXEMPLOS:
- Over 1.5
- Over 2.5
- Under 3.5
- BTTS
- Dupla Chance
- Handicap
- Escanteios
- Player Props

REGRAS:
- Se encontrar dois times, preencha homeTeam e awayTeam.
- "Fortaleza e Ceará hoje" deve virar MATCH_ANALYSIS com Fortaleza x Ceará.
- "esse jogo", "essa partida", "continua" deve manter intenção MATCH_ANALYSIS quando parecer continuação.
- Perguntas como "quem descobriu o Brasil?" são GENERAL.
- Apostas, odds, múltiplas, futebol virtual e times são domínio Oddix, não GENERAL.
- Perguntas como "quais jogos da copa tem hoje", "jogos do mundial hoje", "club world cup hoje" devem virar TODAY_GAMES.
- Se a mensagem pedir todos os jogos de hoje, não transforme em MATCH_ANALYSIS sem dois times claros.

FORMATO:
{
  "intent": "MATCH_ANALYSIS",
  "homeTeam": "Fortaleza",
  "awayTeam": "Ceará",
  "riskMode": "balanced",
  "market": null,
  "confidence": 0.9
}

MENSAGEM:
${message}
`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const raw = response.text || '';
      const parsed = this.safeParseJson(raw);

      if (!parsed) return null;

      return this.normalizeGeminiPayload(message, parsed);
    } catch (error: any) {
      this.logger.warn(
        `Gemini Intent Parser falhou. Usando fallback local. Motivo: ${
          error?.message || error
        }`,
      );

      return null;
    }
  }

  private normalizeGeminiPayload(
    originalMessage: string,
    payload: GeminiIntentPayload,
  ): ParsedOddixIntent {
    const local = this.buildLocalIntent(originalMessage, 'local');

    const intent = this.normalizeIntent(payload.intent) || local.intent;
    const riskMode = this.normalizeRiskMode(payload.riskMode) || local.riskMode;

    const homeTeam =
      this.cleanNullableText(payload.homeTeam) ||
      local.homeTeam;

    const awayTeam =
      this.cleanNullableText(payload.awayTeam) ||
      local.awayTeam;

    const market =
      this.cleanNullableText(payload.market) ||
      local.market;

    const confidence = Number(payload.confidence);

    return {
      intent,
      homeTeam,
      awayTeam,
      riskMode,
      market,
      originalMessage,
      source: 'gemini',
      confidence:
        Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
          ? confidence
          : undefined,
    };
  }

  private buildLocalIntent(
    message: string,
    source: 'local' | 'fallback',
  ): ParsedOddixIntent {
    const fallbackIntent = this.intentService.detect(message);
    const riskMode = this.detectRiskMode(message);
    const teams = this.extractTeams(message);
    const market = this.extractMarket(message);

    let intent = fallbackIntent;

    if (this.looksLikeTodayGamesQuestion(message)) {
      intent = 'TODAY_GAMES';
    }

    if (teams?.home && teams?.away && intent !== 'TODAY_GAMES') {
      intent = 'MATCH_ANALYSIS';
    }

    return {
      intent,
      homeTeam: teams?.home,
      awayTeam: teams?.away,
      riskMode,
      market,
      originalMessage: message,
      source,
    };
  }

  private looksLikeTodayGamesQuestion(message: string): boolean {
    const text = this.normalize(message);
    return [
      'quais jogos',
      'jogos de hoje',
      'partidas de hoje',
      'jogos da copa',
      'copa hoje',
      'mundial hoje',
      'jogos do mundial',
      'club world cup',
      'world cup today',
      'fifa club world cup',
      'copa do mundo',
      'mundial de clubes',
    ].some((term) => text.includes(this.normalize(term)));
  }

  private safeParseJson(raw: string): GeminiIntentPayload | null {
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

  private normalizeIntent(value?: string): OddixIntent | null {
    const intent = String(value || '')
      .trim()
      .toUpperCase();

    const map: Record<string, OddixIntent> = {
      GENERAL: 'GENERAL',
      TODAY_GAMES: 'TODAY_GAMES',
      TODAY: 'TODAY_GAMES',
      GAMES_TODAY: 'TODAY_GAMES',
      FIXTURES: 'TODAY_GAMES',
      TOP_PICKS: 'TOP_PICKS',
      TOP_PICK: 'TOP_PICKS',
      MATCH_ANALYSIS: 'MATCH_ANALYSIS',
      ANALYZE: 'MATCH_ANALYSIS',
      ANALYSE: 'MATCH_ANALYSIS',
      MATCH: 'MATCH_ANALYSIS',
      MULTIPLE: 'MULTIPLE',
      MULTIPLA: 'MULTIPLE',
      MÚLTIPLA: 'MULTIPLE',
      LIVE: 'LIVE',
      NEWS: 'NEWS',
      TEAM: 'TEAM',
      PLAYER: 'PLAYER',
      PLAYER_PROPS: 'PLAYER',
      BANKROLL: 'BANKROLL',
      VALUE_BETS: 'VALUE_BETS',
      VALUE: 'VALUE_BETS',
      VIRTUAL: 'VIRTUAL',
      EXPLAIN: 'EXPLAIN',
    };

    return map[intent] || null;
  }

  private normalizeRiskMode(value?: string): OddixRiskMode | null {
    const text = this.normalize(value || '');

    if (
      text.includes('safe') ||
      text.includes('seguro') ||
      text.includes('segura') ||
      text.includes('conservador') ||
      text.includes('conservadora')
    ) {
      return 'safe';
    }

    if (
      text.includes('aggressive') ||
      text.includes('agressivo') ||
      text.includes('agressiva') ||
      text.includes('alto risco')
    ) {
      return 'aggressive';
    }

    if (
      text.includes('balanced') ||
      text.includes('balanceado') ||
      text.includes('moderado')
    ) {
      return 'balanced';
    }

    return null;
  }

  private detectRiskMode(message: string): OddixRiskMode {
    const text = this.normalize(message);

    if (
      text.includes('segura') ||
      text.includes('conservadora') ||
      text.includes('baixo risco') ||
      text.includes('risco baixo')
    ) {
      return 'safe';
    }

    if (
      text.includes('agressiva') ||
      text.includes('odd alta') ||
      text.includes('odd maior') ||
      text.includes('alto risco') ||
      text.includes('arriscar')
    ) {
      return 'aggressive';
    }

    return 'balanced';
  }

  private extractMarket(message: string): string | undefined {
    const text = this.normalize(message);

    if (text.includes('over 1 5') || text.includes('mais de 1 5')) return 'Over 1.5';
    if (text.includes('over 2 5') || text.includes('mais de 2 5')) return 'Over 2.5';
    if (text.includes('under 3 5') || text.includes('menos de 3 5')) return 'Under 3.5';
    if (text.includes('ambas marcam') || text.includes('btts')) return 'BTTS';
    if (text.includes('dupla chance')) return 'Dupla Chance';
    if (text.includes('handicap')) return 'Handicap';
    if (text.includes('escanteio') || text.includes('escanteios')) return 'Escanteios';
    if (text.includes('player props') || text.includes('jogador')) return 'Player Props';

    return undefined;
  }

  private extractTeams(message: string) {
    const cleaned = String(message || '')
      .replace(/analisa/gi, '')
      .replace(/analisar/gi, '')
      .replace(/analise/gi, '')
      .replace(/análise/gi, '')
      .replace(/hoje/gi, '')
      .replace(/agora/gi, '')
      .replace(/player props/gi, '')
      .trim();

    const normalized = cleaned.toLowerCase();

    for (const separator of [' x ', ' vs ', ' versus ', ' contra ']) {
      if (normalized.includes(separator)) {
        const parts = normalized.split(separator);

        if (parts[0]?.trim() && parts[1]?.trim()) {
          return {
            home: this.titleCase(parts[0].trim()),
            away: this.titleCase(parts[1].trim()),
          };
        }
      }
    }

    const eMatch = normalized.match(
      /^([a-zA-ZÀ-ÿ0-9 .'-]{2,})\s+e\s+([a-zA-ZÀ-ÿ0-9 .'-]{2,})$/,
    );

    if (eMatch?.[1] && eMatch?.[2]) {
      return {
        home: this.titleCase(eMatch[1].trim()),
        away: this.titleCase(eMatch[2].trim()),
      };
    }

    return null;
  }

  private cleanNullableText(value: unknown): string | undefined {
    const text = String(value ?? '').trim();

    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') {
      return undefined;
    }

    return text;
  }

  private titleCase(value: string) {
    return value
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
