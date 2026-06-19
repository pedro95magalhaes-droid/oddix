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
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function VirtualPage() {
  const [league, setLeague] = useState("euro");
  const [loading, setLoading] = useState(true);
  const [topPicks, setTopPicks] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  async function loadVirtual() {
    try {
      setLoading(true);

      const [topResponse, patternResponse, upcomingResponse] = await Promise.allSettled([
        api.get(`/virtual/top-picks?league=${league}&historyLimit=300`),
        api.get(`/virtual/patterns?league=${league}&limit=300`),
        api.get(`/virtual/upcoming?league=${league}`),
      ]);

      setTopPicks(
        topResponse.status === "fulfilled"
          ? topResponse.value?.data?.topPicks || []
          : [],
      );

      setPatterns(
        patternResponse.status === "fulfilled"
          ? patternResponse.value?.data?.patterns || null
          : null,
      );

      setUpcoming(
        upcomingResponse.status === "fulfilled"
          ? upcomingResponse.value?.data?.matches || []
          : [],
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVirtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  const bestPick = topPicks[0];

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.kicker}>⚡ ODDIX VIRTUAL AI</span>
          <h1>Inteligência para Futebol Virtual Bet365</h1>
          <p>
            Análise de padrões, odds e histórico recente. Virtual usa RNG:
            a Oddix mostra tendência estatística, não promessa de resultado.
          </p>

          <div style={styles.actions}>
            <select value={league} onChange={(event) => setLeague(event.target.value)} style={styles.select}>
              {LEAGUES.map((item) => (
                <option key={item.key} value={item.key}>{item.name}</option>
              ))}
            </select>

            <button onClick={loadVirtual} style={styles.primary}>
              {loading ? "Atualizando..." : "Atualizar Virtual"}
            </button>
          </div>
        </div>

        <div style={styles.heroStats}>
          <Metric label="Jogos próximos" value={upcoming.length} />
          <Metric label="Top Picks" value={topPicks.length} />
          <Metric label="Over 1.5" value={`${patterns?.over15 || 0}%`} />
          <Metric label="BTTS" value={`${patterns?.btts || 0}%`} />
        </div>
      </section>

      <section style={styles.grid}>
        <div style={styles.topPick}>
          <span style={styles.kicker}>🔥 TOP PICK VIRTUAL</span>

          {bestPick?.topPick ? (
            <>
              <h2>{bestPick.homeTeam} x {bestPick.awayTeam}</h2>
              <p>{bestPick.league} • {bestPick.timeLabel}</p>

              <div style={styles.pickBox}>
                <div>
                  <small>Mercado</small>
                  <strong>{bestPick.topPick.selection}</strong>
                  <span>{bestPick.topPick.market}</span>
                </div>

                <div>
                  <small>Odd</small>
                  <strong>{bestPick.topPick.odd}</strong>
                </div>

                <div>
                  <small>Score</small>
                  <strong>{bestPick.topPick.score}/100</strong>
                </div>
              </div>

              <p style={styles.reason}>{bestPick.topPick.reason}</p>
            </>
          ) : (
            <p>Aguardando padrões suficientes para montar Top Pick Virtual.</p>
          )}
        </div>

        <div style={styles.patterns}>
          <span style={styles.kicker}>📊 PADRÕES RECENTES</span>
          <Pattern label="Over 0.5" value={patterns?.over05} />
          <Pattern label="Over 1.5" value={patterns?.over15} />
          <Pattern label="Over 2.5" value={patterns?.over25} />
          <Pattern label="Under 3.5" value={patterns?.under35} />
          <Pattern label="Ambas Marcam" value={patterns?.btts} />
          <Pattern label="Casa vence" value={patterns?.homeWins} />
        </div>
      </section>

      <section style={styles.cards}>
        <div style={styles.cardHeader}>
          <h2>Próximos Jogos</h2>
          <span>{upcoming.length} partidas</span>
        </div>

        <div style={styles.matchGrid}>
          {upcoming.map((match) => (
            <article key={match.id} style={styles.matchCard}>
              <div style={styles.matchTop}>
                <span>{match.competition || league}</span>
                <strong>{match.horario}</strong>
              </div>

              <h3>{match.timeA} x {match.timeB}</h3>

              <div style={styles.oddsGrid}>
                <Odd label="Casa" value={match.odds?.odd_resultado_final_casa} />
                <Odd label="Empate" value={match.odds?.odd_resultado_final_empate} />
                <Odd label="Fora" value={match.odds?.odd_resultado_final_fora} />
                <Odd label="Over 1.5" value={match.odds?.["odd_over_1.5"]} />
                <Odd label="BTTS" value={match.odds?.odd_ambas_sim} />
                <Odd label="Under 3.5" value={match.odds?.["odd_under_3.5"]} />
              </div>
            </article>
          ))}
        </div>
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
      <span>{label}</span>
      <strong>{pct}%</strong>
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
    gridTemplateColumns: "1.2fr .8fr",
    gap: 20,
    background:
      "linear-gradient(135deg, rgba(0,0,0,.96), rgba(55,36,4,.88))",
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
  },
  grid: {
    maxWidth: 1280,
    margin: "0 auto 18px",
    display: "grid",
    gridTemplateColumns: "1.35fr .65fr",
    gap: 18,
  },
  topPick: {
    border: "1px solid rgba(250,204,21,.65)",
    borderRadius: 24,
    padding: 22,
    background:
      "radial-gradient(circle at 20% 0%, rgba(250,204,21,.20), transparent 36%), rgba(5,5,5,.94)",
  },
  pickBox: {
    display: "grid",
    gridTemplateColumns: "1.3fr .7fr .7fr",
    gap: 12,
    margin: "18px 0",
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
  },
  matchTop: {
    display: "flex",
    justifyContent: "space-between",
    color: "#facc15",
    fontWeight: 900,
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
  },
};
