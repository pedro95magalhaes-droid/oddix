import { Injectable } from '@nestjs/common';

@Injectable()
export class OddixGlobalAiService {
  async answer(message: string) {
    return {
      success: true,
      answer: `🧠 Pergunta geral detectada:

"${message}"

O módulo Global AI ainda está em modo inicial. Aqui você poderá responder perguntas sobre qualquer assunto usando um LLM externo (OpenAI, Gemini ou Claude).`,
      suggestions: [
        '⚽ Mostrar jogos de hoje',
        '🏆 Top Picks',
        '🔥 Monte uma múltipla',
      ],
    };
  }

  isGeneralQuestion(message: string) {
    const text = (message || '').toLowerCase();

    const footballWords = [
      'jogo',
      'aposta',
      'odd',
      'futebol',
      'gol',
      'time',
      'palpite',
      'flamengo',
      'palmeiras',
      'ao vivo',
      'múltipla',
      'multipla',
      'virtual',
      'mercado',
    ];

    return !footballWords.some((word) =>
      text.includes(word),
    );
  }
}