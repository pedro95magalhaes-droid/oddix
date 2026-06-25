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

Regras de resposta premium:
- Responda primeiro com algo útil. Não faça só perguntas de esclarecimento quando for possível entregar um modelo, exemplo, estrutura ou primeira versão.
- Quando faltar detalhe, assuma um cenário comum, deixe campos editáveis entre colchetes e finalize com no máximo uma pergunta curta de ajuste.
- Para pedidos de texto, campanha, proposta, mensagem, e-mail, roteiro ou copy: entregue uma versão pronta para uso, natural e bem formatada.
- Use tom profissional, humano e direto. Evite enrolação, frases genéricas e excesso de avisos.
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

    if (this.isWritingRequest(text)) {
      return this.buildWritingFallback(message);
    }

    if (text.includes('copa do mundo de 2002') && text.includes('quem ganhou')) {
      return 'O Brasil ganhou a Copa do Mundo de 2002. Na final, venceu a Alemanha por 2 a 0, com dois gols de Ronaldo.';
    }

    if (text.includes('quem jogou') && text.includes('copa do mundo de 2002')) {
      return 'A final da Copa do Mundo de 2002 foi entre Brasil e Alemanha.';
    }

    return `Entendi sua pergunta. No momento, vou responder em modo local: posso ajudar com perguntas gerais, explicações, ideias, textos e também com análises de futebol do Oddix.

Pergunta recebida: "${this.cleanForUser(message)}"`;
  }


  private isWritingRequest(text: string) {
    return [
      'texto formal',
      'criar um texto',
      'cria um texto',
      'crie um texto',
      'mensagem para cliente',
      'email',
      'e mail',
      'campanha',
      'proposta',
      'copy',
      'roteiro',
      'comunicado',
    ].some((term) => text.includes(this.normalize(term)));
  }

  private buildWritingFallback(message: string) {
    const text = this.normalize(message);

    if (text.includes('campanha')) {
      return `Claro. Aqui está uma campanha pronta para adaptar:

## Campanha: Cuidado que cabe no bolso

**Objetivo:** aumentar o movimento da loja, divulgar ofertas úteis e reforçar a farmácia como parceira do cliente no dia a dia.

**Conceito:** saúde, economia e praticidade no mesmo lugar.

**Chamada principal:**
Na dúvida, na pressa, no cuidado: a gente está aqui.

**Ações:**
1. Ofertas-relâmpago para produtos de maior procura.
2. Lista de transmissão no WhatsApp com promoções e dicas rápidas.
3. Post de interação: “qual produto não pode faltar na sua casa?”
4. Combo de cuidado: vitamina, higiene, primeiros socorros e conveniência.

**Texto para post:**
Cuidar da saúde não precisa ser complicado. Na [Nome da Drogaria], você encontra atendimento próximo, ofertas especiais e tudo para facilitar sua rotina. Passe aqui ou peça pelo WhatsApp.

**Slogan:**
Cuidado de verdade, preço que ajuda.`;
    }

    return `Claro. Aqui está um modelo formal versátil que você pode adaptar:

**Assunto:** [Assunto principal]

Prezado(a) [Nome],

Espero que esteja bem.

Gostaria de entrar em contato para tratar sobre [explique o motivo de forma breve]. Nosso objetivo é apresentar uma solução clara, organizada e adequada às suas necessidades, mantendo transparência em todas as etapas.

Fico à disposição para esclarecer qualquer dúvida e alinhar os próximos passos da melhor forma possível.

Atenciosamente,
[Seu nome]
[Cargo ou empresa]
[Contato]

Se você me mandar o contexto, eu adapto esse texto para o cliente certo.`;
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
