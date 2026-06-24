import { Injectable, Optional } from '@nestjs/common';
import type { ChatFootballRequest, ChatFootballResponse } from './chat-football.types';
import { ConversationMemoryService } from './conversation-memory.service';
import { ValueBetService, OddixBetSlipSelection } from './value-bet.service';

@Injectable()
export class OddixCopilotService {
  constructor(
    @Optional() private readonly conversationMemory?: ConversationMemoryService,
    @Optional() private readonly valueBetService?: ValueBetService,
  ) {}

  enhanceResponse(payload: ChatFootballRequest | any, response: ChatFootballResponse): ChatFootballResponse {
    const sessionId = payload?.sessionId || payload?.conversationId || payload?.chatId || 'anonymous';
    const data = response?.data || {};
    const v14 = this.buildV14Data(response);

    const memory = this.conversationMemory?.rememberTurn(
      sessionId,
      payload?.message || payload?.text || payload?.question || '',
      response?.answer || '',
      {
        intent: response?.intent,
        ticket: data.ticket || v14.betSlip,
        fixture: data.fixture,
        fixtures: data.fixtures,
        richContext: data.richContext,
        lastMatch: data.memory?.lastMatch,
        topic: data.memory?.lastMatch?.label,
        recommendation: v14.valueBet?.label,
        valueBet: v14.valueBet,
        betSlip: v14.betSlip,
      },
    );

    return {
      ...response,
      data: {
        ...data,
        v14: {
          ...v14,
          conversationMemory: memory || null,
          streamingReady: true,
          copilot: true,
        },
        v15: {
          ...v14,
          conversationMemory: memory || null,
          streamingReady: true,
          copilot: true,
          cache: {
            odds: !!memory?.lastOdds,
            stats: !!memory?.lastStats,
            fixture: !!memory?.lastFixture,
          },
          matchResolver: {
            enabled: true,
            providerPriority: ['flashscore-live', 'flashscore-odds', 'flashscore', 'live', 'today', 'cache'],
          },
        },
      },
    };
  }

  private buildV14Data(response: ChatFootballResponse) {
    const data = response?.data || {};
    const selections = this.extractSelections(data);
    const betSlip = this.valueBetService?.buildSlip(selections, selections.length > 1 ? 'multiple' : 'observed') || null;
    const valueBet = selections[0]?.value || null;

    return {
      version: 'Oddix Chat V15.0',
      features: ['conversation-memory', 'match-resolver', 'odds-stats-cache', 'value-bet-engine', 'bet-slip', 'streaming-ready'],
      valueBet,
      betSlip,
      impliedProbability: betSlip?.impliedProbability || valueBet?.impliedProbability || null,
      noBetReason: this.detectNoBetReason(response),
    };
  }

  private extractSelections(data: Record<string, any>): OddixBetSlipSelection[] {
    const fromTicket = Array.isArray(data?.ticket?.selections)
      ? data.ticket.selections.map((selection: any) => ({
          game: selection.game || 'Jogo não informado',
          market: selection.markets?.[0] || selection.market || 'Mercado observado',
          odd: Number(selection.odd || 0),
          confidence: Number(selection.confidence || 0),
          source: selection.source || 'ticket',
          value: this.valueBetService?.analyze({
            game: selection.game,
            market: selection.markets?.[0] || selection.market,
            odd: Number(selection.odd || 0),
            confidence: Number(selection.confidence || 0),
            source: selection.source || 'ticket',
          }) || undefined,
        }))
      : [];

    if (fromTicket.length) return fromTicket;

    const odds =
      data?.richContext?.oddsSummary?.options ||
      data?.richContext?.odds?.options ||
      data?.fixture?.odds?.options ||
      [];

    const fixture = data?.fixture || data?.richContext?.fixture || {};
    const home = fixture?.teams?.home?.name || fixture?.times?.home?.name || fixture?.times?.casa?.nome || 'Casa';
    const away = fixture?.teams?.away?.name || fixture?.times?.away?.name || fixture?.times?.fora?.nome || 'Fora';
    const game = `${home} x ${away}`;

    return (Array.isArray(odds) ? odds : [])
      .map((odd: any) => {
        const value = Number(odd?.odd || odd?.value || odd?.price || 0);
        const market = String(odd?.name || odd?.nome || odd?.market || '1X2');
        const analyzed = this.valueBetService?.analyze({
          game,
          market,
          odd: value,
          source: data?.richContext?.oddsSummary?.source || data?.fixture?.odds?.source || 'fixture-odds',
        }) || undefined;

        return {
          game,
          market,
          odd: value,
          source: data?.richContext?.oddsSummary?.source || data?.fixture?.odds?.source || 'fixture-odds',
          value: analyzed,
        };
      })
      .filter((selection: OddixBetSlipSelection) => Number.isFinite(selection.odd) && selection.odd > 1);
  }

  private detectNoBetReason(response: ChatFootballResponse) {
    const answer = String(response?.answer || '').toLowerCase();
    if (answer.includes('sem entrada oficial')) return 'Sem entrada oficial pelos critérios Oddix.';
    if (answer.includes('não vou inventar') || answer.includes('nao vou inventar')) return 'Dados reais insuficientes.';
    if (answer.includes('no_bet') || answer.includes('no bet')) return 'NO_BET.';
    return null;
  }
}
