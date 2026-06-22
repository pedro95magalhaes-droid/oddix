import { Injectable } from '@nestjs/common';
import { OddixIntent } from './oddix-intent.service';

interface Memory {
  lastIntent?: string;
  lastMatch?: any;
  lastTicket?: any;
}

export interface RouterResult {
  intent: OddixIntent | string;
  continueContext?: boolean;
  context?: any;
  suggestions?: string[];
}

@Injectable()
export class OddixRouterService {
  resolve(
    message: string,
    intent: OddixIntent | string,
    memory: Memory = {},
  ): RouterResult {
    const text = (message || '').toLowerCase();

    if (
      text.includes('continua') ||
      text.includes('continue') ||
      text.includes('mais detalhes')
    ) {
      return {
        intent: memory.lastIntent || intent,
        continueContext: true,
        context: memory,
      };
    }

    if (
      text.includes('mais segura') ||
      text.includes('conservadora')
    ) {
      return {
        intent: 'MAKE_SAFER',
        context: {
          match: memory.lastMatch,
          ticket: memory.lastTicket,
        },
      };
    }

    if (
      text.includes('mais agressiva') ||
      text.includes('odd maior')
    ) {
      return {
        intent: 'MAKE_AGGRESSIVE',
        context: {
          match: memory.lastMatch,
          ticket: memory.lastTicket,
        },
      };
    }

    if (
      text.includes('esse jogo') ||
      text.includes('essa partida')
    ) {
      return {
        intent: 'ANALYZE',
        context: {
          match: memory.lastMatch,
        },
      };
    }

    return {
      intent,
      context: memory,
      suggestions: this.defaultSuggestions(intent),
    };
  }

  private defaultSuggestions(
    intent: string,
  ): string[] {
    switch (intent) {
      case 'TOP_PICKS':
        return [
          '🎯 Melhor entrada de hoje',
          '🔥 Monte uma múltipla',
          '⚽ Jogos ao vivo',
          '💰 Calcular retorno',
        ];

      case 'ANALYZE':
        return [
          '🛡️ Opção mais segura',
          '🚀 Opção mais agressiva',
          '🔥 Monte múltipla',
          '💰 Quanto ganho?',
        ];

      default:
        return [
          '⚽ Jogos de hoje',
          '🏆 Top Picks',
          '🔥 Múltipla segura',
          '📈 Jogos ao vivo',
        ];
    }
  }
}