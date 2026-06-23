import { Injectable, Logger } from '@nestjs/common';
import {
  OddixEntityExtractorService,
  OddixEntities,
} from './oddix-entity-extractor.service';
import {
  OddixContextMemoryService,
  OddixConversationContext,
} from './oddix-context-memory.service';

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
  source: 'local';
};

@Injectable()
export class OddixBrainService {
  private readonly logger = new Logger(OddixBrainService.name);

  constructor(
    private readonly entityExtractor: OddixEntityExtractorService,
    private readonly contextMemory: OddixContextMemoryService,
  ) {
    this.logger.log('Oddix Brain iniciado em modo local. Gemini removido definitivamente do Brain.');
  }

  async think(userMessage: string, sessionId = 'anonymous'): Promise<OddixBrainDecision> {
    const message = String(userMessage || '').trim();
    const context = this.contextMemory.get(sessionId);
    const decision = this.localThink(message, context);

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

  private localThink(message: string, context: OddixConversationContext): OddixBrainDecision {
    const entities = this.entityExtractor.extract(message);
    const text = this.normalize(message);

    let intent: OddixBrainIntent = 'GENERAL';
    let reference: OddixBrainDecision['reference'] = 'none';

    const hasMatch = !!entities.homeTeam && !!entities.awayTeam;

    const asksLiveStatus =
      this.hasAny(text, [
        'ao vivo',
        'live',
        'como ta',
        'como esta',
        'quanto ta',
        'placar',
        'resultado',
        'quem ta ganhando',
        'quem esta ganhando',
        'jogo da selecao',
        'selecao da',
        'quantos jogos tem ao vivo',
        'quantos jogos ao vivo',
        'jogos ao vivo',
        'mostrar jogos ao vivo',
        'mostra jogos ao vivo',
        'quais jogos ao vivo',
      ]);

    const asksBankroll =
      !!entities.stake ||
      this.hasAny(text, [
        'quanto ganho',
        'quanto retorna',
        'retorno',
        'lucro',
        'banca',
        'stake',
        'gestao',
        'gestão',
      ]);

    const asksMultiple = this.hasAny(text, ['multipla', 'múltipla', 'bilhete', 'combinada']);

    const asksTopPicks = this.hasAny(text, [
      'top pick',
      'top picks',
      'melhores palpites',
      'melhor palpite',
      'melhores entradas',
      'melhor entrada',
      'palpites de hoje',
      'entrada de hoje',
      'qual melhor aposta',
      'qual a melhor aposta',
      'o que apostar',
      'tem algo bom',
      'tem jogo bom',
      'me indica uma entrada',
      'me recomenda uma aposta',
    ]);

    const asksNews = this.hasAny(text, ['noticia', 'noticias', 'news']);
    const asksVirtual = text.includes('virtual');
    const asksValue = this.hasAny(text, ['value', 'valor de mercado', 'mercado de valor', 'odd justa']);
    const asksPlayer = this.hasAny(text, [
      'jogador',
      'player',
      'player props',
      'chute',
      'finalizacao',
      'finalização',
      'marca gol',
    ]);

    const asksExplain = this.hasAny(text, [
      'explica',
      'explique',
      'por que',
      'porque',
      'entender',
      'me explica',
    ]);

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
      'quem jogou',
      'quem fez gol',
      'quem marcou',
      'quando foi',
      'onde foi',
      'e depois',
      'me fala mais',
      'quem perdeu',
      'quem participou',
      'qual foi o placar',
    ]);

    if (asksBankroll) {
      intent = 'BANKROLL';
      reference = context.lastTicket ? 'lastTicket' : 'none';
    } else if (asksLiveStatus) {
      intent = 'LIVE';
      reference = context.lastMatch ? 'lastMatch' : 'none';
    } else if (hasMatch) {
      intent = 'MATCH_ANALYSIS';
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
      } else {
        intent = 'GENERAL';
        reference = 'none';
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
        'Oddix Brain usa parser local, sem Gemini.',
        'Perguntas de futebol/apostas passam pelo Oddix Engine.',
        'Perguntas gerais podem ser respondidas pelo OddixLlmService configurado com DeepSeek.',
        'Sem dados reais/odds reais = sem entrada oficial.',
      ],
      source: 'local',
    };
  }

  private estimateConfidence(intent: OddixBrainIntent, entities: OddixEntities, text: string) {
    if (intent === 'GENERAL') return 0.62;
    if (intent === 'MATCH_ANALYSIS' && entities.homeTeam && entities.awayTeam) return 0.95;
    if (intent === 'LIVE' && (entities.team || entities.homeTeam || entities.awayTeam)) return 0.93;
    if (intent === 'LIVE' && text.includes('jogos ao vivo')) return 0.9;
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
    if (intent === 'LIVE') {
      if (entities.team) return `saber status ao vivo de ${entities.team}`;
      if (entities.homeTeam && entities.awayTeam) {
        return `saber status ao vivo de ${entities.homeTeam} x ${entities.awayTeam}`;
      }
      return 'listar ou acompanhar jogos ao vivo';
    }

    if (intent === 'MATCH_ANALYSIS') {
      if (entities.homeTeam && entities.awayTeam) {
        return `analisar ${entities.homeTeam} x ${entities.awayTeam}`;
      }
      return 'analisar confronto';
    }

    if (intent === 'MULTIPLE') return 'montar múltipla';
    if (intent === 'BANKROLL') return 'calcular retorno, lucro ou gestão de banca';
    if (intent === 'TOP_PICKS') return 'encontrar melhores entradas';
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
    if (
      this.hasAny(text, [
        'segura',
        'seguro',
        'conservadora',
        'conservador',
        'baixo risco',
        'sem risco',
      ])
    ) {
      return 'safe';
    }

    if (
      this.hasAny(text, [
        'agressiva',
        'agressivo',
        'odd maior',
        'alto risco',
        'arriscar',
        'risco alto',
      ])
    ) {
      return 'aggressive';
    }

    return 'balanced';
  }

  private hasAny(text: string, keywords: string[]) {
    return keywords.some((keyword) => text.includes(this.normalize(keyword)));
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
