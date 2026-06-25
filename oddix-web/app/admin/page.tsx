'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type AdminUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  plan?: string | null;
  accessAllowed?: boolean;
  createdAt?: string | null;
};

type AdminPayload = {
  actor?: AdminUser;
  totalUsers?: number;
  premiumUsers?: number;
  blockedUsers?: number;
  planCounts?: Record<string, number>;
  users?: AdminUser[];
};

const plans = ['Free', 'VIP', 'PRO', 'Premium', 'Admin'];

function getStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  const keys = ['oddix_auth_token', 'oddix_token', 'access_token', 'token', 'auth_token', 'authToken', 'jwt'];
  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return '';
}

function planStyle(plan?: string | null) {
  const normalized = String(plan || 'Free').toLowerCase();
  if (normalized === 'admin') return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300';
  if (normalized === 'pro') return 'border-violet-300/20 bg-violet-400/10 text-violet-300';
  if (normalized === 'vip') return 'border-sky-300/20 bg-sky-400/10 text-sky-300';
  if (normalized === 'premium') return 'border-amber-300/20 bg-amber-400/10 text-amber-200';
  return 'border-rose-300/20 bg-rose-400/10 text-rose-300';
}

export default function OddixAdminPage() {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState('');
  const [error, setError] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_ODDIX_API_URL;
  const cleanApiBase = apiBase?.replace(/\/$/, '') ?? '';
  const users = payload?.users || [];

  useEffect(() => {
    const stored = getStoredAuthToken();
    setToken(stored);
    if (stored) void loadAdmin(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAdmin(authToken = token) {
    if (!cleanApiBase) {
      setError('NEXT_PUBLIC_ODDIX_API_URL não está configurada.');
      return;
    }

    if (!authToken) {
      setError('Faça login no dashboard antes de acessar o painel admin.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${cleanApiBase}/auth/admin/dashboard`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || `Falha ao carregar admin (${response.status})`);
      setPayload(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o painel administrativo.');
    } finally {
      setLoading(false);
    }
  }

  async function updateUserPlan(userId: string, plan: string) {
    if (!cleanApiBase || !token) return;

    setSavingUserId(userId);
    setError('');

    try {
      const response = await fetch(`${cleanApiBase}/auth/admin/user-plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, plan }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || `Falha ao alterar plano (${response.status})`);
      await loadAdmin(token);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível alterar o plano do usuário.');
    } finally {
      setSavingUserId('');
    }
  }

  return (
    <main className="min-h-screen bg-[#05060a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.12),transparent_22%),radial-gradient(circle_at_top_right,rgba(245,158,11,.10),transparent_24%),linear-gradient(180deg,#05060a,#030408)]" />

      <section className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-white/8 bg-[rgba(10,12,19,.84)] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-emerald-300/16 bg-white/[0.03]">
                <Image src="/images/oddix-logo-icon.png" alt="Oddix" width={42} height={42} className="h-9 w-9 object-contain" priority />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-emerald-300">Oddix Admin</p>
                <p className="mt-1 text-sm text-white/50">Painel administrativo separado do painel do usuário</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => loadAdmin()} disabled={loading || !token} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/65 transition hover:bg-white/[0.06] disabled:opacity-50">
                Atualizar
              </button>
              <a href="/dashboard" className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-400/14">
                Dashboard usuário
              </a>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-[32px] border border-white/8 bg-[rgba(10,12,19,.84)] p-6 shadow-[0_30px_100px_rgba(0,0,0,.30)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-400/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                V23.6 Admin Center
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl xl:text-[44px]">
                Gestão de usuários, planos e acesso premium.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                Esta área é separada do painel do usuário. Apenas contas Admin conseguem carregar a lista de usuários e alterar planos.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              {[
                ['Usuários', payload?.totalUsers || 0],
                ['Premium', payload?.premiumUsers || 0],
                ['Bloqueados', payload?.blockedUsers || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[22px] border border-white/8 bg-black/18 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && <p className="mt-5 rounded-2xl border border-rose-300/14 bg-rose-400/8 p-4 text-sm leading-6 text-rose-200">{error}</p>}

        <section className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">Planos</p>
            <h2 className="mt-2 text-2xl font-semibold">Distribuição real</h2>
            <div className="mt-5 space-y-3">
              {plans.map((plan) => (
                <div key={plan} className="rounded-2xl border border-white/8 bg-black/18 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${planStyle(plan)}`}>{plan}</span>
                    <span className="text-lg font-semibold text-white">{payload?.planCounts?.[plan] || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/8 bg-[rgba(10,12,19,.84)] p-5">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">Usuários</p>
                <h2 className="mt-2 text-2xl font-semibold">Controle de acesso</h2>
              </div>
            </div>

            {!users.length ? (
              <div className="rounded-[26px] border border-dashed border-white/12 bg-white/[0.025] p-7 text-center">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">Sem usuários carregados</p>
                <p className="mt-3 text-sm leading-7 text-white/55">Faça login como Admin e clique em atualizar.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-white/8">
                <div className="grid grid-cols-[1.2fr_.7fr_.8fr] gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                  <span>Conta</span>
                  <span>Plano</span>
                  <span>Ação</span>
                </div>
                <div className="divide-y divide-white/8">
                  {users.map((user) => (
                    <div key={user.id} className="grid grid-cols-[1.2fr_.7fr_.8fr] gap-3 px-4 py-4 text-sm">
                      <div>
                        <p className="font-semibold text-white">{user.name || 'Usuário Oddix'}</p>
                        <p className="mt-1 text-white/45">{user.email}</p>
                      </div>
                      <div className="flex items-center">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${planStyle(user.plan)}`}>{user.plan || 'Free'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={user.plan || 'Free'}
                          disabled={savingUserId === user.id}
                          onChange={(event) => updateUserPlan(user.id, event.target.value)}
                          className="h-10 w-full rounded-2xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-emerald-300/35"
                        >
                          {plans.map((plan) => <option key={plan} value={plan} className="bg-black text-white">{plan}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
