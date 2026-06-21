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
  | 'GENERAL';

export type ChatRisk = 'BAIXO' | 'MEDIO' | 'MEDIO_ALTO' | 'ALTO';

export type ChatSeal = 'REPROVADA' | 'ARRISCADA' | 'BOA' | 'SEGURA' | 'ELITE';

export type ChatRole = 'user' | 'assistant';

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
  data?: any;
}

export interface ChatFootballRequest {
  message: string;
  userId?: string;
  mode?: 'safe' | 'balanced' | 'aggressive';
  history?: ChatHistoryMessage[];
}

export interface ChatFootballResponse {
  success: boolean;
  intent: ChatIntent;
  answer: string;
  data?: any;
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