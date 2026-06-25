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
  const planLabel = plan === 'admin' ? 'Admin' : plan.toUpperCase();

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
    <main className="min-h-screen bg-[#07080d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(245,158,11,.12),transparent_34%),radial-gradient(circle_at_95%_0%,rgba(124,58,237,.12),transparent_30%),linear-gradient(180deg,#07080d,#05060a)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <a href="/chat" className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-400/8 shadow-[0_0_38px_rgba(245,158,11,.14)]">
              <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={42} height={42} className="h-10 w-10 object-contain" priority />
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.22em] text-amber-300">Oddix Dashboard</span>
              <span className="block text-xs text-white/45">Auto Access VIP / PRO</span>
            </span>
          </a>

          <a href="/chat" className="rounded-full border border-amber-300/18 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/10">
            Abrir chat
          </a>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.02fr_.98fr]">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              V23.1 Auto Access
            </div>

            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              Acesso automático para clientes VIP e PRO.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-8 text-white/56">
              O cliente não precisa colar token. O Oddix valida o login, lê o plano da conta e libera o chat premium automaticamente quando o plano for VIP, PRO, Premium ou Admin.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['VIP', 'Chat premium, jogos e análises guiadas.'],
                ['PRO', 'Acesso completo aos agentes, odds e IA geral.'],
                ['ADMIN', 'Gestão interna e acesso total.'],
              ].map((item) => (
                <div key={item[0]} className="rounded-2xl border border-amber-300/14 bg-white/[0.035] p-4 text-left">
                  <span className="block text-sm font-black text-amber-200">{item[0]}</span>
                  <span className="mt-2 block text-xs leading-5 text-white/45">{item[1]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[rgba(13,16,24,.78)] p-5 shadow-[0_30px_110px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-5">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white/38">Status do acesso</p>
                <h2 className="mt-2 text-2xl font-semibold">{user ? `Plano ${planLabel}` : 'Login necessário'}</h2>
              </div>
              <span className={[
                'rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em]',
                allowed ? 'bg-emerald-400/12 text-emerald-300' : 'bg-rose-400/12 text-rose-300',
              ].join(' ')}>
                {allowed ? 'Liberado' : 'Bloqueado'}
              </span>
            </div>

            {user ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/24 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/38">Conta conectada</p>
                  <p className="mt-2 text-lg font-semibold">{user.name || 'Usuário Oddix'}</p>
                  <p className="mt-1 text-sm text-white/52">{user.email}</p>
                  <p className="mt-3 text-sm text-white/60">Status: {status}</p>
                </div>

                {!allowed && (
                  <div className="rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-white/65">
                    Esta conta ainda não está em VIP/PRO. Para liberar automaticamente, atualize o plano no banco ou coloque o email em <code>ODDIX_VIP_USERS</code> ou <code>ODDIX_PRO_USERS</code> no backend.
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => loadMe()}
                    disabled={loading}
                    className="h-12 flex-1 rounded-2xl bg-amber-400 px-5 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-60"
                  >
                    Revalidar acesso
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="h-12 flex-1 rounded-2xl border border-white/10 px-5 text-sm font-bold text-white/75 hover:bg-white/8"
                  >
                    Sair
                  </button>
                </div>

                {allowed && (
                  <a href="/chat" className="flex h-12 items-center justify-center rounded-2xl border border-amber-300/18 bg-amber-400/8 px-5 text-sm font-black text-amber-200 hover:bg-amber-400/12">
                    Entrar no chat premium
                  </a>
                )}
              </div>
            ) : (
              <form onSubmit={login} className="mt-6 space-y-4">
                <label className="block text-xs font-black uppercase tracking-[0.16em] text-white/42">Email</label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="cliente@email.com"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-amber-300/35"
                />

                <label className="block text-xs font-black uppercase tracking-[0.16em] text-white/42">Senha</label>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Senha da conta Oddix"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-amber-300/35"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-2xl bg-amber-400 px-5 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-60"
                >
                  {loading ? 'Validando...' : 'Entrar e liberar acesso'}
                </button>
              </form>
            )}

            {error && <p className="mt-4 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm text-rose-200">{error}</p>}

            <div className="mt-6 rounded-2xl border border-amber-300/12 bg-amber-400/6 p-4 text-sm leading-6 text-white/60">
              <strong className="text-amber-200">Liberação automática:</strong> defina os emails em <code>ODDIX_VIP_USERS</code>, <code>ODDIX_PRO_USERS</code> ou atualize o campo <code>plan</code> do usuário no banco. O cliente só faz login.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
