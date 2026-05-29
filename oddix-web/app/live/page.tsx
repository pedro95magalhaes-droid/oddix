'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

function logoFallback(name: string, bg = '111827', color = 'ffffff') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'Time',
  )}&background=${bg}&color=${color}&bold=true`;
}

function dateKey(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

function formatDateTime(date: any) {
  if (!date) return '-';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return '-';

  return parsed.toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusShort(game: any) {
  return game.fixture?.status?.short || '';
}

function isLiveStatus(status: string) {
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'].includes(
    status,
  );
}

function isFinishedStatus(status: string) {
  return ['FT', 'AET', 'PEN'].includes(status);
}

function isCanceledStatus(status: string) {
  return ['CANC', 'ABD', 'AWD', 'WO', 'PST'].includes(status);
}

export default function LivePage() {
  const [games, setGames] = useState<any[]>([]);
  const [savedBets, setSavedBets] = useState<any[]>([]);
  const [savedBetsMap, setSavedBetsMap] = useState<Record<number, string>>({});
  const [plan, setPlan] = useState('Free');
  const [role, setRole] = useState('USER');
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<number | string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [liveFilter, setLiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('time');
  const [liveTick, setLiveTick] = useState(0);

  const gamesPerPage = 24;

  const isPaidPlan = ['PRO', 'VIP', 'Pro', 'Vip', 'pro', 'vip'].includes(String(plan));

  function getLocalDateKey(date: any) {
    if (!date) return '';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return '';

    return dateKey(parsed);
  }

  function getTomorrowKey() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }

  function getGameScore(game: any) {
    const home =
      game.goals?.home ??
      game.score?.fulltime?.home ??
      game.score?.halftime?.home ??
      game.bet?.homeScore ??
      null;

    const away =
      game.goals?.away ??
      game.score?.fulltime?.away ??
      game.score?.halftime?.away ??
      game.bet?.awayScore ??
      null;

    return {
      home: home === null || home === undefined ? '-' : Number(home),
      away: away === null || away === undefined ? '-' : Number(away),
    };
  }

  function getScoreNumber(value: any) {
    return value === '-' ? 0 : Number(value || 0);
  }

  function isLive(game: any) {
    if (game.source === 'saved') {
      return game.savedStatus === 'open';
    }

    return isLiveStatus(getStatusShort(game));
  }

  function getLiveElapsedMinute(game: any) {
    const statusShort = getStatusShort(game);
    const apiElapsed = Number(game.fixture?.status?.elapsed || 0);
    const timestamp = Number(game.fixture?.timestamp || 0);

    if (!isLive(game)) return apiElapsed;

    if (statusShort === 'HT') return 45;

    if (!apiElapsed || !timestamp) return apiElapsed;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const apiGameTimeSeconds = timestamp + apiElapsed * 60;
    const diffMinutes = Math.floor((nowSeconds - apiGameTimeSeconds) / 60);
    const calculated = apiElapsed + Math.max(0, diffMinutes);

    if (['ET', 'BT', 'P'].includes(statusShort)) {
      return Math.min(calculated, 120);
    }

    return Math.min(calculated, 90);
  }

  function getLiveExtraMinute(game: any) {
    const apiExtra = Number(game.fixture?.status?.extra || 0);

    if (!isLive(game)) return apiExtra;

    const elapsed = getLiveElapsedMinute(game);

    if (elapsed > 90) return elapsed - 90;

    return apiExtra;
  }

  function isFinished(game: any) {
    if (game.source === 'saved') {
      return game.savedStatus === 'won' || game.savedStatus === 'lost';
    }

    return isFinishedStatus(getStatusShort(game));
  }

  function getLiveTimeText(game: any) {
    liveTick;

    const statusShort = getStatusShort(game);
    const statusLong = game.fixture?.status?.long;

    if (game.source === 'saved') {
      if (game.savedStatus === 'won') return 'Finalizado • Ganhou';
      if (game.savedStatus === 'lost') return 'Finalizado • Perdeu';
      return 'Salvo em aberto';
    }

    if (statusShort === 'HT') return 'Intervalo';

    const elapsed = getLiveElapsedMinute(game);
    const extra = getLiveExtraMinute(game);

    if (elapsed) {
      if (extra && elapsed >= 90) return `90+${extra}'`;
      return `${elapsed}'`;
    }

    return statusLong || statusShort || '-';
  }

  function getPeriodText(game: any) {
    const short = getStatusShort(game);

    if (short === 'HT') return 'INTERVALO';
    if (short === '1H') return '1º TEMPO';
    if (['2H', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return '2º TEMPO';
    if (isFinished(game)) return 'FINALIZADO';

    return 'PRÉ-JOGO';
  }

  function getTimelinePercent(game: any) {
    liveTick;

    const elapsed = getLiveElapsedMinute(game);

    if (elapsed > 0) return Math.min(100, Math.max(3, Math.round((elapsed / 90) * 100)));
    if (getStatusShort(game) === 'HT') return 50;
    if (isFinished(game)) return 100;

    return 3;
  }

  function getGameTimeLabel(game: any) {
    if (isLive(game)) return getLiveTimeText(game);
    if (isFinished(game)) return 'Finalizado';

    return formatDateTime(game.fixture?.date);
  }

  function statusText(game: any) {
    if (game.source === 'saved') {
      if (game.savedStatus === 'won') return '✅ Ganhou';
      if (game.savedStatus === 'lost') return '❌ Perdeu';
      return '🔥 Salvo aberto';
    }

    const status = getStatusShort(game);

    if (isLiveStatus(status)) return '🔴 Ao vivo';
    if (isFinishedStatus(status)) return '🏁 Finalizado';
    if (isCanceledStatus(status)) return '🚫 Indisponível';

    return '⏳ Futuro';
  }

  function savedBetToGame(bet: any) {
    return {
      source: 'saved',
      savedBetId: bet.id,
      savedStatus: bet.status,
      fixture: {
        id: bet.fixtureId || bet.id,
        date: bet.gameDate || bet.createdAt,
        status: {
          short:
            bet.statusShort ||
            (bet.status === 'won' || bet.status === 'lost'
              ? 'FT'
              : 'SAVED_OPEN'),
          long:
            bet.status === 'won'
              ? 'Palpite ganho'
              : bet.status === 'lost'
              ? 'Palpite perdido'
              : bet.statusShort
              ? 'Jogo atualizado pela API'
              : 'Palpite em aberto',
          elapsed: bet.elapsed || '',
          extra: '',
        },
      },
      league: {
        name: bet.league,
        country: 'Salvo',
        logo: bet.leagueLogo,
      },
      teams: {
        home: {
          name: bet.homeTeam,
          logo: bet.homeLogo,
        },
        away: {
          name: bet.awayTeam,
          logo: bet.awayLogo,
        },
      },
      provider: bet.provider || 'saved',
      goals: {
        home: bet.homeScore ?? null,
        away: bet.awayScore ?? null,
      },
      score: {
        fulltime: {
          home: bet.homeScore ?? null,
          away: bet.awayScore ?? null,
        },
      },
      bet,
    };
  }

  async function loadSavedBets() {
    try {
      const response = await api.get('/bets');
      const bets = response.data || [];
      const map: Record<number, string> = {};

      bets.forEach((bet: any) => {
        const fixtureId = Number(bet.fixtureId);

        if (fixtureId && bet.id) {
          map[fixtureId] = bet.id;
        }
      });

      setSavedBets(bets);
      setSavedBetsMap(map);

      return {
        bets,
        map,
      };
    } catch {
      setSavedBets([]);
      setSavedBetsMap({});

      return {
        bets: [],
        map: {},
      };
    }
  }

  async function loadGames() {
    try {
      if (games.length === 0) setLoading(true);

      const saved = await loadSavedBets();

      const today = new Date();

      const days = Array.from({ length: 8 }).map((_, index) => {
        const date = new Date(today);
        date.setDate(date.getDate() + index);
        return dateKey(date);
      });

      const [liveResponse, ...dayResponses] = await Promise.allSettled([
        api.get('/football/live'),
        ...days.map((date) => api.get(`/football/fixtures?date=${date}`)),
      ]);

      const liveGames =
        liveResponse.status === 'fulfilled'
          ? liveResponse.value?.data || []
          : [];

      const dayGames = dayResponses.flatMap((result: any) => {
        if (result.status !== 'fulfilled') return [];
        return result.value?.data || [];
      });

      const mergedMap = new Map<number, any>();

      [...dayGames, ...liveGames].forEach((game: any) => {
        const id = Number(game.fixture?.id);

        if (!id) return;

        if (isCanceledStatus(getStatusShort(game))) return;

        const existing = mergedMap.get(id);

        if (!existing) {
          mergedMap.set(id, game);
          return;
        }

        if (isLiveStatus(getStatusShort(game))) {
          mergedMap.set(id, game);
        }
      });

      const apiGames = Array.from(mergedMap.values()).sort((a: any, b: any) => {
        const liveA = isLiveStatus(getStatusShort(a)) ? 1 : 0;
        const liveB = isLiveStatus(getStatusShort(b)) ? 1 : 0;

        if (liveA !== liveB) return liveB - liveA;

        const finishedA = isFinishedStatus(getStatusShort(a)) ? 1 : 0;
        const finishedB = isFinishedStatus(getStatusShort(b)) ? 1 : 0;

        if (finishedA !== finishedB) return finishedA - finishedB;

        const dateA = new Date(a.fixture?.date || 0).getTime();
        const dateB = new Date(b.fixture?.date || 0).getTime();

        return dateA - dateB;
      });

      const apiFixtureIds = new Set(
        apiGames.map((game: any) => Number(game.fixture?.id)).filter(Boolean),
      );

      const savedAsGames = saved.bets
        .map(savedBetToGame)
        .filter((game: any) => {
          const fixtureId = Number(game.fixture?.id);
          return !apiFixtureIds.has(fixtureId);
        });

      setGames([...apiGames, ...savedAsGames]);
    } catch {
      alert('Erro ao carregar jogos. Verifique o backend /football/fixtures e /football/live.');
    } finally {
      setLoading(false);
    }
  }

  async function analyzeGame(game: any) {
    if (!isPaidPlan) {
      alert(
        'Análise IA disponível apenas nos planos PRO e VIP. No plano FREE você pode ver os jogos, mas não a análise completa.',
      );

      window.location.href = '/plans';
      return;
    }

    try {
      const fixtureId = game.fixture?.id || game.savedBetId;
      setAnalyzingId(fixtureId);

      const response = await api.post('/ai/generate-bet', {
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        teams: game.teams,
        score: getGameScore(game),
        status: game.fixture?.status,
      });

      const numericFixtureId = Number(game.fixture?.id);

      setSelectedAnalysis({
        game,
        ai: response.data,
        saved: !!game.savedBetId || !!savedBetsMap[numericFixtureId],
        savedBetId: game.savedBetId || savedBetsMap[numericFixtureId] || null,
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      alert('Erro ao analisar este jogo com IA.');
    } finally {
      setAnalyzingId(null);
    }
  }

  async function saveAnalysisToDashboard() {
    if (!selectedAnalysis) return;

    try {
      setSaving(true);

      const game = selectedAnalysis.game;
      const ai = selectedAnalysis.ai;
      const score = getGameScore(game);
      const fixtureId = Number(game.fixture?.id);

      const saved = await loadSavedBets();

      if (game.savedBetId || saved.map[fixtureId]) {
        setSelectedAnalysis({
          ...selectedAnalysis,
          saved: true,
          savedBetId: game.savedBetId || saved.map[fixtureId],
        });

        alert('Esse jogo já foi salvo no Dashboard.');
        return;
      }

      const payload = {
        homeTeam: game.teams?.home?.name || '',
        awayTeam: game.teams?.away?.name || '',
        league: game.league?.name || '',
        tip: ai.tip || '',
        odd: Number(ai.odd || 0),
        confidence: Number(ai.confidence || 0),
        status: 'open',

        homeLogo: game.teams?.home?.logo || '',
        awayLogo: game.teams?.away?.logo || '',
        leagueLogo: game.league?.logo || '',
        fixtureId: fixtureId ? String(fixtureId) : '',
        gameDate: game.fixture?.date || '',

        homeScore: score.home === '-' ? null : Number(score.home),
        awayScore: score.away === '-' ? null : Number(score.away),
        statusShort: game.fixture?.status?.short || '',
        elapsed:
          game.fixture?.status?.elapsed === null ||
          game.fixture?.status?.elapsed === undefined
            ? null
            : Number(game.fixture?.status?.elapsed),
        provider: game.provider || 'api-football',

        markets: ai.markets || [],
        multiples: ai.multiples || null,
        analysis: ai.analysis || '',
        risk: ai.risk || 'Médio',
      };

      const created = await api.post('/admin/bets', payload);
      const createdBetId = created.data?.id;

      setSavedBetsMap((current) => ({
        ...current,
        [fixtureId]: createdBetId,
      }));

      setSavedBets((current) => [created.data, ...current]);

      setSelectedAnalysis({
        ...selectedAnalysis,
        saved: true,
        savedBetId: createdBetId,
      });

      alert('Palpite salvo no Dashboard com sucesso.');
    } catch {
      alert('Erro ao salvar no Dashboard. Confirme se você está logado como ADMIN.');
    } finally {
      setSaving(false);
    }
  }

  function isSavedGame(game: any) {
    if (game.savedBetId) return true;
    return !!savedBetsMap[Number(game.fixture?.id)];
  }

  function getSavedBetId(game: any) {
    if (game.savedBetId) return game.savedBetId;
    return savedBetsMap[Number(game.fixture?.id)];
  }

  function openSavedBet(game: any) {
    const betId = getSavedBetId(game);

    if (!betId) {
      alert('Palpite salvo não encontrado. Atualize os jogos e tente novamente.');
      return;
    }

    window.location.href = `/dashboard/bet/${betId}`;
  }

  function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
  }

  const filteredGames = games
    .filter((game) => {
      const fixtureDate = getLocalDateKey(game.fixture?.date);
      const today = dateKey(new Date());
      const tomorrow = getTomorrowKey();
      const saved = isSavedGame(game);
      const live = isLive(game);
      const finished = isFinished(game);

      const text = search.toLowerCase().trim();

      const matchSearch =
        !text ||
        game.teams?.home?.name?.toLowerCase().includes(text) ||
        game.teams?.away?.name?.toLowerCase().includes(text) ||
        game.league?.name?.toLowerCase().includes(text) ||
        game.league?.country?.toLowerCase().includes(text);

      const matchFilter =
        liveFilter === 'all' ||
        (liveFilter === 'live' && live) ||
        (liveFilter === 'today' && fixtureDate === today) ||
        (liveFilter === 'tomorrow' && fixtureDate === tomorrow) ||
        (liveFilter === 'future' && fixtureDate >= today && !live && !finished && !saved) ||
        (liveFilter === 'finished' && finished) ||
        (liveFilter === 'saved' && saved);

      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const liveA = isLive(a) ? 1 : 0;
      const liveB = isLive(b) ? 1 : 0;
      const savedA = isSavedGame(a) ? 1 : 0;
      const savedB = isSavedGame(b) ? 1 : 0;

      const dateA = new Date(a.fixture?.date || 0).getTime();
      const dateB = new Date(b.fixture?.date || 0).getTime();

      const leagueA = String(a.league?.name || '').localeCompare(
        String(b.league?.name || ''),
      );

      const countryA = String(a.league?.country || '').localeCompare(
        String(b.league?.country || ''),
      );

      if (sortBy === 'live') {
        if (liveA !== liveB) return liveB - liveA;
        return dateA - dateB;
      }

      if (sortBy === 'saved') {
        if (savedA !== savedB) return savedB - savedA;
        return dateA - dateB;
      }

      if (sortBy === 'league') {
        if (leagueA !== 0) return leagueA;
        return dateA - dateB;
      }

      if (sortBy === 'country') {
        if (countryA !== 0) return countryA;
        return leagueA || dateA - dateB;
      }

      return dateA - dateB;
    });

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / gamesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * gamesPerPage;
  const paginatedGames = filteredGames.slice(startIndex, startIndex + gamesPerPage);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTick((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadGames();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      window.location.href = '/';
      return;
    }

    async function loadUser() {
      try {
        const response = await api.get('/auth/me');
        setPlan(response.data.plan || 'Free');
        setRole(response.data.role || 'USER');
        await loadGames();
      } catch {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }

    loadUser();
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.overlay} />

      <header style={styles.header}>
        <img src="/oddix-logo.png" style={styles.logo} />

        <nav style={styles.nav}>
          <span style={styles.planBadge}>Plano: {plan}</span>

          <button style={styles.navButton} onClick={() => (window.location.href = '/dashboard')}>
            Dashboard
          </button>

          <button style={styles.navButton} onClick={() => (window.location.href = '/favorites')}>
            Favoritos
          </button>

          <button style={styles.navButton} onClick={() => (window.location.href = '/history')}>
            Histórico
          </button>

          {role === 'ADMIN' && (
            <button style={styles.adminButton} onClick={() => (window.location.href = '/admin')}>
              Admin
            </button>
          )}

          <button style={styles.logoutButton} onClick={logout}>
            Sair
          </button>
        </nav>
      </header>

      {selectedAnalysis && (() => {
        const game = selectedAnalysis.game;
        const score = getGameScore(game);
        const timeline = getTimelinePercent(game);
        const live = isLive(game);
        const homeName = game.teams?.home?.name || 'Casa';
        const awayName = game.teams?.away?.name || 'Fora';
        const leagueName = game.league?.name || 'Liga';

        return (
          <section style={styles.matchTvPanel}>
            <div style={styles.matchTvHeader}>
              <div>
                <span style={live ? styles.liveNowBadge : styles.nextGameBadge}>
                  {live ? '🔴 AO VIVO AGORA' : isFinished(game) ? '🏁 FINALIZADO' : '⏳ PRÓXIMO JOGO'}
                </span>

                <h2 style={styles.matchTvTitle}>Placar ao vivo</h2>

                <p style={styles.subtitle}>
                  Acompanhe placar, tempo e análise da IA.
                </p>
              </div>

              <div style={styles.updatedBox}>
                <span style={styles.greenDot} />
                Atualizado agora
              </div>
            </div>

            <div style={styles.mainMatchBoard}>
              <div style={styles.boardLeague}>
                <strong>{leagueName}</strong>
                <button style={styles.closeButton} onClick={() => setSelectedAnalysis(null)}>
                  Fechar
                </button>
              </div>

              <div style={styles.bigMatchRow}>
                <div style={styles.bigTeamBlock}>
                  <img
                    src={game.teams?.home?.logo || logoFallback(homeName)}
                    style={styles.bigTeamLogo}
                  />
                  <strong>{homeName}</strong>
                </div>

                <div style={styles.centerClockScore}>
                  <span style={live ? styles.redLiveText : styles.futureText}>
                    {statusText(game)}
                  </span>

                  <div style={styles.tvScore}>
                    <span>{score.home}</span>
                    <small>-</small>
                    <span>{score.away}</span>
                  </div>

                  <div style={styles.digitalClock}>
                    {live ? getLiveTimeText(game) : isFinished(game) ? 'FT' : formatDateTime(game.fixture?.date)}
                  </div>

                  <span style={styles.halfBadge}>{getPeriodText(game)}</span>
                </div>

                <div style={styles.bigTeamBlock}>
                  <img
                    src={game.teams?.away?.logo || logoFallback(awayName)}
                    style={styles.bigTeamLogo}
                  />
                  <strong>{awayName}</strong>
                </div>
              </div>

              <div style={styles.tvTimeline}>
                <span>0'</span>
                <div style={styles.tvTimelineTrack}>
                  <div style={{ ...styles.tvTimelineProgress, width: `${timeline}%` }} />
                  <div style={{ ...styles.tvTimelineBall, left: `${timeline}%` }}>⚽</div>
                  <div style={styles.tvTimelineHalf}>INT</div>
                </div>
                <span>90'</span>
              </div>

              <div style={styles.matchBottomGrid}>
                <div style={styles.scoreTableBox}>
                  <h3>PLACAR</h3>

                  <div style={styles.scoreTable}>
                    <div style={styles.scoreTableHead}>
                      <span />
                      <span>1º TEMPO</span>
                      <span>TOTAL</span>
                    </div>

                    <div style={styles.scoreTableRow}>
                      <strong>{homeName}</strong>
                      <span>{game.score?.halftime?.home ?? '-'}</span>
                      <span>{score.home}</span>
                    </div>

                    <div style={styles.scoreTableRow}>
                      <strong>{awayName}</strong>
                      <span>{game.score?.halftime?.away ?? '-'}</span>
                      <span>{score.away}</span>
                    </div>
                  </div>
                </div>

                <div style={styles.pitchBox}>
                  <div style={styles.pitch}>
                    <div style={styles.pitchLine} />
                    <div style={styles.pitchCircle} />
                    <div style={styles.pitchGoalLeft} />
                    <div style={styles.pitchGoalRight} />
                    <div style={styles.pitchClock}>
                      {live ? getLiveTimeText(game) : isFinished(game) ? 'FT' : 'PRÉ-JOGO'}
                    </div>
                  </div>
                </div>

                <div style={styles.eventBox}>
                  <h3>ANÁLISE DA IA</h3>

                  <div style={styles.eventItem}>
                    <span>🎯</span>
                    <div>
                      <strong>{selectedAnalysis.ai.tip || '-'}</strong>
                      <small>Entrada principal</small>
                    </div>
                  </div>

                  <div style={styles.eventItem}>
                    <span>📈</span>
                    <div>
                      <strong>Odd {selectedAnalysis.ai.odd || '-'}</strong>
                      <small>{selectedAnalysis.ai.confidence || 0}% confiança</small>
                    </div>
                  </div>

                  <div style={styles.eventItem}>
                    <span>⚠️</span>
                    <div>
                      <strong>Risco {selectedAnalysis.ai.risk || 'Médio'}</strong>
                      <small>Gestão recomendada</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {selectedAnalysis.ai.analysis && (
              <p style={styles.tvAnalysisText}>{selectedAnalysis.ai.analysis}</p>
            )}

            <div style={styles.gamerMarketsAndMultiples}>
              {Array.isArray(selectedAnalysis.ai.markets) &&
                selectedAnalysis.ai.markets.length > 0 && (
                  <div style={styles.gamerMarketsPanel}>
                    <div style={styles.gamerPanelHeader}>
                      <h3 style={styles.gamerPanelTitle}>🎮 5 mercados IA</h3>
                      <span style={styles.gamerTag}>PRO / VIP</span>
                    </div>

                    <div style={styles.gamerMarketsList}>
                      {selectedAnalysis.ai.markets.slice(0, 5).map((market: any, index: number) => (
                        <div key={index} style={styles.gamerMarketRow}>
                          <span style={styles.gamerMarketNumber}>{index + 1}</span>

                          <div style={styles.gamerMarketInfo}>
                            <strong style={styles.gamerMarketName}>{market.market}</strong>
                            <span style={styles.gamerMarketTip}>{market.tip}</span>
                          </div>

                          <div style={styles.gamerMarketNumbers}>
                            <span>Odd {market.odd || '-'}</span>
                            <span>{market.confidence || 0}%</span>
                            <span>{market.risk || 'Baixo'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {selectedAnalysis.ai.multiples && (
                <div style={styles.gamerMultiplesPanel}>
                  <div style={styles.gamerPanelHeader}>
                    <h3 style={styles.gamerPanelTitle}>🔥 Múltiplas IA</h3>
                    <span style={styles.gamerGoldTag}>JOGOS DIFERENTES</span>
                  </div>

                  {[
                    selectedAnalysis.ai.multiples.conservative,
                    selectedAnalysis.ai.multiples.moderate,
                    selectedAnalysis.ai.multiples.aggressive,
                  ]
                    .filter(Boolean)
                    .map((multiple: any, index: number) => (
                      <div key={index} style={styles.gamerMultipleMainCard}>
                        <div style={styles.gamerMultipleTop}>
                          <strong style={styles.gamerMultipleName}>{multiple.name}</strong>
                          <span style={styles.gamerCombinedOdd}>Odd {multiple.combinedOdd}</span>
                        </div>

                        {multiple.selections?.map((selection: any, itemIndex: number) => (
                          <div key={itemIndex} style={styles.gamerSelection}>
                            {selection.game && <span style={styles.gamerSelectionGame}>{selection.game}</span>}
                            <strong style={styles.gamerSelectionTip}>{selection.tip}</strong>
                            <span style={styles.gamerSelectionMeta}>
                              {selection.market} • Odd {selection.odd} • {selection.confidence}% • {selection.risk}
                            </span>
                          </div>
                        ))}

                        <div style={styles.gamerMultipleFooter}>
                          <span>{multiple.note}</span>
                          <strong>{multiple.stake}</strong>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>


            <div style={styles.analysisActions}>
              <button
                style={selectedAnalysis.saved ? styles.savedButton : styles.saveButton}
                onClick={saveAnalysisToDashboard}
                disabled={saving || selectedAnalysis.saved}
              >
                {selectedAnalysis.saved
                  ? '✅ Já salvo no Dashboard'
                  : saving
                  ? 'Salvando...'
                  : 'Salvar no Dashboard'}
              </button>

              <button
                style={styles.dashboardButton}
                onClick={() => {
                  if (selectedAnalysis.savedBetId) {
                    window.location.href = `/dashboard/bet/${selectedAnalysis.savedBetId}`;
                  } else {
                    window.location.href = '/dashboard';
                  }
                }}
              >
                {selectedAnalysis.savedBetId ? 'Ver no Dashboard' : 'Ir para Dashboard'}
              </button>
            </div>
          </section>
        );
      })()}

      <section style={styles.hero}>
        <span style={styles.liveBadge}>● JOGOS AO VIVO, FUTUROS E FINALIZADOS</span>

        <h1 style={styles.title}>{isPaidPlan ? 'Escolha um jogo para a IA analisar' : 'Jogos ao vivo liberados no plano FREE'}</h1>

        <p style={styles.subtitle}>
          {isPaidPlan
            ? 'A lista mostra jogos ao vivo, futuros, finalizados e salvos no Dashboard.'
            : 'No plano FREE você acompanha os jogos. Para liberar análise IA, assine PRO ou VIP.'}
        </p>

        <div style={styles.heroStats}>
          <div style={styles.statCardGreen}>
            <span>Jogos disponíveis</span>
            <strong>{games.length}</strong>
          </div>

          <div style={styles.statCard}>
            <span>Ao vivo/abertos</span>
            <strong>{games.filter(isLive).length}</strong>
          </div>

          <div style={styles.statCard}>
            <span>Finalizados</span>
            <strong>{games.filter(isFinished).length}</strong>
          </div>

          <div style={styles.statCardSaved}>
            <span>Já salvos</span>
            <strong>{savedBets.length}</strong>
          </div>
        </div>
      </section>

      <section style={styles.topActions}>
        <button style={styles.refreshButton} onClick={loadGames}>
          Atualizar jogos
        </button>

        <button style={styles.vipButton} onClick={() => (window.location.href = '/plans')}>
          Entrar no VIP
        </button>
      </section>

      <section style={styles.filterBox}>
        {[
          { label: 'Todos', value: 'all' },
          { label: '🔴 Ao vivo', value: 'live' },
          { label: '📌 Hoje', value: 'today' },
          { label: '📅 Amanhã', value: 'tomorrow' },
          { label: '⏳ Futuros', value: 'future' },
          { label: '🏁 Finalizados', value: 'finished' },
          { label: '✅ Já salvos', value: 'saved' },
        ].map((item) => (
          <button
            key={item.value}
            style={
              liveFilter === item.value
                ? styles.filterButtonActive
                : styles.filterButton
            }
            onClick={() => {
              setLiveFilter(item.value);
              setCurrentPage(1);
            }}
          >
            {item.label}
          </button>
        ))}

        <input
          style={styles.searchInput}
          placeholder="Buscar time, liga ou país..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
        />

        {search && (
          <button
            style={styles.clearSearchButton}
            onClick={() => {
              setSearch('');
              setCurrentPage(1);
            }}
          >
            Limpar busca
          </button>
        )}

        <select
          style={styles.sortSelect}
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="time">Ordenar: horário</option>
          <option value="live">Ordenar: ao vivo primeiro</option>
          <option value="saved">Ordenar: salvos primeiro</option>
          <option value="league">Ordenar: liga</option>
          <option value="country">Ordenar: país</option>
        </select>

        <span style={styles.filterCount}>
          Mostrando {paginatedGames.length} de {filteredGames.length} filtrados
        </span>
      </section>

      {loading ? (
        <section style={styles.emptyBox}>
          <h2>Carregando jogos...</h2>
        </section>
      ) : (
        <section style={styles.grid}>
          {paginatedGames.map((game) => {
            const fixtureId = game.fixture?.id || game.savedBetId;
            const live = isLive(game);
            const finished = isFinished(game);
            const saved = isSavedGame(game);
            const score = getGameScore(game);

            return (
              <div key={`${game.source || 'api'}-${fixtureId}`} style={live ? styles.cardLive : styles.card}>
                <div style={styles.cardTopLine} />

                <div style={styles.cardHeader}>
                  <div style={styles.leagueBox}>
                    <img
                      src={game.league?.logo || logoFallback(game.league?.name, '22c55e', '000000')}
                      style={styles.leagueLogo}
                    />
                    <span>{game.league?.name}</span>
                  </div>

                  <span
                    style={
                      game.savedStatus === 'won'
                        ? styles.wonBadge
                        : game.savedStatus === 'lost'
                        ? styles.lostBadge
                        : saved
                        ? styles.savedGameBadge
                        : live
                        ? styles.liveStatusBadge
                        : finished
                        ? styles.finishedBadge
                        : styles.futureBadge
                    }
                  >
                    {statusText(game)}
                  </span>
                </div>

                <div style={styles.scoreboard}>
                  <div style={styles.team}>
                    <img
                      src={game.teams?.home?.logo || logoFallback(game.teams?.home?.name)}
                      style={styles.teamLogo}
                    />
                    <strong>{game.teams?.home?.name}</strong>
                  </div>

                  <div style={styles.cardScoreCenter}>
                    <strong>{score.home}</strong>
                    <span>-</span>
                    <strong>{score.away}</strong>
                    <small>{live ? getLiveTimeText(game) : finished ? 'FT' : 'Início'}</small>
                  </div>

                  <div style={styles.team}>
                    <img
                      src={game.teams?.away?.logo || logoFallback(game.teams?.away?.name)}
                      style={styles.teamLogo}
                    />
                    <strong>{game.teams?.away?.name}</strong>
                  </div>
                </div>

                {game.bet?.tip && (
                  <div style={styles.savedTipBox}>
                    <small>Palpite salvo</small>
                    <strong>{game.bet.tip}</strong>
                  </div>
                )}

                <div style={styles.infoGrid}>
                  <div style={styles.infoItemHighlight}>
                    <small>{live ? 'Tempo ao vivo' : finished ? 'Finalizado' : 'Começa em'}</small>
                    <strong>{getGameTimeLabel(game)}</strong>
                  </div>

                  <div style={styles.infoItem}>
                    <small>País</small>
                    <strong>{game.league?.country || '-'}</strong>
                  </div>

                  <div style={styles.infoItem}>
                    <small>Status</small>
                    <strong>{game.fixture?.status?.long || '-'}</strong>
                  </div>
                </div>

                <div style={styles.cardActions}>
                  <button
                    style={saved ? styles.savedAnalysisButton : styles.analysisButton}
                    onClick={() => analyzeGame(game)}
                    disabled={analyzingId === fixtureId}
                  >
                    {!isPaidPlan
                      ? '🔒 Liberar análise'
                      : analyzingId === fixtureId
                      ? 'Analisando...'
                      : saved
                      ? '✅ Analisar novamente'
                      : '🤖 Analisar jogo'}
                  </button>

                  {saved && (
                    <button style={styles.viewDashboardButton} onClick={() => openSavedBet(game)}>
                      Ver no Dashboard
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {!loading && filteredGames.length > 0 && (
        <section style={styles.paginationBox}>
          <button
            style={safeCurrentPage === 1 ? styles.paginationButtonDisabled : styles.paginationButton}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
          >
            ← Anterior
          </button>

          <span style={styles.paginationText}>
            Página {safeCurrentPage} de {totalPages}
          </span>

          <button
            style={
              safeCurrentPage === totalPages
                ? styles.paginationButtonDisabled
                : styles.paginationButton
            }
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safeCurrentPage === totalPages}
          >
            Próxima →
          </button>
        </section>
      )}

      {!loading && filteredGames.length === 0 && (
        <section style={styles.emptyBox}>
          <h2>Nenhum jogo encontrado nesse filtro</h2>
          <p>Tente mudar o filtro, limpar a busca ou atualizar novamente.</p>

          <button style={styles.refreshButton} onClick={loadGames}>
            Atualizar
          </button>
        </section>
      )}
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100vw',
    color: '#fff',
    padding: '22px 30px 34px',
    fontFamily: 'Arial, sans-serif',
    backgroundImage:
      'linear-gradient(rgba(0,0,0,.78), rgba(0,0,0,.96)), url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2200&q=90")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    position: 'relative' as const,
    overflowX: 'hidden' as const,
  },

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,.25)',
    pointerEvents: 'none' as const,
  },

  header: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px',
  },

  logo: {
    width: '280px',
    height: '105px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 22px rgba(0,0,0,.95))',
  },

  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end',
  },

  planBadge: {
    background: 'rgba(34,197,94,.15)',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,.4)',
    padding: '10px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
  },

  navButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  adminButton: {
    background: '#facc15',
    color: '#000',
    border: 0,
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  logoutButton: {
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  matchTvPanel: {
    position: 'relative' as const,
    zIndex: 2,
    background: 'linear-gradient(145deg,rgba(11,15,20,.98),rgba(0,0,0,.93))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '28px',
    padding: '22px',
    marginBottom: '24px',
    boxShadow: '0 0 80px rgba(0,0,0,.7)',
  },

  matchTvHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '20px',
    marginBottom: '20px',
  },

  matchTvTitle: {
    fontSize: '34px',
    margin: '12px 0 8px',
  },

  liveNowBadge: {
    background: 'rgba(239,68,68,.18)',
    color: '#ff4d4d',
    border: '1px solid rgba(239,68,68,.45)',
    padding: '8px 13px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  nextGameBadge: {
    background: 'rgba(56,189,248,.16)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,.35)',
    padding: '8px 13px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  updatedBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    color: '#d4d4d8',
    fontWeight: 'bold',
    paddingTop: '12px',
  },

  greenDot: {
    width: '12px',
    height: '12px',
    background: '#22c55e',
    borderRadius: '50%',
    boxShadow: '0 0 18px rgba(34,197,94,.8)',
  },

  mainMatchBoard: {
    background: 'linear-gradient(145deg,rgba(18,24,30,.92),rgba(3,5,8,.95))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '18px',
  },

  boardLeague: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#d4d4d8',
    marginBottom: '20px',
    textTransform: 'uppercase' as const,
  },

  closeButton: {
    background: 'rgba(239,68,68,.18)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,.4)',
    padding: '10px 14px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  bigMatchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px 1fr',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '22px',
  },

  bigTeamBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '18px',
    fontSize: '24px',
    fontWeight: 'bold',
  },

  bigTeamLogo: {
    width: '92px',
    height: '92px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 18px rgba(255,255,255,.18))',
  },

  centerClockScore: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
  },

  redLiveText: {
    color: '#ff4d4d',
    fontWeight: 'bold',
    fontSize: '13px',
  },

  futureText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: '13px',
  },

  tvScore: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    color: '#22c55e',
    fontSize: '58px',
    fontWeight: 'bold',
  },

  digitalClock: {
    background: '#04170b',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,.55)',
    borderRadius: '13px',
    padding: '10px 22px',
    fontSize: '26px',
    fontWeight: 'bold',
    boxShadow: '0 0 28px rgba(34,197,94,.2)',
  },

  halfBadge: {
    background: 'rgba(34,197,94,.22)',
    color: '#a3e635',
    padding: '7px 15px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  tvTimeline: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 40px',
    alignItems: 'center',
    gap: '10px',
    margin: '10px 80px 24px',
    color: '#d4d4d8',
    fontWeight: 'bold',
  },

  tvTimelineTrack: {
    position: 'relative' as const,
    height: '8px',
    background: 'rgba(255,255,255,.16)',
    borderRadius: '999px',
  },

  tvTimelineProgress: {
    height: '100%',
    background: 'linear-gradient(90deg,#22c55e,#a3e635)',
    borderRadius: '999px',
  },

  tvTimelineBall: {
    position: 'absolute' as const,
    top: '-13px',
    transform: 'translateX(-50%)',
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: '#06140c',
    border: '2px solid #22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tvTimelineHalf: {
    position: 'absolute' as const,
    left: '50%',
    top: '-9px',
    transform: 'translateX(-50%)',
    background: '#06140c',
    color: '#fff',
    border: '1px solid rgba(34,197,94,.6)',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    fontSize: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  matchBottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.3fr 1fr',
    gap: '20px',
    alignItems: 'stretch',
  },

  scoreTableBox: {
    borderTop: '1px solid rgba(255,255,255,.12)',
    paddingTop: '16px',
  },

  scoreTable: {
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: '12px',
    overflow: 'hidden',
  },

  scoreTableHead: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1fr 1fr',
    background: 'rgba(255,255,255,.05)',
    color: '#a1a1aa',
    padding: '10px',
    fontSize: '11px',
    fontWeight: 'bold',
  },

  scoreTableRow: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1fr 1fr',
    padding: '13px 10px',
    borderTop: '1px solid rgba(255,255,255,.08)',
    alignItems: 'center',
  },

  pitchBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pitch: {
    position: 'relative' as const,
    width: '100%',
    minHeight: '220px',
    background: 'linear-gradient(135deg,#1f7a2e,#0c3b19)',
    border: '2px solid rgba(255,255,255,.45)',
    borderRadius: '12px',
    boxShadow: '0 25px 45px rgba(0,0,0,.45)',
    overflow: 'hidden',
  },

  pitchLine: {
    position: 'absolute' as const,
    left: '50%',
    top: 0,
    bottom: 0,
    width: '2px',
    background: 'rgba(255,255,255,.55)',
  },

  pitchCircle: {
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%,-50%)',
    width: '80px',
    height: '80px',
    border: '2px solid rgba(255,255,255,.55)',
    borderRadius: '50%',
  },

  pitchGoalLeft: {
    position: 'absolute' as const,
    left: '0',
    top: '35%',
    width: '60px',
    height: '70px',
    border: '2px solid rgba(255,255,255,.55)',
    borderLeft: 0,
  },

  pitchGoalRight: {
    position: 'absolute' as const,
    right: '0',
    top: '35%',
    width: '60px',
    height: '70px',
    border: '2px solid rgba(255,255,255,.55)',
    borderRight: 0,
  },

  pitchClock: {
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%,-50%)',
    background: '#06140c',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,.55)',
    borderRadius: '12px',
    padding: '9px 18px',
    fontSize: '30px',
    fontWeight: 'bold',
    boxShadow: '0 0 26px rgba(34,197,94,.25)',
  },

  eventBox: {
    borderTop: '1px solid rgba(255,255,255,.12)',
    paddingTop: '16px',
  },

  eventItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,.08)',
  },

  tvAnalysisText: {
    background: 'rgba(255,255,255,.045)',
    border: '1px solid rgba(255,255,255,.1)',
    color: '#d4d4d8',
    lineHeight: 1.65,
    borderRadius: '16px',
    padding: '16px',
  },

  tvMarketsPanel: {
    background: 'rgba(255,255,255,.035)',
    border: '1px solid rgba(255,255,255,.09)',
    borderRadius: '18px',
    padding: '16px',
    marginTop: '16px',
  },

  analysisActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    marginTop: '20px',
  },

  saveButton: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    border: 0,
    padding: '13px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  savedButton: {
    background: '#facc15',
    color: '#000',
    border: 0,
    padding: '13px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'not-allowed',
  },

  dashboardButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    padding: '13px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  marketsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },

  marketCard: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '16px',
    padding: '14px',
  },

  marketInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  hero: {
    position: 'relative' as const,
    zIndex: 2,
    background: 'linear-gradient(135deg,rgba(20,20,25,.92),rgba(5,5,5,.88))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '30px',
    padding: '34px',
    boxShadow: '0 0 60px rgba(0,0,0,.55)',
    marginBottom: '18px',
  },

  liveBadge: {
    background: '#ef4444',
    padding: '8px 13px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  title: {
    fontSize: '42px',
    marginBottom: '10px',
  },

  subtitle: {
    color: '#d4d4d8',
    fontSize: '16px',
  },

  heroStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px',
    marginTop: '22px',
  },

  statCard: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },

  statCardGreen: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    fontWeight: 'bold',
  },

  statCardSaved: {
    background: 'linear-gradient(135deg,#facc15,#f97316)',
    color: '#000',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    fontWeight: 'bold',
  },

  topActions: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },

  refreshButton: {
    background: 'transparent',
    border: '1px solid #22c55e',
    color: '#22c55e',
    padding: '11px 16px',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },

  vipButton: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    border: 0,
    padding: '13px 20px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  filterBox: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
    marginBottom: '18px',
    background: 'rgba(0,0,0,.35)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '18px',
    padding: '14px',
  },

  filterButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.14)',
    padding: '10px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  filterButtonActive: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    padding: '10px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  searchInput: {
    background: 'rgba(0,0,0,.65)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.14)',
    padding: '11px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    outline: 'none',
    minWidth: '250px',
  },

  clearSearchButton: {
    background: 'rgba(239,68,68,.15)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,.4)',
    padding: '10px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  sortSelect: {
    background: 'rgba(0,0,0,.65)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.14)',
    padding: '11px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    outline: 'none',
    cursor: 'pointer',
  },

  filterCount: {
    color: '#c4c4c4',
    fontWeight: 'bold',
    marginLeft: 'auto',
  },

  grid: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },

  card: {
    position: 'relative' as const,
    overflow: 'hidden',
    background: 'rgba(10,10,13,.92)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '24px',
    padding: '17px',
    boxShadow: '0 20px 45px rgba(0,0,0,.35)',
    backdropFilter: 'blur(12px)',
  },

  cardLive: {
    position: 'relative' as const,
    overflow: 'hidden',
    background: 'linear-gradient(135deg,rgba(239,68,68,.16),rgba(10,10,13,.94))',
    border: '1px solid rgba(239,68,68,.45)',
    borderRadius: '24px',
    padding: '17px',
    boxShadow: '0 20px 55px rgba(239,68,68,.18)',
    backdropFilter: 'blur(12px)',
  },

  cardTopLine: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg,#22c55e,#a3e635,#22c55e)',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },

  leagueBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#22c55e',
    fontWeight: 'bold',
  },

  leagueLogo: {
    width: '28px',
    height: '28px',
    objectFit: 'contain' as const,
  },

  liveStatusBadge: {
    background: '#ef4444',
    color: '#fff',
    padding: '6px 11px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  futureBadge: {
    background: '#38bdf8',
    color: '#000',
    padding: '6px 11px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  finishedBadge: {
    background: '#71717a',
    color: '#fff',
    padding: '6px 11px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  savedGameBadge: {
    background: '#facc15',
    color: '#000',
    padding: '6px 11px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  wonBadge: {
    background: '#22c55e',
    color: '#000',
    padding: '6px 11px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  lostBadge: {
    background: '#ef4444',
    color: '#fff',
    padding: '6px 11px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },

  scoreboard: {
    display: 'grid',
    gridTemplateColumns: '1fr 70px 1fr',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
  },

  team: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '7px',
    fontSize: '13px',
  },

  teamLogo: {
    width: '58px',
    height: '58px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 14px rgba(255,255,255,.18))',
  },

  cardScoreCenter: {
    background: '#111827',
    border: '1px solid rgba(34,197,94,.4)',
    color: '#22c55e',
    borderRadius: '18px',
    padding: '8px 0',
    textAlign: 'center' as const,
    fontWeight: 'bold',
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: '18px',
  },

  savedTipBox: {
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.28)',
    borderRadius: '14px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    marginBottom: '12px',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: '7px',
    marginBottom: '12px',
  },

  infoItem: {
    background: 'rgba(255,255,255,.06)',
    borderRadius: '12px',
    padding: '9px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },

  infoItemHighlight: {
    background: 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(255,255,255,.06))',
    border: '1px solid rgba(34,197,94,.28)',
    borderRadius: '12px',
    padding: '9px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },

  cardActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '9px',
  },

  analysisButton: {
    width: '100%',
    background: '#22c55e',
    color: '#000',
    border: 0,
    borderRadius: '12px',
    padding: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  savedAnalysisButton: {
    width: '100%',
    background: 'rgba(250,204,21,.18)',
    color: '#facc15',
    border: '1px solid rgba(250,204,21,.45)',
    borderRadius: '12px',
    padding: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  viewDashboardButton: {
    width: '100%',
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: '12px',
    padding: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  paginationBox: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    marginTop: '22px',
    flexWrap: 'wrap' as const,
  },

  paginationButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    borderRadius: '999px',
    padding: '12px 18px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  paginationButtonDisabled: {
    background: 'rgba(255,255,255,.08)',
    color: '#71717a',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '999px',
    padding: '12px 18px',
    fontWeight: 'bold',
    cursor: 'not-allowed',
  },

  paginationText: {
    background: 'rgba(0,0,0,.45)',
    border: '1px solid rgba(255,255,255,.12)',
    color: '#fff',
    borderRadius: '999px',
    padding: '12px 18px',
    fontWeight: 'bold',
  },

  emptyBox: {
    position: 'relative' as const,
    zIndex: 2,
    marginTop: '18px',
    background: 'rgba(0,0,0,.55)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '20px',
    padding: '28px',
    textAlign: 'center' as const,
    color: '#d4d4d8',
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

  multiplesPanel: {
    background:
      'linear-gradient(135deg, rgba(250,204,21,.14), rgba(0,0,0,.78) 45%, rgba(15,23,42,.95))',
    border: '1px solid rgba(250,204,21,.35)',
    borderRadius: '28px',
    padding: '22px',
    marginTop: '20px',
    boxShadow: '0 0 36px rgba(250,204,21,.12)',
  },

  multiplesTitle: {
    margin: '0 0 16px',
    fontSize: '24px',
    color: '#fde047',
    textTransform: 'uppercase' as const,
    letterSpacing: '.5px',
  },

  multiplesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },

  multipleCard: {
    background: 'rgba(3,7,18,.86)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '22px',
    padding: '16px',
    boxShadow: 'inset 0 0 22px rgba(255,255,255,.03)',
  },

  multipleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '12px',
  },

  multipleRisk: {
    padding: '7px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '900',
  },

  multipleOddBox: {
    background: 'linear-gradient(135deg,rgba(250,204,21,.18),rgba(249,115,22,.12))',
    border: '1px solid rgba(250,204,21,.28)',
    borderRadius: '16px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },

  multipleSelections: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '9px',
  },

  multipleSelection: {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: '15px',
    padding: '11px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },

  multipleNote: {
    color: '#cbd5e1',
    lineHeight: 1.5,
    fontSize: '13px',
  },

  multipleStake: {
    background: 'rgba(34,197,94,.12)',
    border: '1px solid rgba(34,197,94,.22)',
    borderRadius: '14px',
    padding: '11px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
  },

  riskLow: { background: '#22c55e', color: '#020617' },
  riskMedium: { background: '#facc15', color: '#020617' },
  riskHigh: { background: '#ef4444', color: '#fff' },

};
