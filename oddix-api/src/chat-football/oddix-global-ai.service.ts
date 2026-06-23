import { Injectable, Logger } from '@nestjs/common';
import { OddixLlmService } from './oddix-llm.service';

export type OddixGlobalAiResponse = {
  success: boolean;
  answer: string;
  suggestions: string[];
};

@Injectable()
export class OddixGlobalAiService {
  private readonly logger = new Logger(OddixGlobalAiService.name);

  constructor(private readonly llmService: OddixLlmService) {}

  async answer(message: string): Promise<OddixGlobalAiResponse> {
    const suggestions = this.defaultSuggestions();

    try {
      const answer = await this.llmService.complete([
        {
          role: 'system',
          content: `Você é a IA Global da Oddix, um assistente geral em português do Brasil.

Você responde qualquer tipo de pergunta geral:
- conhecimento geral;
- história;
- tecnologia;
- matemática simples;
- explicações;
- ideias;
- textos;
- dúvidas do dia a dia;
- perguntas de continuação com contexto.

Regras:
- Responda com naturalidade e clareza.
- Use o contexto anterior quando a pergunta atual for curta, como "quem jogou?", "e depois?", "quem fez os gols?", "me explica melhor?".
- Se a pergunta for sobre futebol/apostas do Oddix, responda de forma útil, mas não invente odds, estatísticas ou entradas.
- Não diga que não consegue consultar IA global se o LLM falhar; use fallback local amigável.
- Seja direto quando a pergunta for simples.`,
        },
        {
          role: 'user',
          content: message,
        },
      ]);

      if (!answer) {
        return {
          success: false,
          answer: this.buildFallbackAnswer(message),
          suggestions,
        };
      }

      return {
        success: true,
        answer,
        suggestions,
      };
    } catch (error: any) {
      this.logger.warn(`[ODDIX_GLOBAL_AI] falhou: ${error?.message || error}`);

      return {
        success: false,
        answer: this.buildFallbackAnswer(message),
        suggestions,
      };
    }
  }

  private buildFallbackAnswer(message: string) {
    const text = this.normalize(message);

    if (text.includes('copa do mundo de 2002') && text.includes('quem ganhou')) {
      return 'O Brasil ganhou a Copa do Mundo de 2002. Na final, venceu a Alemanha por 2 a 0, com dois gols de Ronaldo.';
    }

    if (text.includes('quem jogou') && text.includes('copa do mundo de 2002')) {
      return 'A final da Copa do Mundo de 2002 foi entre Brasil e Alemanha.';
    }

    return `Entendi sua pergunta. No momento, vou responder em modo local: posso ajudar com perguntas gerais, explicações, ideias, textos e também com análises de futebol do Oddix.

Pergunta recebida: "${this.cleanForUser(message)}"`;
  }

  private defaultSuggestions() {
    return [
      '⚽ Mostrar jogos de hoje',
      '🏆 Top Picks',
      '🔥 Monte uma múltipla',
      '💰 Calcular retorno',
    ];
  }

  private cleanForUser(value: string) {
    return String(value || '')
      .split('Pergunta atual do usuário:')
      .pop()
      ?.trim()
      .slice(0, 220) || String(value || '').slice(0, 220);
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
