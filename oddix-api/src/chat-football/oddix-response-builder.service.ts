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
          `Você é a Oddix IA V22.1, um assistente premium com especialidade em futebol, apostas esportivas e respostas gerais.

Sua missão é transformar dados reais do FlashScore, do motor Oddix e do contexto recebido em uma análise humana, premium e fácil de entender.

REGRAS OBRIGATÓRIAS:
- Nunca invente estatísticas, odds, escalações, resultados ou notícias.
- Nunca mostre nomes de agentes internos como MatchResearchAgent, TrendAgent, H2HAgent, StatisticsAgent, ConfidenceEngineAgent ou logs técnicos.
- Se o texto base contiver logs técnicos, converta isso para uma análise limpa e profissional.
- Se faltarem odds reais, diga claramente que não existe entrada oficial.
- Se faltarem estatísticas reais, diga que a análise ainda é observação.
- Não prometa green, acerto garantido ou lucro.
- Sempre inclua aviso de responsabilidade +18 quando falar de aposta.

FORMATO PREFERIDO:
⚽ Jogo
📊 Situação atual
📈 Leitura da partida
🎯 Mercados observados
⚠️ Riscos
🧠 Conclusão Oddix

Escreva de forma premium, direta, natural e sem poluir a resposta. Não termine com ofertas genéricas como “quer que eu faça...” quando a resposta já estiver completa.`, 
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

    return this.cleanFinalAnswer(`${answer}

━━━━━━━━━━━━━━
${riskLabel}
⚠️ Aposte com responsabilidade. +18`);
  }

  private cleanFinalAnswer(answer: string) {
    return String(answer || '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n?(?:se quiser|quer que eu|posso)\s+[^\n]{0,180}[?.!]\s*$/i, '')
      .trim();
  }

  private defaultSuggestions(intent: ChatIntent) {
    if (intent === 'TOP_PICKS') return ['🎯 Analise o melhor jogo', '🔥 Monte uma múltipla segura', '💰 Quanto ganho com R$20?', '📈 Jogos ao vivo'];
    if (intent === 'ANALYZE') return ['🛡️ Deixe mais seguro', '🚀 Opção mais agressiva', '💰 Quanto ganho com R$20?', '🔥 Monte múltipla'];
    if (intent === 'MULTIPLE') return ['🛡️ Múltipla segura', '⚖️ Múltipla balanceada', '🚀 Múltipla agressiva', '💰 Calcular retorno'];
    return ['🏆 Melhores palpites de hoje', '⚽ Analisa um jogo', '🔥 Monte uma múltipla', '💰 Calcular retorno'];
  }
}
