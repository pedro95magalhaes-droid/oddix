'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type OddixPlan = 'free' | 'vip' | 'pro' | 'premium' | 'admin';

type OddixUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  plan?: string | null;
  accessAllowed?: boolean;
};

const allowedPlans: OddixPlan[] = ['vip', 'pro', 'premium', 'admin'];

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

  const objectKeys = ['oddix_auth', 'oddix_session', 'user', 'auth'];
  for (const key of objectKeys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token || parsed?.accessToken || parsed?.token || parsed?.jwt;
      if (token) return String(token);
    } catch {
      // ignore invalid JSON
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

function getPlanVisual(plan: OddixPlan) {
  switch (plan) {
    case 'vip':
      return {
        label: 'VIP',
        badge: 'border-sky-300/20 bg-sky-400/10 text-sky-300',
        description: 'Acesso premium ao chat, análises e recursos VIP.',
      };
    case 'pro':
      return {
        label: 'PRO',
        badge: 'border-violet-300/20 bg-violet-400/10 text-violet-300',
        description: 'Acesso completo aos agentes, odds e recursos avançados.',
      };
    case 'premium':
      return {
        label: 'PREMIUM',
        badge: 'border-amber-300/20 bg-amber-400/10 text-amber-200',
        description: 'Conta premium com recursos expandidos e visão completa.',
      };
    case 'admin':
      return {
        label: 'ADMIN',
        badge: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300',
        description: 'Acesso administrativo e controle total da plataforma.',
      };
    default:
      return {
        label: 'FREE',
        badge: 'border-rose-300/20 bg-rose-400/10 text-rose-300',
        description: 'Conta sem acesso liberado aos recursos premium.',
      };
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function OddixDashboardPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [user, setUser] = useState<OddixUser | null>(null);
  const [status, setStatus] = useState('verificando acesso');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_ODDIX_API_URL;
  const cleanApiBase = apiBase?.replace(/\/$/, '') ?? '';

  const plan = normalizePlan(user?.plan);
  const allowed = allowedPlans.includes(plan);
  const planInfo = getPlanVisual(plan);
  const displayName = user?.name?.trim() || 'Usuário Oddix';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('') || 'OD';

  const overviewCards = useMemo(
    () => [
      { label: 'Saldo da banca', value: formatCurrency(1840), detail: '+12,4% no mês', tone: 'text-emerald-300' },
      { label: 'ROI acumulado', value: '+18,2%', detail: 'últimos 30 dias', tone: 'text-emerald-300' },
      { label: 'Win rate', value: '63%', detail: '29 greens / 17 reds', tone: 'text-sky-300' },
      { label: 'Apostas abertas', value: '3', detail: '8 realizadas hoje', tone: 'text-amber-200' },
    ],
    [],
  );

  const recentAnalyses = useMemo(
    () => [
      { title: 'Scotland x Brazil', market: 'Dupla chance Brasil ou Empate', confidence: '86%', note: 'Bom cenário para proteção com tendência favorável ao Brasil.' },
      { title: 'Marrocos x Haiti', market: 'Over 1.5 gols', confidence: '79%', note: 'Leitura favorável para jogo com ao menos dois gols.' },
      { title: 'Bosnia x Qatar', market: 'Ambas marcam', confidence: '74%', note: 'Jogo com boa abertura de espaços e tendência ofensiva.' },
    ],
    [],
  );

  const userBets = useMemo(
    () => [
      { match: 'Suíça x Canadá', pick: 'Canadá +1.5', odd: '1.57', stake: 'R$ 30', result: 'Aberta' },
      { match: 'Bosnia x Qatar', pick: 'Ambas marcam', odd: '1.88', stake: 'R$ 25', result: 'Green' },
      { match: 'Marrocos x Haiti', pick: 'Over 1.5', odd: '1.62', stake: 'R$ 40', result: 'Aberta' },
      { match: 'Kairat x Khan Tengri', pick: 'Kairat vence', odd: '1.16', stake: 'R$ 50', result: 'Red' },
    ],
    [],
  );

  const topPlayers = useMemo(
    () => [
      { name: 'Mbappé', stat: '4 finalizações por jogo', badge: 'Top Pick' },
      { name: 'Haaland', stat: '0.94 gol por jogo', badge: 'Goleador' },
      { name: 'Bellingham', stat: '2.3 passes-chave', badge: 'Criação' },
      { name: 'Vinicius Jr.', stat: '3.1 dribles certos', badge: 'Explosão' },
    ],
    [],
  );

  const topMarkets = useMemo(
    () => [
      { label: 'Over 1.5 gols', description: 'Ótimo para múltiplas conservadoras.', edge: 'Alta recorrência' },
      { label: 'Dupla chance', description: 'Mercado mais seguro em jogos equilibrados.', edge: 'Proteção' },
      { label: 'Ambas marcam', description: 'Boa relação risco/retorno em jogos abertos.', edge: 'Valor' },
      { label: 'Escanteios over', description: 'Ideal quando há pressão ofensiva.', edge: 'Tático' },
    ],
    [],
  );

  const featuredGames = useMemo(
    () => [
      { match: 'Brasil x Escócia', comp: 'Copa do Mundo', meta: '22:00 • Pré-jogo' },
      { match: 'Marrocos x Haiti', comp: 'Copa do Mundo', meta: '19:00 • Pré-jogo' },
      { match: 'Bosnia x Qatar', comp: 'Ao vivo', meta: '52 min • 2x1' },
      { match: 'Suíça x Canadá', comp: 'Ao vivo', meta: '31 min • 0x0' },
    ],
    [],
  );

  const complianceItems = useMemo(
    () => [
      '18+ • conteúdo exclusivo para maiores de idade.',
      'Jogue com responsabilidade.',
      'Aposta não é investimento.',
      'Não aposte para recuperar perdas.',
      'Use controle de banca e limite de exposição.',
    ],
    [],
  );

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
      });

      if (!response.ok) {
        throw new Error(`Falha ao validar sessão (${response.status})`);
      }

      const data = await response.json();
      setUser(data);
      storeAuthPayload({ token, user: data });
      setStatus(allowedPlans.includes(normalizePlan(data?.plan)) ? 'acesso liberado' : 'plano sem acesso');
    } catch (err: any) {
      setUser(null);
      setStatus('sessão inválida');
      setError(err?.message || 'Não foi possível validar o login.');
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
  }

  return (
    <main className="min-h-screen bg-[#05060a] text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(79,70,229,.12),transparent_22%),linear-gradient(180deg,#05060a,#04050a)]" />

      <section className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-white/8 bg-[rgba(10,12,19,.82)] px-5 py-4 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,.30)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-amber-300/18 bg-white/[0.03]">
                <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={42} height={42} className="h-9 w-9 object-contain" priority />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-300">Oddix Dashboard</p>
                <p className="mt-1 text-sm text-white/50">Centro de controle do usuário</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/55">
                {cleanApiBase ? 'API conectada' : 'API não configurada'}
              </span>
              <a href="/chat" className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200 transition hover:border-amber-300/35 hover:bg-amber-400/14">
                Abrir chat
              </a>
            </div>
          </div>
        </header>

        {!user ? (
          <div className="mx-auto flex min-h-[78vh] max-w-xl items-center justify-center">
            <div className="w-full rounded-[32px] border border-white/10 bg-[rgba(12,15,22,.84)] p-7 shadow-[0_30px_120px_rgba(0,0,0,.38)] backdrop-blur-xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300">Login do dashboard</p>
              <h1 className="mt-4 text-3xl font-semibold">Entre no centro de controle Oddix</h1>
              <p className="mt-3 text-sm leading-7 text-white/58">
                Acompanhe análises, apostas, performance, top mercados, jogadores em destaque e alertas de jogo responsável em um só painel.
              </p>

              <form onSubmit={login} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/40">Email</label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="cliente@email.com"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/35"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/40">Senha</label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/35"
                  />
                </div>
                <button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-amber-400 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'Entrando...' : 'Entrar no dashboard'}
                </button>
              </form>

              {error && <p className="mt-4 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 py-6 xl:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-6">
              <section className="rounded-[32px] border border-white/8 bg-[rgba(10,12,19,.84)] p-6 shadow-[0_30px_100px_rgba(0,0,0,.30)] backdrop-blur-xl">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      V23.5 Control Center
                    </div>
                    <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl xl:text-[44px]">
                      Um dashboard mais elegante, organizado e realmente útil para o usuário.
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                      Aqui o usuário controla banca, acompanha análises, apostas abertas, mercados fortes, jogadores em alta, jogos do dia e os alertas obrigatórios de jogo responsável.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {['Análises', 'Apostas', 'Performance', 'Mercados', 'Jogadores', 'Compliance'].map((chip) => (
                        <span key={chip} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/66">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-[290px] rounded-[26px] border border-white/10 bg-black/22 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/25 to-violet-400/15 text-base font-black text-white">
                        {initials}
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{displayName}</p>
                        <p className="text-sm text-white/48">{user.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${planInfo.badge}`}>
                            {planInfo.label}
                          </span>
                          <span className="text-xs text-white/45">{status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overviewCards.map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/34">{item.label}</p>
                    <p className={`mt-4 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
                    <p className="mt-2 text-sm text-white/50">{item.detail}</p>
                  </div>
                ))}
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Espaço de controle</p>
                      <h2 className="mt-2 text-2xl font-semibold">Minhas análises recentes</h2>
                    </div>
                    <a href="/chat" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/[0.06]">
                      Ver tudo
                    </a>
                  </div>

                  <div className="mt-4 space-y-3">
                    {recentAnalyses.map((item) => (
                      <div key={item.title} className="rounded-2xl border border-white/8 bg-black/18 p-4 transition hover:border-amber-300/16">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.title}</p>
                            <p className="mt-1 text-sm text-amber-200">{item.market}</p>
                          </div>
                          <span className="rounded-full border border-emerald-300/16 bg-emerald-400/8 px-2.5 py-1 text-[11px] font-black text-emerald-300">
                            {item.confidence}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/55">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Apostas</p>
                      <h2 className="mt-2 text-2xl font-semibold">Controle das entradas</h2>
                    </div>
                    <span className="rounded-full border border-amber-300/16 bg-amber-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
                      Usuário
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {userBets.map((bet) => (
                      <div key={`${bet.match}-${bet.pick}`} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{bet.match}</p>
                            <p className="mt-1 text-sm text-white/55">{bet.pick}</p>
                          </div>
                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]',
                              bet.result === 'Green'
                                ? 'bg-emerald-400/10 text-emerald-300'
                                : bet.result === 'Red'
                                  ? 'bg-rose-400/10 text-rose-300'
                                  : 'bg-amber-400/10 text-amber-200',
                            ].join(' ')}
                          >
                            {bet.result}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm text-white/52">
                          <span>Odd {bet.odd}</span>
                          <span>Stake {bet.stake}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Top players</p>
                  <h2 className="mt-2 text-xl font-semibold">Melhores jogadores</h2>
                  <div className="mt-4 space-y-3">
                    {topPlayers.map((player) => (
                      <div key={player.name} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{player.name}</p>
                          <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-black text-white/66">{player.badge}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/52">{player.stat}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Mercados</p>
                  <h2 className="mt-2 text-xl font-semibold">Mercados em foco</h2>
                  <div className="mt-4 space-y-3">
                    {topMarkets.map((market) => (
                      <div key={market.label} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{market.label}</p>
                          <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-black text-amber-200">{market.edge}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/52">{market.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Jogos</p>
                  <h2 className="mt-2 text-xl font-semibold">Jogos monitorados</h2>
                  <div className="mt-4 space-y-3">
                    {featuredGames.map((game) => (
                      <div key={`${game.match}-${game.meta}`} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                        <p className="text-sm font-semibold text-white">{game.match}</p>
                        <div className="mt-2 flex items-center justify-between text-sm text-white/52">
                          <span>{game.comp}</span>
                          <span>{game.meta}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.26)]">
                <div className="flex items-start justify-between gap-3 border-b border-white/8 pb-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/36">Status do acesso</p>
                    <h2 className="mt-2 text-2xl font-semibold">Plano {planInfo.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/50">{planInfo.description}</p>
                  </div>
                  <span
                    className={[
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]',
                      allowed ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300' : planInfo.badge,
                    ].join(' ')}
                  >
                    <span className={`h-2 w-2 rounded-full ${allowed ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                    {allowed ? 'Liberado' : 'Bloqueado'}
                  </span>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-black/22 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/25 to-violet-400/15 text-base font-black text-white">
                      {initials}
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{displayName}</p>
                      <p className="text-sm text-white/48">{user.email}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ['Status', status],
                      ['Acesso ao chat', allowed ? 'Liberado' : 'Bloqueado'],
                      ['Tipo de conta', user.role || 'USER'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-white/82">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => loadMe()}
                    disabled={loading}
                    className="h-11 rounded-2xl bg-amber-400 px-5 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Validando...' : 'Revalidar acesso'}
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="h-11 rounded-2xl border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/78 transition hover:bg-white/[0.06]"
                  >
                    Sair da conta
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <a href="/chat" className="flex h-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/8 px-5 text-sm font-black text-amber-200 transition hover:border-amber-300/35 hover:bg-amber-400/12">
                    Entrar no chat
                  </a>
                  <a href="/" className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/76 transition hover:bg-white/[0.06]">
                    Ir para a home
                  </a>
                </div>
              </section>

              <section className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Compliance obrigatório</p>
                    <h2 className="mt-2 text-xl font-semibold">Jogo responsável</h2>
                  </div>
                  <span className="rounded-full border border-amber-300/18 bg-amber-400/10 px-3 py-1 text-[11px] font-black text-amber-200">18+</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {['18+', 'Jogue com responsabilidade', 'Aposta não é investimento', 'Não recupere perdas'].map((pill) => (
                    <span key={pill} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-white/72">
                      {pill}
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {complianceItems.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/18 p-3.5">
                      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/12 text-xs text-emerald-300">✓</span>
                      <p className="text-sm leading-6 text-white/60">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <a href="/jogo-responsavel" className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm font-bold text-white/76 transition hover:bg-white/[0.06]">
                    Ver página responsável
                  </a>
                  <a href="/aviso-legal" className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm font-bold text-white/76 transition hover:bg-white/[0.06]">
                    Ver aviso legal
                  </a>
                </div>
              </section>

              <section className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Ações rápidas</p>
                <div className="mt-4 grid gap-3">
                  {[
                    'Ver top picks do dia',
                    'Abrir análises ao vivo',
                    'Montar múltipla segura',
                    'Consultar melhores mercados',
                  ].map((action) => (
                    <button key={action} className="rounded-2xl border border-white/8 bg-black/18 px-4 py-3 text-left text-sm font-semibold text-white/76 transition hover:border-amber-300/18 hover:bg-amber-400/6">
                      {action}
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {error && user && <p className="mt-4 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}
      </section>
    </main>
  );
}
