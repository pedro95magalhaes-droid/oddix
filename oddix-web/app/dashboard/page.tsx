'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

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
  const keys = ['oddix_auth_token', 'oddix_token', 'access_token', 'token', 'auth_token', 'authToken', 'jwt'];
  for (const key of keys) {
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

function getPlanVisual(plan: OddixPlan) {
  switch (plan) {
    case 'vip':
      return {
        label: 'VIP',
        badge: 'bg-sky-400/12 text-sky-300 border-sky-300/20',
        description: 'Acesso premium ao chat, análises e recursos VIP.',
      };
    case 'pro':
      return {
        label: 'PRO',
        badge: 'bg-violet-400/12 text-violet-300 border-violet-300/20',
        description: 'Acesso completo aos agentes, odds e IA avançada.',
      };
    case 'premium':
      return {
        label: 'PREMIUM',
        badge: 'bg-amber-400/12 text-amber-200 border-amber-300/20',
        description: 'Conta premium com acesso expandido aos recursos Oddix.',
      };
    case 'admin':
      return {
        label: 'ADMIN',
        badge: 'bg-emerald-400/12 text-emerald-300 border-emerald-300/20',
        description: 'Acesso administrativo e gestão completa da plataforma.',
      };
    default:
      return {
        label: 'FREE',
        badge: 'bg-rose-400/12 text-rose-300 border-rose-300/20',
        description: 'Conta sem acesso aos recursos premium no momento.',
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
  const allowed = useMemo(() => allowedPlans.includes(plan), [plan]);
  const planInfo = getPlanVisual(plan);
  const displayName = user?.name?.trim() || 'Usuário Oddix';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('') || 'OD';

  const performanceCards = useMemo(
    () => [
      { label: 'Saldo da banca', value: formatCurrency(1840), meta: '+12,4% no mês', tone: 'text-emerald-300' },
      { label: 'ROI acumulado', value: '+18,2%', meta: 'Últimos 30 dias', tone: 'text-emerald-300' },
      { label: 'Win rate', value: '63%', meta: '29 greens / 17 reds', tone: 'text-sky-300' },
      { label: 'Apostas hoje', value: '8', meta: '3 abertas • 5 encerradas', tone: 'text-amber-200' },
    ],
    [],
  );

  const recentAnalyses = useMemo(
    () => [
      { title: 'Scotland x Brazil', market: 'Dupla chance Brasil ou Empate', confidence: '86%', note: 'Jogo com contexto favorável e risco moderado.' },
      { title: 'Kairat Almaty x Khan Tengri', market: 'Over 1.5 gols', confidence: '78%', note: 'Placar e momentum favorecem continuação ofensiva.' },
      { title: 'Nejmeh SC x Tadamon', market: 'Vitória Nejmeh', confidence: '81%', note: 'Odds e contexto favorecem o mandante.' },
    ],
    [],
  );

  const userBets = useMemo(
    () => [
      { match: 'Marrocos x Haiti', pick: 'Over 1.5', odd: '1.62', stake: 'R$ 40', result: 'Aberta' },
      { match: 'Bosnia x Qatar', pick: 'Ambas marcam', odd: '1.88', stake: 'R$ 25', result: 'Green' },
      { match: 'Suíça x Canadá', pick: 'Canadá +1.5', odd: '1.57', stake: 'R$ 30', result: 'Red' },
    ],
    [],
  );

  const bestPlayers = useMemo(
    () => [
      { name: 'Mbappé', stat: '4 finalizações por jogo', tag: 'Top Player' },
      { name: 'Bellingham', stat: '2.3 passes-chave', tag: 'Criação' },
      { name: 'Haaland', stat: '0.94 gol/jogo', tag: 'Finalização' },
      { name: 'Vinicius Jr.', stat: '3.1 dribles certos', tag: 'Explosão' },
    ],
    [],
  );

  const bestMarkets = useMemo(
    () => [
      { label: 'Over 1.5 gols', edge: 'Alta recorrência', hint: 'Bom para múltiplas conservadoras.' },
      { label: 'Dupla chance', edge: 'Proteção extra', hint: 'Reduz variância em jogos equilibrados.' },
      { label: 'Ambas marcam', edge: 'Boa relação risco/retorno', hint: 'Melhor quando os ataques vivem boa fase.' },
      { label: 'Escanteios over', edge: 'Mercado tático', hint: 'Acompanhar pressão e volume ofensivo.' },
    ],
    [],
  );

  const featuredGames = useMemo(
    () => [
      { match: 'Brasil x Escócia', comp: 'Copa do Mundo', status: 'Pré-jogo', time: '22:00' },
      { match: 'Marrocos x Haiti', comp: 'Copa do Mundo', status: 'Pré-jogo', time: '19:00' },
      { match: 'Bosnia x Qatar', comp: 'Ao vivo', status: '52 min', time: '2 x 1' },
      { match: 'Suíça x Canadá', comp: 'Ao vivo', status: '31 min', time: '0 x 0' },
    ],
    [],
  );

  const controlItems = useMemo(
    () => [
      'Monitorar banca e exposição por entrada.',
      'Salvar análises mais importantes do dia.',
      'Acompanhar apostas abertas e histórico de resultados.',
      'Ver top mercados, top jogadores e jogos em destaque.',
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
    <main className="min-h-screen overflow-hidden bg-[#06070b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(245,158,11,.08),transparent_26%),radial-gradient(circle_at_90%_15%,rgba(99,102,241,.10),transparent_24%),radial-gradient(circle_at_50%_85%,rgba(245,158,11,.05),transparent_28%),linear-gradient(180deg,#06070b,#04050a)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/7 pb-5">
          <a href="/chat" className="group flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-amber-300/15 bg-white/[0.04] shadow-[0_0_40px_rgba(245,158,11,.10)] transition group-hover:border-amber-300/30 group-hover:bg-amber-400/6">
              <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={52} height={52} className="h-11 w-11 object-contain" priority />
            </span>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-[0.34em] text-amber-300">Oddix Dashboard</span>
              <span className="mt-1 block text-sm text-white/55">Centro de controle do usuário</span>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white/55">
              {cleanApiBase ? 'API conectada' : 'API não configurada'}
            </span>
            <a href="/chat" className="rounded-full border border-amber-300/18 bg-amber-400/8 px-4 py-2.5 text-sm font-bold text-amber-200 transition hover:border-amber-300/32 hover:bg-amber-400/12">
              Abrir chat
            </a>
          </div>
        </header>

        {!user ? (
          <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center py-10">
            <div className="w-full rounded-[32px] border border-white/10 bg-[rgba(12,15,22,.82)] p-6 shadow-[0_30px_120px_rgba(0,0,0,.42)] backdrop-blur-xl sm:p-8">
              <div className="mb-6">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">Entrar no painel</p>
                <h1 className="mt-3 text-3xl font-semibold">Acesse seu centro de controle Oddix</h1>
                <p className="mt-3 text-sm leading-7 text-white/58">
                  Faça login para ver análises, apostas, mercados, melhores jogadores, jogos em destaque e todo o controle da sua conta em um único lugar.
                </p>
              </div>

              <form onSubmit={login} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Email</label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="cliente@email.com"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-amber-300/35"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Senha</label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Senha da conta Oddix"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-amber-300/35"
                  />
                </div>
                <button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-amber-400 px-5 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'Validando login...' : 'Entrar no dashboard'}
                </button>
              </form>

              {error && <p className="mt-4 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[1.08fr_.92fr] xl:gap-8">
            <div className="space-y-6">
              <div className="rounded-[30px] border border-white/10 bg-[rgba(12,15,22,.82)] p-6 shadow-[0_30px_120px_rgba(0,0,0,.30)] backdrop-blur-xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      V23.4 Compliance Center
                    </div>
                    <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl">
                      Seu dashboard agora é o centro de controle com análises, apostas, performance e jogo responsável.
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-white/60">
                      Aqui o usuário acompanha banca, resultados, análises, apostas feitas, melhores jogadores, mercados, jogos em foco e alertas obrigatórios de jogo responsável.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-black/25 p-4 min-w-[280px]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/25 to-violet-400/15 text-base font-black text-white shadow-[0_10px_30px_rgba(0,0,0,.22)]">
                      {initials}
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{displayName}</p>
                      <p className="mt-1 text-sm text-white/50">{user.email}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${planInfo.badge}`}>
                          {planInfo.label}
                        </span>
                        <span className="text-xs text-white/45">{status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {performanceCards.map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">{item.label}</p>
                    <p className={`mt-4 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
                    <p className="mt-2 text-sm text-white/48">{item.meta}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[30px] border border-amber-300/14 bg-[linear-gradient(180deg,rgba(245,158,11,.085),rgba(255,255,255,.025))] p-6 shadow-[0_22px_70px_rgba(0,0,0,.24)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Compliance obrigatório</p>
                    <h2 className="mt-2 text-2xl font-semibold">Selos e avisos de jogo responsável</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
                      Área permanente para reforçar que o conteúdo da Oddix é informativo, destinado a maiores de 18 anos e não deve ser tratado como promessa de lucro, investimento ou recuperação de perdas.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.14em]">
                    <span className="rounded-full border border-amber-300/25 bg-amber-400/12 px-3 py-2 text-amber-200">18+</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-white/72">Jogue com responsabilidade</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-white/72">Aposta não é investimento</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-white/72">Não recupere perdas</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    ['Proteção 18+', 'Conteúdo exclusivo para maiores de idade e sem direcionamento a menores.'],
                    ['Controle de banca', 'Estabeleça limite de valor, tempo e exposição antes de apostar.'],
                    ['Aviso de risco', 'Não há garantia de lucro. Odds e análises não eliminam risco financeiro.'],
                  ].map(([title, desc]) => (
                    <div key={title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <p className="text-sm font-black text-white">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/54">{desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <a href="/jogo-responsavel" className="rounded-2xl border border-amber-300/18 bg-amber-400/8 px-4 py-3 text-sm font-black text-amber-200 hover:bg-amber-400/12">
                    Ver página Jogo Responsável
                  </a>
                  <a href="/aviso-legal" className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-white/72 hover:bg-white/[0.06]">
                    Aviso legal e afiliados
                  </a>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
                <div className="rounded-[28px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Espaço de controle</p>
                      <h2 className="mt-2 text-2xl font-semibold">Minhas análises e apostas</h2>
                    </div>
                    <span className="rounded-full border border-amber-300/15 bg-amber-400/8 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                      Painel do usuário
                    </span>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white/45">Análises recentes</h3>
                      <div className="mt-3 space-y-3">
                        {recentAnalyses.map((item) => (
                          <div key={item.title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{item.title}</p>
                                <p className="mt-1 text-sm text-amber-200">{item.market}</p>
                              </div>
                              <span className="rounded-full border border-emerald-300/14 bg-emerald-400/8 px-2.5 py-1 text-[11px] font-black text-emerald-300">
                                {item.confidence}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-white/55">{item.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white/45">Apostas do usuário</h3>
                      <div className="mt-3 space-y-3">
                        {userBets.map((bet) => (
                          <div key={`${bet.match}-${bet.pick}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{bet.match}</p>
                                <p className="mt-1 text-sm text-white/55">{bet.pick}</p>
                              </div>
                              <span className={[
                                'rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]',
                                bet.result === 'Green'
                                  ? 'bg-emerald-400/10 text-emerald-300'
                                  : bet.result === 'Red'
                                    ? 'bg-rose-400/10 text-rose-300'
                                    : 'bg-amber-400/10 text-amber-200',
                              ].join(' ')}>
                                {bet.result}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm text-white/55">
                              <span>Odd {bet.odd}</span>
                              <span>Stake {bet.stake}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Controle operacional</p>
                  <h2 className="mt-2 text-2xl font-semibold">Visão rápida do dia</h2>

                  <div className="mt-5 space-y-3">
                    {controlItems.map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/22 p-4">
                        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-xs text-emerald-300">✓</span>
                        <p className="text-sm leading-6 text-white/62">{item}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[22px] border border-amber-300/12 bg-amber-400/6 p-4 text-sm leading-7 text-white/64">
                    <strong className="text-amber-200">Próximo passo ideal:</strong> conectar essas áreas ao backend real para carregar histórico de análises, bilhetes, banca, favoritos e estatísticas em tempo real.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-[28px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5 lg:col-span-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Top jogadores</p>
                  <h2 className="mt-2 text-xl font-semibold">Melhores jogadores</h2>
                  <div className="mt-4 space-y-3">
                    {bestPlayers.map((player) => (
                      <div key={player.name} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{player.name}</p>
                          <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-black text-white/66">{player.tag}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/52">{player.stat}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5 lg:col-span-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Mercados</p>
                  <h2 className="mt-2 text-xl font-semibold">Melhores mercados</h2>
                  <div className="mt-4 space-y-3">
                    {bestMarkets.map((market) => (
                      <div key={market.label} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{market.label}</p>
                          <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-black text-amber-200">{market.edge}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/52">{market.hint}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5 lg:col-span-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Jogos em foco</p>
                  <h2 className="mt-2 text-xl font-semibold">Jogos e oportunidades</h2>
                  <div className="mt-4 space-y-3">
                    {featuredGames.map((game) => (
                      <div key={`${game.match}-${game.time}`} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{game.match}</p>
                          <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-black text-white/66">{game.time}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-white/52">
                          <span>{game.comp}</span>
                          <span>{game.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[30px] border border-white/10 bg-[rgba(12,15,22,.82)] p-6 shadow-[0_30px_120px_rgba(0,0,0,.30)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3 border-b border-white/8 pb-5">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/38">Status do acesso</p>
                    <h2 className="mt-2 text-3xl font-semibold text-white">Plano {planInfo.label}</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/48">{planInfo.description}</p>
                  </div>
                  <span className={[
                    'inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black uppercase tracking-[0.16em]',
                    allowed ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300' : planInfo.badge,
                  ].join(' ')}>
                    <span className={`h-2 w-2 rounded-full ${allowed ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                    {allowed ? 'Liberado' : 'Bloqueado'}
                  </span>
                </div>

                <div className="mt-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025))] p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/25 to-violet-400/15 text-base font-black text-white shadow-[0_10px_30px_rgba(0,0,0,.22)]">
                      {initials}
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{displayName}</p>
                      <p className="mt-1 text-sm text-white/50">{user.email}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      ['Status', status],
                      ['Acesso ao chat', allowed ? 'Liberado' : 'Bloqueado'],
                      ['Tipo de conta', user.role || 'USER'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/8 bg-black/22 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-white/82">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => loadMe()} disabled={loading} className="h-12 rounded-2xl bg-amber-400 px-5 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? 'Validando...' : 'Revalidar acesso'}
                  </button>
                  <button type="button" onClick={logout} className="h-12 rounded-2xl border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/78 transition hover:bg-white/[0.06]">
                    Sair da conta
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <a href="/chat" className="flex h-12 items-center justify-center rounded-2xl border border-amber-300/18 bg-amber-400/8 px-5 text-sm font-black text-amber-200 transition hover:border-amber-300/30 hover:bg-amber-400/12">
                    Entrar no chat
                  </a>
                  <a href="/" className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/72 transition hover:bg-white/[0.06]">
                    Ir para a home
                  </a>
                </div>

                <div className="mt-5 rounded-[24px] border border-emerald-300/16 bg-emerald-400/8 p-5 text-sm leading-7 text-white/72">
                  <strong className="text-emerald-300">Conta pronta para operar no ecossistema Oddix.</strong>
                  <div className="mt-2 space-y-1 text-white/62">
                    <p>• Use este painel como centro de controle do usuário.</p>
                    <p>• Próxima evolução: conectar tudo ao banco e às APIs reais.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-[rgba(12,15,22,.82)] p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Ações rápidas</p>
                <div className="mt-4 grid gap-3">
                  {[
                    'Ver top picks do dia',
                    'Abrir análises ao vivo',
                    'Montar múltipla segura',
                    'Consultar melhores mercados',
                  ].map((action) => (
                    <button key={action} className="rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-left text-sm font-semibold text-white/76 transition hover:border-amber-300/20 hover:bg-amber-400/5">
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-[rgba(12,15,22,.82)] p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Observação</p>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  Nesta versão, as seções do centro de controle foram montadas com estrutura premium e dados de exemplo. A próxima etapa é integrar cada bloco ao backend real para puxar análises do usuário, bilhetes, banca, top mercados, top jogadores e jogos ao vivo automaticamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && user && <p className="mt-4 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}
      </section>
    </main>
  );
}
