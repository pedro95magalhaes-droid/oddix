import { Injectable } from '@nestjs/common';

type OddixLlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class OddixLlmService {
  isEnabled() {
    return String(process.env.ODDIX_LLM_ENABLED || 'false').toLowerCase() === 'true';
  }

  async complete(messages: OddixLlmMessage[]): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const endpoint = process.env.ODDIX_LLM_ENDPOINT || '';
    const apiKey = process.env.ODDIX_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = process.env.ODDIX_LLM_MODEL || 'gpt-4o-mini';

    if (!endpoint || !apiKey) return null;

    try {
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

      if (!response.ok) return null;

      const data: any = await response.json();
      const answer =
        data?.choices?.[0]?.message?.content ||
        data?.output_text ||
        data?.message ||
        data?.answer ||
        null;

      return answer ? String(answer).trim() : null;
    } catch {
      return null;
    }
  }
}
