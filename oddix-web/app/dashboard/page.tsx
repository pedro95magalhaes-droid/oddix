'use client';

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

const FREE_GROUP_LINK = 'https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb';

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
  return ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status);
}

function isCanceledStatus(status: string) {
  return ['CANC', 'ABD', 'AWD', 'WO', 'PST'].includes(status);
}


function getSavedStatus(game: any) {
  return game?.savedStatus || game?.bet?.status || null;
}

function hasClosedSavedStatus(game: any) {
  const status = getSavedStatus(game);
  return status === 'won' || status === 'lost';
}

function isFinishedByTime(game: any) {
  const status = getStatusShort(game);
  const elapsed = Number(game.fixture?.status?.elapsed || 0);
  const date = game.fixture?.date;

  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status)) return true;
  if (!['2H', 'LIVE', 'IN_PLAY', 'ET'].includes(status)) return false;
  if (elapsed < 90 || !date) return false;

  const start = new Date(date).getTime();
  if (Number.isNaN(start)) return false;

  const minutesSinceStart = Math.floor((Date.now() - start) / 1000 / 60);
  return minutesSinceStart >= 125;
}

function attachSavedBetStatus(game: any, savedBetByFixtureId: Map<number, any>) {
  const fixtureId = Number(game?.fixture?.id || 0);
  const bet = fixtureId ? savedBetByFixtureId.get(fixtureId) : null;

  if (!bet) return game;

  const closed = bet.status === 'won' || bet.status === 'lost';

  return {
    ...game,
    savedBetId: bet.id,
    savedStatus: bet.status,
    bet,
    goals: {
      ...game.goals,
      home: bet.homeScore ?? game.goals?.home ?? null,
      away: bet.awayScore ?? game.goals?.away ?? null,
    },
    score: {
      ...game.score,
      fulltime: {
        ...game.score?.fulltime,
        home: bet.homeScore ?? game.score?.fulltime?.home ?? game.goals?.home ?? null,
        away: bet.awayScore ?? game.score?.fulltime?.away ?? game.goals?.away ?? null,
      },
    },
    fixture: {
      ...game.fixture,
      status: {
        ...game.fixture?.status,
        short: closed ? 'FT' : game.fixture?.status?.short,
        long:
          bet.status === 'won'
            ? 'Palpite ganho'
            : bet.status === 'lost'
            ? 'Palpite perdido'
            : game.fixture?.status?.long,
      },
    },
  };
}

