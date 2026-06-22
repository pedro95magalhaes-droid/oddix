import { Injectable } from '@nestjs/common';
import { OddixBrainIntent } from './oddix-brain.service';
import { OddixEntities } from './oddix-entity-extractor.service';

export type OddixConversationContext = {
  lastIntent?: OddixBrainIntent;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  lastTeam?: string;
  lastMatch?: {
    home: string;
    away: string;
    label: string;
  };
  lastTicket?: any;
  lastEntities?: OddixEntities;
};

@Injectable()
export class OddixContextMemoryService {
  private readonly store = new Map<string, OddixConversationContext>();

  get(sessionId = 'anonymous'): OddixConversationContext {
    return this.store.get(sessionId) || {};
  }

  remember(sessionId = 'anonymous', patch: Partial<OddixConversationContext>) {
    const current = this.get(sessionId);
    const next = {
      ...current,
      ...patch,
      lastMatch: patch.lastMatch || current.lastMatch,
      lastEntities: {
        ...(current.lastEntities || {}),
        ...(patch.lastEntities || {}),
      },
    };

    this.store.set(sessionId, next);
    return next;
  }

  clear(sessionId = 'anonymous') {
    this.store.delete(sessionId);
  }
}
