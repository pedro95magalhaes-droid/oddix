import { Injectable } from '@nestjs/common';

type AnyObject = Record<string, any>;

type OddixRiskMode = 'safe' | 'balanced' | 'aggressive';

@Injectable()
export class OddixMemoryService {
  private readonly memory = new Map<string, AnyObject>();

  buildMemory(payload: AnyObject = {}, history: AnyObject[] = []) {
    const sessionId = this.getSessionId(payload);
    const stored = this.memory.get(sessionId) || {};

    const safeHistory = Array.isArray(history) ? history : [];

    const lastUserMessage = [...safeHistory]
      .reverse()
      .find((item) => item?.role === 'user')?.content;

    const lastAssistantMessage = [...safeHistory]
      .reverse()
      .find((item) => item?.role === 'assistant')?.content;

    const currentMessage = payload?.message || payload?.question || '';
    const extractedMatch =
      this.extractMatch(currentMessage) || this.extractMatch(lastUserMessage || '');

    const lastMatch = stored.lastMatch || extractedMatch || null;

    return {
      ...stored,
      messages: safeHistory,
      lastUserMessage: lastUserMessage || stored.lastUserMessage || currentMessage || null,
      lastAssistantMessage: lastAssistantMessage || stored.lastAssistantMessage || null,
      lastMatch,
      lastIntent: stored.lastIntent || null,
      lastTicket: stored.lastTicket || null,
      lastFixture: stored.lastFixture || null,
      lastRichContext: stored.lastRichContext || null,
      topicStack: stored.topicStack || [],
      profile: stored.profile || null,
    };
  }

  buildProfile(payload: AnyObject = {}, memory: AnyObject = {}) {
    const text = `${payload?.message || ''} ${memory?.lastUserMessage || ''}`.toLowerCase();

    const safe =
      text.includes('segura') ||
      text.includes('conservadora') ||
      text.includes('baixo risco') ||
      text.includes('risco baixo');

    const aggressive =
      text.includes('agressiva') ||
      text.includes('odd maior') ||
      text.includes('alto risco') ||
      text.includes('risco alto');

    const mode: OddixRiskMode = safe
      ? 'safe'
      : aggressive
        ? 'aggressive'
        : this.normalizeMode(payload?.mode || memory?.profile?.mode);

    const profile = {
      mode,

      bankroll: payload?.bankroll ?? memory?.profile?.bankroll ?? null,
      stake: payload?.stake ?? memory?.profile?.stake ?? null,
      maxOdd: safe
        ? 2
        : payload?.maxOdd ??
          memory?.profile?.maxOdd ??
          null,
      risk: safe ? 'baixo' : aggressive ? 'alto' : 'moderado',

      stakeLimitPercent:
        payload?.stakeLimitPercent ??
        memory?.profile?.stakeLimitPercent ??
        3,

      preferredMarkets:
        payload?.preferredMarkets ??
        memory?.profile?.preferredMarkets ??
        [],

      blockedMarkets:
        payload?.blockedMarkets ??
        memory?.profile?.blockedMarkets ??
        [],

      language:
        payload?.language ??
        memory?.profile?.language ??
        'pt-BR',
    };

    return profile;
  }

  remember(payload: AnyObject = {}, patch: AnyObject = {}) {
    const sessionId = this.getSessionId(payload);
    const current = this.memory.get(sessionId) || {};

    const nextMemory = {
      ...current,
      ...patch,
      topicStack: [
        ...(current.topicStack || []),
        ...(patch.topicStack || []),
      ]
        .filter(Boolean)
        .slice(-12),
    };

    this.memory.set(sessionId, nextMemory);

    return nextMemory;
  }

  get(sessionId: string) {
    return this.memory.get(sessionId) || {};
  }

  clear(sessionId: string) {
    this.memory.delete(sessionId);
  }

  private getSessionId(payload: AnyObject = {}) {
    return (
      payload?.sessionId ||
      payload?.conversationId ||
      payload?.chatId ||
      payload?.context?.sessionId ||
      payload?.context?.conversationId ||
      'anonymous'
    );
  }

  private normalizeMode(value: any): OddixRiskMode {
    if (value === 'safe' || value === 'balanced' || value === 'aggressive') {
      return value;
    }

    return 'balanced';
  }

  private extractMatch(text: string) {
    const clean = (text || '').trim();

    const match = clean.match(
      /([a-zA-ZÀ-ÿ0-9 .'-]{2,})\s+(?:x|vs|v|contra)\s+([a-zA-ZÀ-ÿ0-9 .'-]{2,})/i,
    );

    if (!match) return null;

    const home = match[1].trim();
    const away = match[2].trim();

    return {
      home,
      away,
      label: `${home} x ${away}`,
    };
  }
}
