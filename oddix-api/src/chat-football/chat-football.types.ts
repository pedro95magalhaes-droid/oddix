export type ChatIntent =
  | 'SIMPLE'
  | 'MULTIPLE'
  | 'PLAYER_PROPS'
  | 'LIVE'
  | 'VIRTUAL'
  | 'ANALYZE'
  | 'TOP_PICKS'
  | 'EXPLAIN_LAST'
  | 'MORE_MARKETS'
  | 'MAKE_SAFER'
  | 'MAKE_AGGRESSIVE'
  | 'RISK_EXPLAIN'
  | 'BANKROLL'
  | 'LIST_MATCHES'
  | 'ASK_RECOMMENDATION'
  | 'NEWS'
  | 'VALUE_BETS'
  | 'GENERAL';

export type ChatRisk = 'BAIXO' | 'MEDIO' | 'MEDIO_ALTO' | 'ALTO';

export type ChatSeal = 'REPROVADA' | 'ARRISCADA' | 'BOA' | 'SEGURA' | 'ELITE';

export type ChatRole = 'user' | 'assistant' | 'system';

export type OddixChatMode = 'safe' | 'balanced' | 'aggressive';

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
  data?: any;
  createdAt?: string;
}

export interface ChatFootballRequest {
  message: string;
  userId?: string;
  sessionId?: string;
  mode?: OddixChatMode;
  history?: ChatHistoryMessage[];
  messages?: ChatHistoryMessage[];
  stream?: boolean;
}

export interface ChatFootballResponse {
  success: boolean;
  intent: ChatIntent;
  answer: string;
  data?: {
    ticket?: ChatTicket;
    suggestions?: string[];
    waitingForData?: boolean;
    fixture?: any;
    fixtures?: any[];
    statistics?: any;
    research?: any;
    richContext?: any;
    memory?: ConversationMemory;
    profile?: UserBetProfile;
    amount?: number;
    odd?: number;
    potentialReturn?: number;
    profit?: number;
    v14?: OddixV14Data;
    v15?: OddixV15Data;
    [key: string]: any;
  };
}

export interface ChatSelection {
  game: string;
  markets: string[];
  odd: number;
  confidence: number;
  risk: ChatRisk;
  seal: ChatSeal;
  reason: string;
}

export interface ChatTicket {
  type: 'simple' | 'multiple' | 'player_props';
  title: string;
  oddTotal: number;
  confidence: number;
  risk: string;
  status: string;
  selections: ChatSelection[];
}

export interface ConversationMemory {
  lastIntent?: ChatIntent;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  lastMatch?: {
    home: string;
    away: string;
    label: string;
  } | null;
  lastTeam?: string | null;
  lastTicket?: ChatTicket | null;
  lastFixture?: any;
  lastRichContext?: any;
  conversationTopic?: string | null;
  lastRecommendation?: string | null;
  lastAnalysis?: string | null;
  lastFixtures?: any[];
  topicStack: string[];
}

export interface UserBetProfile {
  mode: OddixChatMode;
  maxOdd: number;
  stakeLimitPercent: number;
  preferredMarkets: string[];
  blockedMarkets: string[];
  language: 'pt-BR';
}

export interface OddixBrain {
  message: string;
  text: string;
  intent: ChatIntent;
  teams: { home: string; away: string } | null;
  topicTeam: string | null;
  isFollowUp: boolean;
  wantsSafer: boolean;
  wantsAggressive: boolean;
}

export interface BetCalc {
  stake: number;
  odd: number;
  retorno: number;
  lucro: number;
}


export interface OddixV14ValueBet {
  game: string;
  market: string;
  odd: number;
  impliedProbability: number;
  modelProbability: number | null;
  expectedValue: number | null;
  edge: number | null;
  isValueBet: boolean;
  source: string;
  label: string;
  warning?: string;
}

export interface OddixV14BetSlip {
  id: string;
  title: string;
  type: 'simple' | 'multiple' | 'observed';
  selections: Array<{
    game: string;
    market: string;
    odd: number;
    confidence?: number;
    source?: string;
    value?: OddixV14ValueBet;
  }>;
  totalOdd: number;
  impliedProbability: number;
  averageConfidence: number | null;
  risk: 'BAIXO' | 'MEDIO' | 'MEDIO_ALTO' | 'ALTO';
  status: 'OFICIAL' | 'OBSERVACAO' | 'NO_BET';
  warning: string;
}

export interface OddixV14Data {
  version: string;
  features: string[];
  valueBet?: OddixV14ValueBet | null;
  betSlip?: OddixV14BetSlip | null;
  impliedProbability?: number | null;
  noBetReason?: string | null;
  streamingReady?: boolean;
  copilot?: boolean;
  conversationMemory?: any;
}


export type OddixV15ValueBet = OddixV14ValueBet;
export type OddixV15BetSlip = OddixV14BetSlip;

export interface OddixV15Data extends OddixV14Data {
  cache?: {
    odds?: boolean;
    stats?: boolean;
    fixture?: boolean;
  };
  matchResolver?: {
    enabled: boolean;
    providerPriority: string[];
  };
}
