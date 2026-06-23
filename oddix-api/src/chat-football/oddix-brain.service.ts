import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  OddixEntityExtractorService,
  OddixEntities,
} from './oddix-entity-extractor.service';
import {
  OddixContextMemoryService,
  OddixConversationContext,
} from './oddix-context-memory.service';
import { OddixLlmService } from './oddix-llm.service';

export type OddixBrainIntent =
  | 'GENERAL'
  | 'TODAY_GAMES'
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
  source: 'llm' | 'local';
};

type LlmBrainJson = {
  intent?: OddixBrainIntent;
  confidence?: number;
  riskMode?: OddixBrainRiskMode;
  reference?: OddixBrainDecision['reference'];
  userWants?: string;
  needsCurrentFootballData?: boolean;
  isGeneralQuestion?: boolean;
};

@Injectable()
export class OddixBrainService {
  private readonly logger = new Logger(OddixBrainService.name);

  constructor(
    private readonly entityExtractor: OddixEntityExtractorService,
    private readonly contextMemory: OddixContextMemoryService,
    @Optional() private readonly llmService?: OddixLlmService,
  ) {
    this.logger.log('Oddix Brain V13 iniciado: DeepSeek primeiro, fallback local seguro.');
  }

  async think(userMessage: string, sessionId = 'anonymous'): Promise<OddixBrainDecision> {
    const message = String(userMessage || '').trim();
    const context = this.contextMemory.get(sessionId);

    const localDecision = this.localThink(message, context);
    const llmDecision = await this.llmThink(message, context, localDecision).catch(() => null);
    const decision = llmDecision || localDecision;

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
  }

