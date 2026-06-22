import { Injectable } from '@nestjs/common';
import type {
  ChatFootballRequest,
  ChatHistoryMessage,
  ChatIntent,
  ChatTicket,
  ConversationMemory,
  OddixChatMode,
  UserBetProfile,
} from './chat-football.types';

@Injectable()
export class OddixMemoryService {
  private readonly volatileMemory = new Map<string, ConversationMemory>();

  buildMemory(payload: ChatFootballRequest | any, history: ChatHistoryMessage[]): ConversationMemory {
    const key = this.key(payload);
    const stored = this.volatileMemory.get(key);
    const fromHistory = this.memoryFromHistory(history);

    return {
      lastIntent: fromHistory.lastIntent || stored?.lastIntent,
      lastUserMessage: fromHistory.lastUserMessage || stored?.lastUserMessage,
      lastAssistantMessage: fromHistory.lastAssistantMessage || stored?.lastAssistantMessage,
      lastMatch: fromHistory.lastMatch || stored?.lastMatch || null,
      lastTeam: fromHistory.lastTeam || stored?.lastTeam || null,
      lastTicket: fromHistory.lastTicket || stored?.lastTicket || null,
      lastFixture: fromHistory.lastFixture || stored?.lastFixture,
      lastRichContext: fromHistory.lastRichContext || stored?.lastRichContext,
      topicStack: [...(stored?.topicStack || []), ...(fromHistory.topicStack || [])]
        .filter(Boolean)
        .slice(-12),
    };
  }

  buildProfile(payload: ChatFootballRequest | any, memory?: ConversationMemory): UserBetProfile {
    const mode = this.normalizeMode(payload?.mode);
    const text = `${payload?.message || ''} ${memory?.lastUserMessage || ''}`.toLowerCase();

    const safe =
      mode === 'safe' ||
      text.includes('segura') ||
      text.includes('conservadora') ||
      text.includes('baixo risco');

    const aggressive =
      mode === 'aggressive' ||
      text.includes('agressiva') ||
      text.includes('odd maior') ||
      text.includes('arriscar');

    return {
      mode: safe ? 'safe' : aggressive ? 'aggressive' : 'balanced',
      maxOdd: safe ? 2.0 : aggressive ? 5.0 : 3.0,
      stakeLimitPercent: safe ? 1 : aggressive ? 3 : 2,
      preferredMarkets: safe
        ? ['dupla chance', 'over 0.5', 'over 1.5', 'handicap +1.5']
        : ['over 1.5', 'dupla chance', 'ambas marcam', 'over 2.5'],
      blockedMarkets: safe ? ['placar exato', 'virada', 'handicap alto'] : [],
      language: 'pt-BR',
    };
  }

  remember(payload: ChatFootballRequest | any, patch: Partial<ConversationMemory>) {
    const key = this.key(payload);
    const current = this.volatileMemory.get(key) || { topicStack: [] };

    this.volatileMemory.set(key, {
      ...current,
      ...patch,
      topicStack: [...(current.topicStack || []), ...(patch.topicStack || [])].filter(Boolean).slice(-12),
    });
  }

  private memoryFromHistory(history: ChatHistoryMessage[]): ConversationMemory {
    const memory: ConversationMemory = { topicStack: [] };

    for (const item of history || []) {
      const role = item?.role;
      const content = String(item?.content || '');
      const data = item?.data || {};

      if (role === 'user' && content) memory.lastUserMessage = content;
      if (role === 'assistant' && content) memory.lastAssistantMessage = content;

      if (data?.intent) memory.lastIntent = data.intent as ChatIntent;
      if (data?.ticket?.selections?.length) memory.lastTicket = data.ticket as ChatTicket;
      if (data?.fixture) memory.lastFixture = data.fixture;
      if (data?.richContext) memory.lastRichContext = data.richContext;

      const teams = this.extractTeams(content);
      if (teams) {
        memory.lastMatch = { ...teams, label: `${teams.home} x ${teams.away}` };
        memory.topicStack.push(memory.lastMatch.label);
      }
    }

    return memory;
  }

  private extractTeams(message: string): { home: string; away: string } | null {
    const cleaned = String(message || '')
      .replace(/analisa/gi, '')
      .replace(/analisar/gi, '')
      .replace(/analise/gi, '')
      .replace(/análise/gi, '')
      .replace(/player props/gi, '')
      .trim();

    for (const separator of [' x ', ' vs ', ' versus ', ' contra ']) {
      const normalized = cleaned.toLowerCase();
      if (!normalized.includes(separator)) continue;
      const parts = normalized.split(separator);
      if (parts[0]?.trim() && parts[1]?.trim()) {
        return { home: parts[0].trim(), away: parts[1].trim() };
      }
    }

    return null;
  }

  private normalizeMode(mode?: string): OddixChatMode {
    if (mode === 'safe' || mode === 'balanced' || mode === 'aggressive') return mode;
    return 'balanced';
  }

  private key(payload: ChatFootballRequest | any) {
    return String(payload?.sessionId || payload?.userId || 'anonymous');
  }
}
