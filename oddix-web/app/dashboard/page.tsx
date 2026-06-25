'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

type OddixPlan = 'Free' | 'VIP' | 'PRO' | 'Premium' | 'Admin';
type TabKey = 'overview' | 'bets' | 'analyses' | 'players' | 'markets' | 'compliance';

type DashboardUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  plan?: OddixPlan | string | null;
  accessAllowed?: boolean;
};

type ChartPoint = { label: string; value: number };

type DashboardPayload = {
  user?: DashboardUser;
  access?: { allowed?: boolean; plan?: string; status?: string };
  source?: string;
  hasOperationalData?: boolean;
  metrics?: any;
  charts?: {
    bankroll?: ChartPoint[];
    roi?: ChartPoint[];
    winRate?: ChartPoint[];
  };
  analyses?: any[];
  bets?: any[];
  players?: any[];
  markets?: any[];
  games?: any[];
  compliance?: { seals?: string[]; checklist?: string[] };
  emptyState?: { title?: string; message?: string };
};

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Visão geral', icon: '📊' },
  { key: 'bets', label: 'Minhas apostas', icon: '🎫' },
  { key: 'analyses', label: 'Análises', icon: '🧠' },
  { key: 'players', label: 'Jogadores', icon: '⭐' },
  { key: 'markets', label: 'Mercados', icon: '📈' },
  { key: 'compliance', label: 'Compliance', icon: '18+' },
];

function getStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  const tokenKeys = ['oddix_auth_token', 'oddix_token', 'access_token', 'token', 'auth_token', 'authToken', 'jwt'];
  for (const key of tokenKeys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return '';
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

function storeAuthPayload(payload: any) {
  if (typeof window === 'undefined') return;
  const token = payload?.access_token || payload?.token || '';
  const user = payload?.user || null;
  if (token) {
    window.localStorage.setItem('oddix_auth_token', token);
    window.localStorage.setItem('oddix_token', token);
    window.localStorage.setItem('access_token', token);
  }
  if (user) {
    window.localStorage.setItem('oddix_user', JSON.stringify(user));
    window.localStorage.setItem('oddix_user_email', String(user.email || ''));
    window.localStorage.setItem('oddix_user_plan', String(user.plan || 'Free'));
    window.localStorage.setItem('oddix_access_plan', String(user.plan || 'Free'));
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
}

function planStyle(plan?: string | null) {
  const normalized = String(plan || 'Free').toLowerCase();
  if (normalized === 'admin') return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300';
  if (normalized === 'pro') return 'border-violet-300/20 bg-violet-400/10 text-violet-300';
  if (normalized === 'vip') return 'border-sky-300/20 bg-sky-400/10 text-sky-300';
  if (normalized === 'premium') return 'border-amber-300/20 bg-amber-400/10 text-amber-200';
  return 'border-rose-300/20 bg-rose-400/10 text-rose-300';
}

function EmptyState({ title, message }: { title?: string; message?: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-white/12 bg-white/[0.025] p-7 text-center">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-200">Sem dados ainda</p>
      <h3 className="mt-3 text-2xl font-semibold">{title || 'Dados não conectados'}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/55">
        {message || 'Esta aba já está conectada ao backend, mas ainda não há registros para exibir.'}
      </p>
    </div>
  );
}

function LineChart({ data, title, valuePrefix = '', valueSuffix = '' }: { data: ChartPoint[]; title: string; valuePrefix?: string; valueSuffix?: string }) {
  const points = data?.length ? data : [{ label: 'Hoje', value: 0 }];
  const max = Math.max(...points.map((item) => Number(item.value || 0)), 1);
  const min = Math.min(...points.map((item) => Number(item.value || 0)), 0);
  const span = Math.max(max - min, 1);
  const width = 560;
  const height = 180;
  const padding = 24;
  const coords = points.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const y = height - padding - ((Number(item.value || 0) - min) * (height - padding * 2)) / span;
    return { x, y, label: item.label, value: Number(item.value || 0) };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="rounded-[26px] border border-white/8 bg-black/18 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="text-xs text-white/42">{valuePrefix}{points[points.length - 1]?.value || 0}{valueSuffix}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-44 w-full overflow-visible">
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1={padding} x2={width - padding} y1={padding + line * 38} y2={padding + line * 38} stroke="rgba(255,255,255,.07)" />
        ))}
        <path d={path} fill="none" stroke="rgba(251,191,36,.95)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => (
          <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="5" fill="rgba(251,191,36,1)" />
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data, title }: { data: ChartPoint[]; title: string }) {
  const points = data?.length ? data : [{ label: 'Sem dados', value: 0 }];
  const max = Math.max(...points.map((item) => Number(item.value || 0)), 1);

  return (
    <div className="rounded-[26px] border border-white/8 bg-black/18 p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-5 space-y-4">
        {points.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.max((Number(item.value || 0) / max) * 100, 3)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OddixDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_ODDIX_API_URL;
  const cleanApiBase = apiBase?.replace(/\/$/, '') ?? '';
  const user = payload?.user || null;
  const accessAllowed = Boolean(payload?.access?.allowed || user?.accessAllowed);
  const planLabel = String(payload?.access?.plan || user?.plan || 'Free');
  const displayName = user?.name?.trim() || 'Usuário Oddix';
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map((item) => item[0]?.toUpperCase()).join('') || 'OD';
  const isAdmin = planLabel.toLowerCase() === 'admin';

  const emptyState = payload?.emptyState || {
    title: 'Dados operacionais ainda não conectados',
    message: 'O dashboard já busca dados reais do backend. Assim que as tabelas de apostas, análises, banca e mercados forem conectadas, os dados aparecerão aqui automaticamente.',
  };

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) return;
    setAuthToken(token);
    void loadDashboard(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard(token = authToken) {
    if (!cleanApiBase) {
      setError('NEXT_PUBLIC_ODDIX_API_URL não está configurada.');
      return;
    }

    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${cleanApiBase}/auth/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || `Falha ao carregar dashboard (${response.status})`);
      }

      setPayload(data);
      if (data?.user) storeAuthPayload({ token, user: data.user });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o dashboard.');
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
      if (!response.ok) throw new Error(data?.message || 'Email ou senha inválidos.');

      const token = data?.access_token || data?.token || '';
      setAuthToken(token);
      storeAuthPayload(data);
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
    setPayload(null);
    setAuthToken('');
    setPassword('');
  }

  const metrics = payload?.metrics || {};
  const charts = payload?.charts || {};
  const analyses = payload?.analyses || [];
  const bets = payload?.bets || [];
  const players = payload?.players || [];
  const markets = payload?.markets || [];
  const games = payload?.games || [];
  const compliance = payload?.compliance || {};

  return (
    <main className="min-h-screen bg-[#05060a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,.10),transparent_20%),radial-gradient(circle_at_top_right,rgba(99,102,241,.12),transparent_24%),linear-gradient(180deg,#05060a,#030408)]" />

      <section className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-white/8 bg-[rgba(10,12,19,.84)] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-amber-300/16 bg-white/[0.03]">
                <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={42} height={42} className="h-9 w-9 object-contain" priority />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-300">Oddix Control Center</p>
                <p className="mt-1 text-sm text-white/50">Dashboard real com tabs, métricas e painel administrativo separado</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <a href="/admin" className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/14">
                  Painel admin
                </a>
              )}
              <button type="button" onClick={() => loadDashboard()} disabled={loading || !authToken} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/65 transition hover:bg-white/[0.06] disabled:opacity-50">
                Atualizar
              </button>
              <a href="/chat" className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-400/14">
                Abrir chat
              </a>
            </div>
          </div>
        </header>

        {!user ? (
          <div className="mx-auto flex min-h-[78vh] max-w-xl items-center justify-center">
            <div className="w-full rounded-[32px] border border-white/10 bg-[rgba(12,15,22,.86)] p-7 shadow-[0_30px_120px_rgba(0,0,0,.38)] backdrop-blur-xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300">Dashboard premium</p>
              <h1 className="mt-4 text-3xl font-semibold">Entre no centro de controle Oddix</h1>
              <p className="mt-3 text-sm leading-7 text-white/58">
                Faça login para carregar dados reais do backend: banca, ROI, winrate, apostas, análises, jogadores, mercados e compliance.
              </p>

              <form onSubmit={login} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/40">Email</label>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="cliente@email.com" className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/35" />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/40">Senha</label>
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Sua senha" className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/35" />
                </div>
                <button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-amber-400 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'Entrando...' : 'Entrar no dashboard'}
                </button>
              </form>
              {error && <p className="mt-4 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="py-6">
            <section className="rounded-[32px] border border-white/8 bg-[rgba(10,12,19,.84)] p-6 shadow-[0_30px_100px_rgba(0,0,0,.30)] backdrop-blur-xl">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
                    <span className="h-2 w-2 rounded-full bg-amber-300" />
                    V23.6 Real Backend Dashboard
                  </div>
                  <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl xl:text-[44px]">
                    Centro de controle com tabs reais, gráficos e dados carregados do backend.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-white/58 sm:text-base">
                    Use as abas para acompanhar visão geral, apostas, análises, jogadores, mercados e compliance. O painel admin agora fica separado em <span className="font-semibold text-emerald-300">/admin</span>.
                  </p>
                </div>

                <div className="min-w-[310px] rounded-[26px] border border-white/10 bg-black/22 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/25 to-violet-400/15 text-base font-black text-white">
                      {initials}
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{displayName}</p>
                      <p className="text-sm text-white/48">{user.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${planStyle(planLabel)}`}>{planLabel}</span>
                        <span className={accessAllowed ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>{accessAllowed ? 'acesso liberado' : 'sem acesso premium'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => loadDashboard()} disabled={loading} className="h-11 rounded-2xl bg-amber-400 text-sm font-black text-black transition hover:bg-amber-300 disabled:opacity-60">Revalidar</button>
                    <button type="button" onClick={logout} className="h-11 rounded-2xl border border-white/10 bg-white/[0.02] text-sm font-bold text-white/75 transition hover:bg-white/[0.06]">Sair</button>
                  </div>
                </div>
              </div>
            </section>

            <nav className="sticky top-0 z-20 mt-6 overflow-x-auto rounded-[24px] border border-white/8 bg-[rgba(7,9,15,.88)] p-2 backdrop-blur-xl">
              <div className="flex min-w-max gap-2">
                {tabs.map((tab) => (
                  <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={[
                    'flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition',
                    activeTab === tab.key ? 'bg-amber-400 text-black shadow-[0_12px_30px_rgba(245,158,11,.18)]' : 'text-white/58 hover:bg-white/[0.06] hover:text-white',
                  ].join(' ')}>
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <section className="mt-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Saldo da banca', formatCurrency(metrics?.bankroll?.current || 0), formatPercent(metrics?.bankroll?.monthlyChangePercent || 0), 'text-emerald-300'],
                      ['ROI acumulado', formatPercent(metrics?.roi?.current || 0), metrics?.roi?.period || '30 dias', 'text-emerald-300'],
                      ['Win rate', formatPercent(metrics?.winRate?.current || 0), `${metrics?.winRate?.greens || 0} greens / ${metrics?.winRate?.reds || 0} reds`, 'text-sky-300'],
                      ['Apostas hoje', String(metrics?.bets?.today || 0), `${metrics?.bets?.open || 0} abertas • ${metrics?.bets?.closed || 0} encerradas`, 'text-amber-200'],
                    ].map(([label, value, detail, tone]) => (
                      <div key={label} className="rounded-[24px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
                        <p className={`mt-4 text-3xl font-semibold ${tone}`}>{value}</p>
                        <p className="mt-2 text-sm text-white/50">{detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-3">
                    <LineChart data={charts.bankroll || []} title="Evolução da banca" valuePrefix="R$ " />
                    <LineChart data={charts.roi || []} title="ROI no período" valueSuffix="%" />
                    <BarChart data={charts.winRate || []} title="Greens x Reds" />
                  </div>

                  {!payload?.hasOperationalData && <EmptyState title={emptyState.title} message={emptyState.message} />}
                </div>
              )}

              {activeTab === 'bets' && (
                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                    <div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Minhas apostas</p><h2 className="mt-2 text-2xl font-semibold">Histórico e entradas abertas</h2></div>
                  </div>
                  {bets.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{bets.map((bet: any, index: number) => <div key={bet.id || index} className="rounded-2xl border border-white/8 bg-black/18 p-4"><p className="font-semibold">{bet.match || bet.title || 'Aposta'}</p><p className="mt-1 text-sm text-white/55">{bet.pick || bet.market || 'Mercado não informado'}</p><div className="mt-3 flex justify-between text-sm text-white/55"><span>Odd {bet.odd || '-'}</span><span>{bet.stake || ''}</span></div></div>)}</div> : <EmptyState title="Nenhuma aposta registrada" message="Quando o backend de apostas estiver conectado, suas entradas abertas, greens, reds, odds e stakes aparecerão aqui." />}
                </div>
              )}

              {activeTab === 'analyses' && (
                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <div className="mb-5 border-b border-white/8 pb-4"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Análises</p><h2 className="mt-2 text-2xl font-semibold">Análises salvas e recomendações</h2></div>
                  {analyses.length ? <div className="grid gap-3 md:grid-cols-2">{analyses.map((item: any, index: number) => <div key={item.id || index} className="rounded-2xl border border-white/8 bg-black/18 p-4"><p className="font-semibold">{item.title || item.match || 'Análise'}</p><p className="mt-2 text-sm leading-6 text-white/55">{item.note || item.summary || 'Sem resumo.'}</p></div>)}</div> : <EmptyState title="Nenhuma análise salva" message="As análises geradas pelo Oddix poderão ser salvas no backend e exibidas nesta aba." />}
                </div>
              )}

              {activeTab === 'players' && (
                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <div className="mb-5 border-b border-white/8 pb-4"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Jogadores</p><h2 className="mt-2 text-2xl font-semibold">Melhores jogadores monitorados</h2></div>
                  {players.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{players.map((player: any, index: number) => <div key={player.id || index} className="rounded-2xl border border-white/8 bg-black/18 p-4"><p className="font-semibold">{player.name || 'Jogador'}</p><p className="mt-2 text-sm text-white/55">{player.stat || player.summary || 'Sem estatística.'}</p></div>)}</div> : <EmptyState title="Jogadores ainda não conectados" message="Quando o provider de estatísticas de jogadores estiver conectado, esta aba exibirá os melhores atletas e tendências." />}
                </div>
              )}

              {activeTab === 'markets' && (
                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <div className="mb-5 border-b border-white/8 pb-4"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Mercados</p><h2 className="mt-2 text-2xl font-semibold">Mercados em foco</h2></div>
                  {markets.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{markets.map((market: any, index: number) => <div key={market.id || index} className="rounded-2xl border border-white/8 bg-black/18 p-4"><p className="font-semibold">{market.label || market.name || 'Mercado'}</p><p className="mt-2 text-sm text-white/55">{market.description || market.edge || 'Sem descrição.'}</p></div>)}</div> : <EmptyState title="Mercados ainda não conectados" message="Aqui entrarão os mercados vindos da engine: over/under, ambas marcam, handicap, dupla chance, escanteios e outros." />}
                </div>
              )}

              {activeTab === 'compliance' && (
                <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
                  <div className="rounded-[30px] border border-amber-300/14 bg-amber-400/6 p-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Compliance obrigatório</p>
                    <h2 className="mt-3 text-3xl font-semibold">Selos e avisos de jogo responsável</h2>
                    <div className="mt-5 flex flex-wrap gap-2">{(compliance.seals || []).map((seal) => <span key={seal} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white/75">{seal}</span>)}</div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2"><a href="/jogo-responsavel" className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-black/18 text-sm font-bold text-white/75">Jogo responsável</a><a href="/aviso-legal" className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-black/18 text-sm font-bold text-white/75">Aviso legal</a></div>
                  </div>
                  <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Checklist</p>
                    <div className="mt-4 space-y-3">{(compliance.checklist || []).map((item) => <div key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-black/18 p-4"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/12 text-xs text-emerald-300">✓</span><p className="text-sm leading-6 text-white/62">{item}</p></div>)}</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {error && user && <p className="mb-6 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}
      </section>
    </main>
  );
}
