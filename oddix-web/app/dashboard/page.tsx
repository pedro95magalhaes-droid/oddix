'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type TabKey = 'inicio' | 'jogos' | 'palpites' | 'multiplas' | 'jogadores' | 'entradas' | 'banca' | 'compliance';
type Plan = 'free' | 'vip' | 'pro' | 'premium' | 'admin';

type User = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  plan?: string | null;
};

type Team = {
  id?: number | string;
  name: string;
  logo?: string;
};

type Game = {
  id: string;
  provider?: string;
  fixture: {
    id?: string | number;
    date?: string;
    status: {
      short: string;
      long?: string;
      elapsed?: number;
      extra?: number | null;
    };
    loadedAt: number;
    baseElapsed: number;
  };
  league: {
    id?: string | number;
    name: string;
    country?: string;
    logo?: string;
  };
  teams: {
    home: Team;
    away: Team;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score?: any;
  odds?: any;
  lineups?: any[];
  incidents?: any[];
  oddix: {
    qualityScore: number;
    qualityLabel: string;
    priorityLeague: boolean;
    leagueAllowed: boolean;
  };
  raw?: any;
};

type Pick = {
  id: string;
  fixtureId?: string | number;
  game: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  market: string;
  selection: string;
  odd: number | null;
  confidence: number;
  risk: 'Seguro' | 'Moderado' | 'Ousado';
  reason: string;
  source: 'Mercado real' | 'IA sem odd';
};

type PlayerCard = {
  id: string;
  player: string;
  game: string;
  team?: string;
  teamLogo?: string;
  market: string;
  confidence: number;
  status: string;
};

type Bet = {
  id?: string;
  match?: string;
  game?: string;
  market?: string;
  stake?: number;
  odd?: number;
  status?: string;
  result?: string;
  profit?: number;
};

const tabs: { id: TabKey; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Início', icon: '🏠' },
  { id: 'jogos', label: 'Jogos', icon: '⚽' },
  { id: 'palpites', label: 'Palpites', icon: '🧠' },
  { id: 'multiplas', label: 'Múltiplas', icon: '🧩' },
  { id: 'jogadores', label: 'Jogadores', icon: '⭐' },
  { id: 'entradas', label: 'Entradas', icon: '🎯' },
  { id: 'banca', label: 'Banca', icon: '📈' },
  { id: 'compliance', label: '18+', icon: '🛡️' },
];

const blockedLeagueWords = [
  'women',
  'woman',
  'feminino',
  'feminina',
  'w -',
  ' w ',
  'sub-',
  'sub ',
  'u17',
  'u18',
  'u19',
  'u20',
  'u21',
  'youth',
  'junior',
  'reserva',
  'reserve',
  'esoccer',
  'e-soccer',
  'esports',
  'amistoso de clubes',
  'club friendly',
  'serie c',
  'série c',
  'serie d',
  'série d',
  'carioca c',
  'paulista a4',
  'regional amateur',
];

const premiumLeagueRules: Array<{ terms: string[]; score: number; label: string }> = [
  { terms: ['fifa world cup', 'world cup', 'copa do mundo', 'mundial'], score: 100, label: 'Mundial' },
  { terms: ['uefa champions', 'champions league'], score: 98, label: 'Elite' },
  { terms: ['libertadores'], score: 96, label: 'Elite' },
  { terms: ['sul-americana', 'sudamericana'], score: 91, label: 'Continental' },
  { terms: ['copa do brasil'], score: 90, label: 'Brasil' },
  { terms: ['brazil: serie a', 'brasil: serie a', 'brasileirao serie a', 'brasileirão série a', 'serie a'], score: 88, label: 'Brasil' },
  { terms: ['premier league'], score: 88, label: 'Europa' },
  { terms: ['la liga'], score: 87, label: 'Europa' },
  { terms: ['serie a - italy', 'italy: serie a', 'italian serie a'], score: 87, label: 'Europa' },
  { terms: ['bundesliga'], score: 86, label: 'Europa' },
  { terms: ['ligue 1'], score: 84, label: 'Europa' },
  { terms: ['europa league'], score: 84, label: 'Europa' },
  { terms: ['conference league'], score: 80, label: 'Europa' },
  { terms: ['nations league', 'euro', 'copa america', 'copa américa', 'international'], score: 78, label: 'Seleções' },
  { terms: ['brazil: serie b', 'brasil: serie b', 'brasileirao serie b', 'brasileirão série b', 'serie b'], score: 72, label: 'Brasil B' },
  { terms: ['mls', 'liga mx', 'argentina primera', 'primera division'], score: 68, label: 'Americas' },
];

function normalizeText(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s:.+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeScore(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 30) return null;
  return parsed;
}

function normalizePlan(value?: string | null): Plan {
  const plan = normalizeText(value);
  if (plan === 'vip') return 'vip';
  if (plan === 'pro') return 'pro';
  if (plan === 'premium') return 'premium';
  if (plan === 'admin' || plan === 'owner') return 'admin';
  return 'free';
}

function planLabel(plan: Plan) {
  if (plan === 'admin') return 'ADMIN';
  if (plan === 'premium') return 'PREMIUM';
  return plan.toUpperCase();
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function getStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  const keys = ['oddix_auth_token', 'oddix_token', 'access_token', 'token', 'auth_token', 'authToken', 'jwt'];
  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return '';
}

function storeAuthPayload(payload: any) {
  if (typeof window === 'undefined') return;
  const token = payload?.access_token || payload?.token || '';
  const user = payload?.user || null;
  if (token) {
    window.localStorage.setItem('oddix_auth_token', token);
    window.localStorage.setItem('oddix_token', token);
    window.localStorage.setItem('access_token', token);
    window.localStorage.setItem('token', token);
  }
  if (user) {
    window.localStorage.setItem('oddix_user', JSON.stringify(user));
    window.localStorage.setItem('oddix_user_email', String(user.email || ''));
    window.localStorage.setItem('oddix_user_plan', normalizePlan(user.plan));
  }
}

function clearAuthPayload() {
  if (typeof window === 'undefined') return;
  ['oddix_auth_token', 'oddix_token', 'access_token', 'token', 'auth_token', 'authToken', 'jwt', 'oddix_user', 'oddix_user_email', 'oddix_user_plan'].forEach((key) => window.localStorage.removeItem(key));
}

function getApiBase() {
  return (process.env.NEXT_PUBLIC_ODDIX_API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}

async function apiRequest(path: string, token = '', options: RequestInit = {}) {
  const base = getApiBase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Erro ${response.status} em ${path}`);
  }

  return response.json().catch(() => null);
}

function normalizeStatusShort(status: any) {
  const raw = String(status?.short || status?.curto || status?.shortName || status?.name || '').toUpperCase();
  if (raw === '1T') return '1H';
  if (raw === '2T') return '2H';
  return raw;
}

function isLiveStatus(status: string) {
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'].includes(String(status || '').toUpperCase());
}

function isFinishedStatus(status: string) {
  return ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST'].includes(String(status || '').toUpperCase());
}

function isGameLive(game: Game) {
  const status = game.fixture.status.short;
  const elapsed = safeNumber(game.fixture.status.elapsed, 0);
  if (isFinishedStatus(status)) return false;
  if (!isLiveStatus(status)) return false;
  if (elapsed >= 90) return false;
  return true;
}

function isGameFinished(game: Game) {
  const status = game.fixture.status.short;
  const elapsed = safeNumber(game.fixture.status.elapsed, 0);
  return isFinishedStatus(status) || elapsed >= 90;
}

function gameDateKey(game: Game) {
  if (!game.fixture.date) return '';
  const parsed = new Date(game.fixture.date);
  if (Number.isNaN(parsed.getTime())) return '';
  return dateKey(parsed);
}

function getScoreLabel(game: Game) {
  const home = game.goals.home;
  const away = game.goals.away;
  if (home === null || away === null) return formatDateTime(game.fixture.date);
  return `${home} x ${away}`;
}

function getStatusLabel(game: Game) {
  if (isGameLive(game)) {
    const elapsed = safeNumber(game.fixture.status.elapsed, 0);
    return elapsed ? `Ao vivo • ${elapsed}'` : 'Ao vivo';
  }
  if (isGameFinished(game)) return 'Encerrado';
  return 'Pré-jogo';
}

function leagueQualityScore(rawLeague: any, rawGame: any) {
  const text = normalizeText([
    rawLeague?.name,
    rawLeague?.nome,
    rawLeague?.country,
    rawLeague?.pais,
    rawLeague?.país,
    rawGame?.league?.name,
    rawGame?.liga?.nome,
    rawGame?.competition?.name,
  ].filter(Boolean).join(' '));

  if (blockedLeagueWords.some((word) => text.includes(normalizeText(word)))) {
    return { allowed: false, score: 0, label: 'Bloqueada' };
  }

  for (const rule of premiumLeagueRules) {
    if (rule.terms.some((term) => text.includes(normalizeText(term)))) {
      return { allowed: true, score: rule.score, label: rule.label };
    }
  }

  const apiScore = safeNumber(rawGame?.oddix?.qualityScore ?? rawGame?.oddix?.pontuacaoQualidade, 0);
  if (apiScore >= 65) return { allowed: true, score: apiScore, label: rawGame?.oddix?.qualityLabel || 'Boa' };

  return { allowed: false, score: apiScore || 45, label: 'Baixa' };
}

function normalizeGame(raw: any): Game | null {
  if (!raw) return null;

  const fixture = raw.fixture || raw.jogo || raw.partida || {};
  const status = fixture.status || {};
  const league = raw.league || raw.liga || raw.competition || {};
  const teams = raw.teams || raw.times || {};
  const home = teams.home || teams.casa || teams.mandante || raw.home || {};
  const away = teams.away || teams.fora || teams.visitante || raw.away || {};
  const goals = raw.goals || raw.gols || raw.placar || {};
  const score = raw.score || raw.placar || {};
  const quality = leagueQualityScore(league, raw);

  const homeName = home.name || home.nome || home.teamName || 'Casa';
  const awayName = away.name || away.nome || away.teamName || 'Fora';
  const date = fixture.date || fixture.data || raw.date || raw.data;
  const statusShort = normalizeStatusShort(status);

  const game: Game = {
    id: String(fixture.id || fixture.externalId || raw.id || `${date}-${homeName}-${awayName}`),
    provider: raw.provider || raw.provedor || 'football',
    fixture: {
      id: fixture.id || fixture.externalId || raw.id,
      date,
      status: {
        short: statusShort,
        long: status.long || status.longo || status.name || '',
        elapsed: safeNumber(status.elapsed ?? status.decorrido ?? status.tempoDecorrido, 0),
        extra: status.extra ?? null,
      },
      loadedAt: Date.now(),
      baseElapsed: safeNumber(status.elapsed ?? status.decorrido ?? status.tempoDecorrido, 0),
    },
    league: {
      id: league.id || 0,
      name: league.name || league.nome || raw.leagueName || 'Liga',
      country: league.country || league.pais || league.país || '',
      logo: league.logo || league.logotipo || '',
    },
    teams: {
      home: {
        id: home.id || 0,
        name: homeName,
        logo: home.logo || home.logotipo || home.crest || '',
      },
      away: {
        id: away.id || 0,
        name: awayName,
        logo: away.logo || away.logotipo || away.crest || '',
      },
    },
    goals: {
      home: safeScore(goals.home ?? goals.casa ?? score?.fulltime?.home ?? score?.fulltime?.casa),
      away: safeScore(goals.away ?? goals.fora ?? goals.visitante ?? score?.fulltime?.away ?? score?.fulltime?.fora),
    },
    score,
    odds: raw.odds || raw.cotacoes || raw.bookmakers || null,
    lineups: raw.lineups || raw.escalacoes || raw.escalações || [],
    incidents: raw.incidents || raw.eventos || [],
    oddix: {
      qualityScore: quality.score,
      qualityLabel: quality.label,
      priorityLeague: quality.score >= 78,
      leagueAllowed: quality.allowed,
    },
    raw,
  };

  if (!game.oddix.leagueAllowed) return null;
  if (!game.fixture.date && !isGameLive(game)) return null;

  return game;
}

function gameDedupeKey(game: Game) {
  const home = normalizeText(game.teams.home.name);
  const away = normalizeText(game.teams.away.name);
  const day = gameDateKey(game);
  if (home && away && day) return `${day}-${home}-${away}`;
  return String(game.fixture.id || game.id);
}

function mergeGames(groups: any[][]) {
  const map = new Map<string, Game>();

  groups.flat().forEach((raw) => {
    const game = normalizeGame(raw);
    if (!game) return;
    const key = gameDedupeKey(game);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, game);
      return;
    }

    const existingLive = isGameLive(existing) ? 1 : 0;
    const currentLive = isGameLive(game) ? 1 : 0;
    const existingQuality = safeNumber(existing.oddix.qualityScore, 0);
    const currentQuality = safeNumber(game.oddix.qualityScore, 0);

    if (currentLive > existingLive || currentQuality > existingQuality || game.teams.home.logo || game.teams.away.logo) {
      map.set(key, { ...existing, ...game });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const liveDiff = Number(isGameLive(b)) - Number(isGameLive(a));
    if (liveDiff) return liveDiff;
    const scoreDiff = b.oddix.qualityScore - a.oddix.qualityScore;
    if (scoreDiff) return scoreDiff;
    return new Date(a.fixture.date || 0).getTime() - new Date(b.fixture.date || 0).getTime();
  });
}

