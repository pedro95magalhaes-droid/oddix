'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

function logoFallback(name: string, bg = '111827', color = 'ffffff') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'Time',
  )}&background=${bg}&color=${color}&bold=true`;
}

export default function HistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [plan, setPlan] = useState('Free');
  const [loading, setLoading] = useState(true);

  const hasPremiumAccess = plan === 'Pro' || plan === 'Vip';

  async function loadUser() {
    try {
      const response = await api.get('/auth/me');
      setPlan(response.data.plan || 'Free');
    } catch {
      setPlan('Free');
    }
  }

  async function loadHistory() {
    try {
      const response = await api.get('/history');
      setItems(response.data);
    } catch {
      alert('Erro ao carregar histórico.');
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  }

  async function removeHistory(betId: string) {
    if (!confirm('Remover este palpite do histórico?')) return;

    try {
      await api.delete(`/history/${betId}`);
      loadHistory();
    } catch {
      alert('Erro ao remover do histórico.');
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      window.location.href = '/';
      return;
    }

    loadUser();
    loadHistory();
  }, []);

  if (loading) {
    return (
      <main style={styles.page}>
        <h1>Carregando histórico...</h1>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <img src="/oddix-logo.png" style={styles.logo} />

        <button style={styles.backButton} onClick={() => (window.location.href = '/dashboard')}>
          ← Voltar ao dashboard
        </button>
      </header>

      <section style={styles.hero}>
        <span style={styles.badge}>📚 HISTÓRICO</span>
        <h1 style={styles.title}>Palpites que você abriu</h1>
        <p style={styles.subtitle}>Plano atual: {plan}</p>
      </section>

      {items.length === 0 ? (
        <section style={styles.emptyBox}>
          <h2>Nenhum histórico ainda</h2>
          <p>Volte ao dashboard e clique em Ver análise.</p>

          <button style={styles.greenButton} onClick={() => (window.location.href = '/dashboard')}>
            Ir para o dashboard
          </button>
        </section>
      ) : (
        <section style={styles.grid}>
          {items.map((item) => {
            const bet = item.bet;
            const markets = Array.isArray(bet.markets) ? bet.markets : [];

            return (
              <div key={item.id} style={styles.card}>
                <div style={styles.cardHead}>
                  <div style={styles.leagueBox}>
                    <img
                      src={bet.leagueLogo || logoFallback(bet.league, '22c55e', '000000')}
                      style={styles.leagueLogo}
                    />
                    <span>{bet.league}</span>
                  </div>

                  <span
                    style={{
                      ...styles.statusBadge,
                      ...(bet.status === 'won'
                        ? styles.statusWon
                        : bet.status === 'lost'
                        ? styles.statusLost
                        : styles.statusOpen),
                    }}
                  >
                    {bet.status === 'won'
                      ? '✅ Ganhou'
                      : bet.status === 'lost'
                      ? '❌ Perdeu'
                      : '🔥 Aberto'}
                  </span>
                </div>

                <div style={styles.teams}>
                  <div style={styles.team}>
                    <img
                      src={bet.homeLogo || logoFallback(bet.homeTeam)}
                      style={styles.teamLogo}
                    />
                    <strong>{bet.homeTeam}</strong>
                  </div>

                  <div style={styles.vs}>VS</div>

                  <div style={styles.team}>
                    <img
                      src={bet.awayLogo || logoFallback(bet.awayTeam)}
                      style={styles.teamLogo}
                    />
                    <strong>{bet.awayTeam}</strong>
                  </div>
                </div>

                <div style={styles.pickBox}>
                  <small>Entrada recomendada</small>
                  <strong>{bet.tip}</strong>
                </div>

                <div style={styles.infoGrid}>
                  <div style={styles.infoItem}>
                    <small>Odd</small>
                    <strong>{bet.odd}</strong>
                  </div>

                  <div style={styles.infoItem}>
                    <small>Confiança</small>
                    <strong>{bet.confidence}%</strong>
                  </div>

                  <div style={styles.infoItem}>
                    <small>Status</small>
                    <strong>{statusText(bet.status)}</strong>
                  </div>
                </div>

                {hasPremiumAccess && markets.length > 0 ? (
                  <div style={styles.marketsMiniBox}>
                    <strong style={styles.marketsMiniTitle}>5 mercados IA</strong>

                    {markets.slice(0, 5).map((market: any, index: number) => (
                      <div key={index} style={styles.marketMiniRow}>
                        <div style={styles.marketLeft}>
                          <strong style={styles.marketName}>{market.market}</strong>
                          <span style={styles.marketTip}>{market.tip}</span>
                        </div>

                        <div style={styles.marketRight}>
                          <span style={styles.marketOdd}>Odd {market.odd || '-'}</span>
                          <span style={styles.marketConfidence}>
                            {market.confidence || 0}%
                          </span>
                          <span
                            style={{
                              ...styles.marketRisk,
                              ...(market.risk === 'Alto'
                                ? styles.riskHigh
                                : market.risk === 'Médio'
                                ? styles.riskMedium
                                : styles.riskLow),
                            }}
                          >
                            {market.risk || 'Baixo'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.marketsLockedBox}>
                    🔒 5 mercados disponíveis no Pro/Vip
                  </div>
                )}

                <div style={styles.actions}>
                  <button
                    style={styles.greenButton}
                    onClick={() => (window.location.href = `/dashboard/bet/${bet.id}`)}
                  >
                    Abrir análise
                  </button>

                  <button style={styles.removeButton} onClick={() => removeHistory(bet.id)}>
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}

function statusText(status: string) {
  if (status === 'won') return 'Ganhou';
  if (status === 'lost') return 'Perdeu';
  return 'Aberto';
}

const styles = {
  page: {
    minHeight: '100vh',
    color: '#fff',
    padding: '30px',
    fontFamily: 'Arial, sans-serif',
    backgroundImage:
      'linear-gradient(rgba(0,0,0,.82), rgba(0,0,0,.96)), url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2200&q=90")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },

  logo: {
    width: '260px',
    height: '110px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 22px rgba(0,0,0,.95))',
  },

  backButton: {
    background: 'rgba(0,0,0,.45)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.2)',
    padding: '13px 18px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  hero: {
    background: 'rgba(0,0,0,.65)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '28px',
    padding: '30px',
    marginBottom: '22px',
  },

  badge: {
    display: 'inline-block',
    background: '#38bdf8',
    color: '#000',
    padding: '8px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  title: {
    fontSize: '42px',
    margin: '14px 0 8px',
  },

  subtitle: {
    color: '#d4d4d8',
    fontSize: '16px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '18px',
  },

  card: {
    background: 'rgba(10,10,13,.9)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '24px',
    padding: '20px',
    boxShadow: '0 20px 45px rgba(0,0,0,.45)',
  },

  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },

  leagueBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#22c55e',
    fontWeight: 'bold',
  },

  leagueLogo: {
    width: '32px',
    height: '32px',
    objectFit: 'contain' as const,
  },

  statusBadge: {
    padding: '6px 10px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  statusOpen: {
    background: '#f97316',
    color: '#000',
  },

  statusWon: {
    background: '#22c55e',
    color: '#000',
  },

  statusLost: {
    background: '#ef4444',
    color: '#fff',
  },

  teams: {
    display: 'grid',
    gridTemplateColumns: '1fr 50px 1fr',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },

  team: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
  },

  teamLogo: {
    width: '64px',
    height: '64px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 14px rgba(255,255,255,.16))',
  },

  vs: {
    textAlign: 'center' as const,
    color: '#22c55e',
    fontWeight: 'bold',
    border: '1px solid rgba(34,197,94,.4)',
    borderRadius: '999px',
    padding: '8px 0',
  },

  pickBox: {
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '16px',
    padding: '13px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
    marginBottom: '14px',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: '8px',
    marginBottom: '16px',
  },

  infoItem: {
    background: 'rgba(255,255,255,.06)',
    borderRadius: '13px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },

  marketsMiniBox: {
    background: 'rgba(0,0,0,.38)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '18px',
    padding: '13px',
    marginBottom: '12px',
  },

  marketsMiniTitle: {
    display: 'block',
    color: '#22c55e',
    marginBottom: '10px',
    fontSize: '14px',
  },

  marketMiniRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '10px',
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: '13px',
    padding: '10px',
    marginBottom: '8px',
  },

  marketLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },

  marketName: {
    color: '#fff',
    fontSize: '13px',
  },

  marketTip: {
    color: '#c4c4c4',
    fontSize: '12px',
    lineHeight: '1.35',
  },

  marketRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '5px',
    minWidth: '78px',
  },

  marketOdd: {
    color: '#facc15',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  marketConfidence: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  marketRisk: {
    padding: '4px 7px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '11px',
  },

  riskLow: {
    background: 'rgba(34,197,94,.18)',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,.35)',
  },

  riskMedium: {
    background: 'rgba(250,204,21,.16)',
    color: '#facc15',
    border: '1px solid rgba(250,204,21,.35)',
  },

  riskHigh: {
    background: 'rgba(239,68,68,.16)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,.35)',
  },

  marketsLockedBox: {
    background: 'rgba(250,204,21,.12)',
    border: '1px solid rgba(250,204,21,.35)',
    color: '#facc15',
    borderRadius: '14px',
    padding: '11px',
    fontWeight: 'bold',
    marginBottom: '12px',
    textAlign: 'center' as const,
  },

  actions: {
    display: 'flex',
    gap: '10px',
  },

  greenButton: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    border: 0,
    padding: '12px 16px',
    borderRadius: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  removeButton: {
    background: 'rgba(239,68,68,.15)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,.4)',
    padding: '12px 16px',
    borderRadius: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  emptyBox: {
    maxWidth: '720px',
    margin: '70px auto',
    background: 'rgba(0,0,0,.68)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '28px',
    padding: '34px',
    textAlign: 'center' as const,
  },
};