  private async llmThink(
    message: string,
    context: OddixConversationContext,
    localDecision: OddixBrainDecision,
  ): Promise<OddixBrainDecision | null> {
    if (!this.llmService?.isEnabled()) return null;

    const response = await this.llmService.completeJson<LlmBrainJson>([
      {
        role: 'system',
        content: `Você é o cérebro de roteamento do Oddix Chat V13.

Responda somente JSON válido, sem markdown.

Intents disponíveis:
GENERAL, TODAY_GAMES, TOP_PICKS, MATCH_ANALYSIS, LIVE, MULTIPLE, BANKROLL, NEWS, TEAM, PLAYER, VIRTUAL, VALUE_BETS, EXPLAIN, FOLLOW_UP.

Regras:
- Perguntas gerais de conhecimento => GENERAL.
- "quais jogos hoje", "jogos da copa hoje" => TODAY_GAMES.
- "melhor entrada", "maior confiança", "o que apostar", "aposta segura" => TOP_PICKS.
- "Portugal x Uzbequistão", "Flamengo vs Palmeiras", "time contra time" => MATCH_ANALYSIS.
- "ao vivo", "placar", "quanto tá" => LIVE.
- "múltipla", "bilhete", "combinada" => MULTIPLE.
- "quanto ganho", "retorno", "lucro", "stake" => BANKROLL.
- Continuações como "vale a pena?", "e uma segura?", "presta?" depois de jogo/bilhete => FOLLOW_UP.
- Nunca invente dados. Só classifique a intenção.

JSON:
{
  "intent": "TOP_PICKS",
  "confidence": 0.92,
  "riskMode": "safe|balanced|aggressive",
  "reference": "lastMatch|lastTicket|lastTeam|none",
  "userWants": "frase curta",
  "needsCurrentFootballData": true,
  "isGeneralQuestion": false
}`,
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            message,
            localIntent: localDecision.intent,
            localEntities: localDecision.entities,
            conversationContext: {
              lastIntent: context.lastIntent,
              lastUserMessage: context.lastUserMessage,
              lastTeam: context.lastTeam,
              lastMatch: context.lastMatch,
              hasLastTicket: !!context.lastTicket,
            },
          },
          null,
          2,
        ),
      },
    ]);

    if (!response?.intent) return null;

    const allowed: OddixBrainIntent[] = [
      'GENERAL',
      'TODAY_GAMES',
      'TOP_PICKS',
      'MATCH_ANALYSIS',
      'LIVE',
      'MULTIPLE',
      'BANKROLL',
      'NEWS',
      'TEAM',
      'PLAYER',
      'VIRTUAL',
      'VALUE_BETS',
      'EXPLAIN',
      'FOLLOW_UP',
    ];

    const intent = allowed.includes(response.intent) ? response.intent : localDecision.intent;
    const entities = localDecision.entities;
    const riskMode = response.riskMode || localDecision.riskMode;
    const reference = response.reference || localDecision.reference || 'none';
    const shouldUseGlobalAiDirect = intent === 'GENERAL';
    const shouldUseOddixEngine = !shouldUseGlobalAiDirect;

    return {
      intent,
      userMessage: message,
      normalizedQuestion: this.normalize(message),
      confidence: Number(response.confidence || localDecision.confidence || 0.84),
      riskMode,
      entities,
      reference,
      userWants: response.userWants || this.describeIntent(intent, entities, reference),
      shouldUseOddixEngine,
      shouldUseGlobalAiDirect,
      shouldHumanizeWithGemini: false,
      safetyNotes: [
        'Oddix Brain V13 usa DeepSeek para entender intenção quando disponível.',
        'Perguntas atuais de futebol devem buscar FootballService/FlashScore antes da resposta final.',
        'Sem dados reais/odds reais = sem entrada oficial.',
      ],
      source: 'llm',
    };
  }

  private localThink(message: string, context: OddixConversationContext): OddixBrainDecision {
    const entities = this.entityExtractor.extract(message);
    const text = this.normalize(message);

    let intent: OddixBrainIntent = 'GENERAL';
    let reference: OddixBrainDecision['reference'] = 'none';

    const hasMatch = !!entities.homeTeam && !!entities.awayTeam;

    const asksLiveStatus = this.hasAny(text, [
      'ao vivo',
      'live',
      'como ta',
      'como esta',
      'quanto ta',
      'placar',
      'resultado',
      'quem ta ganhando',
      'jogos ao vivo',
      'mostrar jogos ao vivo',
      'quais jogos ao vivo',
    ]);

    const asksTodayGames = this.hasAny(text, [
      'jogos de hoje',
      'partidas de hoje',
      'quais jogos',
      'copa hoje',
      'jogos da copa',
      'copa do mundo hoje',
      'tem jogo hoje',
    ]);

    const asksBankroll =
      !!entities.stake ||
      this.hasAny(text, ['quanto ganho', 'quanto retorna', 'retorno', 'lucro', 'banca', 'stake', 'gestao', 'gestão']);

    const asksMultiple = this.hasAny(text, ['multipla', 'múltipla', 'bilhete', 'combinada']);

    const asksTopPicks = this.hasAny(text, [
      'top pick',
      'top picks',
      'melhores palpites',
      'melhor palpite',
      'melhores entradas',
      'melhor entrada',
      'maior confianca',
      'maior confiança',
      'mais confiavel',
      'mais confiável',
      'entrada segura',
      'aposta segura',
      'palpites de hoje',
      'entrada de hoje',
      'qual melhor aposta',
      'qual a melhor aposta',
      'o que apostar',
      'tem algo bom',
      'tem jogo bom',
      'me indica',
      'me recomenda',
    ]);

    const asksNews = this.hasAny(text, ['noticia', 'noticias', 'news', 'lesao', 'lesão', 'desfalque']);
    const asksVirtual = text.includes('virtual');
    const asksValue = this.hasAny(text, ['value', 'valor de mercado', 'mercado de valor', 'odd justa']);
    const asksPlayer = this.hasAny(text, ['jogador', 'player', 'player props', 'chute', 'finalizacao', 'finalização', 'marca gol']);
    const asksExplain = this.hasAny(text, ['explica', 'explique', 'por que', 'porque', 'entender', 'me explica']);
    const asksFollowUp = this.hasAny(text, [
      'esse jogo',
      'essa partida',
      'esse bilhete',
      'essa multipla',
      'essa múltipla',
      'continua',
      'e agora',
      'vale a pena',
      'presta',
      'bom pra entrar',
      'tem entrada',
      'e uma segura',
      'uma segura',
      'mais seguro',
    ]);

    if (asksBankroll) {
      intent = 'BANKROLL';
      reference = context.lastTicket ? 'lastTicket' : 'none';
    } else if (asksLiveStatus) {
      intent = 'LIVE';
      reference = context.lastMatch ? 'lastMatch' : 'none';
    } else if (hasMatch) {
      intent = 'MATCH_ANALYSIS';
    } else if (asksTodayGames) {
      intent = 'TODAY_GAMES';
    } else if (asksMultiple) {
      intent = 'MULTIPLE';
    } else if (asksTopPicks) {
      intent = 'TOP_PICKS';
    } else if (asksNews) {
      intent = 'NEWS';
    } else if (asksVirtual) {
      intent = 'VIRTUAL';
    } else if (asksValue) {
      intent = 'VALUE_BETS';
    } else if (asksPlayer) {
      intent = 'PLAYER';
    } else if (asksExplain) {
      intent = 'EXPLAIN';
      reference = context.lastMatch ? 'lastMatch' : context.lastTicket ? 'lastTicket' : 'none';
    } else if (asksFollowUp) {
      if (context.lastMatch || context.lastTicket) {
        intent = 'FOLLOW_UP';
        reference = context.lastMatch ? 'lastMatch' : 'lastTicket';
      }
    } else if (entities.team) {
      intent = 'TEAM';
      reference = 'lastTeam';
    }

    const riskMode = this.detectRiskMode(text);
    const shouldUseGlobalAiDirect = intent === 'GENERAL';
    const shouldUseOddixEngine = !shouldUseGlobalAiDirect;

    return {
      intent,
      userMessage: message,
      normalizedQuestion: text,
      confidence: this.estimateConfidence(intent, entities, text),
      riskMode,
      entities,
      reference,
      userWants: this.describeIntent(intent, entities, reference),
      shouldUseOddixEngine,
      shouldUseGlobalAiDirect,
      shouldHumanizeWithGemini: false,
      safetyNotes: [
        'Oddix Brain V13 fallback local ativo.',
        'Perguntas de futebol/apostas passam pelo Oddix Engine.',
        'Perguntas gerais podem ser respondidas pelo OddixLlmService configurado com DeepSeek.',
        'Sem dados reais/odds reais = sem entrada oficial.',
      ],
      source: 'local',
    };
  }

  private estimateConfidence(intent: OddixBrainIntent, entities: OddixEntities, text: string) {
    if (intent === 'GENERAL') return 0.72;
    if (intent === 'MATCH_ANALYSIS' && entities.homeTeam && entities.awayTeam) return 0.95;
    if (intent === 'LIVE' && (entities.team || entities.homeTeam || entities.awayTeam)) return 0.93;
    if (intent === 'LIVE' && text.includes('jogos ao vivo')) return 0.9;
    if (intent === 'TODAY_GAMES') return 0.91;
    if (intent === 'TOP_PICKS') return 0.9;
    if (intent === 'BANKROLL' && entities.stake) return 0.93;
    if (intent === 'FOLLOW_UP') return 0.82;
    if (intent === 'TEAM' && entities.team) return 0.86;
    return 0.84;
  }

  private describeIntent(
    intent: OddixBrainIntent,
    entities: OddixEntities,
    reference?: OddixBrainDecision['reference'],
  ) {
    if (intent === 'TODAY_GAMES') return 'listar jogos reais de hoje';
    if (intent === 'LIVE') return 'listar ou acompanhar jogos ao vivo';
    if (intent === 'MATCH_ANALYSIS') {
      if (entities.homeTeam && entities.awayTeam) return `analisar ${entities.homeTeam} x ${entities.awayTeam}`;
      return 'analisar confronto';
    }
    if (intent === 'MULTIPLE') return 'montar múltipla';
    if (intent === 'BANKROLL') return 'calcular retorno, lucro ou gestão de banca';
    if (intent === 'TOP_PICKS') return 'encontrar melhores entradas com maior confiança';
    if (intent === 'TEAM') return `analisar equipe ${entities.team || ''}`.trim();
    if (intent === 'PLAYER') return 'avaliar jogador ou player props';
    if (intent === 'NEWS') return 'buscar notícias relevantes';
    if (intent === 'VALUE_BETS') return 'avaliar value bet';
    if (intent === 'VIRTUAL') return 'avaliar futebol virtual';
    if (intent === 'EXPLAIN') return `explicar contexto ${reference || ''}`.trim();
    if (intent === 'FOLLOW_UP') return `continuar contexto ${reference || ''}`.trim();
    return 'responder pergunta geral';
  }

  private detectRiskMode(text: string): OddixBrainRiskMode {
    if (this.hasAny(text, ['segura', 'seguro', 'conservadora', 'conservador', 'baixo risco', 'sem risco'])) {
      return 'safe';
    }

    if (this.hasAny(text, ['agressiva', 'agressivo', 'alto risco', 'odd alta', 'mais retorno'])) {
      return 'aggressive';
    }

    return 'balanced';
  }

  private hasAny(text: string, terms: string[]) {
    return terms.some((term) => text.includes(this.normalize(term)));
  }

  private normalize(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
