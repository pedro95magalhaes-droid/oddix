import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

export type OddixGlobalAiResponse = {
  success: boolean;
  answer: string;
  suggestions: string[];
};

@Injectable()
export class OddixGlobalAiService {
  private readonly logger = new Logger(OddixGlobalAiService.name);
  private readonly ai: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY não configurada. Global AI ficará em modo fallback.');
      this.ai = null;
      return;
    }

    this.ai = new GoogleGenAI({ apiKey });
  }

  async answer(message: string): Promise<OddixGlobalAiResponse> {
    const suggestions = this.defaultSuggestions();

    if (!this.ai) {
      return {
        success: false,
        answer: this.buildFallbackAnswer(message),
        suggestions,
      };
    }

    try {
      const prompt = `
Você é a Oddix IA, um assistente inteligente em português do Brasil.

Responda de forma:
- clara;
- útil;
- natural;
- objetiva quando a pergunta for simples;
- completa quando a pergunta exigir explicação.

Pergunta do usuário:
${message}
`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return {
        success: true,
        answer: response.text || this.buildFallbackAnswer(message),
        suggestions,
      };
    } catch (error: any) {
      this.logger.error(
        `[ODDIX GLOBAL AI] ${error?.response?.data || error?.message || error}`,
      );

      return {
        success: false,
        answer:
          'Não consegui consultar a IA global no momento. Posso continuar ajudando com análises de futebol, apostas, odds, múltiplas e gestão de banca.',
        suggestions,
      };
    }
  }

  async polishFootballAnswer(
    userQuestion: string,
    oddixAnswer: string,
    data?: any,
  ): Promise<string> {
    if (!this.ai) return oddixAnswer;

    try {
      const prompt = `
Você é a Oddix IA, especialista em futebol e apostas esportivas.

Sua função é humanizar e organizar a resposta técnica gerada pelo Oddix Engine.

REGRAS IMPORTANTES:
- Não invente estatísticas.
- Não invente odds.
- Não invente escalações.
- Não crie palpite oficial se os dados informarem falta de dados reais.
- Se faltarem dados reais, deixe isso claro.
- Use português do Brasil.
- Use Markdown quando ajudar.
- Seja profissional, direto e amigável.

PERGUNTA DO USUÁRIO:
${userQuestion}

RESPOSTA TÉCNICA DO ODDIX ENGINE:
${oddixAnswer}

DADOS DISPONÍVEIS:
${JSON.stringify(data || {}, null, 2)}

Agora reescreva a resposta final para o usuário.
`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text || oddixAnswer;
    } catch (error: any) {
      this.logger.warn(
        `Falha ao humanizar resposta com Gemini: ${error?.message || error}`,
      );

      return oddixAnswer;
    }
  }

  isGeneralQuestion(message: string) {
    const text = this.normalize(message);

    if (!text) return false;

    const footballWords = [
      'jogo',
      'jogos',
      'partida',
      'partidas',
      'futebol',
      'gol',
      'gols',
      'aposta',
      'apostas',
      'odd',
      'odds',
      'time',
      'times',
      'seleção',
      'selecao',
      'palpite',
      'palpites',
      'entrada',
      'entradas',
      'top pick',
      'top picks',
      'multipla',
      'múltipla',
      'bilhete',
      'ao vivo',
      'live',
      'placar',
      'quanto ta',
      'quanto tá',
      'virtual',
      'over',
      'under',
      'btts',
      'ambas marcam',
      'dupla chance',
      'handicap',
      'value',
      'mercado',
      'escanteio',
      'escanteios',
      'cartao',
      'cartão',
      'chute',
      'finalizacao',
      'finalização',
      'player props',
      'franca',
      'frança',
      'france',
      'brasil',
      'brazil',
      'argentina',
      'portugal',
      'espanha',
      'spain',
      'flamengo',
      'palmeiras',
      'fortaleza',
      'ceara',
      'ceará',
      'corinthians',
      'santos',
      'vasco',
      'botafogo',
      'fluminense',
      'sao paulo',
      'são paulo',
      'cruzeiro',
      'gremio',
      'grêmio',
      'internacional',
    ];

    return !footballWords.some((word) => text.includes(this.normalize(word)));
  }

  private buildFallbackAnswer(message: string) {
    return `🧠 Entendi sua pergunta:

"${message}"

A IA global está configurada em modo seguro. Posso responder perguntas gerais e também ajudar com futebol, apostas, odds, múltiplas e gestão de banca.`;
  }

  private defaultSuggestions() {
    return [
      '⚽ Mostrar jogos de hoje',
      '🏆 Top Picks',
      '🔥 Monte uma múltipla',
      '💰 Calcular retorno',
    ];
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
