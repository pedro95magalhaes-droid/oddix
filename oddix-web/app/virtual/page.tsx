"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api } from "../../services/api";

const LEAGUES = [
  { key: "euro", name: "Euro Cup Virtual" },
  { key: "copa", name: "Copa Virtual" },
  { key: "super", name: "Super Liga Virtual" },
  { key: "primeiro", name: "Primeira Liga Virtual" },
  { key: "expressar", name: "Express Virtual" },
];

const DEMO_PATTERNS = {
  sampleSize: 300,
  over05: 94,
  over15: 82,
  over25: 64,
  under35: 88,
  btts: 58,
  homeWins: 47,
  awayWins: 29,
  draws: 24,
};

const DEMO_STATS = {
  greens: 128,
  reds: 32,
  voids: 4,
  pending: 6,
  total: 170,
  winRate: 80,
  roi: 23.4,
  profit: 56.3,
  streak: 9,
  bestStreak: 15,
};

const DEMO_ROI = {
  today: 18.4,
  sevenDays: 23.4,
  thirtyDays: 31.7,
};

const DEMO_RESULTS = ["GREEN", "GREEN", "RED", "GREEN", "GREEN"];

const DEMO_HALL = {
  bestOdd: {
    odd: 2.35,
    league: "Euro Cup Virtual",
  },
  bestStreak: {
    greens: 15,
  },
  topLeague: {
    league: "Euro Cup Virtual",
    roi: 28.2,
  },
};

const DEMO_PICK = {
  id: "demo-pick-1",
  league: "Euro Cup Virtual",
  homeTeam: "Oddix 1",
  awayTeam: "Virtual 2",
  timeLabel: "12:05",
  odds: {},
  topPick: {
    market: "Total de Gols",
    selection: "Over 2.5 Gols",
    odd: 1.82,
    score: 94,
    confidence: 94,
    reason:
      "Pick demonstrativa usada apenas quando a API real não retorna Top Pick válido.",
  },
};

const DEMO_UPCOMING = [
  {
    id: "demo-1",
    competition: "Euro Cup Virtual",
    timeA: "Oddix 1",
    timeB: "Virtual 2",
    horario: "12:05",
    odds: {
      odd_resultado_final_casa: "2.05",
      odd_resultado_final_empate: "3.10",
      odd_resultado_final_fora: "2.80",
      odd_over_1_5: "1.38",
      odd_ambas_sim: "1.75",
      odd_under_3_5: "1.42",
    },
  },
  {
    id: "demo-2",
    competition: "Copa Virtual",
    timeA: "Oddix 2",
    timeB: "Virtual 3",
    horario: "12:10",
    odds: {
      odd_resultado_final_casa: "1.95",
      odd_resultado_final_empate: "3.20",
      odd_resultado_final_fora: "3.00",
      odd_over_1_5: "1.40",
      odd_ambas_sim: "1.72",
      odd_under_3_5: "1.45",
    },
  },
  {
    id: "demo-3",
    competition: "Super Liga Virtual",
    timeA: "Oddix 3",
    timeB: "Virtual 4",
    horario: "12:15",
    odds: {
      odd_resultado_final_casa: "2.10",
      odd_resultado_final_empate: "3.00",
      odd_resultado_final_fora: "2.70",
      odd_over_1_5: "1.35",
      odd_ambas_sim: "1.80",
      odd_under_3_5: "1.44",
    },
  },
];

function getLeagueName(key: string) {
  return LEAGUES.find((item) => item.key === key)?.name || `${key} Virtual`;
}

