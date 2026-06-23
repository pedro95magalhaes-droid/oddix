import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export type OddixLlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OddixLlmCacheItem = {
  value: string;
  expiresAt: number;
};

@Injectable()
export class OddixLlmService {
  private readonly logger = new Logger(OddixLlmService.name);
  private readonly cache = new Map<string, OddixLlmCacheItem>();
  private static requestCount = 0;
  private static blockedUntil = 0;

  isEnabled() {
    return String(process.env.ODDIX_LLM_ENABLED || 'false').toLowerCase() === 'true';
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
      process.env.OPENAI_API_KEY ||
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
      this.logger.warn('[ODDIX_LLM] endpoint ou apiKey ausente. Usando fallback local.');
      return null;
    }

    if (OddixLlmService.blockedUntil > Date.now()) {
      const waitMs = OddixLlmService.blockedUntil - Date.now();
      this.logger.warn(`[ODDIX_LLM] cooldown ativo por ${Math.ceil(waitMs / 1000)}s. Usando fallback local.`);
      return null;
    }

    const cacheEnabled =
      String(process.env.ODDIX_LLM_CACHE_ENABLED || 'true').toLowerCase() !== 'false';

    const cacheTtlMs = Number(process.env.ODDIX_LLM_CACHE_TTL_MS || 10 * 60 * 1000);
    const cacheKey = this.buildCacheKey(model, messages);

    if (cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.log(`[ODDIX_LLM] cache hit model=${model} key=${cacheKey}`);
        return cached.value;
      }
    }

    this.cleanupCache();

    try {
      OddixLlmService.requestCount += 1;

      const lastMessage = messages[messages.length - 1]?.content || '';
      this.logger.log(
        `[ODDIX_LLM] request #${OddixLlmService.requestCount} provider=DeepSeek-compatible model=${model} preview="${lastMessage
          .slice(0, 120)
          .replace(/\s+/g, ' ')}"`,
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: Number(process.env.ODDIX_LLM_TEMPERATURE || 0.25),
          max_tokens: Number(process.env.ODDIX_LLM_MAX_TOKENS || 900),
          stream: false,
        }),
      });

      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get('retry-after') || 60);
        OddixLlmService.blockedUntil = Date.now() + retryAfterSeconds * 1000;
        this.logger.warn(`[ODDIX_LLM] rate limit 429. Cooldown ${retryAfterSeconds}s. Usando fallback local.`);
        return null;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `[ODDIX_LLM] request failed status=${response.status} body="${body.slice(0, 250)}"`,
        );
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

      const finalAnswer = answer ? String(answer).trim() : null;

      if (finalAnswer && cacheEnabled) {
        this.cache.set(cacheKey, {
          value: finalAnswer,
          expiresAt: Date.now() + cacheTtlMs,
        });
      }

      return finalAnswer;
    } catch (error: any) {
      this.logger.warn(`[ODDIX_LLM] error: ${error?.message || error}`);
      return null;
    }
  }

  private buildCacheKey(model: string, messages: OddixLlmMessage[]) {
    const compactMessages = messages.map((message) => ({
      role: message.role,
      content: String(message.content || '').slice(0, 6000),
    }));

    const raw = JSON.stringify({
      model,
      messages: compactMessages,
      temperature: process.env.ODDIX_LLM_TEMPERATURE || 0.25,
      maxTokens: process.env.ODDIX_LLM_MAX_TOKENS || 900,
    });

    return createHash('sha1').update(raw).digest('hex').slice(0, 20);
  }

  private cleanupCache() {
    if (this.cache.size < 100) return;

    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt <= now) this.cache.delete(key);
    }

    if (this.cache.size > 250) {
      const keys = Array.from(this.cache.keys()).slice(0, this.cache.size - 250);
      keys.forEach((key) => this.cache.delete(key));
    }
  }
}
