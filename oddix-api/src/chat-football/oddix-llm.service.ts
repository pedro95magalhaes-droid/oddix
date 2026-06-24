import { Injectable, Logger } from '@nestjs/common';

export type OddixLlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class OddixLlmService {
  private readonly logger = new Logger(OddixLlmService.name);
  private static requestCount = 0;
  private static blockedUntil = 0;

  isEnabled() {
    return String(process.env.ODDIX_LLM_ENABLED || 'true').toLowerCase() === 'true';
  }

  private getEndpoint() {
    return (
      process.env.ODDIX_LLM_ENDPOINT ||
      process.env.DEEPSEEK_API_ENDPOINT ||
      'https://api.deepseek.com/chat/completions'
    );
  }

  private getApiKey() {
    return (
      process.env.ODDIX_LLM_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      ''
    );
  }

  private getModel() {
    return (
      process.env.ODDIX_LLM_MODEL ||
      process.env.DEEPSEEK_MODEL ||
      'deepseek-chat'
    );
  }

  async complete(messages: OddixLlmMessage[]): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const endpoint = this.getEndpoint();
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!endpoint || !apiKey) {
      this.logger.warn('[ODDIX_LLM] endpoint ou API key ausente.');
      return null;
    }

    if (OddixLlmService.blockedUntil > Date.now()) {
      const waitMs = OddixLlmService.blockedUntil - Date.now();
      this.logger.warn(`[ODDIX_LLM] cooldown ativo ${Math.ceil(waitMs / 1000)}s.`);
      return null;
    }

    const controller = new AbortController();
    const timeoutMs = Number(process.env.ODDIX_LLM_TIMEOUT_MS || 25000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      OddixLlmService.requestCount += 1;

      const preview = messages[messages.length - 1]?.content || '';
      this.logger.log(
        `[ODDIX_LLM] request #${OddixLlmService.requestCount} model=${model} preview="${preview
          .slice(0, 160)
          .replace(/\s+/g, ' ')}"`,
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: Number(process.env.ODDIX_LLM_TEMPERATURE || 0.55),
          max_tokens: Number(process.env.ODDIX_LLM_MAX_TOKENS || 1800),
          stream: false,
        }),
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get('retry-after') || 60);
        OddixLlmService.blockedUntil = Date.now() + retryAfterSeconds * 1000;
        this.logger.warn(`[ODDIX_LLM] 429 rate limit. Cooldown ${retryAfterSeconds}s.`);
        return null;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(`[ODDIX_LLM] erro HTTP ${response.status}: ${body.slice(0, 300)}`);
        return null;
      }

      const data: any = await response.json();

      const answer =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.output_text ||
        data?.message ||
        data?.answer ||
        null;

      return answer ? String(answer).trim() : null;
    } catch (error: any) {
      clearTimeout(timeout);
      this.logger.warn(`[ODDIX_LLM] falhou: ${error?.message || error}`);
      return null;
    }
  }


  async completeStream(messages: OddixLlmMessage[]): Promise<{ answer: string | null; chunks: string[] }> {
    const answer = await this.complete(messages);
    const chunks = String(answer || '')
      .split(/(\s+)/)
      .reduce((acc: string[], part: string) => {
        if (!part) return acc;
        const last = acc[acc.length - 1] || '';
        if ((last + part).length > 42) acc.push(part);
        else if (acc.length) acc[acc.length - 1] = last + part;
        else acc.push(part);
        return acc;
      }, []);

    return { answer, chunks };
  }

  async completeJson<T = any>(messages: OddixLlmMessage[]): Promise<T | null> {
    const text = await this.complete(messages);
    if (!text) return null;

    const cleaned = String(text)
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const jsonText =
      firstBrace >= 0 && lastBrace > firstBrace
        ? cleaned.slice(firstBrace, lastBrace + 1)
        : cleaned;

    try {
      return JSON.parse(jsonText) as T;
    } catch {
      this.logger.warn(`[ODDIX_LLM] resposta não veio em JSON válido: ${cleaned.slice(0, 250)}`);
      return null;
    }
  }
}
