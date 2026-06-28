'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type OddixPlan = 'free' | 'vip' | 'pro' | 'premium' | 'admin';
type Tab = 'inicio' | 'jogos' | 'entradas' | 'ranking' | 'banca' | 'compliance';

type OddixUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  plan?: string | null;
};

type DashboardOverview = {
  balance: number;
  initialBalance: number;
  profit: number;
  roi: number;
  winRate: number;
  totalBets: number;
  openBets: number;
  settledBets: number;
  avgOdd: number;
  bankrollHistory: Array<{ label: string; value: number }>;
};

type DashboardGame = {
  id: string;
  league?: string;
  status?: string;
  minute?: string;
  kickoff?: string;
  score?: string;
  confidence?: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  topMarket?: string;
  topOdd?: number | string;
};

type DashboardBet = {
  id: string;
  match: string;
  market: string;
  stake: number;
  odd: number;
  potentialReturn?: number;
  result?: 'Aberta' | 'Green' | 'Red' | 'Void' | string;
  status?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeLogo?: string;
  awayLogo?: string;
  createdAt?: string;
};

type DashboardPlayer = {
  id?: string;
  name: string;
  team?: string;
  teamLogo?: string;
  score?: number;
  trend?: string;
  metric?: string;
};

type DashboardMarket = {
  id?: string;
  name: string;
  edge?: number;
  volume?: number;
  winRate?: number;
  note?: string;
};

type ComplianceItem = {
  title: string;
  description: string;
};

const allowedPlans: OddixPlan[] = ['vip', 'pro', 'premium', 'admin'];

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Início', icon: '🏠' },
  { id: 'jogos', label: 'Jogos', icon: '⚽' },
  { id: 'entradas', label: 'Entradas', icon: '🎯' },
  { id: 'ranking', label: 'Ranking', icon: '🏆' },
  { id: 'banca', label: 'Banca', icon: '📈' },
  { id: 'compliance', label: '18+', icon: '🛡️' },
];

const defaultOverview: DashboardOverview = {
  balance: 0,
  initialBalance: 0,
  profit: 0,
  roi: 0,
  winRate: 0,
  totalBets: 0,
  openBets: 0,
  settledBets: 0,
  avgOdd: 0,
  bankrollHistory: [],
};

const defaultCompliance: ComplianceItem[] = [
  { title: '18+', description: 'Conteúdo exclusivo para maiores de 18 anos.' },
  { title: 'Jogo responsável', description: 'Aposte com controle e consciência.' },
  { title: 'Sem promessa de lucro', description: 'Análises e odds não garantem resultado.' },
  { title: 'Aposta não é investimento', description: 'Use a plataforma como entretenimento, não como renda garantida.' },
  { title: 'Controle de banca', description: 'Defina limites de stake, tempo e exposição.' },
  { title: 'Autoexclusão', description: 'Se necessário, pause, limite ou interrompa sua atividade.' },
];

function normalizePlan(value?: string | null): OddixPlan {
  const plan = String(value || '').trim().toLowerCase();
  if (plan === 'vip') return 'vip';
  if (plan === 'pro') return 'pro';
  if (plan === 'premium') return 'premium';
  if (plan === 'admin' || plan === 'owner') return 'admin';
  return 'free';
}

function getStoredAuthToken() {
  if (typeof window === 'undefined') return '';

  const tokenKeys = ['oddix_auth_token', 'oddix_token', 'access_token', 'token', 'auth_token', 'authToken', 'jwt'];

  for (const key of tokenKeys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }

  for (const key of ['oddix_auth', 'oddix_session', 'user', 'auth']) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token || parsed?.accessToken || parsed?.token || parsed?.jwt;
      if (token) return String(token);
    } catch {
      // ignore invalid payloads
    }
  }

  return '';
}

function storeAuthPayload(payload: any) {
  if (typeof window === 'undefined') return;

  const token = payload?.access_token || payload?.token || '';
  const user = payload?.user || null;
  const plan = normalizePlan(user?.plan);

  if (token) {
    window.localStorage.setItem('oddix_auth_token', token);
    window.localStorage.setItem('oddix_token', token);
    window.localStorage.setItem('access_token', token);
  }

  if (user) {
    window.localStorage.setItem('oddix_user', JSON.stringify(user));
    window.localStorage.setItem('oddix_user_email', String(user.email || ''));
    window.localStorage.setItem('oddix_user_plan', plan);
    window.localStorage.setItem('oddix_access_plan', plan);
  }
}