function getReadableMarketName(rawMarket: any, rawLabel: any) {
  const market = normalizeText(String(rawMarket || ''));
  const label = normalizeText(String(rawLabel || ''));
  const joined = `${market} ${label}`.trim();

  if (!joined || joined === 'mercado' || joined === 'market') {
    if (['1', 'x', '2'].includes(String(rawLabel || '').trim().toLowerCase())) return 'Resultado final';
    return 'Mercado principal';
  }

  if (joined.includes('match winner') || joined.includes('full time') || joined.includes('resultado final') || joined.includes('winner') || joined.includes('1x2')) return 'Resultado final';
  if (joined.includes('double chance') || joined.includes('dupla chance')) return 'Dupla chance';
  if (joined.includes('both teams') || joined.includes('ambas marcam') || joined.includes('btts')) return 'Ambas marcam';
  if (joined.includes('over') || joined.includes('under') || joined.includes('total') || joined.includes('gols')) return 'Total de gols';
  if (joined.includes('corner') || joined.includes('escanteio')) return 'Escanteios';
  if (joined.includes('cards') || joined.includes('cart')) return 'Cartões';
  if (joined.includes('handicap')) return 'Handicap';

  const cleaned = String(rawMarket || 'Mercado principal').replace(/[_-]+/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getReadableSelection(rawLabel: any, rawMarket: any, game: Game) {
  const label = String(rawLabel || '').trim();
  const normalized = normalizeText(label);
  const market = normalizeText(String(rawMarket || ''));
  const home = game.teams.home.name;
  const away = game.teams.away.name;

  if (['1', 'home', 'mandante', 'casa'].includes(normalized)) return `${home} vence`;
  if (['2', 'away', 'visitante', 'fora'].includes(normalized)) return `${away} vence`;
  if (['x', 'draw', 'empate'].includes(normalized)) return 'Empate';

  if (normalized === '1x' || normalized.includes('home or draw')) return `${home} ou empate`;
  if (normalized === 'x2' || normalized.includes('away or draw')) return `${away} ou empate`;
  if (normalized === '12' || normalized.includes('home or away')) return `${home} ou ${away}`;

  if (normalized === 'yes' || normalized === 'sim') {
    if (market.includes('both') || market.includes('ambas') || market.includes('btts')) return 'Ambas marcam - Sim';
    return 'Sim';
  }

  if (normalized === 'no' || normalized === 'nao' || normalized === 'não') {
    if (market.includes('both') || market.includes('ambas') || market.includes('btts')) return 'Ambas marcam - Não';
    return 'Não';
  }

  if (label && label !== 'Mercado real') return label;
  return 'Seleção disponível';
}

function collectOddsCandidates(raw: any) {
  const options: any[] = [];

  if (!raw) return options;
  if (Array.isArray(raw)) options.push(...raw);
  if (Array.isArray(raw?.options)) options.push(...raw.options);
  if (Array.isArray(raw?.opções)) options.push(...raw.opções);
  if (Array.isArray(raw?.markets)) options.push(...raw.markets);
  if (Array.isArray(raw?.bets)) options.push(...raw.bets);
  if (Array.isArray(raw?.bookmakers)) {
    raw.bookmakers.forEach((book: any) => {
      (book?.bets || book?.markets || []).forEach((market: any) => {
        const marketName = market.name || market.label || market.key || market.market || market.title;
        (market?.values || market?.outcomes || market?.options || market?.selections || []).forEach((outcome: any) => {
          options.push({ ...outcome, market: marketName });
        });
      });
    });
  }

  Object.entries(raw || {}).forEach(([key, value]) => {
    if (['home', 'away', 'draw', '1', '2', 'x'].includes(String(key).toLowerCase()) && typeof value !== 'object') {
      options.push({ label: key, odd: value, market: 'Resultado final' });
    }
  });

  return options;
}

function getOddsOptions(game: Game) {
  const raw = game.odds;
  const options = collectOddsCandidates(raw);

  return options
    .map((item) => {
      const odd = Number(item?.odd ?? item?.price ?? item?.value ?? item?.cotacao ?? item?.ímpar ?? item?.odds);
      const rawLabel = item?.label || item?.name || item?.selection || item?.tip || item?.mercado || item?.valueName || item?.outcome || item?.key;
      const rawMarket = item?.market || item?.mercado || item?.marketName || item?.name || 'Mercado principal';
      return {
        label: getReadableSelection(rawLabel, rawMarket, game),
        odd,
        market: getReadableMarketName(rawMarket, rawLabel),
      };
    })
    .filter((item) => Number.isFinite(item.odd) && item.odd >= 1.15 && item.odd <= 5.5 && item.label !== 'Seleção disponível')
    .filter((item, index, array) => array.findIndex((other) => `${other.market}-${other.label}-${other.odd}` === `${item.market}-${item.label}-${item.odd}`) === index)
    .slice(0, 12);
}

function getPlayerNameFromLineup(game: Game) {
  const lineups = game.lineups || [];
  for (const lineup of lineups) {
    const starters = lineup?.startXI || lineup?.startXi || lineup?.titulares || lineup?.players || [];
    if (!Array.isArray(starters)) continue;
    const found = starters.find((item: any) => item?.player?.name || item?.player?.nome || item?.name || item?.nome || item?.athlete?.name);
    if (found) return found?.player?.name || found?.player?.nome || found?.name || found?.nome || found?.athlete?.name;
  }

  const scorer = (game.incidents || []).find((item: any) => {
    const type = normalizeText(item?.type || item?.tipo || item?.incidentType);
    return type.includes('goal') || type.includes('gol');
  });

  return scorer?.player?.name || scorer?.player?.nome || scorer?.playerName || scorer?.nome || null;
}

function buildMarketsForGame(game: Game): Pick[] {
  const odds = getOddsOptions(game);
  const home = game.teams.home.name;
  const away = game.teams.away.name;
  const quality = safeNumber(game.oddix.qualityScore, 60);
  const live = isGameLive(game);
  const scoreTotal = safeNumber(game.goals.home, 0) + safeNumber(game.goals.away, 0);

  if (odds.length) {
    return odds.slice(0, 3).map((odd, index) => ({
      id: `${game.id}-real-${index}`,
      fixtureId: game.fixture.id,
      game: `${home} x ${away}`,
      league: game.league.name,
      homeTeam: home,
      awayTeam: away,
      homeLogo: game.teams.home.logo,
      awayLogo: game.teams.away.logo,
      market: String(odd.market || 'Mercado real'),
      selection: String(odd.label || 'Seleção'),
      odd: Number(odd.odd),
      confidence: Math.min(88, Math.max(55, quality - index * 4)),
      risk: index === 0 ? 'Seguro' : index === 1 ? 'Moderado' : 'Ousado',
      reason: 'Mercado real normalizado a partir da fonte de odds do jogo.',
      source: 'Mercado real',
    }));
  }

  const baseMarkets = live
    ? [
        { market: 'Ao vivo', selection: scoreTotal <= 1 ? 'Over 0.5 gol no jogo' : 'Under 5.5 gols', delta: 0, risk: 'Moderado' as const },
        { market: 'Proteção ao vivo', selection: 'Dupla chance do lado dominante', delta: -3, risk: 'Moderado' as const },
      ]
    : [
        { market: 'Dupla chance', selection: `${home} ou empate`, delta: 1, risk: 'Seguro' as const },
        { market: 'Total de gols', selection: 'Over 1.5 gols', delta: -1, risk: 'Moderado' as const },
        { market: 'Total de gols', selection: 'Under 3.5 gols', delta: -2, risk: 'Seguro' as const },
        { market: 'Ambas marcam', selection: 'Ambas marcam - Sim', delta: -6, risk: 'Ousado' as const },
        { market: 'Escanteios', selection: 'Over escanteios', delta: -7, risk: 'Ousado' as const },
      ];

  return baseMarkets.map((item, index) => ({
    id: `${game.id}-suggested-${index}`,
    fixtureId: game.fixture.id,
    game: `${home} x ${away}`,
    league: game.league.name,
    homeTeam: home,
    awayTeam: away,
    homeLogo: game.teams.home.logo,
    awayLogo: game.teams.away.logo,
    market: item.market,
    selection: item.selection,
    odd: null,
    confidence: Math.min(86, Math.max(52, quality + item.delta)),
    risk: item.risk,
    reason: 'Sugestão gerada a partir de jogo atual e qualidade da liga. Odd real ainda indisponível.',
    source: 'IA sem odd',
  }));
}

function buildPlayerCards(games: Game[]) {
  const cards: PlayerCard[] = [];
  for (const game of games) {
    const player = getPlayerNameFromLineup(game);
    if (!player) continue;
    cards.push({
      id: `${game.id}-${player}`,
      player,
      game: `${game.teams.home.name} x ${game.teams.away.name}`,
      team: game.teams.home.name,
      teamLogo: game.teams.home.logo,
      market: 'Player prop em observação',
      confidence: Math.min(84, Math.max(58, game.oddix.qualityScore - 3)),
      status: isGameLive(game) ? 'Ao vivo' : 'Pré-jogo',
    });
  }
  return cards.slice(0, 8);
}

function buildMultiples(picks: Pick[]) {
  const qualified = picks.filter((pick) => pick.confidence >= 55).sort((a, b) => b.confidence - a.confidence);
  const safe = qualified.filter((pick) => pick.risk === 'Seguro').slice(0, 3);
  const moderate = qualified.slice(0, 4);
  const bold = qualified.slice(0, 5);

  return [
    { id: 'safe', title: 'Múltipla segura', label: 'Seguro', description: 'Combinação conservadora com mercados de proteção.', items: safe.length >= 2 ? safe : qualified.slice(0, 3) },
    { id: 'moderate', title: 'Múltipla moderada', label: 'Moderado', description: 'Equilíbrio entre proteção e potencial de retorno.', items: moderate },
    { id: 'bold', title: 'Múltipla ousada', label: 'Ousado', description: 'Entrada agressiva para quem aceita maior risco.', items: bold },
  ].filter((multiple) => multiple.items.length >= 2);
}

function calculateMultipleOdd(items: Pick[]) {
  if (!items.length || items.some((item) => !item.odd)) return null;
  return items.reduce((total, item) => total * Number(item.odd || 1), 1);
}

function TeamLogo({ src, name, size = 34 }: { src?: string; name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TM';

  if (src) {
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[10px] font-black text-white/70" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/12 bg-black/15 p-8 text-center">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/48">{subtitle}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const className =
    risk === 'Seguro'
      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300'
      : risk === 'Moderado'
        ? 'border-sky-300/20 bg-sky-400/10 text-sky-300'
        : 'border-amber-300/20 bg-amber-400/10 text-amber-200';
  return <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${className}`}>{risk}</span>;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('inicio');
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [savingPickId, setSavingPickId] = useState('');

  const plan = normalizePlan(user?.plan);
  const allowed = ['vip', 'pro', 'premium', 'admin'].includes(plan);
  const displayName = user?.name?.trim() || 'Usuário Oddix';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'OD';

  const liveGames = useMemo(() => games.filter(isGameLive), [games]);
  const pregameGames = useMemo(() => games.filter((game) => !isGameLive(game) && !isGameFinished(game)), [games]);
  const finishedGames = useMemo(() => games.filter(isGameFinished), [games]);
  const leagues = useMemo(() => Array.from(new Set(games.map((game) => game.league.name).filter(Boolean))).sort(), [games]);

  const allPicks = useMemo(() => games.flatMap((game) => buildMarketsForGame(game)).filter((pick) => pick.confidence >= 52).slice(0, 80), [games]);
  const realOddPicks = useMemo(() => allPicks.filter((pick) => pick.odd), [allPicks]);
  const multiples = useMemo(() => buildMultiples(allPicks), [allPicks]);
  const playerCards = useMemo(() => buildPlayerCards(games), [games]);

  const filteredGames = useMemo(() => {
    const q = normalizeText(search);
    return games
      .filter((game) => {
        if (leagueFilter !== 'all' && game.league.name !== leagueFilter) return false;
        if (!q) return true;
        const haystack = normalizeText(`${game.teams.home.name} ${game.teams.away.name} ${game.league.name} ${game.league.country}`);
        return q.split(' ').some((term) => haystack.includes(term));
      })
      .slice(0, 80);
  }, [games, search, leagueFilter]);

  const stats = useMemo(() => {
    const won = bets.filter((bet) => ['won', 'green'].includes(normalizeText(bet.status || bet.result))).length;
    const lost = bets.filter((bet) => ['lost', 'red'].includes(normalizeText(bet.status || bet.result))).length;
    const settled = won + lost;
    const totalStake = bets.reduce((sum, bet) => sum + safeNumber(bet.stake, 0), 0);
    const profit = bets.reduce((sum, bet) => sum + safeNumber(bet.profit, 0), 0);
    return {
      bets: bets.length,
      won,
      lost,
      roi: settled ? Math.round((won / settled) * 100) : 0,
      totalStake,
      profit,
    };
  }, [bets]);

  async function loadAll(token = authToken, showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);
      setError('');

      const today = dateKey(new Date());
      const tomorrow = dateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
      const responses = await Promise.allSettled([
        apiRequest('/football/live', token),
        apiRequest(`/football/fixtures?date=${today}`, token),
        apiRequest(`/football/fixtures?date=${tomorrow}`, token),
        apiRequest('/bets', token),
      ]);

      const live = responses[0].status === 'fulfilled' ? responses[0].value?.data || responses[0].value || [] : [];
      const todayGames = responses[1].status === 'fulfilled' ? responses[1].value?.data || responses[1].value || [] : [];
      const tomorrowGames = responses[2].status === 'fulfilled' ? responses[2].value?.data || responses[2].value || [] : [];
      const loadedBets = responses[3].status === 'fulfilled' ? responses[3].value?.data || responses[3].value || [] : [];

      const allowedDates = new Set([today, tomorrow]);
      const minScore = safeNumber(process.env.NEXT_PUBLIC_ODDIX_DASHBOARD_MIN_SCORE, 55);
      const merged = mergeGames([live, todayGames, tomorrowGames])
        .filter((game) => isGameLive(game) || allowedDates.has(gameDateKey(game)))
        .filter((game) => game.oddix.qualityScore >= minScore)
        .slice(0, 80);

      setGames(merged);
      setBets(Array.isArray(loadedBets) ? loadedBets : []);

      if (!merged.length) {
        setError('Nenhum jogo principal retornou da fonte /football/live ou /football/fixtures com o filtro de qualidade atual.');
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os jogos principais.');
      setGames([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadUser(token = authToken) {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest('/auth/me', token);
      setUser(data);
      await loadAll(token, true);
    } catch (err: any) {
      setError(err?.message || 'Sessão inválida. Faça login novamente.');
      setLoading(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const token = data?.access_token || data?.token || '';
      if (!token) throw new Error('Login sem token retornado.');
      setAuthToken(token);
      setUser(data?.user || null);
      storeAuthPayload(data);
      await loadAll(token, true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível fazer login.');
      setLoading(false);
    }
  }

  async function savePick(pick: Pick) {
    try {
      setSavingPickId(pick.id);
      await apiRequest('/dashboard/bets/from-pick', authToken, {
        method: 'POST',
        body: JSON.stringify({ pick }),
      });
      await loadAll(authToken);
    } catch {
      alert('Não foi possível salvar agora. Confirme se o backend tem POST /dashboard/bets/from-pick ativo.');
    } finally {
      setSavingPickId('');
    }
  }

  function logout() {
    clearAuthPayload();
    setAuthToken('');
    setUser(null);
    setGames([]);
    setBets([]);
  }

  useEffect(() => {
    const token = getStoredAuthToken();
    setAuthToken(token);
    void loadUser(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (authToken) void loadAll(authToken, false);
    }, 30000);
    return () => clearInterval(interval);
  }, [authToken]);

  function renderLogin() {
    return (
      <main className="min-h-screen bg-[#05070b] text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(200,247,31,.18),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,.12),transparent_26%),linear-gradient(180deg,#070a0f,#040509)]" />
        <div className="relative mx-auto flex min-h-screen max-w-md items-center px-5">
          <form onSubmit={login} className="w-full rounded-[34px] border border-white/10 bg-[#10141d]/90 p-7 shadow-[0_30px_120px_rgba(0,0,0,.42)] backdrop-blur-xl">
            <div className="mb-7 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#c8f71f]/35 bg-black/40">
                <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={38} height={38} className="h-9 w-9 object-contain" priority />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c8f71f]">Oddix</p>
                <h1 className="text-2xl font-black">Dashboard premium</h1>
              </div>
            </div>
            <p className="mb-6 text-sm leading-7 text-white/56">Entre para acessar os principais jogos, palpites, múltiplas, jogadores e controle de banca.</p>
            <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} type="email" placeholder="Email" className="mb-3 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm outline-none focus:border-[#c8f71f]/50" />
            <input value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} type="password" placeholder="Senha" className="mb-4 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm outline-none focus:border-[#c8f71f]/50" />
            <button disabled={loading} className="h-12 w-full rounded-2xl bg-[#c8f71f] text-sm font-black text-black disabled:opacity-60">{loading ? 'Entrando...' : 'Entrar'}</button>
            {error && <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  function renderHero() {
    return (
      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="relative overflow-hidden rounded-[36px] border border-[#c8f71f]/25 bg-[linear-gradient(135deg,#d9ff59,#a8e71a_48%,#7cc80a)] p-7 text-black shadow-[0_30px_120px_rgba(200,247,31,.16)]">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
          <div className="absolute bottom-4 right-8 hidden h-28 w-28 rounded-full border border-black/10 bg-black/10 md:block" />
          <p className="relative text-xs font-black uppercase tracking-[0.28em] text-black/55">V23.21 • fonte real do futebol</p>
          <h1 className="relative mt-4 max-w-3xl text-4xl font-black leading-[1.04] sm:text-5xl">Dashboard vivo, moderno e focado nos principais jogos.</h1>
          <p className="relative mt-4 max-w-2xl text-sm font-semibold leading-7 text-black/65">Usando o mesmo fluxo do seu arquivo: /football/live + /football/fixtures hoje e amanhã. O Oddix filtra os jogos mais relevantes e monta palpites, múltiplas e cards de jogadores.</p>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <button onClick={() => void loadAll(authToken, false)} className="h-12 rounded-2xl bg-black px-5 text-sm font-black text-[#c8f71f] shadow-[0_16px_34px_rgba(0,0,0,.22)]">{refreshing ? 'Atualizando...' : 'Atualizar radar'}</button>
            <button onClick={() => setActiveTab('palpites')} className="h-12 rounded-2xl bg-white/70 px-5 text-sm font-black text-black">Gerar palpites</button>
            <button onClick={() => setActiveTab('multiplas')} className="h-12 rounded-2xl border border-black/10 bg-black/10 px-5 text-sm font-black text-black">Montar múltiplas</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <MiniBanner title="Ao vivo" value={String(liveGames.length)} caption="jogos monitorados" tone="from-emerald-400/16 to-[#12151d]" />
          <MiniBanner title="Pré-jogo" value={String(pregameGames.length)} caption="oportunidades futuras" tone="from-sky-400/16 to-[#12151d]" />
          <MiniBanner title="Mercados" value={String(allPicks.length)} caption="sugestões geradas" tone="from-[#c8f71f]/16 to-[#12151d]" />
        </div>
      </section>
    );
  }

  function MiniBanner({ title, value, caption, tone }: { title: string; value: string; caption: string; tone: string }) {
    return (
      <div className={`rounded-[30px] border border-white/8 bg-gradient-to-br ${tone} p-5 shadow-[0_20px_70px_rgba(0,0,0,.24)]`}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">{title}</p>
        <p className="mt-3 text-4xl font-black text-white">{value}</p>
        <p className="mt-2 text-sm text-white/45">{caption}</p>
      </div>
    );
  }

  function renderMetricCards() {
    return (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Jogos', String(games.length), `${liveGames.length} ao vivo`, 'bg-emerald-400/12 text-emerald-300'],
          ['Palpites', String(allPicks.length), `${realOddPicks.length} com odds`, 'bg-[#c8f71f]/12 text-[#c8f71f]'],
          ['Múltiplas', String(multiples.length), 'por perfil de risco', 'bg-sky-400/12 text-sky-300'],
          ['Entradas', String(stats.bets), `${stats.won}G / ${stats.lost}R`, 'bg-violet-400/12 text-violet-300'],
          ['Plano', planLabel(plan), allowed ? 'Liberado' : 'Bloqueado', allowed ? 'bg-emerald-400/12 text-emerald-300' : 'bg-rose-400/12 text-rose-300'],
        ].map(([label, value, detail, tone]) => (
          <div key={label} className="rounded-[30px] border border-white/8 bg-[#12151d] p-5 shadow-[0_20px_70px_rgba(0,0,0,.20)] transition hover:-translate-y-1 hover:border-[#c8f71f]/20">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
            <p className="mt-4 text-3xl font-black text-white">{value}</p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${tone}`}>{detail}</span>
          </div>
        ))}
      </section>
    );
  }

  function GameCard({ game }: { game: Game }) {
    const markets = buildMarketsForGame(game).slice(0, 2);
    return (
      <div className="group rounded-[28px] border border-white/8 bg-[#12151d] p-5 shadow-[0_24px_70px_rgba(0,0,0,.20)] transition hover:-translate-y-1 hover:border-[#c8f71f]/25">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">{game.league.name}</p>
            <p className="mt-1 text-xs text-white/42">{game.league.country || game.oddix.qualityLabel} • {getStatusLabel(game)}</p>
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-black text-white/76">{getScoreLabel(game)}</span>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3">
            <TeamLogo src={game.teams.home.logo} name={game.teams.home.name} size={40} />
            <p className="text-base font-black text-white">{game.teams.home.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <TeamLogo src={game.teams.away.logo} name={game.teams.away.name} size={40} />
            <p className="text-base font-black text-white">{game.teams.away.name}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <InfoTile label="Qualidade" value={`${game.oddix.qualityScore}%`} />
          <InfoTile label="Mercados" value={markets.length ? String(markets.length) : 'Aguarde'} />
          <InfoTile label="Horário" value={isGameLive(game) ? 'Live' : formatDateTime(game.fixture.date)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {markets.map((market) => (
            <button key={market.id} onClick={() => setActiveTab('palpites')} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-white/72 transition hover:border-[#c8f71f]/30 hover:text-[#c8f71f]">
              {market.market} • {market.selection}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function InfoTile({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-2xl bg-white/[0.035] p-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">{label}</p>
        <p className="mt-1 text-xs font-black text-white">{value}</p>
      </div>
    );
  }

  function PickCard({ pick }: { pick: Pick }) {
    return (
      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(145deg,#151923,#0f1219)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.20)] transition hover:-translate-y-1 hover:border-[#c8f71f]/25">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#c8f71f]/20 bg-[#c8f71f]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#c8f71f]">{pick.market}</span>
            <RiskBadge risk={pick.risk} />
          </div>
          <div className="rounded-2xl border border-[#c8f71f]/20 bg-[#c8f71f]/10 px-4 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-white/36">Score</p>
            <p className="text-2xl font-black text-[#c8f71f]">{pick.confidence}%</p>
          </div>
        </div>
        <h3 className="mt-4 text-xl font-black text-white">{pick.game}</h3>
        <p className="mt-1 text-sm font-bold text-[#c8f71f]">{pick.selection}</p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-black/18 p-3">
          <TeamLogo src={pick.homeLogo} name={pick.homeTeam} size={30} />
          <span className="text-xs font-black text-white/75">{pick.homeTeam}</span>
          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-black text-white/35">VS</span>
          <TeamLogo src={pick.awayLogo} name={pick.awayTeam} size={30} />
          <span className="text-xs font-black text-white/75">{pick.awayTeam}</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/50">{pick.reason}</p>
        <div className="mt-4 h-2 rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#c8f71f,#38bdf8)]" style={{ width: `${Math.max(8, Math.min(100, pick.confidence))}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <InfoTile label="Odd" value={pick.odd ? pick.odd.toFixed(2) : 'Sem odd'} />
          <InfoTile label="Fonte" value={pick.source === 'Mercado real' ? 'Real' : 'IA'} />
          <button onClick={() => void savePick(pick)} disabled={savingPickId === pick.id} className="rounded-2xl bg-[#c8f71f] px-4 py-3 text-xs font-black text-black transition hover:bg-[#d9ff59] disabled:opacity-60">
            {savingPickId === pick.id ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    );
  }

  function MultipleCard({ multiple }: { multiple: ReturnType<typeof buildMultiples>[number] }) {
    const avgConfidence = Math.round(multiple.items.reduce((sum, item) => sum + item.confidence, 0) / multiple.items.length);
    const odd = calculateMultipleOdd(multiple.items);
    return (
      <div className="overflow-hidden rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(200,247,31,.15),transparent_36%),linear-gradient(145deg,#151923,#0f1219)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.26)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-[#c8f71f]/20 bg-[#c8f71f]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#c8f71f]">{multiple.label} • {multiple.items.length} entradas</span>
            <h3 className="mt-4 text-2xl font-black text-white">{multiple.title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">{multiple.description}</p>
          </div>
          <div className="rounded-2xl border border-[#c8f71f]/20 bg-[#c8f71f]/10 px-4 py-3 text-center">
            <p className="text-[10px] font-black uppercase text-white/36">Confiança</p>
            <p className="text-2xl font-black text-[#c8f71f]">{avgConfidence}%</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {multiple.items.map((item, index) => (
            <div key={item.id} className="rounded-2xl border border-white/8 bg-black/18 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c8f71f] text-xs font-black text-black">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white">{item.game}</p>
                  <p className="text-sm text-white/48">{item.selection}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <TeamLogo src={item.homeLogo} name={item.homeTeam} size={24} />
                    <span className="text-xs text-white/45">x</span>
                    <TeamLogo src={item.awayLogo} name={item.awayTeam} size={24} />
                  </div>
                </div>
                <span className="rounded-full bg-[#c8f71f]/12 px-3 py-1 text-xs font-black text-[#c8f71f]">{item.confidence}%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoTile label="Odd" value={odd ? odd.toFixed(2) : 'Sem cálculo'} />
          <InfoTile label="Status" value={odd ? 'Com odds' : 'Aguardando odds'} />
          <button className="rounded-2xl bg-[#c8f71f] px-4 py-3 text-xs font-black text-black">Usar múltipla</button>
        </div>
      </div>
    );
  }

  function PlayerCardView({ card }: { card: PlayerCard }) {
    return (
      <div className="rounded-[28px] border border-white/8 bg-[#12151d] p-5 shadow-[0_20px_70px_rgba(0,0,0,.22)] transition hover:-translate-y-1 hover:border-[#c8f71f]/20">
        <div className="flex items-center gap-4">
          <TeamLogo src={card.teamLogo} name={card.team || card.player} size={48} />
          <div>
            <p className="text-lg font-black text-white">{card.player}</p>
            <p className="text-sm text-white/45">{card.game}</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-white/8 bg-black/18 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#c8f71f]">{card.market}</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">Status</p>
              <p className="font-black text-white">{card.status}</p>
            </div>
            <p className="text-3xl font-black text-[#c8f71f]">{card.confidence}%</p>
          </div>
        </div>
      </div>
    );
  }

  function renderInicio() {
    return (
      <div className="space-y-5">
        {renderHero()}
        {renderMetricCards()}
        {error && <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</div>}
        <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
            <SectionHeader title="Principais jogos" subtitle="Fonte real do futebol" action="Ver jogos" onAction={() => setActiveTab('jogos')} />
            <div className="mt-5 grid gap-4">{games.length ? games.slice(0, 4).map((game) => <GameCard key={game.id} game={game} />) : <EmptyState title="Nenhum jogo principal" subtitle="Ajuste o filtro de score ou verifique /football/live e /football/fixtures." />}</div>
          </div>
          <div className="space-y-5">
            <div className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
              <SectionHeader title="Palpites em destaque" subtitle="Mercados gerados" action="Gerar" onAction={() => setActiveTab('palpites')} />
              <div className="mt-5 grid gap-4">{allPicks.length ? allPicks.slice(0, 2).map((pick) => <PickCard key={pick.id} pick={pick} />) : <EmptyState title="Sem palpites" subtitle="Os palpites aparecem quando houver jogos principais carregados." />}</div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function SectionHeader({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c8f71f]">{subtitle}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        </div>
        {action && <button onClick={onAction} className="rounded-full bg-[#c8f71f] px-4 py-2 text-xs font-black text-black shadow-[0_12px_28px_rgba(200,247,31,.16)]">{action}</button>}
      </div>
    );
  }

  function renderJogos() {
    return (
      <div className="space-y-5">
        <section className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
          <SectionHeader title="Jogos principais" subtitle="Live + hoje + amanhã" action="Atualizar" onAction={() => void loadAll(authToken, false)} />
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar time ou liga" className="h-12 rounded-2xl border border-white/10 bg-black/22 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#c8f71f]/40" />
            <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-black/22 px-4 text-sm text-white outline-none focus:border-[#c8f71f]/40">
              <option value="all">Todas as ligas</option>
              {leagues.map((league) => <option key={league} value={league}>{league}</option>)}
            </select>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">{filteredGames.length ? filteredGames.map((game) => <GameCard key={game.id} game={game} />) : <EmptyState title="Sem jogos para esse filtro" subtitle="Tente limpar a busca ou reduzir o score mínimo no ambiente." />}</div>
        </section>
      </div>
    );
  }

  function renderPalpites() {
    return (
      <section className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
        <SectionHeader title="Palpites da IA" subtitle="Vários mercados por jogo" action="Atualizar" onAction={() => void loadAll(authToken, false)} />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">{allPicks.length ? allPicks.map((pick) => <PickCard key={pick.id} pick={pick} />) : <EmptyState title="Sem palpites agora" subtitle="Carregue jogos principais para gerar mercados sugeridos." />}</div>
      </section>
    );
  }

  function renderMultiplas() {
    return (
      <section className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
        <SectionHeader title="Múltiplas prontas" subtitle="Seguro, moderado e ousado" action="Regerar" onAction={() => void loadAll(authToken, false)} />
        <div className="mt-5 grid gap-5 xl:grid-cols-3">{multiples.length ? multiples.map((multiple) => <MultipleCard key={multiple.id} multiple={multiple} />) : <EmptyState title="Sem múltiplas disponíveis" subtitle="É preciso ter pelo menos dois palpites qualificados para montar múltiplas." />}</div>
      </section>
    );
  }

  function renderJogadores() {
    return (
      <section className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
        <SectionHeader title="Jogadores em foco" subtitle="Cards de player props" action="Atualizar" onAction={() => void loadAll(authToken, false)} />
        <div className="mt-5 grid gap-4 xl:grid-cols-3">{playerCards.length ? playerCards.map((card) => <PlayerCardView key={card.id} card={card} />) : <EmptyState title="Aguardando escalações e eventos" subtitle="Os cards de jogadores aparecem quando a fonte retornar lineups, titulares, artilheiros ou eventos do jogo." />}</div>
      </section>
    );
  }

  function renderEntradas() {
    return (
      <section className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
        <SectionHeader title="Minhas entradas" subtitle="Controle salvo pelo usuário" action="Adicionar aposta" />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {bets.length ? bets.map((bet, index) => (
            <div key={bet.id || index} className="rounded-[28px] border border-white/8 bg-black/18 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{bet.match || bet.game || 'Aposta'}</p>
                  <p className="mt-1 text-sm text-white/48">{bet.market || 'Mercado'}</p>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-black text-white/72">{bet.status || bet.result || 'Aberta'}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <InfoTile label="Stake" value={formatCurrency(safeNumber(bet.stake, 0))} />
                <InfoTile label="Odd" value={safeNumber(bet.odd, 0) ? safeNumber(bet.odd, 0).toFixed(2) : '--'} />
                <InfoTile label="Lucro" value={formatCurrency(safeNumber(bet.profit, 0))} />
              </div>
            </div>
          )) : <EmptyState title="Nenhuma entrada salva" subtitle="Salve um palpite ou uma múltipla para começar a controlar a banca." />}
        </div>
      </section>
    );
  }

  function renderBanca() {
    return (
      <section className="rounded-[34px] border border-white/8 bg-[#10141d] p-5 shadow-[0_28px_90px_rgba(0,0,0,.24)]">
        <SectionHeader title="Banca e performance" subtitle="ROI real após entradas" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoBig title="Total em stake" value={formatCurrency(stats.totalStake)} />
          <InfoBig title="Lucro/prejuízo" value={formatCurrency(stats.profit)} />
          <InfoBig title="Win rate" value={`${stats.roi}%`} />
          <InfoBig title="Entradas" value={String(stats.bets)} />
        </div>
      </section>
    );
  }

  function InfoBig({ title, value }: { title: string; value: string }) {
    return (
      <div className="rounded-[28px] border border-white/8 bg-black/18 p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{title}</p>
        <p className="mt-4 text-3xl font-black text-white">{value}</p>
      </div>
    );
  }

  function renderCompliance() {
    return (
      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-[34px] bg-[linear-gradient(135deg,#d9ff59,#a8e71a)] p-7 text-black shadow-[0_30px_90px_rgba(200,247,31,.14)]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-black/55">Jogo responsável</p>
          <h2 className="mt-3 text-5xl font-black">18+</h2>
          <p className="mt-4 text-sm font-semibold leading-7 text-black/68">A Oddix gera análise, não promessa de lucro. Apostas devem ser tratadas como entretenimento, com limites e responsabilidade.</p>
        </div>
        <div className="rounded-[34px] border border-white/8 bg-[#10141d] p-5">
          <SectionHeader title="Selos e avisos" subtitle="Compliance" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {['18+ obrigatório', 'Aposte com responsabilidade', 'Sem promessa de lucro', 'Aposta não é investimento', 'Não recupere perdas', 'Use operadores autorizados'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/8 bg-black/18 p-4 text-sm font-black text-white/78">{item}</div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderContent() {
    if (activeTab === 'jogos') return renderJogos();
    if (activeTab === 'palpites') return renderPalpites();
    if (activeTab === 'multiplas') return renderMultiplas();
    if (activeTab === 'jogadores') return renderJogadores();
    if (activeTab === 'entradas') return renderEntradas();
    if (activeTab === 'banca') return renderBanca();
    if (activeTab === 'compliance') return renderCompliance();
    return renderInicio();
  }

  if (!user && !loading) return renderLogin();

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(200,247,31,.12),transparent_28%),radial-gradient(circle_at_88%_4%,rgba(56,189,248,.10),transparent_22%),linear-gradient(180deg,#070a0f,#040509)]" />
      <div className="pointer-events-none fixed left-1/2 top-24 h-48 w-48 -translate-x-1/2 rounded-full bg-[#c8f71f]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-30 rounded-[30px] border border-white/8 bg-[#0d1017]/88 p-3 shadow-[0_22px_80px_rgba(0,0,0,.30)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href="/chat" className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#c8f71f]/35 bg-[#0d1017] shadow-[0_0_24px_rgba(200,247,31,.12)]">
                <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={34} height={34} className="h-8 w-8 object-contain" priority />
              </span>
              <div>
                <p className="text-sm font-black tracking-tight text-white">Oddix Control</p>
                <p className="text-xs font-semibold text-white/42">Dashboard animado de palpites</p>
              </div>
            </a>
            <div className="flex items-center gap-2">
              <button onClick={() => void loadAll(authToken, false)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-white/70 hover:bg-white/6">{refreshing ? 'Sincronizando...' : 'Sincronizar'}</button>
              <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-black text-white/58 sm:inline-flex">{planLabel(plan)}</span>
              <span className={allowed ? 'rounded-full bg-emerald-400/12 px-3 py-1.5 text-xs font-black text-emerald-300' : 'rounded-full bg-rose-400/12 px-3 py-1.5 text-xs font-black text-rose-300'}>{allowed ? 'Liberado' : 'Bloqueado'}</span>
              <button onClick={logout} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white/58 hover:bg-white/6">Sair</button>
            </div>
          </div>
        </header>

        <section className="mt-4 grid flex-1 gap-5 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
            <div className="rounded-[32px] border border-white/8 bg-[#0d1017]/92 p-3 shadow-[0_24px_70px_rgba(0,0,0,.26)] backdrop-blur-xl">
              <div className="mb-3 rounded-[26px] bg-white/[0.035] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c8f71f]/14 text-sm font-black text-[#c8f71f]">{initials}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{displayName}</p>
                    <p className="truncate text-xs text-white/40">{user?.email}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/28">{games.length} jogos no radar</p>
                  </div>
                </div>
              </div>
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={['flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition', activeTab === tab.id ? 'bg-[#c8f71f] text-black shadow-[0_14px_34px_rgba(200,247,31,.16)]' : 'text-white/58 hover:bg-white/[0.05] hover:text-white'].join(' ')}>
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
              <div className="mt-3 rounded-[24px] border border-[#c8f71f]/18 bg-[#c8f71f]/8 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">18+</p>
                <p className="mt-2 text-xs leading-5 text-white/58">Aposte com responsabilidade. Aposta não é investimento.</p>
              </div>
            </div>
          </aside>

          <section className="pb-10">{loading ? <EmptyState title="Carregando radar Oddix" subtitle="Buscando /football/live, jogos de hoje e jogos de amanhã." /> : renderContent()}</section>
        </section>
      </div>
    </main>
  );
}
