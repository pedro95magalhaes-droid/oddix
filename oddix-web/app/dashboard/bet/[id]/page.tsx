'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../services/api';

function logoFallback(name: string, bg = '111827', color = 'ffffff') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Time')}&background=${bg}&color=${color}&bold=true`;
}

function cleanAnalysis(text: any) {
  const raw = String(text || '').trim();
  if (!raw) return 'Entrada validada pela IA Oddix com leitura de mercado, odd, risco e gestão de banca.';

  return raw
    .replace(/ODDIX_PREGAME_[A-Z_]+\s*\|\s*/g, '')
    .replace(/EDGE_IA_[+\-0-9%]+\s*\|\s*/g, '')
    .replace(/VIP_[A-Z_]+\s*\|\s*/g, '')
    .replace(/\s*\|\s*/g, '\n')
    .replace(/Fontes:[\s\S]*?Gestão:/i, 'Gestão:')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLiveStatus(status?: string) {
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(String(status || '').toUpperCase());
}

function isFinishedStatus(status?: string) {
  return ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST'].includes(String(status || '').toUpperCase());
}

function getScore(game: any, bet: any) {
  const home = game?.goals?.home ?? game?.score?.fulltime?.home ?? bet?.homeScore ?? null;
  const away = game?.goals?.away ?? game?.score?.fulltime?.away ?? bet?.awayScore ?? null;
  if (home === null || home === undefined || away === null || away === undefined) return 'VS';
  return `${home} - ${away}`;
}

function getGameMinute(game: any, bet: any) {
  const status = String(game?.fixture?.status?.short || bet?.statusShort || '').toUpperCase();
  const elapsed = game?.fixture?.status?.elapsed ?? bet?.elapsed;

  if (isLiveStatus(status)) return elapsed ? `${elapsed}'` : 'AO VIVO';
  if (isFinishedStatus(status)) return 'FT';

  const date = game?.fixture?.date || bet?.gameDate;
  if (!date) return 'Pré-jogo';

  return new Date(date).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatValue(stats: any, teamIndex: number, type: string) {
  const team = stats?.teams?.[teamIndex];
  const found = team?.statistics?.find((item: any) => item.type === type);
  return found?.value === null || found?.value === undefined ? '-' : found.value;
}

function statusText(status: string) {
  if (status === 'won') return '✅ Green';
  if (status === 'lost') return '❌ Red';
  return '🔥 Aberto';
}

function riskColor(risk: any) {
  const value = String(risk || '').toLowerCase();
  if (value.includes('baixo')) return '#22c55e';
  if (value.includes('alto')) return '#ef4444';
  return '#facc15';
}

function calculateEdge(confidence: any, odd: any, risk: any) {
  const c = Number(confidence || 75);
  const o = Number(odd || 1.5);
  let edge = Math.round((c - 65) * 0.55 + (o - 1.4) * 8);
  if (String(risk || '').toLowerCase().includes('baixo')) edge += 3;
  return Math.max(8, Math.min(edge, 28));
}

function metric(stats: any, type: string, label: string) {
  return {
    label,
    home: getStatValue(stats, 0, type),
    away: getStatValue(stats, 1, type),
  };
}

export default function BetAnalysis() {
  const params = useParams();
  const id = params.id as string;

  const [bet, setBet] = useState<any>(null);
  const [plan, setPlan] = useState('Free');
  const [loading, setLoading] = useState(true);
  const [liveGame, setLiveGame] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  const hasPremiumAccess = ['Pro', 'Vip', 'PRO', 'VIP', 'pro', 'vip'].includes(String(plan));

  useEffect(() => {
    async function loadData() {
      try {
        const userResponse = await api.get('/auth/me');
        setPlan(userResponse.data?.plan || 'Free');

        const betResponse = await api.get(`/bets/${id}`);
        const currentBet = betResponse.data;
        setBet(currentBet);

        if (currentBet?.fixtureId) {
          const [fixtureResponse, statsResponse] = await Promise.allSettled([
            api.get(`/football/fixture/${currentBet.fixtureId}`),
            api.get(`/football/statistics/${currentBet.fixtureId}`),
          ]);

          if (fixtureResponse.status === 'fulfilled' && fixtureResponse.value?.data?.fixture) {
            setLiveGame(fixtureResponse.value.data);
          }

          if (statsResponse.status === 'fulfilled') {
            setStats(statsResponse.value?.data || null);
          }
        }
      } catch {
        alert('Erro ao carregar análise.');
        window.location.href = '/dashboard';
      } finally {
        setLoading(false);
      }
    }

    if (id) loadData();
  }, [id]);

  const cleanText = useMemo(() => cleanAnalysis(bet?.analysis), [bet?.analysis]);

  if (loading) {
    return <main style={styles.page}><h1>Carregando análise...</h1></main>;
  }

  if (!bet) {
    return <main style={styles.page}><h1>Palpite não encontrado.</h1></main>;
  }

  const markets = Array.isArray(bet.markets) ? bet.markets : [];
  const multiples = bet.multiples || null;
  const currentGame = liveGame;
  const liveStatus = currentGame?.fixture?.status?.short || bet.statusShort;
  const showScore = getScore(currentGame, bet);
  const showMinute = getGameMinute(currentGame, bet);
  const edge = calculateEdge(bet.confidence, bet.odd, bet.risk);
  const riskHex = riskColor(bet.risk);
  const statsRows = [
    metric(stats, 'Ball Possession', 'Posse'),
    metric(stats, 'Total Shots', 'Finalizações'),
    metric(stats, 'Shots on Goal', 'Chutes no gol'),
    metric(stats, 'Corner Kicks', 'Escanteios'),
    metric(stats, 'Yellow Cards', 'Cartões'),
    metric(stats, 'Fouls', 'Faltas'),
  ];

  return (
    <main style={styles.page}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <header style={styles.header}>
        <img src="/oddix-logo.png" style={styles.logo} />
        <button style={styles.backButton} onClick={() => (window.location.href = '/dashboard')}>← Voltar ao dashboard</button>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <div style={styles.badge}>💎 ODDIX PRO AI</div>
          <div style={styles.leagueBox}>
            <img src={bet.leagueLogo || logoFallback(bet.league, 'facc15', '111827')} style={styles.leagueLogo} />
            <span>{bet.league}</span>
          </div>
          <div style={{ ...styles.statusBadge, borderColor: riskHex }}>{statusText(bet.status)}</div>
        </div>

        <div style={styles.matchStage}>
          <div style={styles.teamSide}>
            <div style={styles.logoRing}>
              <img src={bet.homeLogo || logoFallback(bet.homeTeam)} style={styles.teamLogo} />
            </div>
            <strong>{bet.homeTeam}</strong>
          </div>

          <div style={styles.centerScore}>
            <span style={styles.scoreText}>{showScore}</span>
            <small style={{ ...styles.minuteText, ...(isLiveStatus(liveStatus) ? styles.liveMinute : {}) }}>{showMinute}</small>
          </div>

          <div style={styles.teamSide}>
            <div style={styles.logoRing}>
              <img src={bet.awayLogo || logoFallback(bet.awayTeam)} style={styles.teamLogo} />
            </div>
            <strong>{bet.awayTeam}</strong>
          </div>
        </div>

        <div style={styles.entryPanel}>
          <small>ENTRADA PREMIUM</small>
          <h1>{bet.tip}</h1>
          <p>Leitura validada por IA, odd, risco e gestão de banca.</p>
        </div>
      </section>

      <section style={styles.kpiGrid}>
        <div style={styles.kpiCard}><small>ODD</small><strong>{bet.odd}</strong></div>
        <div style={styles.kpiCard}><small>CONFIANÇA</small><strong>{bet.confidence}%</strong></div>
        <div style={styles.kpiCard}><small>EDGE IA</small><strong style={{ color: '#22c55e' }}>+{edge}%</strong></div>
        <div style={styles.kpiCard}><small>RISCO</small><strong style={{ color: riskHex }}>{bet.risk || 'Médio'}</strong></div>
      </section>

      <section style={styles.contentGrid}>
        <div style={styles.cardLarge}>
          <div style={styles.sectionTitleRow}>
            <h2>📌 Leitura Oddix</h2>
            <span>FlashScore + IA</span>
          </div>
          <p style={styles.analysisText}>{cleanText}</p>
          <div style={styles.managementBox}>💵 Gestão recomendada: <strong>0.5 a 1 unidade</strong>. Sem all-in.</div>
        </div>

        <div style={styles.cardSide}>
          <h2>Resumo VIP</h2>
          <InfoLine label="Seu plano" value={plan} />
          <InfoLine label="Status" value={statusText(bet.status)} />
          <InfoLine label="Mercados IA" value={hasPremiumAccess ? String(markets.length || 1) : 'Bloqueado'} />
          <InfoLine label="Provider" value={bet.provider || 'Oddix'} />
        </div>
      </section>

      <section style={styles.statsSection}>
        <div style={styles.sectionTitleRow}>
          <div>
            <h2>📊 Estatísticas da partida</h2>
            <p>Dados reais quando a FlashScore disponibilizar.</p>
          </div>
        </div>

        {stats?.available ? (
          <div style={styles.statsTable}>
            <div style={styles.statsHeader}>
              <strong>{stats.teams?.[0]?.team?.name || bet.homeTeam}</strong>
              <span>Estatística</span>
              <strong>{stats.teams?.[1]?.team?.name || bet.awayTeam}</strong>
            </div>
            {statsRows.map((row) => (
              <div key={row.label} style={styles.statsRow}>
                <strong>{row.home}</strong>
                <span>{row.label}</span>
                <strong>{row.away}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyBox}>
            <h3>Estatísticas indisponíveis</h3>
            <p>{stats?.message || 'A API ainda não liberou estatísticas para este jogo.'}</p>
          </div>
        )}
      </section>

      {hasPremiumAccess && markets.length > 0 && (
        <section style={styles.marketsSection}>
          <div style={styles.sectionTitleRow}>
            <h2>🧠 Melhores mercados da IA</h2>
            <span>Premium</span>
          </div>
          <div style={styles.marketsGrid}>
            {markets.slice(0, 5).map((market: any, index: number) => (
              <div key={index} style={styles.marketCard}>
                <div style={styles.marketTop}><span>#{index + 1}</span><small>{market.category || 'IA'}</small></div>
                <h3>{market.market}</h3>
                <strong>{market.tip}</strong>
                <div style={styles.marketKpis}>
                  <span>Odd {market.odd}</span>
                  <span>{market.confidence}%</span>
                  <span>{market.risk}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasPremiumAccess && multiples && (
        <section style={styles.marketsSection}>
          <div style={styles.sectionTitleRow}>
            <h2>🚀 Múltiplas da IA</h2>
            <span>Gestão reduzida</span>
          </div>
          <div style={styles.marketsGrid}>
            {[multiples.conservative, multiples.moderate, multiples.aggressive].filter(Boolean).map((multiple: any, index: number) => (
              <div key={index} style={styles.marketCard}>
                <div style={styles.marketTop}><span>{multiple.name}</span><small>{multiple.risk}</small></div>
                <h3>Odd {multiple.combinedOdd}</h3>
                <p>{multiple.selections?.map((s: any) => s.tip).join(' + ')}</p>
                <div style={styles.marketKpis}><span>{multiple.stake}</span></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div style={styles.infoLine}><span>{label}</span><strong>{value}</strong></div>;
}

const styles: Record<string, any> = {
  page: {
    minHeight: '100vh',
    color: '#fff',
    padding: '28px',
    fontFamily: 'Arial, sans-serif',
    background: 'radial-gradient(circle at 20% 0%, rgba(250,204,21,.22), transparent 28%), radial-gradient(circle at 90% 18%, rgba(124,58,237,.30), transparent 32%), linear-gradient(135deg, #030006 0%, #08010f 38%, #12051f 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlowOne: { position: 'fixed', left: -120, top: 120, width: 320, height: 320, background: 'rgba(250,204,21,.16)', filter: 'blur(80px)', borderRadius: '999px', pointerEvents: 'none' },
  bgGlowTwo: { position: 'fixed', right: -100, bottom: 80, width: 360, height: 360, background: 'rgba(34,197,94,.13)', filter: 'blur(90px)', borderRadius: '999px', pointerEvents: 'none' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, position: 'relative', zIndex: 2 },
  logo: { width: 210, height: 78, objectFit: 'contain', filter: 'drop-shadow(0 0 22px rgba(250,204,21,.25))' },
  backButton: { background: 'rgba(0,0,0,.55)', color: '#fff', border: '1px solid rgba(250,204,21,.42)', padding: '12px 17px', borderRadius: 999, fontWeight: 900, cursor: 'pointer' },
  hero: { position: 'relative', zIndex: 1, borderRadius: 34, padding: 28, border: '1px solid rgba(250,204,21,.38)', background: 'linear-gradient(135deg, rgba(0,0,0,.72), rgba(15,15,25,.58)), url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2200&q=90")', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 24px 80px rgba(0,0,0,.55)' },
  heroTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 26 },
  badge: { color: '#facc15', fontWeight: 1000, fontSize: 22, letterSpacing: 1.5 },
  leagueBox: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, color: '#e9d5ff' },
  leagueLogo: { width: 36, height: 36, objectFit: 'contain' },
  statusBadge: { border: '1px solid #facc15', background: 'rgba(0,0,0,.58)', padding: '10px 14px', borderRadius: 999, fontWeight: 900 },
  matchStage: { display: 'grid', gridTemplateColumns: '1fr 170px 1fr', alignItems: 'center', gap: 18 },
  teamSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, fontSize: 26, textAlign: 'center', textShadow: '0 4px 12px #000' },
  logoRing: { width: 166, height: 166, borderRadius: 36, border: '2px solid rgba(250,204,21,.42)', background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', boxShadow: '0 0 34px rgba(250,204,21,.16)' },
  teamLogo: { width: 128, height: 128, objectFit: 'contain', filter: 'drop-shadow(0 0 14px rgba(255,255,255,.15))' },
  centerScore: { textAlign: 'center' },
  scoreText: { display: 'block', background: '#020617', color: '#fff', border: '1px solid rgba(34,197,94,.55)', borderRadius: 22, padding: '17px 20px', fontSize: 30, fontWeight: 1000 },
  minuteText: { display: 'inline-block', marginTop: 10, color: '#facc15', fontWeight: 900 },
  liveMinute: { color: '#ef4444' },
  entryPanel: { maxWidth: 780, margin: '28px auto 0', textAlign: 'center', borderRadius: 30, padding: '24px 28px', background: 'rgba(0,0,0,.66)', border: '1px solid rgba(250,204,21,.34)', boxShadow: '0 18px 50px rgba(0,0,0,.42)' },
  entryPanelSmall: {},
  entryPanel: { maxWidth: 820, margin: '28px auto 0', textAlign: 'center', borderRadius: 30, padding: '24px 28px', background: 'rgba(0,0,0,.66)', border: '1px solid rgba(250,204,21,.34)', boxShadow: '0 18px 50px rgba(0,0,0,.42)' },
  entryPanel: undefined,
};

styles.entryPanel = { maxWidth: 820, margin: '28px auto 0', textAlign: 'center', borderRadius: 30, padding: '24px 28px', background: 'rgba(0,0,0,.66)', border: '1px solid rgba(250,204,21,.34)', boxShadow: '0 18px 50px rgba(0,0,0,.42)' };
Object.assign(styles, {
  entryPanel: styles.entryPanel,
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '18px 0', position: 'relative', zIndex: 2 },
  kpiCard: { background: 'rgba(0,0,0,.72)', border: '1px solid rgba(250,204,21,.30)', borderRadius: 24, padding: 20, boxShadow: '0 16px 45px rgba(0,0,0,.32)' },
  contentGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18, position: 'relative', zIndex: 2 },
  cardLarge: { background: 'rgba(0,0,0,.72)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 26, padding: 24 },
  cardSide: { background: 'rgba(0,0,0,.72)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 26, padding: 24 },
  sectionTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 15 },
  analysisText: { whiteSpace: 'pre-line', lineHeight: 1.65, color: '#f8fafc', fontWeight: 700 },
  managementBox: { marginTop: 16, padding: 16, borderRadius: 18, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.28)' },
  infoLine: { display: 'flex', justifyContent: 'space-between', gap: 15, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.08)' },
  statsSection: { background: 'rgba(0,0,0,.72)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 26, padding: 24, marginBottom: 18, position: 'relative', zIndex: 2 },
  statsTable: { display: 'grid', gap: 8 },
  statsHeader: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', padding: 14, borderRadius: 16, background: 'linear-gradient(90deg, rgba(34,197,94,.26), rgba(250,204,21,.18))' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.06)' },
  emptyBox: { padding: 24, borderRadius: 18, background: 'rgba(255,255,255,.06)', color: '#cbd5e1' },
  marketsSection: { background: 'rgba(0,0,0,.72)', border: '1px solid rgba(250,204,21,.22)', borderRadius: 26, padding: 24, marginBottom: 18, position: 'relative', zIndex: 2 },
  marketsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 },
  marketCard: { borderRadius: 20, padding: 18, background: 'linear-gradient(135deg, rgba(17,24,39,.94), rgba(45,13,86,.84))', border: '1px solid rgba(250,204,21,.18)' },
  marketTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#facc15', fontWeight: 900, marginBottom: 10 },
  marketKpis: { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12, color: '#e9d5ff', fontWeight: 800 },
});
