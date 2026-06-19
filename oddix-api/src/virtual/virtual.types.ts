export type VirtualLeague = "euro" | "copa" | "super" | "primeiro" | "expressar";

export type VirtualOdds = Record<string, string | number | null | undefined>;

export type VirtualRawMatch = {
  id: string;
  hora?: string;
  minuto?: string;
  horario?: string;
  competition?: string;
  league?: string;
  timeA?: string;
  timeB?: string;
  odds?: VirtualOdds;
  resultado?: string;
  resultadoHt?: string;
  resultadoFt?: string;
  primeiroMarcar?: string;
  ultimoMarcar?: string;
  vencedorHtFt?: string;
  created_at?: string;
};

export type VirtualMarketPick = {
  market: string;
  selection: string;
  odd: number;
  score: number;
  confidence: number;
  risk: "Baixo" | "Médio" | "Alto";
  reason: string;
};

export type VirtualAnalyzedMatch = {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  timeLabel: string;
  createdAt?: string;
  odds: VirtualOdds;
  picks: VirtualMarketPick[];
  topPick: VirtualMarketPick | null;
  warning: string;
};