function clearAuthPayload() {
  if (typeof window === 'undefined') return;

  [
    'oddix_auth_token',
    'oddix_token',
    'access_token',
    'token',
    'auth_token',
    'authToken',
    'jwt',
    'oddix_user',
    'oddix_user_email',
    'oddix_user_plan',
    'oddix_access_plan',
    'oddix_access_token',
  ].forEach((key) => window.localStorage.removeItem(key));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function planLabel(plan: OddixPlan) {
  if (plan === 'admin') return 'ADMIN';
  if (plan === 'premium') return 'PREMIUM';
  return plan.toUpperCase();
}

function nameInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('');
}

function coerceArray<T>(value: any, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (Array.isArray(value?.items)) return value.items as T[];
  if (Array.isArray(value?.data)) return value.data as T[];
  if (Array.isArray(value?.rows)) return value.rows as T[];
  if (Array.isArray(value?.results)) return value.results as T[];
  return fallback;
}

function coerceObject<T extends object>(value: any, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...fallback, ...value };
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) return { ...fallback, ...value.data };
  return fallback;
}

function resultBadgeValue(value?: string) {
  const result = String(value || '').trim().toLowerCase();
  if (result === 'green' || result === 'won' || result === 'win') return 'Green';
  if (result === 'red' || result === 'lost' || result === 'loss') return 'Red';
  if (result === 'void' || result === 'cancelada' || result === 'cancelled') return 'Void';
  return 'Aberta';
}

