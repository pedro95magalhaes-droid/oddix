"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";

const LEAGUES = [
  { key: "euro", name: "Euro Cup" },
  { key: "copa", name: "Copa" },
  { key: "super", name: "Super" },
  { key: "primeiro", name: "Primeiro" },
  { key: "expressar", name: "Expressar" },
];

function safeNumber(value: any, fallback = 0) {
  const cleaned = String(value ?? "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripAccents(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

    // Também cria uma versão com vírgula convertida para ponto e outra com underscore.
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
    id: String(match?.id || `${match?.timeA || match?.homeTeam}-${match?.timeB || match?.awayTeam}-${match?.horario || ""}`),
    competition:
      match?.competition ||
      match?.competicao ||
      match?.["competição"] ||
      match?.league ||
      match?.liga ||
      fallbackLeague,
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
      `${match?.hora || ""}:${match?.minuto || ""}`,
    odds,
  };
}

function normalizePick(pick: any) {
  const topPick = pick?.topPick || pick?.top_pick || pick?.principal || null;
  const normalizedTopPick = topPick
    ? {
        ...topPick,
        market: topPick.market || topPick.mercado || "Mercado",
        selection: topPick.selection || topPick.selecao || topPick.escolha || "Entrada",
        odd: safeNumber(topPick.odd, 0),
        score: safeNumber(topPick.score ?? topPick.pontuacao ?? topPick["pontuação"], 0),
        confidence: safeNumber(
          topPick.confidence ?? topPick.confianca ?? topPick["confiança"],
          0,
        ),
        risk: topPick.risk || topPick.risco || "Médio",
        reason: topPick.reason || topPick.motivo || "Padrão estatístico detectado pela IA Virtual.",
      }
    : null;

  return {
    ...pick,
    id: String(pick?.id || `${pick?.homeTeam}-${pick?.awayTeam}-${pick?.timeLabel || ""}`),
    league: pick?.league || pick?.liga || pick?.competition || "virtual",
    homeTeam: pick?.homeTeam || pick?.timeA || pick?.casa || "Casa",
    awayTeam: pick?.awayTeam || pick?.timeB || pick?.fora || "Fora",
    timeLabel: pick?.timeLabel || pick?.horario || `${pick?.hora || ""}:${pick?.minuto || ""}`,
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
    sampleSize: pickPatternValue(raw, [
      "sampleSize",
      "sample_size",
      "amostra",
      "retornado",
      "returned",
    ]),
    over05: pickPatternValue(raw, [
      "over05",
      "over0_5",
      "over0.5",
      "acima de 05",
      "acima de 0.5",
      "acima de 0,5",
      "mais de 0.5",
      "mais de 0,5",
    ]),
    over15: pickPatternValue(raw, [
      "over15",
      "over1_5",
      "over1.5",
      "acima de 15 anos",
      "acima de 1.5",
      "acima de 1,5",
      "mais de 1.5",
      "mais de 1,5",
    ]),
    over25: pickPatternValue(raw, [
      "over25",
      "over2_5",
      "over2.5",
      "acima de 25 anos",
      "acima de 2.5",
      "acima de 2,5",
      "mais de 2.5",
      "mais de 2,5",
    ]),
    under35: pickPatternValue(raw, [
      "under35",
      "under3_5",
      "under3.5",
      "menores de 35 anos",
      "menos de 3.5",
      "menos de 3,5",
      "under 3.5",
      "under 3,5",
    ]),
    btts: pickPatternValue(raw, [
      "btts",
      "ambasMarcam",
      "ambas_marcam",
      "ambas marcam",
    ]),
    homeWins: pickPatternValue(raw, [
      "homeWins",
      "home_wins",
      "casaVence",
      "casa vence",
      "Vitórias em casa",
      "vitorias em casa",
    ]),
    awayWins: pickPatternValue(raw, [
      "awayWins",
      "away_wins",
      "foraVence",
      "fora vence",
      "VitóriasFora de Casa",
      "vitorias fora de casa",
      "vitórias fora de casa",
    ]),
    draws: pickPatternValue(raw, [
      "draws",
      "empates",
      "empate",
    ]),
  };
}

