'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

function logoFallback(name: string, bg = '111827', color = 'ffffff') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'Time',
  )}&background=${bg}&color=${color}&bold=true`;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
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

  async function loadFavorites() {
    try {
      const response = await api.get('/favorite');
      setFavorites(response.data);
    } catch {
      alert('Erro ao carregar favoritos.');
    } finally {
      setLoading(false);
    }
  }

  async function removeFavorite(betId: string) {
    try {
      await api.delete(`/favorite/${betId}`);
      loadFavorites();
    } catch {
      alert('Erro ao remover favorito.');
    }
  }

  async function openAnalysis(betId: string) {
    try {
      await api.post(`/history/${betId}`);
    } catch {}

    window.location.href = `/dashboard/bet/${betId}`;
  }

  useEffect(() => {
    loadUser();
    loadFavorites();
  }, []);

  if (loading) {
    return (
      <main style={styles.page}>
        <h1>Carregando favoritos...</h1>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <img src="/oddix-logo.png" style={styles.logo} />

        <button style={styles.backButton} onClick={() => (window.location.href = '/dashboard')}>
          Voltar ao dashboard
        </button>
      </header>

      <section style={styles.hero}>
        <h1 style={styles.title}>Meus Favoritos</h1>
        <p style={styles.subtitle}>Palpites que você salvou para acompanhar depois.</p>
        <span style={styles.planBadge}>Plano: {plan}</span>
      </section>

      {favorites.length === 0 ? (
        <div style={styles.emptyBox}>
          <h2>Nenhum favorito ainda.</h2>
          <p>Volte ao dashboard e marque seus palpites favoritos.</p>
        </div>
      ) : (
        <section style={styles.grid}>
          {favorites.map((fav) => {
            const bet = fav.bet || fav;
            const markets = Array.isArray(bet.markets) ? bet.markets : [];

            return (
              <div key={fav.id || bet.id} style={styles.card}>
                <div style={styles.cardHead}>
                  <div style={styles.league}>
                    <img
                      src={bet.leagueLogo || logoFallback(bet.league, '22c55e', '000000')}
                      style={styles.leagueLogo}
                    />
                    <span>{bet.league}</span>
                  </div>

                  <span style={styles.favoriteBadge}>⭐ Favorito</span>
                </div>

                <div style={styles.scoreboard}>
                  <div style={styles.team}>
                    <img
                      src={bet.homeLogo || logoFallback(bet.homeTeam)}
                      style={styles.teamLogo}
                    />
                    <strong>{bet.homeTeam}</strong>
                  </div>

                  <div style={styles.centerVs}>
                    <span>VS</span>
                    <small>IA</small>
                  </div>

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
                  <button style={styles.removeButton} onClick={() => removeFavorite(bet.id)}>
                    Remover
                  </button>

                  <button style={styles.analysisButton} onClick={() => openAnalysis(bet.id)}>
                    Ver análise
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
    background: '#050505',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },

  logo: {
    width: '240px',
    height: '100px',
    objectFit: 'contain' as const,
  },

  backButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    padding: '12px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  hero: {
    background: 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(250,204,21,.12))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '26px',
    padding: '26px',
    marginBottom: '22px',
  },

  title: {
    fontSize: '38px',
    margin: 0,
  },

  subtitle: {
    color: '#c4c4c4',
  },

  planBadge: {
    display: 'inline-block',
    background: 'rgba(34,197,94,.15)',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,.4)',
    padding: '9px 13px',
    borderRadius: '999px',
    fontWeight: 'bold',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '18px',
  },

  card: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '24px',
    padding: '18px',
  },

  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },

  league: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#22c55e',
    fontWeight: 'bold',
  },

  leagueLogo: {
    width: '30px',
    height: '30px',
    objectFit: 'contain' as const,
  },

  favoriteBadge: {
    background: 'rgba(250,204,21,.14)',
    color: '#facc15',
    border: '1px solid rgba(250,204,21,.35)',
    padding: '7px 10px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  scoreboard: {
    display: 'grid',
    gridTemplateColumns: '1fr 48px 1fr',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
  },

  team: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
  },

  teamLogo: {
    width: '60px',
    height: '60px',
    objectFit: 'contain' as const,
  },

  centerVs: {
    background: '#111827',
    border: '1px solid rgba(34,197,94,.4)',
    color: '#22c55e',
    borderRadius: '999px',
    padding: '8px 0',
    textAlign: 'center' as const,
    fontWeight: 'bold',
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: '12px',
  },

  pickBox: {
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '16px',
    padding: '13px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
    marginBottom: '12px',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: '8px',
    marginBottom: '12px',
  },

  infoItem: {
    background: 'rgba(255,255,255,.06)',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
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

  removeButton: {
    flex: 1,
    background: '#ef4444',
    color: '#fff',
    border: 0,
    padding: '12px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  analysisButton: {
    flex: 1,
    background: '#22c55e',
    color: '#000',
    border: 0,
    padding: '12px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  emptyBox: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '20px',
    padding: '24px',
    color: '#d4d4d8',
  },
};