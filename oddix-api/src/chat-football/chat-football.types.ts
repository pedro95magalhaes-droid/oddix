export type ChatIntent =
  | 'SIMPLE'
  | 'MULTIPLE'
  | 'PLAYER_PROPS'
  | 'LIVE'
  | 'VIRTUAL'
  | 'ANALYZE'
  | 'TOP_PICKS'
  | 'GENERAL';

export type ChatRisk = 'BAIXO' | 'MEDIO' | 'MEDIO_ALTO' | 'ALTO';

export type ChatSeal = 'REPROVADA' | 'ARRISCADA' | 'BOA' | 'SEGURA' | 'ELITE';

export interface ChatFootballRequest {
  message: string;
  userId?: string;
  mode?: 'safe' | 'balanced' | 'aggressive';
}

export interface ChatFootballResponse {
  success: boolean;
  intent: ChatIntent;
  answer: string;
  data?: any;
}

export interface ChatSelection {
  game: string;
  market: string;
  odd: number;
  confidence: number;
  risk: ChatRisk;
  seal: ChatSeal;
  reason: string;
}