function safeNumber(value: any, fallback = 0) {
  const cleaned = String(value ?? "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value: any, fallback = 0) {
  return `${safeNumber(value, fallback).toFixed(1).replace(".0", "")}%`;
}

function formatTimeLabel(value: any) {
  if (!value) return "-";

  const raw = String(value);

  if (/^\d{1,2}:\d{2}$/.test(raw)) return raw;

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripAccents(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(key: string) {
  return stripAccents(String(key || ""))
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .replace(/^impar_/, "odd_")
    .replace(/^ímpar_/, "odd_")
    .replace(/^odd_odd_/, "odd_")
    .trim();
}

function normalizeOdds(odds: any = {}) {
  const normalized: Record<string, any> = {};

  Object.entries(odds || {}).forEach(([key, value]) => {
    const fixedKey = normalizeKey(key);
    normalized[fixedKey] = value;
    normalized[fixedKey.replace(/,/g, ".")] = value;
    normalized[fixedKey.replace(/\./g, "_")] = value;
  });

  return normalized;
}

function getOdd(odds: any, ...keys: string[]) {
  const normalized = normalizeOdds(odds);

  for (const key of keys) {
    const fixedKey = normalizeKey(key);
    const value =
      normalized[fixedKey] ??
      normalized[fixedKey.replace(/\./g, "_")] ??
      normalized[fixedKey.replace(/,/g, ".")];

    if (value !== undefined && value !== null && value !== "") {
      return String(value).replace(",", ".").trim();
    }
  }

  return "-";
}

function normalizeMatch(match: any, fallbackLeague = "euro") {
  const odds = normalizeOdds(match?.odds || match?.odd || {});

  return {
    ...match,
    id: String(
      match?.id ||
        `${match?.timeA || match?.homeTeam}-${match?.timeB || match?.awayTeam}-${
          match?.horario || ""
        }`,
    ),
    competition:
      match?.competition ||
      match?.competicao ||
      match?.["competição"] ||
      match?.league ||
      match?.liga ||
      getLeagueName(fallbackLeague),
    timeA:
      match?.timeA ||
      match?.homeTeam ||
      match?.home ||
      match?.casa ||
      "Casa",
    timeB:
      match?.timeB ||
      match?.awayTeam ||
      match?.away ||
      match?.fora ||
      "Fora",
    horario:
      match?.horario ||
      match?.timeLabel ||
      match?.kickoff ||
      match?.inicio ||
      match?.["início"] ||
      `${match?.hora || ""}:${match?.minuto || ""}`,
    odds,
  };
}

function normalizePick(pick: any) {
  const directTopPick =
    pick?.market ||
    pick?.mercado ||
    pick?.tip ||
    pick?.dica ||
    pick?.selection ||
    pick?.odd ||
    pick?.["ímpar"]
      ? {
          market: pick?.market || pick?.mercado || "Mercado",
          selection:
            pick?.selection ||
            pick?.selecao ||
            pick?.escolha ||
            pick?.tip ||
            pick?.dica ||
            "Entrada",
          odd: safeNumber(pick?.odd ?? pick?.["ímpar"], 0),
          score: safeNumber(
            pick?.score ??
              pick?.pontuacao ??
              pick?.["pontuação"] ??
              pick?.confidence ??
              pick?.confianca ??
              pick?.["confiança"],
            0,
          ),
          confidence: safeNumber(
            pick?.confidence ?? pick?.confianca ?? pick?.["confiança"] ?? pick?.score,
            0,
          ),
          reason: pick?.reason || pick?.motivo,
        }
      : null;

  const topPick =
    pick?.topPick ||
    pick?.top_pick ||
    pick?.principal ||
    pick?.bestPick ||
    pick?.best_pick ||
    directTopPick ||
    null;

  const normalizedTopPick = topPick
    ? {
        ...topPick,
        market: topPick.market || topPick.mercado || "Mercado",
        selection:
          topPick.selection ||
          topPick.selecao ||
          topPick.escolha ||
          topPick.tip ||
          topPick.dica ||
          "Entrada",
        odd: safeNumber(topPick.odd ?? topPick["ímpar"], 0),
        score: safeNumber(
          topPick.score ?? topPick.pontuacao ?? topPick["pontuação"] ?? topPick.confidence ?? topPick.confianca ?? topPick["confiança"],
          0,
        ),
        confidence: safeNumber(
          topPick.confidence ??
            topPick.confianca ??
            topPick["confiança"] ??
            topPick.score,
          0,
        ),
        reason:
          topPick.reason ||
          topPick.motivo ||
          pick?.reason ||
          pick?.motivo ||
          "Padrão estatístico detectado pela IA Virtual.",
      }
    : null;

  return {
    ...pick,
    id: String(
      pick?.id ||
        `${pick?.homeTeam || pick?.timeA}-${pick?.awayTeam || pick?.timeB}-${
          pick?.timeLabel || ""
        }`,
    ),
    league: pick?.league || pick?.liga || pick?.competition || "virtual",
    homeTeam: pick?.homeTeam || pick?.timeA || pick?.casa || "Casa",
    awayTeam: pick?.awayTeam || pick?.timeB || pick?.fora || "Fora",
    timeLabel:
      pick?.timeLabel ||
      pick?.horario ||
      pick?.kickoff ||
      pick?.inicio ||
      pick?.["início"] ||
      `${pick?.hora || ""}:${pick?.minuto || ""}`,
    topPick: normalizedTopPick,
    odds: normalizeOdds(pick?.odds || {}),
  };
}

function unwrapArray(data: any, keys: string[]) {
  if (!data) return [];

  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;

  return [];
}

function pickPatternValue(raw: any, keys: string[], fallback = 0) {
  if (!raw) return fallback;

  const normalizedMap: Record<string, any> = {};

  Object.entries(raw || {}).forEach(([key, value]) => {
    const normalized = stripAccents(String(key))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    normalizedMap[normalized] = value;
  });

  for (const key of keys) {
    const direct = raw[key];

    if (direct !== undefined && direct !== null && direct !== "") {
      return safeNumber(direct, fallback);
    }

    const normalized = stripAccents(String(key))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const mapped = normalizedMap[normalized];

    if (mapped !== undefined && mapped !== null && mapped !== "") {
      return safeNumber(mapped, fallback);
    }
  }

  return fallback;
}

function unwrapPatterns(data: any) {
  const raw =
    data?.patterns ||
    data?.padroes ||
    data?.padrões ||
    data?.stats ||
    data?.data?.patterns ||
    data?.data?.padroes ||
    data?.data?.padrões ||
    data?.data ||
    null;

  if (!raw || Array.isArray(raw)) return null;

  return {
    sampleSize: pickPatternValue(raw, ["sampleSize", "sample_size", "amostra"]),
    over05: pickPatternValue(raw, ["over05", "over0_5", "over0.5", "mais de 0.5"]),
    over15: pickPatternValue(raw, ["over15", "over1_5", "over1.5", "mais de 1.5"]),
    over25: pickPatternValue(raw, ["over25", "over2_5", "over2.5", "mais de 2.5"]),
    under35: pickPatternValue(raw, ["under35", "under3_5", "under3.5", "menos de 3.5"]),
    btts: pickPatternValue(raw, ["btts", "ambasMarcam", "ambas marcam"]),
    homeWins: pickPatternValue(raw, ["homeWins", "casaVence", "casa vence"]),
    awayWins: pickPatternValue(raw, ["awayWins", "foraVence", "fora vence"]),
    draws: pickPatternValue(raw, ["draws", "empates", "empate"]),
  };
}

export default function VirtualPage() {
  const [league, setLeague] = useState("euro");
  const [loading, setLoading] = useState(true);
  const [topPicks, setTopPicks] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(DEMO_STATS);
  const [roi, setRoi] = useState<any>(DEMO_ROI);
  const [results, setResults] = useState<any[]>(DEMO_RESULTS);
  const [hallOfFame, setHallOfFame] = useState<any>(DEMO_HALL);
  const [error, setError] = useState("");

  async function loadVirtual() {
    try {
      setLoading(true);
      setError("");

      const [
        topResponse,
        patternResponse,
        upcomingResponse,
        statsResponse,
        roiResponse,
        resultsResponse,
        hallResponse,
      ] = await Promise.allSettled([
        api.get(`/virtual/top-picks?league=${league}&historyLimit=300`),
        api.get(`/virtual/patterns?league=${league}&limit=300`),
        api.get(`/virtual/upcoming?league=${league}`),
        api.get(`/virtual/stats?league=${league}`),
        api.get(`/virtual/roi?league=${league}`),
        api.get(`/virtual/results?league=${league}`),
        api.get(`/virtual/hall-of-fame?league=${league}`),
      ]);

      let normalizedTopPicks: any[] = [];
      let normalizedUpcoming: any[] = [];

      if (topResponse.status === "fulfilled") {
        const rows = unwrapArray(topResponse.value?.data, [
          "topPicks",
          "top_picks",
          "picks",
          "escolhas",
          "matches",
          "matchs",
        ]);

        normalizedTopPicks = rows.map(normalizePick);
        setTopPicks(normalizedTopPicks);
      } else {
        setTopPicks([]);
      }

      if (patternResponse.status === "fulfilled") {
        setPatterns(unwrapPatterns(patternResponse.value?.data));
      } else {
        setPatterns(null);
      }

      if (upcomingResponse.status === "fulfilled") {
        const rows = unwrapArray(upcomingResponse.value?.data, [
          "matches",
          "matchs",
          "partidas",
          "jogos",
          "games",
          "data",
        ]);

        normalizedUpcoming = rows.map((match: any) =>
          normalizeMatch(match, league),
        );
      }

      if (statsResponse.status === "fulfilled") {
        const data = statsResponse.value?.data;
        setStats(data?.stats || data?.data?.stats || data?.data || data || DEMO_STATS);
      } else {
        setStats(DEMO_STATS);
      }

      if (roiResponse.status === "fulfilled") {
        const data = roiResponse.value?.data;
        setRoi(data?.roi || data?.data?.roi || data?.data || data || DEMO_ROI);
      } else {
        setRoi(DEMO_ROI);
      }

      if (resultsResponse.status === "fulfilled") {
        const data = resultsResponse.value?.data;
        const rows = unwrapArray(data, ["results", "resultados", "history", "data"]);
        setResults(rows.length ? rows : DEMO_RESULTS);
      } else {
        setResults(DEMO_RESULTS);
      }

      if (hallResponse.status === "fulfilled") {
        const data = hallResponse.value?.data;
        setHallOfFame(data?.hallOfFame || data?.hall_of_fame || data?.data?.hallOfFame || data?.data || data || DEMO_HALL);
      } else {
        setHallOfFame(DEMO_HALL);
      }

      if (!normalizedUpcoming.length && normalizedTopPicks.length) {
        normalizedUpcoming = normalizedTopPicks.map((pick) =>
          normalizeMatch(
            {
              id: pick.id,
              competition: pick.league,
              timeA: pick.homeTeam,
              timeB: pick.awayTeam,
              horario: pick.timeLabel,
              odds: pick.odds,
            },
            league,
          ),
        );
      }

      setUpcoming(normalizedUpcoming);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar Oddix Virtual.");
      setTopPicks([]);
      setUpcoming([]);
      setPatterns(null);
      setStats(DEMO_STATS);
      setRoi(DEMO_ROI);
      setResults(DEMO_RESULTS);
      setHallOfFame(DEMO_HALL);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVirtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  const hasRealData = topPicks.length > 0 || upcoming.length > 0;
  const hasValidTopPick = Boolean(topPicks[0]?.topPick);

  const demoMode = !loading && !hasRealData;

  const displayUpcoming = upcoming.length > 0 ? upcoming : DEMO_UPCOMING;

  const displayStats = stats || DEMO_STATS;
  const displayRoi = roi || DEMO_ROI;
  const displayResults = results?.length ? results : DEMO_RESULTS;
  const displayHall = hallOfFame || DEMO_HALL;

  const computedPatterns = useMemo(() => {
    if (patterns) return patterns;

    if (!topPicks.length) return DEMO_PATTERNS;

    const total = Math.max(topPicks.length, 1);

    return {
      ...DEMO_PATTERNS,
      sampleSize: topPicks.length,
      over15:
        Math.round(
          (topPicks.filter((item) =>
            String(item?.topPick?.selection || "").toLowerCase().includes("1.5"),
          ).length /
            total) *
            100,
        ) || DEMO_PATTERNS.over15,
      under35:
        Math.round(
          (topPicks.filter((item) =>
            String(item?.topPick?.selection || "").toLowerCase().includes("3.5"),
          ).length /
            total) *
            100,
        ) || DEMO_PATTERNS.under35,
      btts:
        Math.round(
          (topPicks.filter((item) =>
            String(item?.topPick?.selection || "").toLowerCase().includes("btts"),
          ).length /
            total) *
            100,
        ) || DEMO_PATTERNS.btts,
    };
  }, [patterns, topPicks]);

  const patternRanking = [
    { label: "Under 3.5", value: computedPatterns?.under35 || 0, medal: "🥇" },
    { label: "Over 0.5", value: computedPatterns?.over05 || 0, medal: "🥈" },
    { label: "Over 1.5", value: computedPatterns?.over15 || 0, medal: "🥉" },
    { label: "BTTS", value: computedPatterns?.btts || 0, medal: "4º" },
    { label: "Casa vence", value: computedPatterns?.homeWins || 0, medal: "5º" },
  ].sort((a, b) => b.value - a.value);

  const strongestFallbackPattern = patternRanking[0] || {
    label: "Over 0.5",
    value: 90,
  };

  const firstRealUpcoming = upcoming[0] ? normalizeMatch(upcoming[0], league) : null;

  const fallbackPickFromRealMatch = firstRealUpcoming
    ? {
        id: firstRealUpcoming.id,
        league: firstRealUpcoming.competition || getLeagueName(league),
        homeTeam: firstRealUpcoming.timeA || "Casa",
        awayTeam: firstRealUpcoming.timeB || "Fora",
        timeLabel: firstRealUpcoming.horario,
        odds: firstRealUpcoming.odds || {},
        topPick: {
          market: "Mercado Virtual",
          selection: strongestFallbackPattern.label.includes("Under 3.5")
            ? "Under 3.5 gols"
            : strongestFallbackPattern.label.includes("Over 1.5")
              ? "Over 1.5 gols"
              : strongestFallbackPattern.label.includes("BTTS")
                ? "BTTS - Sim"
                : "Over 0.5 gols",
          odd: strongestFallbackPattern.label.includes("Under 3.5")
            ? getOdd(firstRealUpcoming.odds, "odd_under_3.5", "odd_under_3,5", "odd_under_35")
            : strongestFallbackPattern.label.includes("Over 1.5")
              ? getOdd(firstRealUpcoming.odds, "odd_over_1.5", "odd_over_1,5", "odd_over_15")
              : strongestFallbackPattern.label.includes("BTTS")
                ? getOdd(firstRealUpcoming.odds, "odd_ambas_sim")
                : getOdd(firstRealUpcoming.odds, "odd_over_0.5", "odd_over_0,5", "odd_over_05"),
          score: strongestFallbackPattern.value || 90,
          confidence: strongestFallbackPattern.value || 90,
          reason:
            "Top Pick montado automaticamente com o primeiro jogo real retornado pela API e o padrão estatístico mais forte da amostra.",
        },
      }
    : null;

  const hasApiFallbackPick = Boolean(!hasValidTopPick && fallbackPickFromRealMatch);

  const bestPick = hasValidTopPick
    ? topPicks[0]
    : fallbackPickFromRealMatch || DEMO_PICK;

  function getStrongestPattern() {
    return patternRanking[0] || { label: "Mercado Virtual", value: 0 };
  }

  function getBestMarketForMatch(match: any) {
    const strongest = getStrongestPattern();

    if (strongest.label.includes("Under 3.5")) {
      return {
        label: "Under 3.5 gols",
        odd: getOdd(match.odds, "odd_under_3.5", "odd_under_3,5", "odd_under_35"),
        score: strongest.value,
      };
    }

    if (strongest.label.includes("Over 0.5")) {
      return {
        label: "Over 0.5 gols",
        odd: getOdd(match.odds, "odd_over_0.5", "odd_over_0,5", "odd_over_05"),
        score: strongest.value,
      };
    }

    if (strongest.label.includes("Over 1.5")) {
      return {
        label: "Over 1.5 gols",
        odd: getOdd(match.odds, "odd_over_1.5", "odd_over_1,5", "odd_over_15"),
        score: strongest.value,
      };
    }

    if (strongest.label.includes("BTTS")) {
      return {
        label: "BTTS - Sim",
        odd: getOdd(match.odds, "odd_ambas_sim"),
        score: strongest.value,
      };
    }

    return {
      label: strongest.label || "Mercado Virtual",
      odd: "-",
      score: strongest.value || 0,
    };
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.kicker}>⚡ ODDIX VIRTUAL AI</span>

          <h1 style={styles.title}>Inteligência para Futebol Virtual Oddix</h1>

          <p style={styles.text}>
            Análise estatística avançada, padrões recorrentes, odds inteligentes
            e Top Picks gerados pela IA Oddix Virtual.
          </p>

          <div style={styles.heroBadge}>
            🔥 +{computedPatterns.sampleSize} partidas analisadas •{" "}
            {computedPatterns.under35}% Under 3.5 • {computedPatterns.over15}%
            Over 1.5
          </div>

          {demoMode ? (
            <div style={styles.demoBanner}>
              🎮 MODO DEMONSTRAÇÃO • API indisponível no momento. Os dados reais
              serão atualizados automaticamente quando a API virtual responder.
            </div>
          ) : null}

          <div style={styles.actions}>
            <select
              value={league}
              onChange={(event) => setLeague(event.target.value)}
              style={styles.select}
            >
              {LEAGUES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
            </select>

            <button onClick={loadVirtual} style={styles.primary}>
              {loading ? "Atualizando..." : "Atualizar Virtual"}
            </button>
          </div>

          {error ? <p style={styles.error}>{error}</p> : null}
        </div>

        <div style={styles.heroStats}>
          <Metric label="Jogos próximos" value={displayUpcoming.length} />
          <Metric label="Top Picks" value={topPicks.length || 0} />
          <Metric label="ROI Hoje" value={`+${formatPercent(displayRoi?.today ?? displayStats?.roi, DEMO_ROI.today)}`} />
          <Metric label="Winrate" value={formatPercent(displayStats?.winRate ?? displayStats?.winrate, DEMO_STATS.winRate)} />
        </div>
      </section>

      <section style={styles.quickStats}>
        <MiniStat icon="🟢" label="Greens" value={safeNumber(displayStats?.greens, DEMO_STATS.greens)} />
        <MiniStat icon="🔴" label="Reds" value={safeNumber(displayStats?.reds, DEMO_STATS.reds)} />
        <MiniStat icon="🔥" label="Sequência" value={`${safeNumber(displayStats?.streak, DEMO_STATS.streak)} Greens`} />
        <MiniStat icon="🏆" label="Recorde" value={`${safeNumber(displayStats?.bestStreak, DEMO_STATS.bestStreak)} Greens`} />
      </section>

      <section style={styles.grid}>
        <div style={styles.topPick}>
          <span style={styles.kicker}>
            {hasValidTopPick || hasApiFallbackPick
              ? "🔥 TOP PICK DO MOMENTO"
              : "🎯 PICK DEMONSTRAÇÃO"}
          </span>

          {bestPick?.topPick ? (
            <>
              <div style={styles.scoreBadge}>
                SCORE {bestPick.topPick.score || 0}/100 • CONFIANÇA{" "}
                {bestPick.topPick.confidence || 0}%
              </div>

              <h2 style={styles.matchTitle}>
                {bestPick.homeTeam} x {bestPick.awayTeam}
              </h2>

              <p style={styles.text}>
                {bestPick.league} • {formatTimeLabel(bestPick.timeLabel)}
              </p>

              <div style={styles.pickBox}>
                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>Mercado</small>
                  <strong style={styles.pickStrong}>
                    {bestPick.topPick.selection}
                  </strong>
                  <span style={styles.pickSub}>{bestPick.topPick.market}</span>
                </div>

                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>Odd</small>
                  <strong style={styles.pickStrong}>
                    {bestPick.topPick.odd || "-"}
                  </strong>
                </div>

                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>Score</small>
                  <strong style={styles.pickStrong}>
                    {bestPick.topPick.score || 0}/100
                  </strong>
                </div>

                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>IA</small>
                  <strong style={styles.pickStrong}>
                    {(bestPick.topPick.confidence || 0) >= 93
                      ? "ELITE"
                      : (bestPick.topPick.confidence || 0) >= 85
                        ? "MUITO FORTE"
                        : "FORTE"}
                  </strong>
                </div>
              </div>

              <p style={styles.reason}>{bestPick.topPick.reason}</p>

              {demoMode ? (
                <div style={styles.demoActions}>
                  <span>📈 ROI: +18.4%</span>
                  <span>🏆 Winrate: 80%</span>
                  <span>🔥 Melhor padrão: Over 0.5</span>
                </div>
              ) : null}
            </>
          ) : (
            <div style={styles.emptyTopPick}>
              <h3>🤖 IA Virtual analisando partidas</h3>
              <p>Aguardando sincronização da API virtual.</p>
            </div>
          )}
        </div>

        <div style={styles.patterns}>
          <span style={styles.kicker}>🏆 RANKING DE PADRÕES</span>

          {patternRanking.map((item) => (
            <div key={item.label} style={styles.rankingRow}>
              <span>{item.medal}</span>
              <strong>{item.label}</strong>
              <b>{item.value > 0 ? `${item.value}%` : "Analisando"}</b>
            </div>
          ))}

          <div style={styles.patternDivider} />

          <Pattern label="Over 2.5" value={computedPatterns.over25} />
          <Pattern label="Empates" value={computedPatterns.draws} />
        </div>
      </section>

      <section style={styles.premiumGrid}>
        <PremiumCard
          title="📈 ROI Virtual"
          items={[
            `Hoje: +${formatPercent(displayRoi?.today, DEMO_ROI.today)}`,
            `7 dias: +${formatPercent(displayRoi?.sevenDays ?? displayRoi?.seven_days, DEMO_ROI.sevenDays)}`,
            `30 dias: +${formatPercent(displayRoi?.thirtyDays ?? displayRoi?.thirty_days, DEMO_ROI.thirtyDays)}`,
          ]}
        />
        <PremiumCard
          title="🏆 Hall da Fama"
          items={[
            `Maior Green: Odd ${safeNumber(displayHall?.bestOdd?.odd ?? displayHall?.best_odd?.odd, DEMO_HALL.bestOdd.odd)}`,
            `Melhor sequência: ${safeNumber(displayHall?.bestStreak?.greens ?? displayHall?.best_streak?.greens, DEMO_HALL.bestStreak.greens)} Greens`,
            `Liga destaque: ${displayHall?.topLeague?.league ?? displayHall?.top_league?.league ?? DEMO_HALL.topLeague.league}`,
          ]}
        />
        <PremiumCard
          title="🟢 Últimos Resultados"
          items={displayResults.slice(0, 5).map((item: any) => String(item?.status || item?.result || item))}
        />
      </section>

      <section style={styles.boostSection}>
        <div>
          <span style={styles.kicker}>⚡ ODDIX VIRTUAL BOOST</span>
          <h2 style={styles.boostTitle}>Combinação inteligente do momento</h2>
          <p style={styles.text}>
            Seleção automática baseada nos padrões mais fortes da amostra
            recente.
          </p>
        </div>

        <div style={styles.boostGrid}>
          <BoostLeg
            number="01"
            title="Under 3.5 gols"
            value={`${computedPatterns.under35}% na amostra`}
          />
          <BoostLeg
            number="02"
            title="Over 0.5 gols"
            value={`${computedPatterns.over05}% na amostra`}
          />
          <BoostLeg
            number="03"
            title="Over 1.5 gols"
            value={`${computedPatterns.over15}% na amostra`}
          />
        </div>
      </section>

      <section style={styles.cards}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Próximos Jogos Virtuais</h2>
          <span>{displayUpcoming.length} partidas virtuais</span>
        </div>

        <div style={styles.matchGrid}>
          {displayUpcoming.map((match) => {
            const bestMarket = getBestMarketForMatch(match);

            return (
              <article key={match.id} style={styles.matchCard}>
                <div style={styles.matchTop}>
                  <span>🎮 {match.competition || getLeagueName(league)}</span>
                  <strong>{formatTimeLabel(match.horario)}</strong>
                </div>

                <div style={styles.virtualBadge}>FUTEBOL VIRTUAL • RNG</div>

                <h3>
                  {match.timeA} x {match.timeB}
                </h3>

                <div style={styles.bestMarket}>
                  <span>🎮 Melhor mercado virtual</span>
                  <strong>{bestMarket.label}</strong>
                  <small>
                    Odd {bestMarket.odd} • Score {bestMarket.score}%
                  </small>
                </div>

                <div style={styles.oddsGrid}>
                  <Odd
                    label="Casa"
                    value={getOdd(match.odds, "odd_resultado_final_casa")}
                  />
                  <Odd
                    label="Empate"
                    value={getOdd(match.odds, "odd_resultado_final_empate")}
                  />
                  <Odd
                    label="Fora"
                    value={getOdd(match.odds, "odd_resultado_final_fora")}
                  />
                  <Odd
                    label="Over 1.5"
                    value={getOdd(match.odds, "odd_over_1.5", "odd_over_1,5")}
                  />
                  <Odd label="BTTS" value={getOdd(match.odds, "odd_ambas_sim")} />
                  <Odd
                    label="Under 3.5"
                    value={getOdd(match.odds, "odd_under_3.5", "odd_under_3,5")}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: any) {
  return (
    <div style={styles.metric}>
      <strong style={styles.metricValue}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function MiniStat({ icon, label, value }: any) {
  return (
    <div style={styles.miniStat}>
      <span style={styles.miniStatIcon}>{icon}</span>
      <strong style={styles.miniStatValue}>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function PremiumCard({ title, items }: any) {
  return (
    <div style={styles.premiumCard}>
      <h3>{title}</h3>
      {items.map((item: string) => (
        <div key={item} style={styles.premiumItem}>
          {item}
        </div>
      ))}
    </div>
  );
}

function BoostLeg({ number, title, value }: any) {
  return (
    <div style={styles.boostLeg}>
      <span>{number}</span>
      <strong>{title}</strong>
      <small>{value}</small>
    </div>
  );
}

function Pattern({ label, value }: any) {
  const pct = safeNumber(value, 0);

  return (
    <div style={styles.patternRow}>
      <div style={styles.patternHeader}>
        <span>{label}</span>
        <strong>{pct}%</strong>
      </div>
      <div style={styles.bar}>
        <div style={{ ...styles.fill, width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function Odd({ label, value }: any) {
  return (
    <div style={styles.odd}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(circle at 80% 0%, rgba(250,204,21,.18), transparent 32%), #030303",
    color: "#fff",
    padding: "28px",
    paddingBottom: 96,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  hero: {
    maxWidth: 1280,
    margin: "0 auto 18px",
    border: "1px solid rgba(250,204,21,.32)",
    borderRadius: 28,
    padding: 28,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, .8fr)",
    gap: 20,
    background: "linear-gradient(135deg, rgba(0,0,0,.96), rgba(55,36,4,.88))",
  },
  title: {
    margin: "10px 0",
    fontSize: "clamp(44px, 6vw, 72px)",
    lineHeight: 0.96,
    letterSpacing: -2.5,
  },
  text: {
    color: "rgba(255,255,255,.72)",
    lineHeight: 1.5,
    fontWeight: 700,
  },
  heroBadge: {
    display: "inline-flex",
    padding: "10px 16px",
    borderRadius: 999,
    background: "rgba(250,204,21,.12)",
    border: "1px solid rgba(250,204,21,.35)",
    color: "#facc15",
    fontWeight: 900,
    marginTop: 12,
    flexWrap: "wrap",
    gap: 6,
  },
  demoBanner: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(59,130,246,.12)",
    border: "1px solid rgba(59,130,246,.35)",
    color: "#93c5fd",
    fontWeight: 800,
  },
  kicker: {
    color: "#facc15",
    fontWeight: 1000,
    fontSize: 12,
    letterSpacing: 1,
  },
  actions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  select: {
    background: "#050505",
    color: "#fff",
    border: "1px solid rgba(250,204,21,.35)",
    borderRadius: 14,
    padding: "13px 16px",
    fontWeight: 900,
  },
  primary: {
    background: "#facc15",
    color: "#050505",
    border: 0,
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  error: {
    color: "#fecaca",
    background: "rgba(239,68,68,.12)",
    border: "1px solid rgba(239,68,68,.35)",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  heroStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  metric: {
    border: "1px solid rgba(250,204,21,.28)",
    borderRadius: 18,
    padding: 18,
    background: "rgba(0,0,0,.36)",
    minHeight: 112,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: "clamp(22px, 2.5vw, 34px)",
    lineHeight: 1,
    fontWeight: 1000,
  },
  quickStats: {
    maxWidth: 1280,
    margin: "0 auto 18px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
  },
  miniStat: {
    border: "1px solid rgba(250,204,21,.22)",
    borderRadius: 18,
    padding: 18,
    background: "linear-gradient(135deg, rgba(5,5,5,.96), rgba(22,22,22,.72))",
    display: "grid",
    gap: 6,
    boxShadow: "0 18px 50px rgba(0,0,0,.24)",
  },
  miniStatIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  miniStatValue: {
    fontSize: "clamp(26px, 3vw, 36px)",
    lineHeight: 1,
    fontWeight: 1000,
  },
  grid: {
    maxWidth: 1280,
    margin: "0 auto 18px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, .65fr)",
    gap: 18,
  },
  topPick: {
    border: "1px solid rgba(250,204,21,.65)",
    borderRadius: 24,
    padding: "20px 20px 18px",
    alignSelf: "start",
    background:
      "radial-gradient(circle at 20% 0%, rgba(250,204,21,.20), transparent 36%), rgba(5,5,5,.94)",
    boxShadow: "0 24px 80px rgba(250,204,21,.10)",
  },
  emptyTopPick: {
    display: "grid",
    gap: 12,
    minHeight: 180,
    alignContent: "center",
    textAlign: "center",
    color: "rgba(255,255,255,.75)",
  },
  scoreBadge: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#fff",
    fontWeight: 1000,
    marginBottom: 12,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  matchTitle: {
    fontSize: "clamp(30px, 4vw, 46px)",
    margin: "8px 0 4px",
    lineHeight: 1.05,
    letterSpacing: -1.2,
  },
  pickBox: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1.35fr) .65fr .75fr .75fr",
    gap: 12,
    margin: "14px 0 12px",
  },
  pickItem: {
    border: "1px solid rgba(250,204,21,.22)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(0,0,0,.28)",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  miniLabel: {
    color: "rgba(255,255,255,.62)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickStrong: {
    color: "#facc15",
    fontSize: "clamp(20px, 2vw, 32px)",
    lineHeight: 1.05,
    fontWeight: 1000,
    overflowWrap: "break-word",
  },
  pickSub: {
    color: "rgba(255,255,255,.72)",
    fontWeight: 800,
  },
  demoActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
    color: "#facc15",
    fontWeight: 900,
  },
  patterns: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 24,
    padding: 22,
    background: "rgba(5,5,5,.92)",
  },
  rankingRow: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0,1fr) 90px",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(250,204,21,.16)",
    background: "rgba(250,204,21,.055)",
    borderRadius: 14,
    padding: "12px 14px",
    marginTop: 10,
  },
  patternDivider: {
    height: 1,
    background: "rgba(255,255,255,.10)",
    margin: "16px 0 4px",
  },
  patternRow: {
    marginTop: 14,
  },
  patternHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  bar: {
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,.10)",
    overflow: "hidden",
    marginTop: 6,
  },
  fill: {
    height: "100%",
    background: "linear-gradient(90deg,#22c55e,#facc15)",
  },
  reason: {
    color: "#d9f99d",
    fontWeight: 800,
  },
  premiumGrid: {
    maxWidth: 1280,
    margin: "0 auto 18px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 14,
  },
  premiumCard: {
    border: "1px solid rgba(250,204,21,.22)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(5,5,5,.92)",
  },
  premiumItem: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    color: "rgba(255,255,255,.82)",
    fontWeight: 800,
  },
  boostSection: {
    maxWidth: 1280,
    margin: "0 auto 18px",
    border: "1px solid rgba(34,197,94,.26)",
    borderRadius: 24,
    padding: 22,
    background:
      "radial-gradient(circle at 20% 0%, rgba(34,197,94,.18), transparent 32%), rgba(5,5,5,.92)",
    display: "grid",
    gridTemplateColumns: "minmax(0, .9fr) minmax(360px, 1.1fr)",
    gap: 18,
    alignItems: "center",
  },
  boostTitle: {
    margin: "8px 0 4px",
    fontSize: "clamp(24px, 3vw, 40px)",
    lineHeight: 1.05,
  },
  boostGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  boostLeg: {
    border: "1px solid rgba(34,197,94,.22)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(0,0,0,.28)",
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  cards: {
    maxWidth: 1280,
    margin: "0 auto",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 24,
    padding: 22,
    background: "rgba(5,5,5,.92)",
    scrollMarginBottom: 110,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    margin: 0,
  },
  matchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
    gap: 16,
    marginTop: 12,
  },
  matchCard: {
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 20,
    padding: 20,
    background: "linear-gradient(135deg, rgba(255,255,255,.045), rgba(0,0,0,.28))",
    minWidth: 0,
  },
  matchTop: {
    display: "flex",
    justifyContent: "space-between",
    color: "#facc15",
    fontWeight: 900,
    gap: 12,
  },
  oddsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginTop: 12,
  },
  virtualBadge: {
    display: "inline-flex",
    width: "fit-content",
    marginTop: 10,
    border: "1px solid rgba(34,197,94,.22)",
    background: "rgba(34,197,94,.09)",
    color: "#86efac",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 0.7,
  },
  bestMarket: {
    border: "1px solid rgba(250,204,21,.20)",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    background: "rgba(250,204,21,.06)",
    display: "grid",
    gap: 3,
  },
  odd: {
    border: "1px solid rgba(250,204,21,.18)",
    borderRadius: 12,
    padding: 10,
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
};