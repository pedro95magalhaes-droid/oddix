export type VirtualBadge = 'FORTE' | 'MUITO_FORTE' | 'ELITE';
export type VirtualStatus = 'PENDING' | 'GREEN' | 'RED' | 'VOID';

export interface VirtualLeague {
  id: string;
  name: string;
  country?: string;
  provider?: string;
  active?: boolean;
  [key: string]: any;
}

export interface VirtualOdds {
  market?: string;
  name?: string;
  odd?: number;
  line?: number;

  casa?: number;
  empate?: number;
  fora?: number;
  over15?: number;
  over25?: number;
  bttsYes?: number;

  [key: string]: any;
}

export interface VirtualRawMatch {
  id: string;

  league?: string;
  leagueId?: string;
  homeTeam?: string;
  awayTeam?: string;
  kickoff?: string;
  status?: string;
  odds?: VirtualOdds[] | VirtualOdds | Record<string, any>;
  provider?: string;

  competition?: string;
  timeA?: string;
  timeB?: string;
  horario?: string;
  hora?: string | number;
  minuto?: string | number;
  created_at?: string;

  resultado?: string;
  resultadoFt?: string;
  resultadoHt?: string;

  [key: string]: any;
}

export interface VirtualMarketPick {
  market: string;
  tip?: string;
  selection?: string;
  odd: number;
  confidence?: number;
  score: number;
  reason?: string;

  [key: string]: any;
}

export interface VirtualAnalyzedMatch {
  id: string;

  league?: string;
  leagueId?: string;
  homeTeam?: string;
  awayTeam?: string;
  kickoff?: string;
  status?: string;
  odds?: VirtualOdds[] | VirtualOdds | Record<string, any>;
  provider?: string;

  competition?: string;
  timeA?: string;
  timeB?: string;
  horario?: string;
  hora?: string | number;
  minuto?: string | number;
  created_at?: string;

  timeLabel?: string;
  createdAt?: string;
  picks?: VirtualMarketPick[];
  topPick?: VirtualMarketPick;
  warning?: string;

  confidence?: number;
  badge?: VirtualBadge;
  bestPick?: VirtualMarketPick;
  patterns?: string[];

  [key: string]: any;
}

export interface VirtualPick {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  tip: string;
  odd: number;
  confidence: number;
  badge: VirtualBadge;
  status: VirtualStatus;
  profit: number;
  roi: number;
  kickoff: string;
  createdAt: string;
  reason: string;
}

export interface VirtualStats {
  greens: number;
  reds: number;
  voids: number;
  pending: number;
  total: number;
  winRate: number;
  roi: number;
  profit: number;
  streak: number;
  bestStreak: number;
}