'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../services/api';

function logoFallback(name: string, bg = '111827', color = 'ffffff') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'Time',
  )}&background=${bg}&color=${color}&bold=true`;
}


function isLiveStatus(status?: string) {
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(String(status || '').toUpperCase());
}

function isFinishedStatus(status?: string) {
  return ['FT', 'AET', 'PEN'].includes(String(status || '').toUpperCase());
}

function getScore(game: any, bet: any) {
  const home =
    game?.goals?.home ??
    game?.score?.fulltime?.home ??
    bet?.homeScore ??
    null;

  const away =
    game?.goals?.away ??
    game?.score?.fulltime?.away ??
    bet?.awayScore ??
    null;

  if (home === null || home === undefined || away === null || away === undefined) {
    return 'VS';
  }

  return `${home} - ${away}`;
}

function getGameMinute(game: any) {
  const status = String(game?.fixture?.status?.short || '').toUpperCase();
  const elapsed = game?.fixture?.status?.elapsed;

  if (isLiveStatus(status)) {
    return elapsed ? `${elapsed}'` : 'AO VIVO';
  }

  if (isFinishedStatus(status)) return 'FT';

  const date = game?.fixture?.date;
  if (!date) return 'Aguardando';

  return new Date(date).toLocaleString('pt-BR', {
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
  if (status === 'won') return '✅ Ganhou';
  if (status === 'lost') return '❌ Perdeu';
  return '🔥 Aberto';
}

export default function BetAnalysis() {
  const params = useParams();
  const id = params.id as string;

  const [bet, setBet] = useState<any>(null);
  const [plan, setPlan] = useState('Free');
  const [loading, setLoading] = useState(true);
  const [liveGame, setLiveGame] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  const hasPremiumAccess = plan === 'Pro' || plan === 'Vip';

  useEffect(() => {
    async function loadData() {
      try {
        const userResponse = await api.get('/auth/me');
        setPlan(userResponse.data.plan || 'Free');

        const betResponse = await api.get(`/bets/${id}`);
        const currentBet = betResponse.data;
        setBet(currentBet);

        if (currentBet?.fixtureId) {
          const [fixtureResponse, statsResponse] = await Promise.allSettled([
            api.get(`/football/fixture/${currentBet.fixtureId}`),
            api.get(`/football/statistics/${currentBet.fixtureId}`),
          ]);

          if (
            fixtureResponse.status === 'fulfilled' &&
            fixtureResponse.value?.data?.fixture
          ) {
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

  if (loading) {
    return (
      <main style={styles.page}>
        <h1>Carregando análise...</h1>
      </main>
    );
  }

  if (!bet) {
    return (
      <main style={styles.page}>
        <h1>Palpite não encontrado.</h1>
      </main>
    );
  }

  const markets = Array.isArray(bet.markets) ? bet.markets : [];
  const multiples = bet.multiples || null;
  const currentGame = liveGame;
  const liveStatus = currentGame?.fixture?.status?.short;
  const showScore = getScore(currentGame, bet);
  const showMinute = getGameMinute(currentGame);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <img src="/oddix-logo.png" style={styles.logo} />

        <button style={styles.backButton} onClick={() => (window.location.href = '/dashboard')}>
          ← Voltar ao dashboard
        </button>
      </header>

      <section style={styles.hero}>
        <div style={styles.leagueBox}>
          <img
            src={bet.leagueLogo || logoFallback(bet.league, '22c55e', '000000')}
            style={styles.leagueLogo}
          />
          <span>{bet.league}</span>
        </div>

        <div style={styles.teams}>
          <div style={styles.team}>
            <img src={bet.homeLogo || logoFallback(bet.homeTeam)} style={styles.teamLogo} />
            <strong>{bet.homeTeam}</strong>
          </div>

          <div style={styles.scoreBox}>
            <span style={styles.scoreText}>{showScore}</span>
            <small
              style={{
                ...styles.minuteText,
                ...(isLiveStatus(liveStatus) ? styles.liveMinute : {}),
              }}
            >
              {showMinute}
            </small>
          </div>

          <div style={styles.team}>
            <img src={bet.awayLogo || logoFallback(bet.awayTeam)} style={styles.teamLogo} />
            <strong>{bet.awayTeam}</strong>
          </div>
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
          {statusText(bet.status)}
        </span>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2>Melhor entrada</h2>

          <strong style={styles.tip}>{bet.tip}</strong>

          <div style={styles.infoLine}>
            <span>Odd</span>
            <strong>{bet.odd}</strong>
          </div>

          <div style={styles.infoLine}>
            <span>Confiança IA</span>
            <strong>{bet.confidence}%</strong>
          </div>

          <div style={styles.infoLine}>
            <span>Risco</span>
            <strong>{bet.risk || 'Médio'}</strong>
          </div>

          <div style={styles.bar}>
            <div
              style={{
                ...styles.barFill,
                width: `${bet.confidence}%`,
              }}
            />
          </div>
        </div>

        <div style={styles.card}>
          <h2>Leitura da IA</h2>

          <p style={styles.text}>
            {bet.analysis ||
              `A IA Oddix identificou valor no confronto entre ${bet.homeTeam} e ${bet.awayTeam}. A entrada recomendada é ${bet.tip}, considerando tendência de mercado, odd, confiança e cenário do jogo.`}
          </p>

          <p style={styles.text}>
            Use gestão de banca e evite exposição alta em entradas únicas.
          </p>
        </div>

        <div style={styles.card}>
          <h2>Resumo</h2>

          <div style={styles.infoLine}>
            <span>Seu plano</span>
            <strong>{plan}</strong>
          </div>

          <div style={styles.infoLine}>
            <span>Status</span>
            <strong>{statusText(bet.status)}</strong>
          </div>

          <div style={styles.infoLine}>
            <span>Mercados IA</span>
            <strong>{hasPremiumAccess ? markets.length || 1 : 'Bloqueado'}</strong>
          </div>
        </div>
      </section>

      <section style={styles.statsSection}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Estatísticas da partida</h2>
            <p style={styles.sectionSubtitle}>
              Placar, tempo e números do jogo quando a API disponibilizar.
            </p>
          </div>
        </div>

        {stats?.available ? (
          <div style={styles.statsTable}>
            <div style={styles.statsRowHead}>
              <strong>{stats.teams?.[0]?.team?.name || bet.homeTeam}</strong>
              <span>Estatística</span>
              <strong>{stats.teams?.[1]?.team?.name || bet.awayTeam}</strong>
            </div>

            {[
              ['Ball Possession', 'Posse'],
              ['Total Shots', 'Chutes'],
              ['Shots on Goal', 'No gol'],
              ['Corner Kicks', 'Escanteios'],
              ['Yellow Cards', 'Cartões'],
              ['Fouls', 'Faltas'],
              ['Offsides', 'Impedimentos'],
            ].map(([type, label]) => (
              <div key={type} style={styles.statsRow}>
                <strong>{getStatValue(stats, 0, type)}</strong>
                <span>{label}</span>
                <strong>{getStatValue(stats, 1, type)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyMarkets}>
            <h3>Estatísticas indisponíveis</h3>
            <p>
              {stats?.message ||
                'A API ainda não liberou estatísticas para este jogo ou o limite diário foi atingido.'}
            </p>
          </div>
        )}
      </section>

      {hasPremiumAccess && multiples && (
        <section style={styles.multiplesSection}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Apostas múltiplas da IA</h2>
              <p style={styles.sectionSubtitle}>
                Estratégias conservadora, moderada e agressiva para este jogo.
              </p>
            </div>
          </div>

          <div style={styles.multiplesGrid}>
            {[
              multiples.conservative,
              multiples.moderate,
              multiples.aggressive,
            ]
              .filter(Boolean)
              .map((multiple: any, index: number) => (
                <div key={index} style={styles.multipleCard}>
                  <div style={styles.multipleHeader}>
                    <strong>{multiple.name}</strong>
                    <span
                      style={{
                        ...styles.multipleRisk,
                        ...(multiple.risk === 'Baixo'
                          ? styles.riskLow
                          : multiple.risk === 'Médio'
                          ? styles.riskMedium
                          : styles.riskHigh),
                      }}
                    >
                      {multiple.risk}
                    </span>
                  </div>

                  <div style={styles.multipleOddBox}>
                    <small>Odd combinada</small>
                    <strong>{multiple.combinedOdd}</strong>
                  </div>

                  <div style={styles.multipleSelections}>
                    {multiple.selections?.map((selection: any, itemIndex: number) => (
                      <div key={itemIndex} style={styles.multipleSelection}>
                        <small>{selection.market}</small>
                        <strong>{selection.tip}</strong>
                        <span>
                          Odd {selection.odd} • {selection.confidence}% • {selection.risk}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p style={styles.multipleNote}>{multiple.note}</p>

                  <div style={styles.multipleStake}>
                    <small>Stake recomendada</small>
                    <strong>{multiple.stake}</strong>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      <section style={styles.marketsSection}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>5 melhores mercados da IA</h2>
            <p style={styles.sectionSubtitle}>
              Disponível para usuários Pro e Vip.
            </p>
          </div>
        </div>

        {hasPremiumAccess ? (
          markets.length > 0 ? (
            <div style={styles.marketsGrid}>
              {markets.map((market: any, index: number) => (
                <div key={index} style={styles.marketCard}>
                  <div style={styles.marketTop}>
                    <span style={styles.marketNumber}>#{index + 1}</span>
                    <span style={styles.marketCategory}>{market.category}</span>
                  </div>

                  <h3 style={styles.marketTitle}>{market.market}</h3>

                  <div style={styles.marketTipBox}>
                    <small>Palpite</small>
                    <strong>{market.tip}</strong>
                  </div>

                  <div style={styles.marketStats}>
                    <div style={styles.marketStat}>
                      <small>Odd</small>
                      <strong>{market.odd}</strong>
                    </div>

                    <div style={styles.marketStat}>
                      <small>Confiança</small>
                      <strong>{market.confidence}%</strong>
                    </div>

                    <div style={styles.marketStat}>
                      <small>Risco</small>
                      <strong>{market.risk}</strong>
                    </div>
                  </div>

                  <div style={styles.marketBar}>
                    <div
                      style={{
                        ...styles.marketBarFill,
                        width: `${market.confidence}%`,
                      }}
                    />
                  </div>

                  <p style={styles.marketReason}>{market.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyMarkets}>
              <h3>Este palpite ainda não tem 5 mercados salvos.</h3>
              <p>Volte no admin, clique em 🤖 Gerar IA e depois em Criar/Salvar palpite.</p>
            </div>
          )
        ) : (
          <div style={styles.lockedBox}>
            <div style={styles.lockIcon}>🔒</div>

            <h3>5 mercados bloqueados no plano Free</h3>

            <p>
              No plano Free você vê apenas a entrada principal. Faça upgrade para Pro ou Vip
              para liberar escanteios, cartões, chutes, gols, jogadores e mercados avançados.
            </p>

            <div style={styles.lockedPreview}>
              <div style={styles.fakeMarket}>
                <strong>Mercado 1</strong>
                <span>Conteúdo exclusivo Pro/Vip</span>
              </div>

              <div style={styles.fakeMarket}>
                <strong>Mercado 2</strong>
                <span>Conteúdo exclusivo Pro/Vip</span>
              </div>

              <div style={styles.fakeMarket}>
                <strong>Mercado 3</strong>
                <span>Conteúdo exclusivo Pro/Vip</span>
              </div>
            </div>

            <button style={styles.upgradeButton} onClick={() => (window.location.href = '/plans')}>
              Ver planos
            </button>
          </div>
        )}
      </section>
    </main>
  );
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
    marginBottom: '26px',
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
    background: 'rgba(0,0,0,.68)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '28px',
    padding: '34px',
    marginBottom: '22px',
    boxShadow: '0 20px 60px rgba(0,0,0,.45)',
  },

  leagueBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#22c55e',
    fontWeight: 'bold',
    marginBottom: '22px',
  },

  leagueLogo: {
    width: '44px',
    height: '44px',
    objectFit: 'contain' as const,
  },

  teams: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 1fr',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '22px',
  },

  team: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    fontSize: '24px',
    textAlign: 'center' as const,
  },

  teamLogo: {
    width: '125px',
    height: '125px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 18px rgba(255,255,255,.18))',
  },

  scoreBox: {
    background: '#111827',
    border: '1px solid rgba(34,197,94,.45)',
    color: '#22c55e',
    borderRadius: '999px',
    padding: '12px 0',
    textAlign: 'center' as const,
    fontWeight: 'bold',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },

  scoreText: {
    fontSize: '26px',
    color: '#fff',
  },

  minuteText: {
    color: '#22c55e',
    fontSize: '12px',
    fontWeight: 'bold',
  },

  liveMinute: {
    color: '#ef4444',
    animation: 'pulse 1s infinite',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '8px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
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

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '18px',
    marginBottom: '22px',
  },

  card: {
    background: 'rgba(10,10,13,.9)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 18px 45px rgba(0,0,0,.35)',
  },

  tip: {
    display: 'block',
    color: '#22c55e',
    fontSize: '30px',
    marginBottom: '18px',
  },

  infoLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    background: 'rgba(255,255,255,.06)',
    padding: '14px',
    borderRadius: '14px',
    marginBottom: '10px',
  },

  bar: {
    height: '10px',
    background: '#27272a',
    borderRadius: '999px',
    overflow: 'hidden',
    marginTop: '16px',
  },

  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg,#22c55e,#a3e635)',
  },

  text: {
    color: '#d4d4d8',
    lineHeight: 1.7,
  },

  statsSection: {
    background: 'rgba(0,0,0,.55)',
    border: '1px solid rgba(34,197,94,.22)',
    borderRadius: '28px',
    padding: '24px',
    marginBottom: '22px',
  },

  statsTable: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },

  statsRowHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: '8px',
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '14px',
    padding: '12px',
  },

  statsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: '8px',
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '14px',
    padding: '11px',
  },

  multiplesSection: {
    background: 'rgba(0,0,0,.55)',
    border: '1px solid rgba(34,197,94,.22)',
    borderRadius: '28px',
    padding: '24px',
    marginBottom: '22px',
  },

  multiplesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },

  multipleCard: {
    background: 'rgba(10,10,13,.92)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '22px',
    padding: '18px',
  },

  multipleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '12px',
  },

  multipleRisk: {
    padding: '6px 10px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  riskLow: { background: '#22c55e', color: '#000' },
  riskMedium: { background: '#facc15', color: '#000' },
  riskHigh: { background: '#ef4444', color: '#fff' },

  multipleOddBox: {
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '16px',
    padding: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },

  multipleSelections: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },

  multipleSelection: {
    background: 'rgba(255,255,255,.06)',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },

  multipleNote: {
    color: '#d4d4d8',
    lineHeight: 1.5,
    fontSize: '14px',
  },

  multipleStake: {
    background: 'rgba(255,255,255,.06)',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
  },

  marketsSection: {
    background: 'rgba(0,0,0,.55)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '28px',
    padding: '24px',
  },

  sectionHeader: {
    marginBottom: '18px',
  },

  sectionTitle: {
    fontSize: '30px',
    margin: 0,
  },

  sectionSubtitle: {
    color: '#c4c4c4',
    marginBottom: 0,
  },

  marketsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },

  marketCard: {
    background: 'rgba(10,10,13,.92)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '22px',
    padding: '18px',
  },

  marketTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '12px',
  },

  marketNumber: {
    background: '#22c55e',
    color: '#000',
    padding: '6px 10px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  marketCategory: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: '12px',
    textAlign: 'right' as const,
  },

  marketTitle: {
    margin: '0 0 12px',
    fontSize: '21px',
  },

  marketTipBox: {
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '16px',
    padding: '13px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
    marginBottom: '12px',
  },

  marketStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: '8px',
    marginBottom: '12px',
  },

  marketStat: {
    background: 'rgba(255,255,255,.06)',
    borderRadius: '13px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },

  marketBar: {
    height: '8px',
    background: '#27272a',
    borderRadius: '999px',
    overflow: 'hidden',
    marginBottom: '12px',
  },

  marketBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg,#22c55e,#a3e635)',
  },

  marketReason: {
    color: '#d4d4d8',
    lineHeight: 1.5,
    fontSize: '14px',
  },

  emptyMarkets: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '18px',
    padding: '20px',
    color: '#d4d4d8',
  },

  lockedBox: {
    background: 'linear-gradient(135deg,rgba(250,204,21,.13),rgba(0,0,0,.65))',
    border: '1px solid rgba(250,204,21,.35)',
    borderRadius: '24px',
    padding: '28px',
    textAlign: 'center' as const,
  },

  lockIcon: {
    fontSize: '42px',
    marginBottom: '10px',
  },

  lockedPreview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginTop: '20px',
    marginBottom: '20px',
  },

  fakeMarket: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '16px',
    padding: '16px',
    filter: 'blur(.2px)',
    opacity: 0.65,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },

  upgradeButton: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    border: 0,
    padding: '14px 22px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  gamerMarketsAndMultiples: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, .85fr)',
    gap: '18px',
    alignItems: 'stretch',
    marginTop: '22px',
    marginBottom: '22px',
  },

  gamerMarketsPanel: {
    position: 'relative' as const,
    overflow: 'hidden',
    background:
      'linear-gradient(135deg, rgba(0,255,136,.12), rgba(10,10,20,.92) 45%, rgba(0,0,0,.96))',
    border: '1px solid rgba(34,197,94,.38)',
    borderRadius: '26px',
    padding: '20px',
    boxShadow: '0 0 32px rgba(34,197,94,.12), inset 0 0 24px rgba(34,197,94,.04)',
  },

  gamerMultiplesPanel: {
    position: 'relative' as const,
    overflow: 'hidden',
    background:
      'linear-gradient(135deg, rgba(250,204,21,.16), rgba(15,23,42,.94) 42%, rgba(0,0,0,.98))',
    border: '1px solid rgba(250,204,21,.36)',
    borderRadius: '26px',
    padding: '20px',
    boxShadow: '0 0 34px rgba(250,204,21,.12), inset 0 0 24px rgba(250,204,21,.04)',
  },

  gamerPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },

  gamerPanelTitle: {
    margin: 0,
    fontSize: '22px',
    letterSpacing: '.3px',
    textTransform: 'uppercase' as const,
  },

  gamerTag: {
    background: 'rgba(34,197,94,.18)',
    border: '1px solid rgba(34,197,94,.45)',
    color: '#86efac',
    borderRadius: '999px',
    padding: '7px 11px',
    fontSize: '11px',
    fontWeight: '900',
    whiteSpace: 'nowrap' as const,
  },

  gamerGoldTag: {
    background: 'rgba(250,204,21,.18)',
    border: '1px solid rgba(250,204,21,.45)',
    color: '#fde047',
    borderRadius: '999px',
    padding: '7px 11px',
    fontSize: '11px',
    fontWeight: '900',
    whiteSpace: 'nowrap' as const,
  },

  gamerMarketsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },

  gamerMarketRow: {
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr) 120px',
    gap: '12px',
    alignItems: 'center',
    background: 'linear-gradient(90deg, rgba(255,255,255,.08), rgba(255,255,255,.035))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '18px',
    padding: '12px',
  },

  gamerMarketNumber: {
    width: '38px',
    height: '38px',
    borderRadius: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#020617',
    fontWeight: '900',
    boxShadow: '0 0 16px rgba(34,197,94,.35)',
  },

  gamerMarketInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    minWidth: 0,
  },

  gamerMarketName: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '900',
  },

  gamerMarketTip: {
    color: '#cbd5e1',
    fontSize: '12px',
    lineHeight: 1.35,
  },

  gamerMarketNumbers: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    textAlign: 'right' as const,
    color: '#fde047',
    fontSize: '12px',
    fontWeight: '900',
  },

  gamerMultipleMainCard: {
    background: 'rgba(0,0,0,.38)',
    border: '1px solid rgba(250,204,21,.24)',
    borderRadius: '22px',
    padding: '16px',
    marginBottom: '14px',
  },

  gamerMultipleTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '12px',
  },

  gamerMultipleName: {
    fontSize: '16px',
    fontWeight: '900',
    color: '#fff',
  },

  gamerCombinedOdd: {
    background: 'linear-gradient(135deg,#facc15,#f97316)',
    color: '#111827',
    padding: '9px 12px',
    borderRadius: '14px',
    fontWeight: '900',
    boxShadow: '0 0 18px rgba(250,204,21,.25)',
  },

  gamerSelection: {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: '15px',
    padding: '11px',
    marginBottom: '9px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },

  gamerSelectionGame: {
    color: '#93c5fd',
    fontSize: '12px',
    fontWeight: '900',
  },

  gamerSelectionTip: {
    color: '#fff',
    fontWeight: '900',
    fontSize: '13px',
  },

  gamerSelectionMeta: {
    color: '#fde047',
    fontSize: '12px',
    fontWeight: '800',
  },

  gamerMultipleFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    color: '#cbd5e1',
    fontSize: '12px',
    borderTop: '1px solid rgba(255,255,255,.1)',
    paddingTop: '10px',
    marginTop: '8px',
  },

};
