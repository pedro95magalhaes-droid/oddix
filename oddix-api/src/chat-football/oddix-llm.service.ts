import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

type OddixLlmMessage = {
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

  isEnabled() {
    return String(process.env.ODDIX_LLM_ENABLED || 'false').toLowerCase() === 'true';
  }

  async complete(messages: OddixLlmMessage[]): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const endpoint = process.env.ODDIX_LLM_ENDPOINT || '';
    const apiKey = process.env.ODDIX_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = process.env.ODDIX_LLM_MODEL || 'gpt-4o-mini';

    if (!endpoint || !apiKey) return null;

    const cacheEnabled =
      String(process.env.ODDIX_LLM_CACHE_ENABLED || 'true').toLowerCase() !== 'false';
    const cacheTtlMs = Number(process.env.ODDIX_LLM_CACHE_TTL_MS || 10 * 60 * 1000);
    const cacheKey = this.buildCacheKey(model, messages);

    if (cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.log(`[ODDIX_LLM] cache hit ${cacheKey}`);
        return cached.value;
      }
    }

    this.cleanupCache();

    try {
      OddixLlmService.requestCount += 1;

      const lastMessage = messages[messages.length - 1]?.content || '';
      this.logger.log(
        `[ODDIX_LLM] request #${OddixLlmService.requestCount} model=${model} preview="${lastMessage
          .slice(0, 90)
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
          temperature: Number(process.env.ODDIX_LLM_TEMPERATURE || 0.35),
          max_tokens: Number(process.env.ODDIX_LLM_MAX_TOKENS || 1200),
        }),
      });

      if (response.status === 429) {
        this.logger.warn('[ODDIX_LLM] quota/rate limit 429. Usando fallback local.');
        return null;
      }

      if (!response.ok) {
        this.logger.warn(`[ODDIX_LLM] request failed status=${response.status}`);
        return null;
      }

      const data: any = await response.json();
      const answer =
        data?.choices?.[0]?.message?.content ||
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
    const raw = JSON.stringify({
      model,
      messages,
      temperature: process.env.ODDIX_LLM_TEMPERATURE || 0.35,
      maxTokens: process.env.ODDIX_LLM_MAX_TOKENS || 1200,
    });

    return createHash('sha1').update(raw).digest('hex').slice(0, 16);
  }

  private cleanupCache() {
    if (this.cache.size < 100) return;

    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt <= now) this.cache.delete(key);
    }

    if (this.cache.size > 200) {
      const keys = Array.from(this.cache.keys()).slice(0, this.cache.size - 200);
      keys.forEach((key) => this.cache.delete(key));
    }
  }
}