function ResultPill({ value }: { value?: string }) {
  const normalized = resultBadgeValue(value);
  const style =
    normalized === 'Green'
      ? 'bg-emerald-400/12 text-emerald-300'
      : normalized === 'Red'
        ? 'bg-rose-400/12 text-rose-300'
        : normalized === 'Void'
          ? 'bg-slate-400/12 text-slate-300'
          : 'bg-lime-300/12 text-lime-200';

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${style}`}>{normalized}</span>;
}

function TeamLogo({ src, team, size = 38 }: { src?: string; team: string; size?: number }) {
  const initials = nameInitials(team || 'Time') || 'TM';

  if (src) {
    return (
      <span className="flex items-center justify-center overflow-hidden rounded-full border border-white/12 bg-white/5" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={team} className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <span className="flex items-center justify-center rounded-full border border-white/12 bg-white/5 text-[10px] font-black text-white/70" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-black/10 p-8 text-center">
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/45">{subtitle}</p>
    </div>
  );
}

export default function OddixDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [user, setUser] = useState<OddixUser | null>(null);
  const [status, setStatus] = useState('verificando acesso');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [showBetForm, setShowBetForm] = useState(false);
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [savingBet, setSavingBet] = useState(false);
  const [savingBankroll, setSavingBankroll] = useState(false);
  const [betGameId, setBetGameId] = useState('');
  const [betMatch, setBetMatch] = useState('');
  const [betMarket, setBetMarket] = useState('');
  const [betStake, setBetStake] = useState('');
  const [betOdd, setBetOdd] = useState('');
  const [betResult, setBetResult] = useState('Aberta');
  const [bankrollInitial, setBankrollInitial] = useState('');

  const [overview, setOverview] = useState<DashboardOverview>(defaultOverview);
  const [games, setGames] = useState<DashboardGame[]>([]);
  const [bets, setBets] = useState<DashboardBet[]>([]);
  const [players, setPlayers] = useState<DashboardPlayer[]>([]);
  const [markets, setMarkets] = useState<DashboardMarket[]>([]);
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>(defaultCompliance);

  const apiBase = process.env.NEXT_PUBLIC_ODDIX_API_URL;
  const cleanApiBase = apiBase?.replace(/\/$/, '') ?? '';

  const plan = normalizePlan(user?.plan);
  const allowed = allowedPlans.includes(plan);
  const displayName = user?.name?.trim() || 'Usuário Oddix';
  const initials = nameInitials(displayName) || 'OD';

  const bankrollHistory = useMemo(() => {
    if (overview.bankrollHistory?.length) return overview.bankrollHistory;
    return [] as Array<{ label: string; value: number }>;
  }, [overview.bankrollHistory]);

  const maxBankroll = Math.max(1, ...bankrollHistory.map((item) => item.value || 0));

  useEffect(() => {
    const token = getStoredAuthToken();

    if (!token) {
      setStatus('login necessário');
      return;
    }

    setAuthToken(token);
    void loadMe(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestJson(path: string, token: string) {
    const response = await fetch(`${cleanApiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text().catch(() => 'Falha ao carregar dados');
      throw new Error(message || `Falha em ${path}`);
    }

    return response.json().catch(() => null);
  }

  async function loadDashboard(token = authToken) {
    if (!cleanApiBase || !token) return;

    setDashboardLoading(true);
    setDashboardError('');

    const targets = [
      ['/dashboard/overview', defaultOverview],
      ['/dashboard/games', []],
      ['/dashboard/bets', []],
      ['/dashboard/players', []],
      ['/dashboard/markets', []],
      ['/dashboard/compliance', defaultCompliance],
    ] as const;

    try {
      const [overviewRaw, gamesRaw, betsRaw, playersRaw, marketsRaw, complianceRaw] = await Promise.all(
        targets.map(async ([path, fallback]) => {
          try {
            return await requestJson(path, token);
          } catch {
            return fallback;
          }
        }),
      );

      setOverview(coerceObject<DashboardOverview>(overviewRaw, defaultOverview));
      setGames(coerceArray<DashboardGame>(gamesRaw));
      setBets(coerceArray<DashboardBet>(betsRaw));
      setPlayers(coerceArray<DashboardPlayer>(playersRaw));
      setMarkets(coerceArray<DashboardMarket>(marketsRaw));
      setComplianceItems(coerceArray<ComplianceItem>(complianceRaw, defaultCompliance));

      const noData =
        coerceArray<DashboardGame>(gamesRaw).length === 0 &&
        coerceArray<DashboardBet>(betsRaw).length === 0 &&
        coerceArray<DashboardPlayer>(playersRaw).length === 0 &&
        coerceArray<DashboardMarket>(marketsRaw).length === 0;

      if (noData) {
        setDashboardError('O frontend já está pronto para dados reais, mas o backend ainda não retornou conteúdo estruturado nos endpoints do dashboard.');
      }
    } catch (err: any) {
      setDashboardError(err?.message || 'Não foi possível carregar os dados reais do dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadMe(token = authToken) {
    if (!cleanApiBase) {
      setStatus('api não configurada');
      return;
    }

    if (!token) {
      setStatus('login necessário');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${cleanApiBase}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Falha ao validar sessão (${response.status})`);
      }

      const data = await response.json();
      setUser(data);
      storeAuthPayload({ token, user: data });
      setStatus(allowedPlans.includes(normalizePlan(data?.plan)) ? 'acesso liberado' : 'plano sem acesso');
      await loadDashboard(token);
    } catch (err: any) {
      setUser(null);
      setStatus('sessão inválida');
      setError(err?.message || 'Não foi possível validar seu login.');
    } finally {
      setLoading(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cleanApiBase) {
      setError('NEXT_PUBLIC_ODDIX_API_URL não está configurada no frontend.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${cleanApiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Email ou senha inválidos.');
      }

      const token = data?.access_token || data?.token || '';
      setAuthToken(token);
      setUser(data?.user || null);
      storeAuthPayload(data);
      setStatus(allowedPlans.includes(normalizePlan(data?.user?.plan)) ? 'acesso liberado' : 'plano sem acesso');
      setPassword('');
      await loadDashboard(token);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível fazer login.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAuthPayload();
    setAuthToken('');
    setUser(null);
    setPassword('');
    setStatus('login necessário');
    setGames([]);
    setBets([]);
    setPlayers([]);
    setMarkets([]);
    setOverview(defaultOverview);
  }

  function openBetFormFromGame(game?: DashboardGame) {
    if (game) {
      setBetGameId(game.id);
      setBetMatch(`${game.homeTeam} x ${game.awayTeam}`);
      setBetMarket(game.topMarket || '');
      setBetOdd(game.topOdd ? String(game.topOdd) : '');
    } else {
      setBetGameId('');
      setBetMatch('');
      setBetMarket('');
      setBetOdd('');
    }

    setBetStake('');
    setBetResult('Aberta');
    setShowBetForm(true);
  }

  async function saveBankroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanApiBase || !authToken) return;

    setSavingBankroll(true);
    setDashboardError('');

    try {
      await fetch(`${cleanApiBase}/dashboard/bankroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ initialAmount: Number(bankrollInitial), currentAmount: Number(bankrollInitial) }),
      });

      setShowBankrollForm(false);
      setBankrollInitial('');
      await loadDashboard();
    } catch (err: any) {
      setDashboardError(err?.message || 'Não foi possível salvar a banca.');
    } finally {
      setSavingBankroll(false);
    }
  }

  async function saveBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanApiBase || !authToken) return;

    const selectedGame = games.find((game) => game.id === betGameId);
    const match = betMatch || (selectedGame ? `${selectedGame.homeTeam} x ${selectedGame.awayTeam}` : 'Aposta registrada');
    const stake = Number(betStake);
    const odd = Number(betOdd || selectedGame?.topOdd || 1);

    setSavingBet(true);
    setDashboardError('');

    try {
      await fetch(`${cleanApiBase}/dashboard/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          match,
          market: betMarket || selectedGame?.topMarket || 'Mercado não informado',
          stake,
          odd,
          potentialReturn: stake * odd,
          result: betResult,
          homeTeam: selectedGame?.homeTeam,
          awayTeam: selectedGame?.awayTeam,
          homeLogo: selectedGame?.homeLogo,
          awayLogo: selectedGame?.awayLogo,
        }),
      });

      setShowBetForm(false);
      setBetGameId('');
      setBetMatch('');
      setBetMarket('');
      setBetStake('');
      setBetOdd('');
      setBetResult('Aberta');
      await loadDashboard();
    } catch (err: any) {
      setDashboardError(err?.message || 'Não foi possível salvar a aposta.');
    } finally {
      setSavingBet(false);
    }
  }

  async function updateBetResult(betId: string, result: string) {
    if (!cleanApiBase || !authToken) return;

    setDashboardError('');

    try {
      await fetch(`${cleanApiBase}/dashboard/bets/${encodeURIComponent(betId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ result }),
      });

      await loadDashboard();
    } catch (err: any) {
      setDashboardError(err?.message || 'Não foi possível atualizar a aposta.');
    }
  }

  function sectionHeader(title: string, subtitle: string, action?: string, onAction?: () => void) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">{subtitle}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        </div>
        {action && (
          <button onClick={onAction} className="rounded-full bg-[#c8f71f] px-4 py-2 text-xs font-black text-black">
            {action}
          </button>
        )}
      </div>
    );
  }

  function renderLogin() {
    return (
      <div className="mx-auto flex min-h-[82vh] w-full max-w-md items-center justify-center px-4">
        <div className="w-full rounded-[32px] border border-white/10 bg-[#12151d] p-6 shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          <div className="mb-7 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#c8f71f]/35 bg-[#0d1017] shadow-[0_0_28px_rgba(200,247,31,.14)]">
              <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={38} height={38} className="h-9 w-9 object-contain" priority />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c8f71f]">Oddix</p>
              <h1 className="text-2xl font-black">Centro de controle</h1>
            </div>
          </div>

          <p className="mb-6 text-sm leading-7 text-white/55">Entre para acompanhar jogos reais, entradas, banca, ranking, mercados e compliance.</p>

          <form onSubmit={login} className="space-y-4">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="Email"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#c8f71f]/60"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="Senha"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#c8f71f]/60"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-[#c8f71f] text-sm font-black text-black transition hover:bg-[#d9ff59] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Validando...' : 'Entrar'}
            </button>
          </form>

          {error && <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
        </div>
      </div>
    );
  }

  function GameCard({ game }: { game: DashboardGame }) {
    const statusText = [game.status, game.minute].filter(Boolean).join(' • ');

    return (
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#c8f71f]">{game.league || 'Partida'}</p>
            <p className="mt-1 text-xs font-semibold text-white/40">{statusText || game.kickoff || 'Sem status'}</p>
          </div>
          <span className="rounded-xl bg-white/7 px-3 py-1.5 text-xs font-black text-white/78">{game.score || game.kickoff || '--'}</span>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <TeamLogo src={game.homeLogo} team={game.homeTeam} />
            <span className="font-black text-white">{game.homeTeam}</span>
          </div>
          <div className="flex items-center gap-3">
            <TeamLogo src={game.awayLogo} team={game.awayTeam} />
            <span className="font-black text-white">{game.awayTeam}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Mercado</p>
            <p className="mt-1 text-xs font-black text-white">{game.topMarket || '--'}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Odd</p>
            <p className="mt-1 text-xs font-black text-white">{game.topOdd ?? '--'}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Confiança</p>
            <p className="mt-1 text-xs font-black text-white">{game.confidence ? `${game.confidence}%` : '--'}</p>
          </div>
        </div>
        <button onClick={() => openBetFormFromGame(game)} className="mt-3 h-10 w-full rounded-2xl bg-[#c8f71f] text-xs font-black text-black">
          Adicionar aposta neste jogo
        </button>
      </div>
    );
  }

  function BetCard({ bet }: { bet: DashboardBet }) {
    const returnValue = bet.potentialReturn ?? bet.stake * bet.odd;

    return (
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">{bet.match}</p>
            <p className="mt-1 text-xs font-semibold text-white/45">{bet.market}</p>
            {bet.createdAt && <p className="mt-1 text-[11px] text-white/32">{bet.createdAt}</p>}
          </div>
          <ResultPill value={bet.result || bet.status} />
        </div>

        {(bet.homeTeam || bet.awayTeam) && (
          <div className="mt-4 flex items-center gap-3">
            {bet.homeTeam && <TeamLogo src={bet.homeLogo} team={bet.homeTeam} size={30} />}
            <span className="text-xs font-black text-white/80">{bet.homeTeam || ''}</span>
            <span className="text-xs font-black text-white/35">x</span>
            {bet.awayTeam && <TeamLogo src={bet.awayLogo} team={bet.awayTeam} size={30} />}
            <span className="text-xs font-black text-white/80">{bet.awayTeam || ''}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Stake</p>
            <p className="mt-1 text-xs font-black text-white">{formatCurrency(bet.stake)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Odd</p>
            <p className="mt-1 text-xs font-black text-white">{formatDecimal(bet.odd)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Retorno</p>
            <p className="mt-1 text-xs font-black text-white">{formatCurrency(returnValue)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={() => updateBetResult(bet.id, 'Green')} className="h-9 rounded-xl bg-emerald-400/12 text-xs font-black text-emerald-300">Green</button>
          <button onClick={() => updateBetResult(bet.id, 'Red')} className="h-9 rounded-xl bg-rose-400/12 text-xs font-black text-rose-300">Red</button>
          <button onClick={() => updateBetResult(bet.id, 'Void')} className="h-9 rounded-xl bg-white/6 text-xs font-black text-white/65">Void</button>
        </div>
      </div>
    );
  }

  function renderInicio() {
    return (
      <div className="space-y-5">
        <section className="rounded-[32px] bg-[linear-gradient(135deg,#d9ff59,#9fdc12)] p-6 text-black shadow-[0_24px_80px_rgba(200,247,31,.14)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-black/55">V23.13 • Bet Tracker</p>
              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Banca, apostas e ROI agora com controle real do usuário.</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-black/65">
                Cadastre banca, adicione apostas, marque Green/Red/Void e acompanhe ROI, lucro e win rate reais.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadDashboard()}
                className="inline-flex h-12 min-w-[148px] items-center justify-center whitespace-nowrap rounded-2xl border border-black/10 bg-black px-5 text-sm font-black text-[#c8f71f] shadow-[0_14px_30px_rgba(0,0,0,.18)]"
              >
                {dashboardLoading ? 'Atualizando...' : 'Atualizar dados'}
              </button>
              <button
                onClick={() => setShowBankrollForm(true)}
                className="inline-flex h-12 min-w-[148px] items-center justify-center whitespace-nowrap rounded-2xl border border-black/10 bg-black/12 px-5 text-sm font-black text-black"
              >
                Configurar banca
              </button>
              <a href="/chat" className="inline-flex h-12 min-w-[148px] items-center justify-center whitespace-nowrap rounded-2xl border border-black/10 bg-white/70 px-5 text-sm font-black text-black">
                Abrir chat
              </a>
            </div>
          </div>
        </section>

        {dashboardError && (
          <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{dashboardError}</div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Banca', formatCurrency(overview.balance), overview.balance ? `${overview.openBets} abertas` : 'Sem dados', 'bg-emerald-400/12 text-emerald-300'],
            ['Lucro', formatCurrency(overview.profit), overview.totalBets ? `${overview.settledBets} liquidadas` : 'Sem dados', 'bg-[#c8f71f]/12 text-[#c8f71f]'],
            ['ROI', `${formatDecimal(overview.roi)}%`, `Odd média ${formatDecimal(overview.avgOdd || 0)}`, 'bg-sky-400/12 text-sky-300'],
            ['Win rate', `${formatDecimal(overview.winRate)}%`, `${overview.totalBets} apostas`, 'bg-indigo-400/12 text-indigo-300'],
            ['Plano', planLabel(plan), allowed ? 'Liberado' : 'Bloqueado', allowed ? 'bg-emerald-400/12 text-emerald-300' : 'bg-rose-400/12 text-rose-300'],
          ].map(([label, value, detail, tone]) => (
            <div key={label} className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
              <p className="mt-4 text-3xl font-black text-white">{value}</p>
              <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${tone}`}>{detail}</span>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
          <div className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">Jogos reais</p>
                <h2 className="mt-2 text-2xl font-black">Para acompanhar hoje</h2>
              </div>
              <button onClick={() => setActiveTab('jogos')} className="rounded-full bg-white/6 px-4 py-2 text-xs font-black text-white/70">Ver todos</button>
            </div>
            <div className="space-y-3">
              {games.length ? games.slice(0, 3).map((game) => <GameCard key={game.id} game={game} />) : <EmptyState title="Sem jogos carregados" subtitle="Quando o backend retornar partidas reais, os cards com logos dos times aparecem aqui." />}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">Entradas reais</p>
                <h2 className="mt-2 text-2xl font-black">Minhas apostas</h2>
              </div>
              <button onClick={() => openBetFormFromGame()} className="rounded-full bg-[#c8f71f] px-4 py-2 text-xs font-black text-black">Adicionar aposta</button>
            </div>
            <div className="space-y-3">
              {bets.length ? bets.slice(0, 3).map((bet) => <BetCard key={bet.id} bet={bet} />) : <EmptyState title="Nenhuma aposta real encontrada" subtitle="Conecte o controle de bilhetes do usuário no backend para preencher esta área automaticamente." />}
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderJogos() {
    return (
      <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
        {sectionHeader('Jogos do dia', 'Partidas reais monitoradas pelo Oddix', 'Atualizar jogos', () => void loadDashboard())}
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {games.length ? games.map((game) => <GameCard key={game.id} game={game} />) : <EmptyState title="Sem jogos retornados" subtitle="O endpoint /dashboard/games precisa retornar a lista real de partidas com logos, odds e status." />}
        </div>
      </section>
    );
  }

  function renderEntradas() {
    return (
      <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
        {sectionHeader('Minhas apostas', 'Controle real do usuário', 'Nova aposta', () => openBetFormFromGame())}
        <div className="mt-5 space-y-3">
          {bets.length ? bets.map((bet) => <BetCard key={bet.id} bet={bet} />) : <EmptyState title="Sem apostas cadastradas" subtitle="O endpoint /dashboard/bets deve retornar as apostas reais do usuário logado." />}
        </div>
      </section>
    );
  }

  function renderRanking() {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Melhores jogadores', 'Dados reais de performance')}
          <div className="mt-5 space-y-3">
            {players.length ? (
              players.map((player, index) => (
                <div key={`${player.id || player.name}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c8f71f] text-sm font-black text-black">#{index + 1}</span>
                  <TeamLogo src={player.teamLogo} team={player.team || player.name} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-white">{player.name}</p>
                    <p className="text-sm text-white/48">{player.team || 'Sem time'} • {player.metric || 'Sem métrica'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-[#c8f71f]">{player.score ?? '--'}</p>
                    <p className="text-xs font-bold text-white/36">{player.trend || 'Tendência'}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="Sem ranking de jogadores" subtitle="Conecte os dados reais do backend para exibir atletas, time, score e tendência." />
            )}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Ranking de mercados', 'Mercados reais com melhor leitura')}
          <div className="mt-5 space-y-3">
            {markets.length ? (
              markets.map((market, index) => {
                const edge = Number(market.edge || market.winRate || 0);
                return (
                  <div key={`${market.id || market.name}-${index}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-white">#{index + 1} {market.name}</p>
                        <p className="mt-1 text-sm text-white/48">{market.note || `${market.volume || 0} entradas monitoradas`}</p>
                      </div>
                      <span className="rounded-full bg-[#c8f71f]/12 px-3 py-1 text-sm font-black text-[#c8f71f]">{edge}%</span>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-[#c8f71f]" style={{ width: `${Math.max(4, Math.min(100, edge))}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState title="Sem ranking de mercados" subtitle="O endpoint /dashboard/markets deve alimentar esta aba com edge, volume e observação." />
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderBanca() {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Evolução da banca', 'Gráfico real do usuário')}
          {bankrollHistory.length ? (
            <div className="mt-8 flex h-64 items-end gap-3 rounded-[24px] border border-white/8 bg-black/20 p-5">
              {bankrollHistory.map((item) => (
                <div key={item.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div
                    className="min-h-[16px] rounded-t-2xl bg-[#c8f71f] shadow-[0_0_24px_rgba(200,247,31,.18)]"
                    style={{ height: `${Math.max(12, ((item.value || 0) / maxBankroll) * 100)}%` }}
                    title={`${item.label}: ${formatCurrency(item.value)}`}
                  />
                  <p className="text-center text-xs font-bold text-white/42">{item.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="Sem histórico de banca" subtitle="O endpoint /dashboard/overview deve retornar bankrollHistory para montar o gráfico real." />
            </div>
          )}
        </section>

        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Resumo financeiro', 'ROI, lucro e exposição reais')}
          <div className="mt-5 space-y-3">
            {[
              ['Banca inicial', formatCurrency(overview.initialBalance)],
              ['Banca atual', formatCurrency(overview.balance)],
              ['Lucro/prejuízo', formatCurrency(overview.profit)],
              ['ROI', `${formatDecimal(overview.roi)}%`],
              ['Win rate', `${formatDecimal(overview.winRate)}%`],
              ['Apostas abertas', String(overview.openBets)],
              ['Apostas liquidadas', String(overview.settledBets)],
              ['Odd média', formatDecimal(overview.avgOdd)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 p-4">
                <span className="text-sm text-white/55">{label}</span>
                <span className="text-base font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderCompliance() {
    return (
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-[28px] border border-[#c8f71f]/20 bg-[linear-gradient(135deg,#d9ff59,#a8e71a)] p-6 text-black">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-black/55">Jogo responsável</p>
          <h2 className="mt-3 text-4xl font-black">18+</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-black/68">
            O Oddix deve operar com avisos claros: aposta não é investimento, não há garantia de lucro e o conteúdo é exclusivo para maiores de idade.
          </p>
          <div className="mt-5 grid gap-3">
            {['Aposte com responsabilidade', 'Não aposte para recuperar perdas', 'Defina limites de banca', 'Use apenas operadores autorizados'].map((item) => (
              <div key={item} className="rounded-2xl bg-black/10 px-4 py-3 text-sm font-black text-black">{item}</div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Selos e avisos', 'Compliance obrigatório para operação e afiliados')}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {complianceItems.length ? complianceItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="font-black text-[#c8f71f]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.description}</p>
              </div>
            )) : defaultCompliance.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="font-black text-[#c8f71f]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a href="/jogo-responsavel" className="flex h-12 items-center justify-center rounded-2xl bg-white/6 text-sm font-black text-white/75">Jogo responsável</a>
            <a href="/aviso-legal" className="flex h-12 items-center justify-center rounded-2xl bg-white/6 text-sm font-black text-white/75">Aviso legal</a>
          </div>
        </section>
      </div>
    );
  }

  function renderBankrollModal() {
    if (!showBankrollForm) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
        <form onSubmit={saveBankroll} className="w-full max-w-md rounded-[30px] border border-white/10 bg-[#12151d] p-6 shadow-[0_30px_120px_rgba(0,0,0,.5)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">Banca</p>
              <h3 className="mt-2 text-2xl font-black text-white">Configurar banca inicial</h3>
            </div>
            <button type="button" onClick={() => setShowBankrollForm(false)} className="rounded-full bg-white/6 px-3 py-1 text-sm font-black text-white/60">×</button>
          </div>

          <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-white/35">Valor inicial</label>
          <input
            value={bankrollInitial}
            onChange={(event) => setBankrollInitial(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex: 1000"
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c8f71f]/50"
          />

          <button disabled={savingBankroll} className="mt-5 h-12 w-full rounded-2xl bg-[#c8f71f] text-sm font-black text-black disabled:opacity-60">
            {savingBankroll ? 'Salvando...' : 'Salvar banca'}
          </button>
        </form>
      </div>
    );
  }

  function renderBetModal() {
    if (!showBetForm) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
        <form onSubmit={saveBet} className="w-full max-w-xl rounded-[30px] border border-white/10 bg-[#12151d] p-6 shadow-[0_30px_120px_rgba(0,0,0,.5)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">Aposta</p>
              <h3 className="mt-2 text-2xl font-black text-white">Adicionar aposta real</h3>
            </div>
            <button type="button" onClick={() => setShowBetForm(false)} className="rounded-full bg-white/6 px-3 py-1 text-sm font-black text-white/60">×</button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/35">Jogo</label>
              <select
                value={betGameId}
                onChange={(event) => {
                  const game = games.find((item) => item.id === event.target.value);
                  setBetGameId(event.target.value);
                  if (game) {
                    setBetMatch(`${game.homeTeam} x ${game.awayTeam}`);
                    setBetMarket(game.topMarket || betMarket);
                    setBetOdd(game.topOdd ? String(game.topOdd) : betOdd);
                  }
                }}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#c8f71f]/50"
              >
                <option value="">Selecionar jogo ou preencher manual</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>{game.homeTeam} x {game.awayTeam}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/35">Partida</label>
              <input value={betMatch} onChange={(event) => setBetMatch(event.target.value)} placeholder="Brasil x Argentina" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c8f71f]/50" />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/35">Mercado</label>
              <input value={betMarket} onChange={(event) => setBetMarket(event.target.value)} placeholder="Over 1.5" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c8f71f]/50" />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/35">Status</label>
              <select value={betResult} onChange={(event) => setBetResult(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[#c8f71f]/50">
                <option>Aberta</option>
                <option>Green</option>
                <option>Red</option>
                <option>Void</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/35">Stake</label>
              <input value={betStake} onChange={(event) => setBetStake(event.target.value)} type="number" min="0" step="0.01" placeholder="R$ 50" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c8f71f]/50" />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/35">Odd</label>
              <input value={betOdd} onChange={(event) => setBetOdd(event.target.value)} type="number" min="1" step="0.01" placeholder="1.80" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c8f71f]/50" />
            </div>
          </div>

          <button disabled={savingBet} className="mt-5 h-12 w-full rounded-2xl bg-[#c8f71f] text-sm font-black text-black disabled:opacity-60">
            {savingBet ? 'Salvando...' : 'Salvar aposta'}
          </button>
        </form>
      </div>
    );
  }

  function renderContent() {
    if (activeTab === 'jogos') return renderJogos();
    if (activeTab === 'entradas') return renderEntradas();
    if (activeTab === 'ranking') return renderRanking();
    if (activeTab === 'banca') return renderBanca();
    if (activeTab === 'compliance') return renderCompliance();
    return renderInicio();
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#070a0f] text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(215,255,47,.12),transparent_34%),linear-gradient(180deg,#070a0f,#05070b)]" />
        <div className="relative">{renderLogin()}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070a0f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(215,255,47,.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,.08),transparent_22%),linear-gradient(180deg,#070a0f,#05070b)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-30 rounded-[28px] border border-white/8 bg-[#0d1017]/90 p-3 shadow-[0_22px_80px_rgba(0,0,0,.28)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href="/chat" className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#c8f71f]/35 bg-[#0d1017] shadow-[0_0_24px_rgba(200,247,31,.12)]">
                <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={34} height={34} className="h-8 w-8 object-contain" priority />
              </span>
              <div>
                <p className="text-sm font-black tracking-tight text-white">Oddix Control</p>
                <p className="text-xs font-semibold text-white/42">Dashboard esportivo com dados reais</p>
              </div>
            </a>

            <div className="flex items-center gap-2">
              <button onClick={() => void loadDashboard()} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-white/70 hover:bg-white/6">
                {dashboardLoading ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-black text-white/58 sm:inline-flex">{planLabel(plan)}</span>
              <span className={allowed ? 'rounded-full bg-emerald-400/12 px-3 py-1.5 text-xs font-black text-emerald-300' : 'rounded-full bg-rose-400/12 px-3 py-1.5 text-xs font-black text-rose-300'}>
                {allowed ? 'Liberado' : 'Bloqueado'}
              </span>
              <button onClick={logout} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white/58 hover:bg-white/6">Sair</button>
            </div>
          </div>
        </header>

        <section className="mt-4 grid flex-1 gap-5 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
            <div className="rounded-[30px] border border-white/8 bg-[#0d1017] p-3 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
              <div className="mb-3 rounded-[24px] bg-white/[0.035] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c8f71f]/14 text-sm font-black text-[#c8f71f]">{initials}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{displayName}</p>
                    <p className="truncate text-xs text-white/40">{user.email}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/28">{status}</p>
                  </div>
                </div>
              </div>

              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition',
                      activeTab === tab.id
                        ? 'bg-[#c8f71f] text-black shadow-[0_14px_34px_rgba(200,247,31,.16)]'
                        : 'text-white/58 hover:bg-white/[0.05] hover:text-white',
                    ].join(' ')}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-3 rounded-[22px] border border-[#c8f71f]/18 bg-[#c8f71f]/8 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">18+</p>
                <p className="mt-2 text-xs leading-5 text-white/58">Aposte com responsabilidade. Aposta não é investimento.</p>
              </div>
            </div>
          </aside>

          <section className="pb-8">{renderContent()}</section>
        </section>
      </div>
      {renderBankrollModal()}
      {renderBetModal()}
    </main>
  );
}
