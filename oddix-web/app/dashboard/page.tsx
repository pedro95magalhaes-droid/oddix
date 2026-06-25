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
      // ignore invalid local storage payloads
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
        accent: 'from-sky-400/18 to-cyan-400/5',
        description: 'Acesso premium ao chat, análises e recursos VIP.',
      };
    case 'pro':
      return {
        label: 'PRO',
        badge: 'bg-violet-400/12 text-violet-300 border-violet-300/20',
        accent: 'from-violet-400/18 to-fuchsia-400/5',
        description: 'Acesso completo aos agentes, odds e IA avançada.',
      };
    case 'premium':
      return {
        label: 'PREMIUM',
        badge: 'bg-amber-400/12 text-amber-200 border-amber-300/20',
        accent: 'from-amber-400/18 to-orange-400/5',
        description: 'Conta premium com acesso expandido aos recursos Oddix.',
      };
    case 'admin':
      return {
        label: 'ADMIN',
        badge: 'bg-emerald-400/12 text-emerald-300 border-emerald-300/20',
        accent: 'from-emerald-400/18 to-lime-400/5',
        description: 'Acesso administrativo e gestão completa da plataforma.',
      };
    default:
      return {
        label: 'FREE',
        badge: 'bg-rose-400/12 text-rose-300 border-rose-300/20',
        accent: 'from-rose-400/12 to-transparent',
        description: 'Conta sem acesso aos recursos premium no momento.',
      };
  }
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
        headers: {
          'Content-Type': 'application/json',
        },
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
              <Image
                src="/images/oddix-logo-icon.png"
                alt="Oddix"
                width={52}
                height={52}
                className="h-11 w-11 object-contain"
                priority
              />
            </span>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-[0.34em] text-amber-300">Oddix Dashboard</span>
              <span className="mt-1 block text-sm text-white/55">Acesso automático VIP / PRO / Admin</span>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white/55">
              {cleanApiBase ? 'API conectada' : 'API não configurada'}
            </span>
            <a
              href="/chat"
              className="rounded-full border border-amber-300/18 bg-amber-400/8 px-4 py-2.5 text-sm font-bold text-amber-200 transition hover:border-amber-300/32 hover:bg-amber-400/12"
            >
              Abrir chat
            </a>
          </div>
        </header>

        <div className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[1.08fr_.92fr] xl:gap-10 xl:py-10">
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              V23.2 Premium Dashboard
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl xl:text-[56px]">
              Painel mais claro, elegante e pronto para liberar o acesso premium automaticamente.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
              O cliente entra com a conta dele, o Oddix valida o plano e mostra imediatamente se o acesso ao chat premium está liberado. Sem token manual, sem etapas confusas.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['⚡', 'Acesso instantâneo', 'Login + validação automática do plano.'],
                ['🔒', 'Controle seguro', 'Liberação por plano ou lista de emails no backend.'],
                ['👑', 'VIP / PRO / ADMIN', 'Hierarquia clara de acesso premium.'],
                ['💬', 'Entrada rápida', 'Se estiver liberado, entra no chat em um clique.'],
              ].map(([icon, title, desc]) => (
                <div key={title} className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4 shadow-[0_10px_30px_rgba(0,0,0,.18)]">
                  <span className="text-lg">{icon}</span>
                  <p className="mt-3 text-sm font-bold text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/48">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ['VIP', 'Chat premium, jogos e análises guiadas.'],
                ['PRO', 'Acesso aos agentes, odds, IA geral e recursos avançados.'],
                ['ADMIN', 'Gestão da plataforma e visão completa de acesso.'],
              ].map((item) => (
                <div key={item[0]} className="rounded-[24px] border border-amber-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02))] p-5">
                  <span className="text-sm font-black uppercase tracking-[0.18em] text-amber-200">{item[0]}</span>
                  <p className="mt-3 text-sm leading-6 text-white/55">{item[1]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className={`absolute inset-x-10 -top-5 h-32 rounded-full bg-gradient-to-r ${planInfo.accent} blur-3xl`} />

            <div className="relative rounded-[32px] border border-white/10 bg-[rgba(12,15,22,.82)] p-5 shadow-[0_30px_120px_rgba(0,0,0,.42)] backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/38">Status do acesso</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">{user ? `Plano ${planInfo.label}` : 'Entrar para validar'}</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/48">{user ? planInfo.description : 'Faça login para o Oddix identificar seu plano e validar o acesso automaticamente.'}</p>
                </div>

                <span
                  className={[
                    'inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black uppercase tracking-[0.16em]',
                    allowed ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300' : planInfo.badge,
                  ].join(' ')}
                >
                  <span className={`h-2 w-2 rounded-full ${allowed ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                  {allowed ? 'Liberado' : user ? 'Bloqueado' : 'Aguardando login'}
                </span>
              </div>

              {user ? (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-col gap-4 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025))] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/25 to-violet-400/15 text-base font-black text-white shadow-[0_10px_30px_rgba(0,0,0,.22)]">
                        {initials}
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{displayName}</p>
                        <p className="mt-1 text-sm text-white/50">{user.email}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:text-right">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Plano detectado</p>
                      <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] sm:ml-auto ${planInfo.badge}`}>
                        {planInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['Status', status],
                      ['Acesso ao chat', allowed ? 'Liberado' : 'Bloqueado'],
                      ['Tipo de conta', user.role || planInfo.label],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/8 bg-black/22 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-white/82">{value}</p>
                      </div>
                    ))}
                  </div>

                  {!allowed && (
                    <div className="rounded-[24px] border border-rose-300/14 bg-rose-400/8 p-5 text-sm leading-7 text-white/68">
                      <strong className="text-rose-200">Conta ainda sem acesso premium.</strong>
                      <div className="mt-2 space-y-1 text-white/62">
                        <p>• Coloque o email em <code>ODDIX_VIP_USERS</code>, <code>ODDIX_PRO_USERS</code> ou <code>ODDIX_ADMIN_USERS</code>.</p>
                        <p>• Ou atualize o campo <code>plan</code> do usuário no banco.</p>
                        <p>• Depois clique em <strong>Revalidar acesso</strong>.</p>
                      </div>
                    </div>
                  )}

                  {allowed && (
                    <div className="rounded-[24px] border border-emerald-300/16 bg-emerald-400/8 p-5 text-sm leading-7 text-white/72">
                      <strong className="text-emerald-300">Conta liberada com sucesso.</strong>
                      <div className="mt-2 space-y-1 text-white/62">
                        <p>• O acesso ao chat premium está ativo para esta conta.</p>
                        <p>• Recursos de acordo com o plano já podem ser usados agora.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => loadMe()}
                      disabled={loading}
                      className="h-12 rounded-2xl bg-amber-400 px-5 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? 'Validando...' : 'Revalidar acesso'}
                    </button>
                    <button
                      type="button"
                      onClick={logout}
                      className="h-12 rounded-2xl border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/78 transition hover:bg-white/[0.06]"
                    >
                      Sair da conta
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href="/chat"
                      className="flex h-12 items-center justify-center rounded-2xl border border-amber-300/18 bg-amber-400/8 px-5 text-sm font-black text-amber-200 transition hover:border-amber-300/30 hover:bg-amber-400/12"
                    >
                      Entrar no chat
                    </a>
                    <a
                      href="/"
                      className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/72 transition hover:bg-white/[0.06]"
                    >
                      Ir para a home
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={login} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-white/42">Email</label>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="cliente@email.com"
                      className="h-13 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-amber-300/35"
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
                      className="h-13 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-amber-300/35"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-2xl bg-amber-400 px-5 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Validando login...' : 'Entrar e validar acesso'}
                  </button>
                </form>
              )}

              {error && <p className="mt-4 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}

              <div className="mt-6 rounded-[24px] border border-amber-300/12 bg-amber-400/6 p-4 text-sm leading-7 text-white/62">
                <strong className="text-amber-200">Como liberar automaticamente:</strong> configure <code>ODDIX_VIP_USERS</code>, <code>ODDIX_PRO_USERS</code> e <code>ODDIX_ADMIN_USERS</code> no backend, ou mantenha o campo <code>plan</code> atualizado no banco. O cliente só precisa fazer login.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
