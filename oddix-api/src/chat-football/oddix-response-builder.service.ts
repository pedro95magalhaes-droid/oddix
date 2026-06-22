import { Injectable } from '@nestjs/common';
import type {
  ChatFootballResponse,
  ChatIntent,
  ConversationMemory,
  UserBetProfile,
} from './chat-football.types';
import { OddixLlmService } from './oddix-llm.service';

@Injectable()
export class OddixResponseBuilderService {
  constructor(private readonly llmService: OddixLlmService) {}

  async buildHumanAnswer(input: {
    intent: ChatIntent;
    userMessage: string;
    baseAnswer: string;
    memory: ConversationMemory;
    profile: UserBetProfile;
    facts?: any;
    suggestions?: string[];
    data?: Record<string, any>;
  }): Promise<ChatFootballResponse> {
    const llmAnswer = await this.llmService.complete([
      {
        role: 'system',
        content:
          'Você é a Oddix IA, um assistente especialista em futebol e apostas. Responda em pt-BR, de forma natural, direta e humana. Nunca invente estatísticas, odds, escalações ou resultados. Quando faltar dado real, diga claramente que está aguardando dados reais. Sempre inclua aviso de responsabilidade +18 quando falar de aposta.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          pergunta: input.userMessage,
          intencao: input.intent,
          memoria: input.memory,
          perfil: input.profile,
          fatos: input.facts || {},
          respostaBase: input.baseAnswer,
        }),
      },
    ]);

    return {
      success: true,
      intent: input.intent,
      answer: llmAnswer || this.polishFallback(input.baseAnswer, input.intent, input.profile),
      data: {
        ...(input.data || {}),
        suggestions: input.suggestions || this.defaultSuggestions(input.intent),
        memory: input.memory,
        profile: input.profile,
      },
    };
  }

  buildDirect(input: {
    intent: ChatIntent;
    answer: string;
    memory: ConversationMemory;
    profile: UserBetProfile;
    data?: Record<string, any>;
    suggestions?: string[];
  }): ChatFootballResponse {
    return {
      success: true,
      intent: input.intent,
      answer: this.polishFallback(input.answer, input.intent, input.profile),
      data: {
        ...(input.data || {}),
        suggestions: input.suggestions || this.defaultSuggestions(input.intent),
        memory: input.memory,
        profile: input.profile,
      },
    };
  }

  private polishFallback(answer: string, intent: ChatIntent, profile: UserBetProfile) {
    const riskLabel =
      profile.mode === 'safe'
        ? '🛡️ Perfil conservador ativo.'
        : profile.mode === 'aggressive'
          ? '🚀 Perfil agressivo ativo.'
          : '⚖️ Perfil balanceado ativo.';

    if (intent === 'BANKROLL') return answer;

    return `${answer}

━━━━━━━━━━━━━━
${riskLabel}
⚠️ Aposte com responsabilidade. +18`;
  }

  private defaultSuggestions(intent: ChatIntent) {
    if (intent === 'TOP_PICKS') return ['🎯 Analise o melhor jogo', '🔥 Monte uma múltipla segura', '💰 Quanto ganho com R$20?', '📈 Jogos ao vivo'];
    if (intent === 'ANALYZE') return ['🛡️ Deixe mais seguro', '🚀 Opção mais agressiva', '💰 Quanto ganho com R$20?', '🔥 Monte múltipla'];
    if (intent === 'MULTIPLE') return ['🛡️ Múltipla segura', '⚖️ Múltipla balanceada', '🚀 Múltipla agressiva', '💰 Calcular retorno'];
    return ['🏆 Melhores palpites de hoje', '⚽ Analisa um jogo', '🔥 Monte uma múltipla', '💰 Calcular retorno'];
  }
}
