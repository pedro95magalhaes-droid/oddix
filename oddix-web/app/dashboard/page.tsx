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

const allowedPlans: OddixPlan[] = ['vip', 'pro', 'premium', 'admin'];

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Início', icon: '🏠' },
  { id: 'jogos', label: 'Jogos', icon: '⚽' },
  { id: 'entradas', label: 'Entradas', icon: '🎯' },
  { id: 'ranking', label: 'Ranking', icon: '🏆' },
  { id: 'banca', label: 'Banca', icon: '📈' },
  { id: 'compliance', label: '18+', icon: '🛡️' },
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
      // ignore invalid storage payload
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
  }).format(value);
}

function planLabel(plan: OddixPlan) {
  if (plan === 'admin') return 'ADMIN';
  if (plan === 'premium') return 'PREMIUM';
  return plan.toUpperCase();
}

function ResultPill({ value }: { value: string }) {
  const style =
    value === 'Green'
      ? 'bg-emerald-400/12 text-emerald-300'
      : value === 'Red'
        ? 'bg-rose-400/12 text-rose-300'
        : 'bg-lime-300/12 text-lime-200';

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${style}`}>{value}</span>;
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

  const apiBase = process.env.NEXT_PUBLIC_ODDIX_API_URL;
  const cleanApiBase = apiBase?.replace(/\/$/, '') ?? '';

  const plan = normalizePlan(user?.plan);
  const allowed = allowedPlans.includes(plan);
  const displayName = user?.name?.trim() || 'Usuário Oddix';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase())
      .join('') || 'OD';

  const games = useMemo(
    () => [
      { id: 'bra-sco', home: 'Brasil', away: 'Escócia', league: 'Copa do Mundo', time: '22:00', status: 'Pré-jogo', odd: '1.72', confidence: 86 },
      { id: 'mar-hai', home: 'Marrocos', away: 'Haiti', league: 'Copa do Mundo', time: '19:00', status: 'Pré-jogo', odd: '1.58', confidence: 79 },
      { id: 'bos-qat', home: 'Bósnia', away: 'Catar', league: 'Internacional', time: '2 x 1', status: 'Ao vivo • 52’', odd: '1.88', confidence: 74 },
      { id: 'sui-can', home: 'Suíça', away: 'Canadá', league: 'Internacional', time: '0 x 0', status: 'Ao vivo • 31’', odd: '1.57', confidence: 72 },
    ],
    [],
  );

  const picks = useMemo(
    () => [
      { id: 'p1', match: 'Brasil x Escócia', market: 'Brasil ou empate', stake: 40, odd: 1.72, status: 'Aberta' },
      { id: 'p2', match: 'Marrocos x Haiti', market: 'Over 1.5 gols', stake: 35, odd: 1.58, status: 'Aberta' },
      { id: 'p3', match: 'Bósnia x Catar', market: 'Ambas marcam', stake: 25, odd: 1.88, status: 'Green' },
      { id: 'p4', match: 'Kairat x Khan Tengri', market: 'Kairat vence', stake: 50, odd: 1.16, status: 'Red' },
    ],
    [],
  );

  const markets = useMemo(
    () => [
      { name: 'Over 1.5 gols', edge: 88, note: 'Bom para múltiplas conservadoras.' },
      { name: 'Dupla chance', edge: 84, note: 'Proteção em jogos equilibrados.' },
      { name: 'Ambas marcam', edge: 76, note: 'Melhor em jogos abertos.' },
      { name: 'Escanteios over', edge: 71, note: 'Depende do volume ofensivo ao vivo.' },
    ],
    [],
  );

  const players = useMemo(
    () => [
      { name: 'Mbappé', score: 96, stat: '4 finalizações/jogo', tag: 'Finalização' },
      { name: 'Haaland', score: 94, stat: '0,94 gol/jogo', tag: 'Goleador' },
      { name: 'Bellingham', score: 91, stat: '2,3 passes-chave', tag: 'Criação' },
      { name: 'Vinicius Jr.', score: 89, stat: '3,1 dribles certos', tag: 'Explosão' },
    ],
    [],
  );

  const bankrollHistory = useMemo(
    () => [
      { day: 'Seg', value: 1500 },
      { day: 'Ter', value: 1540 },
      { day: 'Qua', value: 1620 },
      { day: 'Qui', value: 1585 },
      { day: 'Sex', value: 1710 },
      { day: 'Sáb', value: 1765 },
      { day: 'Hoje', value: 1840 },
    ],
    [],
  );

  const maxBankroll = Math.max(...bankrollHistory.map((item) => item.value));
  const balance = 1840;
  const initialBalance = 1500;
  const profit = balance - initialBalance;
  const roi = 18.2;
  const winRate = 63;

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

          <p className="mb-6 text-sm leading-7 text-white/55">
            Entre para acompanhar jogos, entradas, banca, ranking, mercados e alertas de jogo responsável.
          </p>

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

  function sectionHeader(title: string, subtitle: string, action?: string) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">{subtitle}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        </div>
        {action && <button className="rounded-full bg-[#c8f71f] px-4 py-2 text-xs font-black text-black">{action}</button>}
      </div>
    );
  }

  function gameCard(game: (typeof games)[number]) {
    return (
      <div key={game.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">
              {game.home} x {game.away}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/40">
              {game.league} • {game.status}
            </p>
          </div>
          <span className="rounded-xl bg-white/7 px-3 py-1.5 text-xs font-black text-white/78">{game.time}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#c8f71f]/12 px-3 py-1 text-xs font-black text-[#c8f71f]">Odd {game.odd}</span>
          <span className="text-xs font-black text-white/50">Confiança {game.confidence}%</span>
        </div>
      </div>
    );
  }

  function pickCard(pick: (typeof picks)[number]) {
    return (
      <div key={pick.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">{pick.match}</p>
            <p className="mt-1 text-xs font-semibold text-white/45">{pick.market}</p>
          </div>
          <ResultPill value={pick.status} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Stake</p>
            <p className="mt-1 text-xs font-black text-white">R$ {pick.stake}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Odd</p>
            <p className="mt-1 text-xs font-black text-white">{pick.odd}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[10px] font-black uppercase text-white/30">Retorno</p>
            <p className="mt-1 text-xs font-black text-white">R$ {(pick.stake * pick.odd).toFixed(0)}</p>
          </div>
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
              <p className="text-xs font-black uppercase tracking-[0.22em] text-black/55">V23.9 • Oddix Control</p>
              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Palpites, banca e controle em um só lugar.</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-black/65">
                Visual inspirado em app esportivo: direto, rápido, mobile-first e focado em jogos, entradas e performance.
              </p>
            </div>
            <a href="/chat" className="inline-flex h-12 min-w-[148px] items-center justify-center whitespace-nowrap rounded-2xl bg-black px-5 text-sm font-black text-[#c8f71f] shadow-[0_14px_30px_rgba(0,0,0,.18)]">
              Abrir chat
            </a>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Banca', formatCurrency(balance), '+18,2%', 'bg-emerald-400/12 text-emerald-300'],
            ['Lucro', formatCurrency(profit), 'No período', 'bg-[#c8f71f]/12 text-[#c8f71f]'],
            ['Win rate', `${winRate}%`, '29G / 17R', 'bg-sky-400/12 text-sky-300'],
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
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">Jogos quentes</p>
                <h2 className="mt-2 text-2xl font-black">Para acompanhar hoje</h2>
              </div>
              <button onClick={() => setActiveTab('jogos')} className="rounded-full bg-white/6 px-4 py-2 text-xs font-black text-white/70">
                Ver todos
              </button>
            </div>
            <div className="space-y-3">{games.slice(0, 3).map((game) => gameCard(game))}</div>
          </div>

          <div className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c8f71f]">Entradas</p>
                <h2 className="mt-2 text-2xl font-black">Minhas apostas</h2>
              </div>
              <button onClick={() => setActiveTab('entradas')} className="rounded-full bg-[#c8f71f] px-4 py-2 text-xs font-black text-black">
                Adicionar aposta
              </button>
            </div>
            <div className="space-y-3">{picks.slice(0, 3).map((pick) => pickCard(pick))}</div>
          </div>
        </section>
      </div>
    );
  }

  function renderJogos() {
    return (
      <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
        {sectionHeader('Jogos do dia', 'Partidas monitoradas pelo Oddix', 'Atualizar jogos')}
        <div className="mt-5 grid gap-3 lg:grid-cols-2">{games.map((game) => gameCard(game))}</div>
      </section>
    );
  }

  function renderEntradas() {
    return (
      <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
        {sectionHeader('Minhas apostas', 'Controle de entradas, stake, odd e resultado', 'Nova aposta')}
        <div className="mt-5 space-y-3">{picks.map((pick) => pickCard(pick))}</div>
      </section>
    );
  }

  function renderRanking() {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Melhores jogadores', 'Atletas com melhor tendência estatística')}
          <div className="mt-5 space-y-3">
            {players.map((player, index) => (
              <div key={player.name} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c8f71f] text-sm font-black text-black">#{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white">{player.name}</p>
                  <p className="text-sm text-white/48">{player.stat}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-[#c8f71f]">{player.score}</p>
                  <p className="text-xs font-bold text-white/36">{player.tag}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Ranking de mercados', 'Mercados com maior recorrência e valor')}
          <div className="mt-5 space-y-3">
            {markets.map((market, index) => (
              <div key={market.name} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-white">#{index + 1} {market.name}</p>
                    <p className="mt-1 text-sm text-white/48">{market.note}</p>
                  </div>
                  <span className="rounded-full bg-[#c8f71f]/12 px-3 py-1 text-sm font-black text-[#c8f71f]">{market.edge}%</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-[#c8f71f]" style={{ width: `${market.edge}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderBanca() {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Evolução da banca', 'Gráfico simples de saldo por dia')}
          <div className="mt-8 flex h-64 items-end gap-3 rounded-[24px] border border-white/8 bg-black/20 p-5">
            {bankrollHistory.map((item) => (
              <div key={item.day} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div
                  className="min-h-[16px] rounded-t-2xl bg-[#c8f71f] shadow-[0_0_24px_rgba(200,247,31,.18)]"
                  style={{ height: `${Math.max(12, (item.value / maxBankroll) * 100)}%` }}
                  title={`${item.day}: ${formatCurrency(item.value)}`}
                />
                <p className="text-center text-xs font-bold text-white/42">{item.day}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/8 bg-[#12151d] p-5">
          {sectionHeader('Resumo financeiro', 'ROI, lucro e exposição')}
          <div className="mt-5 space-y-3">
            {[
              ['Banca inicial', formatCurrency(initialBalance)],
              ['Banca atual', formatCurrency(balance)],
              ['Lucro/prejuízo', formatCurrency(profit)],
              ['ROI', '+18,2%'],
              ['Exposição aberta', formatCurrency(75)],
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
          {sectionHeader('Avisos obrigatórios', 'Selos para afiliados e boas práticas')}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['18+', 'Conteúdo exclusivo para maiores de 18 anos.'],
              ['Jogo responsável', 'Aposte com controle e consciência.'],
              ['Sem promessa de lucro', 'Análises não garantem resultado.'],
              ['Não é investimento', 'Aposta deve ser tratada como entretenimento.'],
              ['Controle de banca', 'Nunca comprometa gastos essenciais.'],
              ['Autoexclusão', 'Use pausas e limites quando necessário.'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="font-black text-[#c8f71f]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-white/55">{desc}</p>
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
                <p className="text-xs font-semibold text-white/42">Dashboard esportivo premium</p>
              </div>
            </a>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-black text-white/58 sm:inline-flex">
                {planLabel(plan)}
              </span>
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
    </main>
  );
}
