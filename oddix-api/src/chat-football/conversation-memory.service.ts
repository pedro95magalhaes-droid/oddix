import { Injectable } from '@nestjs/common';

export type OddixConversationSnapshot = {
  sessionId: string;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  lastIntent?: string;
  lastMatch?: any;
  lastTeam?: any;
  lastTicket?: any;
  lastFixture?: any;
  lastRichContext?: any;
  conversationTopic?: string | null;
  lastRecommendation?: string | null;
  lastAnalysis?: string | null;
  lastFixtures?: any[];
  officialBetAllowed?: boolean;
  updatedAt: string;
};

@Injectable()
export class ConversationMemoryService {
  private readonly store = new Map<string, OddixConversationSnapshot>();
  private readonly maxFixtures = 30;

  get(sessionId = 'anonymous'): OddixConversationSnapshot {
    return (
      this.store.get(sessionId) || {
        sessionId,
        conversationTopic: null,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  save(sessionId = 'anonymous', data: Partial<OddixConversationSnapshot>) {
    const current = this.get(sessionId);
    const next: OddixConversationSnapshot = {
      ...current,
      ...data,
      sessionId,
      lastFixtures: Array.isArray(data.lastFixtures)
        ? data.lastFixtures.slice(0, this.maxFixtures)
        : current.lastFixtures,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(sessionId, next);
    return next;
  }

  rememberTurn(sessionId: string, userMessage: string, assistantMessage: string, metadata: Record<string, any> = {}) {
    return this.save(sessionId, {
      lastUserMessage: userMessage,
      lastAssistantMessage: assistantMessage,
      lastIntent: metadata.intent,
      lastMatch: metadata.lastMatch || metadata.match,
      lastTicket: metadata.ticket,
      lastFixture: metadata.fixture,
      lastRichContext: metadata.richContext,
      lastFixtures: metadata.fixtures,
      lastRecommendation: metadata.recommendation,
      lastAnalysis: assistantMessage,
      conversationTopic: metadata.topic || metadata.lastMatch?.label || metadata.fixture?.league?.name || null,
    });
  }

  clear(sessionId = 'anonymous') {
    this.store.delete(sessionId);
    return { cleared: true, sessionId };
  }
}