export default function Dashboard() {
  const [games, setGames] = useState<any[]>([]);
  const [savedBets, setSavedBets] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [plan, setPlan] = useState('Free');
  const [role, setRole] = useState('USER');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [searchTeam, setSearchTeam] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [selectedStats, setSelectedStats] = useState<any>(null);
  const [analyzingId, setAnalyzingId] = useState<number | string | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveTick, setLiveTick] = useState(0);

  const isPaidPlan = ['PRO', 'VIP', 'Pro', 'Vip', 'pro', 'vip'].includes(String(plan));

  const totalGames = games.length;
  const liveGames = games.filter(isGameLive).length;
  const finishedGames = games.filter(isGameFinished).length;
  const futureGames = games.filter(
    (game) => !isGameLive(game) && !isGameFinished(game),
  ).length;

  const leagues = Array.from(new Set(games.map((game) => game.league?.name))).filter(
    Boolean,
  );

  const filteredGames = games
    .filter((game) => {
      const live = isGameLive(game);
      const finished = isGameFinished(game);
      const today = dateKey(new Date());
      const gameDate = getGameDateKey(game.fixture?.date);

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'live' && live) ||
        (statusFilter === 'today' && gameDate === today) ||
        (statusFilter === 'future' && !live && !finished) ||
        (statusFilter === 'finished' && finished);

      const matchLeague =
        leagueFilter === 'all' || game.league?.name === leagueFilter;

      const search = searchTeam.toLowerCase().trim();

      const matchTeam =
        !search ||
        game.teams?.home?.name?.toLowerCase().includes(search) ||
        game.teams?.away?.name?.toLowerCase().includes(search) ||
        game.league?.name?.toLowerCase().includes(search);

      return matchStatus && matchLeague && matchTeam;
    })
    .sort((a, b) => {
      const liveA = isGameLive(a) ? 1 : 0;
      const liveB = isGameLive(b) ? 1 : 0;

      if (liveA !== liveB) return liveB - liveA;

      const finishedA = isGameFinished(a) ? 1 : 0;
      const finishedB = isGameFinished(b) ? 1 : 0;

      if (finishedA !== finishedB) return finishedA - finishedB;

      const dateA = new Date(a.fixture?.date || 0).getTime();
      const dateB = new Date(b.fixture?.date || 0).getTime();

      return dateA - dateB;
    });

  function getGameDateKey(date: any) {
    if (!date) return '';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return '';

    return dateKey(parsed);
  }

  function getScore(game: any) {
    const home =
      game.goals?.home ??
      game.score?.fulltime?.home ??
      game.score?.halftime?.home ??
      null;

    const away =
      game.goals?.away ??
      game.score?.fulltime?.away ??
      game.score?.halftime?.away ??
      null;

    return {
      home: home === null || home === undefined ? '-' : Number(home),
      away: away === null || away === undefined ? '-' : Number(away),
    };
  }

  function isGameLive(game: any) {
    if (hasClosedSavedStatus(game)) return false;

    if (game.source === 'saved') {
      return game.savedStatus === 'open';
    }

    if (isFinishedByTime(game)) return false;

    return isLiveStatus(getStatusShort(game));
  }

  function isGameFinished(game: any) {
    if (hasClosedSavedStatus(game)) return true;

    if (game.source === 'saved') {
      return game.savedStatus === 'won' || game.savedStatus === 'lost';
    }

    return isFinishedByTime(game) || isFinishedStatus(getStatusShort(game));
  }

  function getLiveElapsedMinute(game: any) {
    liveTick;

    const statusShort = getStatusShort(game);
    const apiElapsed = Number(game.fixture?.status?.elapsed || 0);
    const timestamp = Number(game.fixture?.timestamp || 0);

    if (statusShort === 'HT') return 45;

    if (!isGameLive(game)) return apiElapsed;

    if (!apiElapsed) return apiElapsed;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const dateSeconds = game.fixture?.date
      ? Math.floor(new Date(game.fixture.date).getTime() / 1000)
      : 0;
    const baseTimestamp = timestamp || dateSeconds;

    if (!baseTimestamp) return apiElapsed;

    const apiGameTimeSeconds = timestamp
      ? timestamp + apiElapsed * 60
      : baseTimestamp;
    const diffMinutes = Math.floor((nowSeconds - apiGameTimeSeconds) / 60);
    const calculated = timestamp
      ? apiElapsed + Math.max(0, diffMinutes)
      : Math.max(apiElapsed, diffMinutes);

    if (['ET', 'BT', 'P'].includes(statusShort)) {
      return Math.min(calculated, 120);
    }

    return Math.min(calculated, 90);
  }

  function getLiveExtraMinute(game: any) {
    liveTick;

    const elapsed = getLiveElapsedMinute(game);
    const apiExtra = Number(game.fixture?.status?.extra || 0);

    if (elapsed > 90) return elapsed - 90;

    return apiExtra;
  }

  function getGameTimeText(game: any) {
    liveTick;

    const statusShort = getStatusShort(game);
    const statusLong = game.fixture?.status?.long;

    if (statusShort === 'HT') return 'Intervalo';

    if (isGameLive(game)) {
      const elapsed = getLiveElapsedMinute(game);
      const extra = getLiveExtraMinute(game);

      if (elapsed) {
        if (extra && elapsed >= 90) return `90+${extra}'`;
        return `${elapsed}'`;
      }

      return statusLong || 'Ao vivo';
    }

    if (isGameFinished(game)) return 'FT';

    return formatDateTime(game.fixture?.date);
  }

  function getGameStatusLabel(game: any) {
    if (isGameLive(game)) return `🔴 Ao vivo ${getGameTimeText(game)}`;
    if (isGameFinished(game)) return '🏁 Finalizado';
    return '⏳ Futuro';
  }

  function getTimelinePercent(game: any) {
    if (isGameFinished(game)) return 100;

    const elapsed = getLiveElapsedMinute(game);

    if (elapsed > 0) {
      return Math.min(100, Math.max(3, Math.round((elapsed / 90) * 100)));
    }

    return 3;
  }

  function isSavedGame(game: any) {
    if (game.source === 'saved' || game.savedBetId) return true;

    const fixtureId = Number(game.fixture?.id);

    return savedBets.some((bet) => Number(bet.fixtureId) === fixtureId);
  }

  function getSavedBetId(game: any) {
    if (game.savedBetId) return game.savedBetId;

    const fixtureId = Number(game.fixture?.id);
    const found = savedBets.find((bet) => Number(bet.fixtureId) === fixtureId);

    return found?.id;
  }

  function normalizeTeamName(name: any) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(fc|sc|ec|afc|cf|club|women|woman|w|u20|u21|u23|rs)\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function teamMatchScore(a: any, b: any) {
    const nameA = normalizeTeamName(a);
    const nameB = normalizeTeamName(b);

    if (!nameA || !nameB) return 0;
    if (nameA === nameB) return 100;
    if (nameA.includes(nameB) || nameB.includes(nameA)) return 90;

    const wordsA = nameA.split(' ').filter((word) => word.length >= 3);
    const wordsB = nameB.split(' ').filter((word) => word.length >= 3);

    if (!wordsA.length || !wordsB.length) return 0;

    let common = 0;

    wordsA.forEach((wordA) => {
      if (
        wordsB.some(
          (wordB) =>
            wordA === wordB ||
            wordA.includes(wordB) ||
            wordB.includes(wordA),
        )
      ) {
        common++;
      }
    });

    return Math.round((common / Math.max(wordsA.length, wordsB.length)) * 100);
  }

  function findApiGameForSavedBet(bet: any, apiGames: any[]) {
    const betDate = bet.gameDate ? getGameDateKey(bet.gameDate) : '';

    let bestGame = null;
    let bestScore = 0;

    apiGames.forEach((game) => {
      const gameDate = getGameDateKey(game.fixture?.date);

      const sameDate = !betDate || !gameDate || betDate === gameDate;

      if (!sameDate) return;

      const normalScore =
        teamMatchScore(game.teams?.home?.name, bet.homeTeam) +
        teamMatchScore(game.teams?.away?.name, bet.awayTeam);

      const reversedScore =
        teamMatchScore(game.teams?.home?.name, bet.awayTeam) +
        teamMatchScore(game.teams?.away?.name, bet.homeTeam);

      const score = Math.max(normalScore, reversedScore);

      if (score > bestScore) {
        bestScore = score;
        bestGame = game;
      }
    });

    return bestScore >= 120 ? bestGame : null;
  }

  function savedBetToGame(bet: any) {
    return {
      source: 'saved',
      savedBetId: bet.id,
      savedStatus: bet.status,
      provider: bet.provider || 'saved',
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
              : 'Palpite em aberto',
          elapsed: bet.elapsed || null,
          extra: null,
        },
      },
      league: {
        id: 0,
        name: bet.league || 'Liga salva',
        country: 'Salvo',
        logo: bet.leagueLogo || '',
      },
      teams: {
        home: {
          id: 0,
          name: bet.homeTeam || 'Casa',
          logo: bet.homeLogo || '',
        },
        away: {
          id: 0,
          name: bet.awayTeam || 'Fora',
          logo: bet.awayLogo || '',
        },
      },
      goals: {
        home: bet.homeScore ?? null,
        away: bet.awayScore ?? null,
      },
      score: {
        fulltime: {
          home: bet.homeScore ?? null,
          away: bet.awayScore ?? null,
        },
        halftime: {
          home: null,
          away: null,
        },
      },
      bet,
    };
  }


  function stableGameKey(game: any) {
    const fixtureId = Number(game?.fixture?.id || 0);

    if (fixtureId) return `fixture-${fixtureId}`;

    const home = normalizeTeamName(game?.teams?.home?.name || '');
    const away = normalizeTeamName(game?.teams?.away?.name || '');
    const date = getGameDateKey(game?.fixture?.date || '');

    return `teams-${date}-${home}-${away}`;
  }

  function mergeStableGames(previousGames: any[], nextGames: any[]) {
    const map = new Map<string, any>();

    previousGames.forEach((game: any) => {
      const key = stableGameKey(game);
      if (key) map.set(key, game);
    });

    nextGames.forEach((game: any) => {
      const key = stableGameKey(game);
      if (!key) return;

      const oldGame = map.get(key);

      if (!oldGame) {
        map.set(key, game);
        return;
      }

      map.set(key, {
        ...oldGame,
        ...game,
        fixture: {
          ...oldGame.fixture,
          ...game.fixture,
          status: {
            ...oldGame.fixture?.status,
            ...game.fixture?.status,
          },
        },
        goals: {
          ...oldGame.goals,
          ...game.goals,
        },
        score: {
          ...oldGame.score,
          ...game.score,
          fulltime: {
            ...oldGame.score?.fulltime,
            ...game.score?.fulltime,
          },
          halftime: {
            ...oldGame.score?.halftime,
            ...game.score?.halftime,
          },
        },
        teams: {
          home: {
            ...oldGame.teams?.home,
            ...game.teams?.home,
          },
          away: {
            ...oldGame.teams?.away,
            ...game.teams?.away,
          },
        },
        league: {
          ...oldGame.league,
          ...game.league,
        },
      });
    });

    return Array.from(map.values());
  }


  async function loadGames() {
    try {
      if (games.length === 0) setLoading(true);

      const dates = Array.from({ length: 17 }).map((_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index - 2);
        return dateKey(date);
      });

      const responses = await Promise.allSettled([
        api.get('/football/live'),
        ...dates.map((date) => api.get(`/football/fixtures?date=${date}`)),
        api.get('/bets'),
      ]);

      const betsResponse = responses[responses.length - 1] as any;
      const currentSavedBets =
        betsResponse?.status === 'fulfilled' ? betsResponse.value?.data || [] : [];

      setSavedBets(currentSavedBets);

      const savedBetByFixtureId = new Map<number, any>();
      currentSavedBets.forEach((bet: any) => {
        const fixtureId = Number(bet.fixtureId);
        if (fixtureId) savedBetByFixtureId.set(fixtureId, bet);
      });

      const apiGames = responses.slice(0, -1).flatMap((result: any) => {
        if (result.status !== 'fulfilled') return [];
        return result.value?.data || [];
      });

      const map = new Map<string, any>();
      const apiFixtureIds = new Set<number>();
      const apiGamesDeduped: any[] = [];

      apiGames.forEach((rawGame: any) => {
        const id = Number(rawGame.fixture?.id);

        if (!id) return;

        const game = attachSavedBetStatus(rawGame, savedBetByFixtureId);

        if (isCanceledStatus(getStatusShort(game))) return;

        apiFixtureIds.add(id);

        const key = `api-${id}`;
        const existing = map.get(key);

        if (!existing) {
          map.set(key, game);
          apiGamesDeduped.push(game);
          return;
        }

        if (isGameLive(game) || isGameFinished(game)) {
          map.set(key, game);
          return;
        }

        const existingDate = new Date(existing.fixture?.date || 0).getTime();
        const currentDate = new Date(game.fixture?.date || 0).getTime();

        if (currentDate >= existingDate) {
          map.set(key, game);
        }
      });

      const missingSavedBets = currentSavedBets.filter((bet: any) => {
        const fixtureId = Number(bet.fixtureId);
        return fixtureId && !apiFixtureIds.has(fixtureId);
      });

      const fixtureByIdResponses = await Promise.allSettled(
        missingSavedBets.map((bet: any) =>
          api.get(`/football/fixture/${bet.fixtureId}`),
        ),
      );

      fixtureByIdResponses.forEach((result: any, index: number) => {
        const bet = missingSavedBets[index];

        if (result.status === 'fulfilled' && result.value?.data?.fixture?.id) {
          const apiGame = attachSavedBetStatus(result.value.data, savedBetByFixtureId);
          const fixtureId = Number(apiGame.fixture?.id);

          apiFixtureIds.add(fixtureId);
          map.set(`api-${fixtureId}`, apiGame);
          return;
        }

        const matchedApiGame: any = findApiGameForSavedBet(bet, apiGamesDeduped);

        if (matchedApiGame?.fixture?.id) {
          const decoratedGame = attachSavedBetStatus(matchedApiGame, savedBetByFixtureId);
          const fixtureId = Number(decoratedGame.fixture.id);

          apiFixtureIds.add(fixtureId);
          map.set(`api-${fixtureId}`, decoratedGame);
          return;
        }

        map.set(`saved-${bet.id}`, savedBetToGame(bet));
      });

      currentSavedBets.forEach((bet: any) => {
        const fixtureId = Number(bet.fixtureId);

        if (fixtureId && apiFixtureIds.has(fixtureId)) {
          return;
        }

        const matchedApiGame: any = findApiGameForSavedBet(bet, apiGamesDeduped);

        if (matchedApiGame?.fixture?.id) {
          const decoratedGame = attachSavedBetStatus(matchedApiGame, savedBetByFixtureId);
          const matchedFixtureId = Number(decoratedGame.fixture.id);

          apiFixtureIds.add(matchedFixtureId);
          map.set(`api-${matchedFixtureId}`, decoratedGame);
          return;
        }

        if (!fixtureId) {
          map.set(`saved-${bet.id}`, savedBetToGame(bet));
        }
      });

      const ordered = Array.from(map.values()).sort((a: any, b: any) => {
        const liveA = isGameLive(a) ? 1 : 0;
        const liveB = isGameLive(b) ? 1 : 0;

        if (liveA !== liveB) return liveB - liveA;

        const today = dateKey(new Date());
        const todayA = getGameDateKey(a.fixture?.date) === today ? 1 : 0;
        const todayB = getGameDateKey(b.fixture?.date) === today ? 1 : 0;

        if (todayA !== todayB) return todayB - todayA;

        const finishedA = isGameFinished(a) ? 1 : 0;
        const finishedB = isGameFinished(b) ? 1 : 0;

        if (finishedA !== finishedB) return finishedA - finishedB;

        const dateA = new Date(a.fixture?.date || 0).getTime();
        const dateB = new Date(b.fixture?.date || 0).getTime();

        return dateA - dateB;
      });

      setGames((current) => {
        if (!ordered.length && current.length > 0) {
          return current;
        }

        const merged = mergeStableGames(current, ordered);

        return merged.sort((a: any, b: any) => {
          const liveA = isGameLive(a) ? 1 : 0;
          const liveB = isGameLive(b) ? 1 : 0;

          if (liveA !== liveB) return liveB - liveA;

          const today = dateKey(new Date());
          const todayA = getGameDateKey(a.fixture?.date) === today ? 1 : 0;
          const todayB = getGameDateKey(b.fixture?.date) === today ? 1 : 0;

          if (todayA !== todayB) return todayB - todayA;

          const finishedA = isGameFinished(a) ? 1 : 0;
          const finishedB = isGameFinished(b) ? 1 : 0;

          if (finishedA !== finishedB) return finishedA - finishedB;

          const dateA = new Date(a.fixture?.date || 0).getTime();
          const dateB = new Date(b.fixture?.date || 0).getTime();

          return dateA - dateB;
        });
      });
    } catch {
      setGames((current) => current);
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedBets() {
    try {
      const response = await api.get('/bets');
      setSavedBets(response.data || []);
    } catch {
      setSavedBets([]);
    }
  }

  async function loadFavorites() {
    try {
      const response = await api.get('/favorite');
      setFavorites(response.data || []);
    } catch {
      setFavorites([]);
    }
  }

  async function loadStats() {
    try {
      const response = await api.get('/stats');
      setStats(response.data);
    } catch {
      setStats(null);
    }
  }

  async function analyzeGame(game: any) {
    if (!isPaidPlan) {
      alert('Análise IA disponível apenas nos planos PRO e VIP. No plano FREE você pode ver os jogos, mas não a análise completa.');
      window.location.href = '/plans';
      return;
    }

    try {
      const fixtureId = game.fixture?.id;
      setAnalyzingId(fixtureId);
      setSelectedStats(null);

      const [aiResponse, statsResponse] = await Promise.allSettled([
        api.post('/ai/generate-bet', {
          ...game,
          homeTeam: game.teams?.home?.name,
          awayTeam: game.teams?.away?.name,
          league: game.league?.name,
          leagueName: game.league?.name,
          teams: game.teams,
          fixture: game.fixture,
          goals: game.goals,
          score: game.score || getScore(game),
          status: game.fixture?.status,
        }),
        fixtureId
          ? api.get(`/football/statistics/${fixtureId}`)
          : Promise.resolve({ data: null }),
      ]);

      if (aiResponse.status !== 'fulfilled') {
        alert('Erro ao analisar jogo.');
        return;
      }

      const stats =
        statsResponse.status === 'fulfilled' ? statsResponse.value?.data : null;

      setSelectedStats(stats);

      setSelectedAnalysis({
        game,
        ai: aiResponse.value.data,
        stats,
        saved: isSavedGame(game),
        savedBetId: getSavedBetId(game) || null,
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      alert('Erro ao analisar jogo.');
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
      const score = getScore(game);
      const fixtureId = Number(game.fixture?.id);

      if (isSavedGame(game)) {
        alert('Esse jogo já foi salvo.');
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

      await loadSavedBets();

      setSelectedAnalysis({
        ...selectedAnalysis,
        saved: true,
        savedBetId: created.data?.id,
      });

      alert('Análise salva com sucesso.');
    } catch {
      alert('Erro ao salvar análise.');
    } finally {
      setSaving(false);
    }
  }

  function getStatValue(stats: any, teamIndex: number, type: string) {
    const team = stats?.teams?.[teamIndex];

    if (!team) return '-';

    const found = team.statistics?.find((item: any) => item.type === type);

    return found?.value === null || found?.value === undefined ? '-' : found.value;
  }

  function getStatsTeamName(stats: any, index: number, fallback: string) {
    return stats?.teams?.[index]?.team?.name || fallback;
  }

  function clearFilters() {
    setStatusFilter('all');
    setLeagueFilter('all');
    setSearchTeam('');
  }

  function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTick((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadGames();
      loadStats();
    }, 120000);

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

        await Promise.all([
          loadGames(),
          loadSavedBets(),
          loadFavorites(),
          loadStats(),
        ]);
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
        <div style={styles.logoBox}>
          <img src="/oddix-logo.png" style={styles.logo} />
        </div>

        <nav style={styles.nav}>
          <span>🔥 Ao Vivo</span>
          <span>📊 Mercado</span>
          <span>🤖 IA</span>

          <span style={styles.planBadge}>Plano: {plan}</span>

          <button style={styles.liveNavButton} onClick={() => (window.location.href = '/live')}>
            Ao Vivo
          </button>

          {role === 'ADMIN' && (
            <button style={styles.adminButton} onClick={() => (window.location.href = '/admin')}>
              Admin
            </button>
          )}

          <button style={styles.historyButton} onClick={() => (window.location.href = '/history')}>
            Histórico
          </button>

          <button style={styles.favoriteNavButton} onClick={() => (window.location.href = '/favorites')}>
            Favoritos
          </button>

          <button
            style={styles.freeGroupButton}
            onClick={() => window.open(FREE_GROUP_LINK, '_blank')}
          >
            Grupo FREE
          </button>

          <button style={styles.vipButton} onClick={() => (window.location.href = '/plans')}>
            Assinar PRO/VIP
          </button>

          <button style={styles.logoutButton} onClick={logout}>
            Sair
          </button>
        </nav>
      </header>

      {selectedAnalysis && (() => {
        const game = selectedAnalysis.game;
        const score = getScore(game);

        return (
          <section style={styles.analysisPanel}>
            <div style={styles.analysisTop}>
              <div>
                <span style={isGameLive(game) ? styles.liveAnalysisBadge : styles.futureAnalysisBadge}>
                  {getGameStatusLabel(game)}
                </span>

                <h2 style={styles.analysisTitle}>
                  {game.teams?.home?.name} x {game.teams?.away?.name}
                </h2>

                <p style={styles.sectionSubtitle}>
                  {game.league?.name} • {formatDateTime(game.fixture?.date)}
                </p>
              </div>

              <button style={styles.closeButton} onClick={() => setSelectedAnalysis(null)}>
                Fechar
              </button>
            </div>

            <div style={styles.analysisScoreboard}>
              <div style={styles.analysisTeam}>
                <img src={game.teams?.home?.logo || logoFallback(game.teams?.home?.name)} style={styles.analysisLogo} />
                <strong>{game.teams?.home?.name}</strong>
              </div>

              <div style={styles.analysisScoreCenter}>
                <div style={styles.analysisScore}>
                  <span>{score.home}</span>
                  <small>-</small>
                  <span>{score.away}</span>
                </div>

                <strong style={styles.analysisClock}>{getGameTimeText(game)}</strong>
              </div>

              <div style={styles.analysisTeam}>
                <img src={game.teams?.away?.logo || logoFallback(game.teams?.away?.name)} style={styles.analysisLogo} />
                <strong>{game.teams?.away?.name}</strong>
              </div>
            </div>

            {selectedStats && (
              <div style={styles.statsPanel}>
                <div style={styles.statsHeader}>
                  <strong>Estatísticas do jogo</strong>
                  <span>
                    {selectedStats.simulated
                      ? 'Dados provisórios'
                      : selectedStats.available
                      ? 'Dados reais da API'
                      : selectedStats.message || 'Indisponível'}
                  </span>
                </div>

                {selectedStats.available ? (
                  <div style={styles.statsTable}>
                    <div style={styles.statsRowHead}>
                      <strong>{getStatsTeamName(selectedStats, 0, game.teams?.home?.name)}</strong>
                      <span>Estatística</span>
                      <strong>{getStatsTeamName(selectedStats, 1, game.teams?.away?.name)}</strong>
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
                        <strong>{getStatValue(selectedStats, 0, type)}</strong>
                        <span>{label}</span>
                        <strong>{getStatValue(selectedStats, 1, type)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.statsEmpty}>
                    {selectedStats.message || 'Estatísticas disponíveis quando o jogo começar.'}
                  </p>
                )}
              </div>
            )}

            <div style={styles.analysisGrid}>
              <div style={styles.analysisMetric}>
                <small>Entrada</small>
                <strong>{selectedAnalysis.ai.tip}</strong>
              </div>

              <div style={styles.analysisMetric}>
                <small>Odd</small>
                <strong>{selectedAnalysis.ai.odd}</strong>
              </div>

              <div style={styles.analysisMetric}>
                <small>Confiança</small>
                <strong>{selectedAnalysis.ai.confidence}%</strong>
              </div>

              <div style={styles.analysisMetric}>
                <small>Risco</small>
                <strong>{selectedAnalysis.ai.risk}</strong>
              </div>
            </div>

            {selectedAnalysis.ai.analysis && (
              <p style={styles.analysisText}>{selectedAnalysis.ai.analysis}</p>
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
                  ? '✅ Já salvo'
                  : saving
                  ? 'Salvando...'
                  : 'Salvar análise'}
              </button>

              {selectedAnalysis.savedBetId && (
                <button
                  style={styles.openSavedButton}
                  onClick={() => (window.location.href = `/dashboard/bet/${selectedAnalysis.savedBetId}`)}
                >
                  Ver análise salva
                </button>
              )}
            </div>
          </section>
        );
      })()}

      <section style={styles.hero}>
        <div>
          <span style={styles.liveBadge}>● DASHBOARD ONLINE</span>

          <h1 style={styles.heroTitle}>
            Jogos online para analisar com IA.
          </h1>

          <p style={styles.heroText}>
            O Dashboard busca jogos direto da API por data, sem depender da rota /football/live.
          </p>

          <div style={styles.heroChips}>
            <span style={styles.chip}>🔴 Ao vivo</span>
            <span style={styles.chip}>⏳ Futuros</span>
            <span style={styles.chip}>🏁 Finalizados</span>
            <span style={styles.chip}>🤖 Análise IA</span>
          </div>
        </div>

        <div style={styles.heroPanel}>
          <strong style={styles.bigNumber}>{plan}</strong>
          <span>Plano ativo</span>

          <div style={styles.pulseBar}>
            <div style={styles.pulseFill} />
          </div>
        </div>
      </section>

      <section style={styles.history}>
        <div style={styles.historyCard}>
          <span>Jogos online</span>
          <strong>{totalGames}</strong>
        </div>

        <div style={styles.historyCardOpen}>
          <span>Ao vivo</span>
          <strong>{liveGames}</strong>
        </div>

        <div style={styles.historyCardVip}>
          <span>Futuros</span>
          <strong>{futureGames}</strong>
        </div>

        <div style={styles.historyCardWon}>
          <span>Finalizados</span>
          <strong>{finishedGames}</strong>
        </div>

        <div style={styles.historyCard}>
          <span>Salvos</span>
          <strong>{savedBets.length}</strong>
        </div>

        <div style={styles.historyCard}>
          <span>Favoritos</span>
          <strong>{favorites.length}</strong>
        </div>

        <div style={styles.historyCard}>
          <span>ROI</span>
          <strong>{stats?.roi ?? 0}%</strong>
        </div>

        <div style={styles.historyCard}>
          <span>Lucro simulado</span>
          <strong>R$ {stats?.profit ?? 0}</strong>
        </div>
      </section>

      <section style={styles.content}>
        <aside style={styles.sidebar}>
          <div style={styles.sideCardGreen}>
            <span>📡 Online agora</span>
            <strong>{totalGames}</strong>
            <small>Jogos puxados direto da API</small>
          </div>

          <div style={styles.sideCard}>
            <h3>Resumo</h3>
            <p style={styles.rank}>🔴 Ao vivo: {liveGames}</p>
            <p style={styles.rank}>⏳ Futuros: {futureGames}</p>
            <p style={styles.rank}>🏁 Finalizados: {finishedGames}</p>
          </div>

          <div style={styles.sideCard}>
            <h3>Histórico Oddix</h3>
            <p style={styles.rank}>📚 Salvos: {savedBets.length}</p>
            <p style={styles.rank}>⭐ Favoritos: {favorites.length}</p>
            <p style={styles.rank}>📈 ROI: {stats?.roi ?? 0}%</p>
            <p style={styles.rank}>💰 Lucro: R$ {stats?.profit ?? 0}</p>
          </div>

          <div style={styles.sideCard}>
            <h3>Melhores dados</h3>
            <p style={styles.rank}>🏆 Liga: {stats?.bestLeague || '-'}</p>
            <p style={styles.rank}>🎯 Mercado: {stats?.bestMarket || '-'}</p>
            <p style={styles.rank}>📊 Odd média: {stats?.averageOdd ?? '-'}</p>
          </div>
        </aside>

        <section>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Jogos online</h2>
              <p style={styles.sectionSubtitle}>
                {isPaidPlan
                  ? 'Escolha um jogo para a IA analisar.'
                  : 'Plano FREE: você vê os jogos, mas a análise IA é liberada no PRO/VIP.'}
              </p>
            </div>

            <button
              style={styles.refreshButton}
              onClick={() => {
                loadGames();
                loadSavedBets();
                loadStats();
              }}
            >
              Atualizar
            </button>
          </div>

          <div style={styles.filterBox}>
            {[
              { label: 'Todos', value: 'all' },
              { label: '🔴 Ao vivo', value: 'live' },
              { label: '📌 Hoje', value: 'today' },
              { label: '⏳ Futuros', value: 'future' },
              { label: '🏁 Finalizados', value: 'finished' },
            ].map((item) => (
              <button
                key={item.value}
                style={
                  statusFilter === item.value
                    ? styles.filterButtonActive
                    : styles.filterButton
                }
                onClick={() => setStatusFilter(item.value)}
              >
                {item.label}
              </button>
            ))}

            <select
              style={styles.leagueSelect}
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
            >
              <option value="all">Todas as ligas</option>

              {leagues.map((league: any) => (
                <option key={league} value={league}>
                  {league}
                </option>
              ))}
            </select>

            <input
              style={styles.searchInput}
              placeholder="Buscar por time ou liga..."
              value={searchTeam}
              onChange={(e) => setSearchTeam(e.target.value)}
            />

            <button style={styles.clearButton} onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>

          <p style={styles.resultText}>
            Mostrando {filteredGames.length} de {games.length} jogos online
          </p>

          {loading ? (
            <div style={styles.emptyBox}>
              <h3>Carregando jogos online...</h3>
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredGames.map((game) => {
                const score = getScore(game);
                const saved = isSavedGame(game);
                const live = isGameLive(game);
                const finished = isGameFinished(game);
                const fixtureId = game.fixture?.id;

                return (
                  <div key={fixtureId} style={live ? styles.cardLive : styles.card}>
                    <div style={styles.topLine} />

                    <div style={styles.cardHead}>
                      <div style={styles.league}>
                        <img
                          src={game.league?.logo || logoFallback(game.league?.name, '22c55e', '000000')}
                          style={styles.leagueLogo}
                        />
                        <span>{game.league?.name}</span>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,
                          ...(live
                            ? styles.statusLive
                            : finished
                            ? styles.statusFinished
                            : styles.statusOpen),
                        }}
                      >
                        {getGameStatusLabel(game)}
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

                      <div style={styles.centerScore}>
                        <strong>{score.home}</strong>
                        <span>-</span>
                        <strong>{score.away}</strong>
                        <small>{getGameTimeText(game)}</small>
                      </div>

                      <div style={styles.team}>
                        <img
                          src={game.teams?.away?.logo || logoFallback(game.teams?.away?.name)}
                          style={styles.teamLogo}
                        />
                        <strong>{game.teams?.away?.name}</strong>
                      </div>
                    </div>

                    <div style={styles.dashboardLiveTimeline}>
                      <div
                        style={{
                          ...styles.dashboardLiveTimelineFill,
                          width: `${getTimelinePercent(game)}%`,
                        }}
                      />
                      <div
                        style={{
                          ...styles.dashboardLiveTimelineBall,
                          left: `${getTimelinePercent(game)}%`,
                        }}
                      >
                        ⚽
                      </div>
                    </div>

                    <div style={styles.infoGrid}>
                      <div style={styles.infoItem}>
                        <small>{live ? 'Tempo ao vivo' : finished ? 'Finalizado' : 'Começa em'}</small>
                        <strong>{getGameTimeText(game)}</strong>
                      </div>

                      <div style={styles.infoItem}>
                        <small>País</small>
                        <strong>{game.league?.country || '-'}</strong>
                      </div>

                      <div style={styles.infoItem}>
                        <small>Status</small>
                        <strong>{game.fixture?.status?.long || '-'}</strong>
                      </div>

                      <div style={styles.infoItem}>
                        <small>Salvo</small>
                        <strong>{saved ? 'Sim' : 'Não'}</strong>
                      </div>
                    </div>

                    <div style={styles.footerCard}>
                      <button
                        style={saved ? styles.favoriteActiveButton : styles.favoriteButton}
                        onClick={() => {
                          const betId = getSavedBetId(game);

                          if (betId) {
                            window.location.href = `/dashboard/bet/${betId}`;
                          } else {
                            analyzeGame(game);
                          }
                        }}
                      >
                        {saved ? '✅ Ver salvo' : '🤖 Analisar'}
                      </button>

                      <button
                        style={styles.analysisButton}
                        onClick={() => analyzeGame(game)}
                        disabled={analyzingId === fixtureId}
                      >
                        {!isPaidPlan ? 'Liberar análise' : analyzingId === fixtureId ? 'Analisando...' : 'Ver análise'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filteredGames.length === 0 && (
            <div style={styles.emptyBox}>
              <h3>Nenhum jogo encontrado</h3>
              <p>Tente mudar o filtro ou atualizar novamente.</p>
            </div>
          )}
        </section>
      </section>

      <footer style={styles.footer}>
        <strong>ODDIX</strong>
        <span>Dashboard online • IA • Placar ao vivo • Gestão de risco</span>
        <span>Jogue com responsabilidade.</span>
      </footer>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100vw',
    color: '#fff',
    padding: '18px 30px 28px',
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
    marginBottom: '8px',
    gap: '20px',
  },
  logoBox: {
    width: '540px',
    height: '205px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '42px',
    background: 'rgba(0,0,0,.25)',
    boxShadow: '0 0 45px rgba(0,0,0,.85)',
  },
  logo: {
    width: '520px',
    height: '190px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 22px rgba(0,0,0,.95))',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    color: '#e5e5e5',
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
  liveNavButton: {
    background: 'rgba(239,68,68,.16)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,.45)',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  adminButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.18)',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  historyButton: {
    background: 'rgba(56,189,248,.14)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,.4)',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  favoriteNavButton: {
    background: 'rgba(250,204,21,.15)',
    color: '#facc15',
    border: '1px solid rgba(250,204,21,.45)',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  freeGroupButton: {
    background: 'rgba(34,197,94,.14)',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,.45)',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
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
  logoutButton: {
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    padding: '11px 16px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  analysisPanel: {
    position: 'relative' as const,
    zIndex: 2,
    background: 'linear-gradient(145deg,rgba(11,15,20,.98),rgba(0,0,0,.93))',
    border: '1px solid rgba(34,197,94,.3)',
    borderRadius: '28px',
    padding: '24px',
    marginBottom: '22px',
  },
  analysisTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'flex-start',
  },
  liveAnalysisBadge: {
    background: 'rgba(239,68,68,.18)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,.45)',
    padding: '8px 13px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  futureAnalysisBadge: {
    background: 'rgba(56,189,248,.16)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,.35)',
    padding: '8px 13px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  analysisTitle: {
    fontSize: '32px',
    marginBottom: '6px',
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
  analysisScoreboard: {
    display: 'grid',
    gridTemplateColumns: '1fr 240px 1fr',
    alignItems: 'center',
    gap: '16px',
    marginTop: '22px',
    background: 'rgba(255,255,255,.045)',
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: '20px',
    padding: '18px',
  },
  analysisTeam: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
    textAlign: 'center' as const,
    fontSize: '18px',
  },
  analysisLogo: {
    width: '82px',
    height: '82px',
    objectFit: 'contain' as const,
  },
  analysisScoreCenter: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
  },
  analysisScore: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
    color: '#22c55e',
    fontSize: '48px',
    fontWeight: 'bold',
  },
  analysisClock: {
    background: '#06140c',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,.5)',
    borderRadius: '13px',
    padding: '8px 18px',
  },
  statsPanel: {
    marginTop: '18px',
    background: 'rgba(0,0,0,.38)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '18px',
    padding: '15px',
  },
  statsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    color: '#22c55e',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
  },
  statsTable: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '7px',
  },
  statsRowHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: '8px',
    background: 'rgba(255,255,255,.08)',
    borderRadius: '12px',
    padding: '10px',
    color: '#fff',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: '8px',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: '12px',
    padding: '9px',
  },
  statsEmpty: {
    color: '#d4d4d8',
    margin: 0,
  },
  analysisGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '10px',
    marginTop: '16px',
  },
  analysisMetric: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.09)',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  analysisText: {
    background: 'rgba(255,255,255,.045)',
    border: '1px solid rgba(255,255,255,.1)',
    color: '#d4d4d8',
    lineHeight: 1.65,
    borderRadius: '16px',
    padding: '16px',
  },
  analysisActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    marginTop: '16px',
  },
  saveButton: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    border: 0,
    padding: '12px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  savedButton: {
    background: '#facc15',
    color: '#000',
    border: 0,
    padding: '12px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'not-allowed',
  },
  openSavedButton: {
    background: 'rgba(255,255,255,.08)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.16)',
    padding: '12px 18px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  hero: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: '1fr 260px',
    gap: '20px',
    padding: '34px',
    borderRadius: '30px',
    background: 'linear-gradient(135deg,rgba(20,20,25,.92),rgba(5,5,5,.88))',
    border: '1px solid rgba(255,255,255,.12)',
    boxShadow: '0 0 60px rgba(0,0,0,.55)',
    marginBottom: '22px',
  },
  liveBadge: {
    background: '#ef4444',
    padding: '8px 13px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  heroTitle: {
    fontSize: '42px',
    maxWidth: '780px',
    marginBottom: '10px',
  },
  heroText: {
    color: '#d4d4d8',
    fontSize: '16px',
  },
  heroChips: {
    marginTop: '18px',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  chip: {
    background: 'rgba(255,255,255,.08)',
    border: '1px solid rgba(255,255,255,.1)',
    padding: '9px 12px',
    borderRadius: '999px',
  },
  heroPanel: {
    background: 'rgba(0,0,0,.55)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '24px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
  },
  bigNumber: {
    fontSize: '48px',
    color: '#22c55e',
  },
  pulseBar: {
    marginTop: '18px',
    height: '10px',
    background: '#27272a',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  pulseFill: {
    width: '91%',
    height: '100%',
    background: 'linear-gradient(90deg,#22c55e,#a3e635)',
  },
  history: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '14px',
    marginBottom: '22px',
  },
  historyCard: {
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  historyCardOpen: {
    background: 'linear-gradient(135deg,#f97316,#facc15)',
    color: '#000',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    fontWeight: 'bold',
  },
  historyCardWon: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    fontWeight: 'bold',
  },
  historyCardVip: {
    background: 'linear-gradient(135deg,#38bdf8,#6366f1)',
    color: '#000',
    borderRadius: '18px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    fontWeight: 'bold',
  },
  content: {
    position: 'relative' as const,
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: '18px',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  sideCard: {
    background: 'rgba(12,12,15,.88)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '22px',
    padding: '18px',
    backdropFilter: 'blur(12px)',
  },
  sideCardGreen: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#000',
    borderRadius: '22px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    fontWeight: 'bold',
  },
  rank: {
    background: 'rgba(255,255,255,.06)',
    padding: '10px',
    borderRadius: '12px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '28px',
  },
  sectionSubtitle: {
    margin: 0,
    color: '#c4c4c4',
  },
  refreshButton: {
    background: 'transparent',
    border: '1px solid #22c55e',
    color: '#22c55e',
    padding: '10px 16px',
    borderRadius: '14px',
    cursor: 'pointer',
  },
  filterBox: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
    marginBottom: '10px',
    alignItems: 'center',
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
  leagueSelect: {
    background: 'rgba(0,0,0,.65)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.14)',
    padding: '11px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    outline: 'none',
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
    minWidth: '220px',
  },
  clearButton: {
    background: 'rgba(239,68,68,.15)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,.4)',
    padding: '10px 14px',
    borderRadius: '999px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  resultText: {
    color: '#c4c4c4',
    marginBottom: '16px',
    fontSize: '14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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
    background: 'linear-gradient(135deg,rgba(239,68,68,.18),rgba(10,10,13,.94))',
    border: '1px solid rgba(239,68,68,.42)',
    borderRadius: '24px',
    padding: '17px',
    boxShadow: '0 20px 45px rgba(239,68,68,.18)',
    backdropFilter: 'blur(12px)',
  },
  topLine: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg,#22c55e,#a3e635,#22c55e)',
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
    width: '28px',
    height: '28px',
    objectFit: 'contain' as const,
  },
  statusBadge: {
    padding: '5px 10px',
    borderRadius: '999px',
    fontWeight: 'bold',
    fontSize: '11px',
  },
  statusOpen: {
    background: '#38bdf8',
    color: '#000',
  },
  statusLive: {
    background: '#ef4444',
    color: '#fff',
  },
  statusFinished: {
    background: '#71717a',
    color: '#fff',
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
    width: '54px',
    height: '54px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 14px rgba(255,255,255,.18))',
  },
  centerScore: {
    background: '#06140c',
    border: '1px solid rgba(34,197,94,.48)',
    color: '#22c55e',
    borderRadius: '16px',
    padding: '7px 0',
    textAlign: 'center' as const,
    fontWeight: 'bold',
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: '18px',
    boxShadow: '0 0 18px rgba(34,197,94,.12)',
  },
  dashboardLiveTimeline: {
    position: 'relative' as const,
    height: '7px',
    background: 'rgba(255,255,255,.13)',
    borderRadius: '999px',
    marginBottom: '14px',
  },
  dashboardLiveTimelineFill: {
    height: '100%',
    background: 'linear-gradient(90deg,#22c55e,#a3e635)',
    borderRadius: '999px',
  },
  dashboardLiveTimelineBall: {
    position: 'absolute' as const,
    top: '-9px',
    transform: 'translateX(-50%)',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#06140c',
    border: '1px solid rgba(34,197,94,.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
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
  footerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  favoriteButton: {
    background: 'rgba(250,204,21,.12)',
    color: '#facc15',
    border: '1px solid rgba(250,204,21,.45)',
    borderRadius: '12px',
    padding: '9px 12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  favoriteActiveButton: {
    background: '#facc15',
    color: '#000',
    border: 0,
    borderRadius: '12px',
    padding: '9px 12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  analysisButton: {
    background: '#22c55e',
    color: '#000',
    border: 0,
    borderRadius: '12px',
    padding: '9px 12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  marketsMiniBox: {
    background: 'rgba(0,0,0,.38)',
    border: '1px solid rgba(34,197,94,.25)',
    borderRadius: '18px',
    padding: '13px',
    marginTop: '14px',
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
    color: '#facc15',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  emptyBox: {
    marginTop: '18px',
    background: 'rgba(0,0,0,.55)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '20px',
    padding: '24px',
    textAlign: 'center' as const,
    color: '#d4d4d8',
  },
  footer: {
    position: 'relative' as const,
    zIndex: 2,
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255,255,255,.12)',
    display: 'flex',
    justifyContent: 'space-between',
    color: '#c4c4c4',
    gap: '12px',
    flexWrap: 'wrap' as const,
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
  navButton: {
    background: 'linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.04))',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.16)',
    padding: '11px 14px',
    borderRadius: '999px',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: 'inset 0 0 18px rgba(255,255,255,.03)',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    color: '#fff',
    borderRadius: '999px',
    padding: '9px 13px',
    fontWeight: '900',
    fontSize: '12px',
    boxShadow: '0 0 20px rgba(239,68,68,.25)',
  },
  statCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  },
  statCard: {
    background:
      'linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.035))',
    border: '1px solid rgba(255,255,255,.13)',
    borderRadius: '20px',
    padding: '16px',
    boxShadow: 'inset 0 0 22px rgba(255,255,255,.03), 0 14px 35px rgba(0,0,0,.24)',
  },
  greenStatCard: {
    background: 'linear-gradient(135deg,#22c55e,#84cc16)',
    color: '#020617',
    borderRadius: '20px',
    padding: '16px',
    fontWeight: '900',
    boxShadow: '0 0 30px rgba(34,197,94,.25)',
  },
  orangeStatCard: {
    background: 'linear-gradient(135deg,#f59e0b,#f97316)',
    color: '#020617',
    borderRadius: '20px',
    padding: '16px',
    fontWeight: '900',
    boxShadow: '0 0 30px rgba(249,115,22,.22)',
  },
  blueStatCard: {
    background: 'linear-gradient(135deg,#38bdf8,#6366f1)',
    color: '#020617',
    borderRadius: '20px',
    padding: '16px',
    fontWeight: '900',
    boxShadow: '0 0 30px rgba(56,189,248,.22)',
  },
  dashboardShell: {
    display: 'grid',
    gridTemplateColumns: '290px minmax(0,1fr)',
    gap: '18px',
    alignItems: 'start',
  },
  sidebarCard: {
    background: 'linear-gradient(135deg, rgba(0,0,0,.82), rgba(15,23,42,.78))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '24px',
    padding: '18px',
    boxShadow: '0 18px 45px rgba(0,0,0,.35)',
  },
  contentPanel: {
    background: 'linear-gradient(135deg, rgba(0,0,0,.52), rgba(15,23,42,.58))',
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: '28px',
    padding: '18px',
    boxShadow: '0 18px 55px rgba(0,0,0,.30)',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
    marginBottom: '18px',
    padding: '12px',
    borderRadius: '20px',
    background: 'rgba(0,0,0,.45)',
    border: '1px solid rgba(255,255,255,.10)',
  },
  activeFilterButton: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#020617',
    border: '1px solid rgba(34,197,94,.7)',
    padding: '10px 13px',
    borderRadius: '999px',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 0 22px rgba(34,197,94,.30)',
  },
  select: {
    background: 'rgba(0,0,0,.66)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.16)',
    padding: '12px 14px',
    borderRadius: '999px',
    outline: 'none',
  },
  gamesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
    gap: '16px',
  },
  gameCard: {
    position: 'relative' as const,
    overflow: 'hidden',
    background:
      'linear-gradient(135deg, rgba(34,197,94,.11), rgba(15,23,42,.88) 42%, rgba(0,0,0,.96))',
    border: '1px solid rgba(34,197,94,.24)',
    borderRadius: '26px',
    padding: '18px',
    boxShadow: '0 0 30px rgba(34,197,94,.08), 0 18px 42px rgba(0,0,0,.35)',
  },
  liveGameCard: {
    position: 'relative' as const,
    overflow: 'hidden',
    background:
      'linear-gradient(135deg, rgba(239,68,68,.20), rgba(15,23,42,.90) 42%, rgba(0,0,0,.98))',
    border: '1px solid rgba(239,68,68,.45)',
    borderRadius: '26px',
    padding: '18px',
    boxShadow: '0 0 34px rgba(239,68,68,.18), 0 18px 42px rgba(0,0,0,.35)',
  },
  scoreBadge: {
    background: 'linear-gradient(135deg,#020617,#111827)',
    border: '1px solid rgba(34,197,94,.45)',
    color: '#22c55e',
    borderRadius: '18px',
    padding: '10px 13px',
    fontSize: '24px',
    fontWeight: '900',
    minWidth: '86px',
    textAlign: 'center' as const,
    boxShadow: 'inset 0 0 18px rgba(34,197,94,.08)',
  },
  analyzeButton: {
    background: 'linear-gradient(135deg,#22c55e,#a3e635)',
    color: '#020617',
    border: 0,
    borderRadius: '14px',
    padding: '12px 14px',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 0 22px rgba(34,197,94,.25)',
  },
  viewButton: {
    background: 'linear-gradient(135deg,#38bdf8,#2563eb)',
    color: '#fff',
    border: 0,
    borderRadius: '14px',
    padding: '12px 14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
};;