export default function VirtualPage() {
  const [league, setLeague] = useState("euro");
  const [loading, setLoading] = useState(true);
  const [topPicks, setTopPicks] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function loadVirtual() {
    try {
      setLoading(true);
      setError("");

      const [topResponse, patternResponse, upcomingResponse] = await Promise.allSettled([
        api.get(`/virtual/top-picks?league=${league}&historyLimit=300`),
        api.get(`/virtual/patterns?league=${league}&limit=300`),
        api.get(`/virtual/upcoming?league=${league}`),
      ]);

      let normalizedTopPicks: any[] = [];
      let normalizedUpcoming: any[] = [];

      if (topResponse.status === "fulfilled") {
        const rows = unwrapArray(topResponse.value?.data, [
          "topPicks",
          "top_picks",
          "picks",
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
          "jogos",
          "games",
          "data",
        ]);

        normalizedUpcoming = rows.map((match: any) => normalizeMatch(match, league));
      }

      // Fallback: se /upcoming falhar ou vier vazio, usa os próprios jogos do /top-picks.
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVirtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  const bestPick = topPicks[0];

  const computedPatterns = useMemo(() => {
    if (patterns) return patterns;

    // Fallback visual quando /patterns falhar, usando os próprios Top Picks.
    const total = Math.max(topPicks.length, 1);
    const over15 = topPicks.filter((item) =>
      String(item?.topPick?.selection || "").toLowerCase().includes("1.5"),
    ).length;
    const under35 = topPicks.filter((item) =>
      String(item?.topPick?.selection || "").toLowerCase().includes("3.5"),
    ).length;
    const btts = topPicks.filter((item) =>
      String(item?.topPick?.selection || "").toLowerCase().includes("btts"),
    ).length;

    return {
      sampleSize: topPicks.length,
      over05: 0,
      over15: Math.round((over15 / total) * 100),
      over25: 0,
      under35: Math.round((under35 / total) * 100),
      btts: Math.round((btts / total) * 100),
      homeWins: 0,
      awayWins: 0,
      draws: 0,
    };
  }, [patterns, topPicks]);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.kicker}>⚡ ODDIX VIRTUAL AI</span>
          <h1 style={styles.title}>Inteligência para Futebol Virtual Bet365</h1>
          <p style={styles.text}>
            Análise de padrões, odds e histórico recente. Virtual usa RNG:
            a Oddix mostra tendência estatística, não promessa de resultado.
          </p>

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
          <Metric label="Jogos próximos" value={upcoming.length} />
          <Metric label="Top Picks" value={topPicks.length} />
          <Metric label="Over 1.5" value={`${computedPatterns?.over15 || 0}%`} />
          <Metric label="BTTS" value={`${computedPatterns?.btts || 0}%`} />
        </div>
      </section>

      <section style={styles.grid}>
        <div style={styles.topPick}>
          <span style={styles.kicker}>🔥 TOP PICK VIRTUAL</span>

          {bestPick?.topPick ? (
            <>
              <h2 style={styles.matchTitle}>
                {bestPick.homeTeam} x {bestPick.awayTeam}
              </h2>
              <p style={styles.text}>
                {bestPick.league} • {bestPick.timeLabel}
              </p>

              <div style={styles.pickBox}>
                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>Mercado</small>
                  <strong style={styles.pickStrong}>{bestPick.topPick.selection}</strong>
                  <span style={styles.pickSub}>{bestPick.topPick.market}</span>
                </div>

                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>Odd</small>
                  <strong style={styles.pickStrong}>{bestPick.topPick.odd || "-"}</strong>
                </div>

                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>Score</small>
                  <strong style={styles.pickStrong}>{bestPick.topPick.score || 0}/100</strong>
                </div>

                <div style={styles.pickItem}>
                  <small style={styles.miniLabel}>Confiança</small>
                  <strong style={styles.pickStrong}>{bestPick.topPick.confidence || 0}%</strong>
                </div>
              </div>

              <p style={styles.reason}>{bestPick.topPick.reason}</p>
            </>
          ) : (
            <p style={styles.text}>
              {loading
                ? "Carregando Top Pick Virtual..."
                : "Aguardando padrões suficientes para montar Top Pick Virtual."}
            </p>
          )}
        </div>

        <div style={styles.patterns}>
          <span style={styles.kicker}>📊 PADRÕES RECENTES</span>
          <Pattern label="Over 0.5" value={computedPatterns?.over05} />
          <Pattern label="Over 1.5" value={computedPatterns?.over15} />
          <Pattern label="Over 2.5" value={computedPatterns?.over25} />
          <Pattern label="Under 3.5" value={computedPatterns?.under35} />
          <Pattern label="Ambas Marcam" value={computedPatterns?.btts} />
          <Pattern label="Casa vence" value={computedPatterns?.homeWins} />
        </div>
      </section>

      <section style={styles.cards}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Próximos Jogos</h2>
          <span>{upcoming.length} partidas</span>
        </div>

        <div style={styles.matchGrid}>
          {upcoming.map((match) => (
            <article key={match.id} style={styles.matchCard}>
              <div style={styles.matchTop}>
                <span>{match.competition || league}</span>
                <strong>{match.horario || "-"}</strong>
              </div>

              <h3>{match.timeA} x {match.timeB}</h3>

              <div style={styles.oddsGrid}>
                <Odd label="Casa" value={getOdd(match.odds, "odd_resultado_final_casa")} />
                <Odd label="Empate" value={getOdd(match.odds, "odd_resultado_final_empate")} />
                <Odd label="Fora" value={getOdd(match.odds, "odd_resultado_final_fora")} />
                <Odd label="Over 1.5" value={getOdd(match.odds, "odd_over_1.5", "odd_over_1,5")} />
                <Odd label="BTTS" value={getOdd(match.odds, "odd_ambas_sim")} />
                <Odd label="Under 3.5" value={getOdd(match.odds, "odd_under_3.5", "odd_under_3,5")} />
              </div>
            </article>
          ))}
        </div>

        {!loading && !upcoming.length ? (
          <p style={styles.empty}>
            Nenhum jogo virtual retornado agora. Verifique o backend `/virtual/upcoming?league={league}`.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: any) {
  return (
    <div style={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(circle at 80% 0%, rgba(250,204,21,.18), transparent 32%), #030303",
    color: "#fff",
    padding: "28px",
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
    background:
      "linear-gradient(135deg, rgba(0,0,0,.96), rgba(55,36,4,.88))",
  },
  title: {
    margin: "10px 0",
    fontSize: "clamp(34px, 5vw, 62px)",
    lineHeight: 1,
    letterSpacing: -2,
  },
  text: {
    color: "rgba(255,255,255,.72)",
    lineHeight: 1.5,
    fontWeight: 700,
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
    padding: 22,
    background:
      "radial-gradient(circle at 20% 0%, rgba(250,204,21,.20), transparent 36%), rgba(5,5,5,.94)",
  },
  matchTitle: {
    fontSize: "clamp(28px, 4vw, 44px)",
    margin: "10px 0 4px",
  },
  pickBox: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1.35fr) .65fr .75fr .75fr",
    gap: 12,
    margin: "18px 0",
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
    letterSpacing: .5,
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
  patterns: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 24,
    padding: 22,
    background: "rgba(5,5,5,.92)",
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
  cards: {
    maxWidth: 1280,
    margin: "0 auto",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 24,
    padding: 22,
    background: "rgba(5,5,5,.92)",
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
    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
    gap: 14,
    marginTop: 12,
  },
  matchCard: {
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,.035)",
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
  odd: {
    border: "1px solid rgba(250,204,21,.18)",
    borderRadius: 12,
    padding: 10,
    minWidth: 0,
  },
  empty: {
    marginTop: 16,
    color: "rgba(255,255,255,.68)",
  },
};
