"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";

type Game = any;

function logoFallback(name: string, bg = "111827", color = "ffffff") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Time")}&background=${bg}&color=${color}&bold=true`;
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function formatDateTime(date: any) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status: any) {
  const raw = String(status || "").toUpperCase();
  if (raw === "1T") return "1H";
  if (raw === "2T") return "2H";
  if (raw === "IN_PLAY") return "LIVE";
  return raw;
}

function safeScore(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) return null;
  return parsed;
}

function normalizeGame(raw: any): Game | null {
  if (!raw) return null;

  const fixture = raw.fixture || raw.jogo || {};
  const status = fixture.status || raw.status || {};
  const league = raw.league || raw.liga || {};
  const teams = raw.teams || raw.times || {};
  const home = teams.home || teams.casa || {};
  const away = teams.away || teams.fora || teams.visitante || {};
  const goals = raw.goals || raw.gols || {};
  const score = raw.score || raw.placar || {};

  const homeGoals = safeScore(
    goals.home ??
      goals.casa ??
      score?.fulltime?.home ??
      score?.fulltime?.casa ??
      score?.["tempo integral"]?.home ??
      score?.["tempo integral"]?.casa,
  );

  const awayGoals = safeScore(
    goals.away ??
      goals.fora ??
      goals.visitante ??
      score?.fulltime?.away ??
      score?.fulltime?.fora ??
      score?.["tempo integral"]?.away ??
      score?.["tempo integral"]?.fora,
  );

  const id = fixture.id || raw.id;
  if (!id) return null;

  return {
    ...raw,
    provider: raw.provider || raw.provedor || "unknown",
    fixture: {
      ...fixture,
      id,
      externalId: fixture.externalId || fixture.idExterno || raw.externalId,
      date: fixture.date || fixture.data || raw.start_at || raw.date,
      timestamp: fixture.timestamp || fixture["carimbo de data/hora"] || null,
      timezone:
        fixture.timezone || fixture["fuso horário"] || "America/Sao_Paulo",
      status: {
        ...status,
        short: normalizeStatus(
          status.short || status.curto || status.shortName,
        ),
        long: status.long || status.longo || status.name || "",
        elapsed: Number(
          status.elapsed ?? status.decorrido ?? status["tempo decorrido"] ?? 0,
        ),
        extra: status.extra ?? null,
      },
    },
    league: {
      ...league,
      id: league.id || 0,
      name: league.name || league.nome || "Liga",
      country: league.country || league.pais || league.país || "",
      logo: league.logo || league.logotipo || "",
    },
    teams: {
      home: {
        ...home,
        id: home.id || 0,
        name: home.name || home.nome || "Casa",
        logo: home.logo || home.logotipo || "",
      },
      away: {
        ...away,
        id: away.id || 0,
        name: away.name || away.nome || "Fora",
        logo: away.logo || away.logotipo || "",
      },
    },
    goals: {
      home: homeGoals,
      away: awayGoals,
    },
    score: {
      ...score,
      fulltime: {
        home: homeGoals,
        away: awayGoals,
      },
    },
  };
}

function getStatusShort(game: Game) {
  return normalizeStatus(game?.fixture?.status?.short || "");
}

function isLiveStatus(status: string) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(
    normalizeStatus(status),
  );
}

function isFinishedStatus(status: string) {
  return ["FT", "AET", "PEN", "AWD", "WO"].includes(normalizeStatus(status));
}

function isCanceledStatus(status: string) {
  return ["CANC", "ABD", "AWD", "WO", "PST"].includes(normalizeStatus(status));
}

function getLocalDateKey(date: any) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return dateKey(parsed);
}

function isLive(game: Game) {
  const status = getStatusShort(game);
  const elapsed = Number(game?.fixture?.status?.elapsed || 0);
  const extra = Number(game?.fixture?.status?.extra || 0);

  if (isFinishedStatus(status) || isCanceledStatus(status)) return false;
  if (!isLiveStatus(status)) return false;
  if (elapsed >= 90) return false;
  if (elapsed >= 85 && extra > 0) return false;

  return true;
}

function isFinished(game: Game) {
  const status = getStatusShort(game);
  const elapsed = Number(game?.fixture?.status?.elapsed || 0);
  const extra = Number(game?.fixture?.status?.extra || 0);

  if (isFinishedStatus(status)) return true;
  if (elapsed >= 90) return true;
  if (elapsed >= 85 && extra > 0) return true;

  return false;
}

function getGameScore(game: Game) {
  const home = safeScore(game?.goals?.home ?? game?.score?.fulltime?.home);
  const away = safeScore(game?.goals?.away ?? game?.score?.fulltime?.away);

  return {
    home: home === null ? "-" : home,
    away: away === null ? "-" : away,
  };
}

function getLiveElapsedMinute(game: Game) {
  const status = getStatusShort(game);
  const elapsed = Number(game?.fixture?.status?.elapsed || 0);
  if (status === "HT") return 45;
  if (!isLive(game)) return elapsed;
  return Math.min(Math.max(elapsed || 0, 0), 90);
}

function getGameTimeText(game: Game) {
  const status = getStatusShort(game);
  if (status === "HT") return "Intervalo";
  if (isLive(game)) {
    const elapsed = getLiveElapsedMinute(game);
    return elapsed ? `${elapsed}'` : "Ao vivo";
  }
  if (isFinished(game)) return "FT";
  return formatDateTime(game?.fixture?.date);
}

function statusText(game: Game) {
  if (isLive(game)) return "🔴 Ao vivo";
  if (isFinished(game)) return "🏁 Finalizado";
  if (isCanceledStatus(getStatusShort(game))) return "🚫 Indisponível";
  return "⏳ Futuro";
}

function getOdd(game: Game, name: string) {
  const options = game?.odds?.options || [];
  const found = options.find((item: any) => String(item?.name) === name);
  return found?.odd || game?.main_odds?.[`outcome_${name}`]?.value || "-";
}

export default function LivePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [plan, setPlan] = useState("Free");
  const [role, setRole] = useState("USER");
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<number | string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("time");
  const [currentPage, setCurrentPage] = useState(1);

  const gamesPerPage = 24;
  const isPaidPlan = ["PRO", "VIP", "Pro", "Vip", "pro", "vip"].includes(
    String(plan),
  );

  async function loadGames() {
    try {
      if (games.length === 0) setLoading(true);

      const today = addDaysKey(0);
      const tomorrow = addDaysKey(1);

      const responses = await Promise.allSettled([
        api.get("/football/live"),
        api.get(`/football/fixtures?date=${today}`),
        api.get(`/football/fixtures?date=${tomorrow}`),
      ]);

      const merged = new Map<string, Game>();

      responses.forEach((result: any) => {
        if (result.status !== "fulfilled") return;

        (result.value?.data || [])
          .map(normalizeGame)
          .filter(Boolean)
          .forEach((game: any) => {
            if (isCanceledStatus(getStatusShort(game))) return;

            const id = String(game?.fixture?.id || "");
            if (!id) return;

            const old = merged.get(id);
            if (!old || isLive(game) || isFinished(game)) {
              merged.set(id, game);
            }
          });
      });

      setGames(Array.from(merged.values()));
    } catch {
      alert(
        "Erro ao carregar jogos. Verifique /football/live e /football/fixtures.",
      );
      setGames([]);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeGame(game: Game) {
    if (!isPaidPlan) {
      alert("Análise IA disponível apenas nos planos PRO e VIP.");
      window.location.href = "/plans";
      return;
    }

    try {
      const fixtureId = game?.fixture?.id;
      setAnalyzingId(fixtureId);

      const response = await api.post("/ai/generate-bet", {
        ...game,
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        leagueName: game.league?.name,
        teams: game.teams,
        fixture: game.fixture,
        goals: game.goals,
        score: getGameScore(game),
        status: game.fixture?.status,
        odds: game.odds || game.main_odds || null,
      });

      setSelectedAnalysis({ game, ai: response.data });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      alert("Erro ao analisar este jogo com IA.");
    } finally {
      setAnalyzingId(null);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  const filteredGames = useMemo(() => {
    const today = addDaysKey(0);
    const tomorrow = addDaysKey(1);
    const text = search.toLowerCase().trim();

    return games
      .filter((game) => {
        const gameDate = getLocalDateKey(game?.fixture?.date);
        const live = isLive(game);
        const finished = isFinished(game);

        const matchFilter =
          filter === "all" ||
          (filter === "live" && live) ||
          (filter === "today" && gameDate === today) ||
          (filter === "tomorrow" && gameDate === tomorrow) ||
          (filter === "future" && gameDate >= today && !live && !finished) ||
          (filter === "finished" && finished);

        const matchSearch =
          !text ||
          game?.teams?.home?.name?.toLowerCase().includes(text) ||
          game?.teams?.away?.name?.toLowerCase().includes(text) ||
          game?.league?.name?.toLowerCase().includes(text) ||
          game?.league?.country?.toLowerCase().includes(text);

        return matchFilter && matchSearch;
      })
      .sort((a, b) => {
        const liveA = isLive(a) ? 1 : 0;
        const liveB = isLive(b) ? 1 : 0;
        const finishedA = isFinished(a) ? 1 : 0;
        const finishedB = isFinished(b) ? 1 : 0;
        const dateA = new Date(a?.fixture?.date || 0).getTime();
        const dateB = new Date(b?.fixture?.date || 0).getTime();

        if (sortBy === "live") {
          if (liveA !== liveB) return liveB - liveA;
          return dateA - dateB;
        }

        if (sortBy === "league") {
          const leagueA = String(a?.league?.name || "").localeCompare(
            String(b?.league?.name || ""),
          );
          if (leagueA !== 0) return leagueA;
          return dateA - dateB;
        }

        if (liveA !== liveB) return liveB - liveA;
        if (finishedA !== finishedB) return finishedA - finishedB;
        return dateA - dateB;
      });
  }, [games, filter, search, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGames.length / gamesPerPage),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedGames = filteredGames.slice(
    (safeCurrentPage - 1) * gamesPerPage,
    safeCurrentPage * gamesPerPage,
  );

  const liveCount = games.filter(isLive).length;
  const finishedCount = games.filter(isFinished).length;
  const futureCount = games.filter(
    (game) => !isLive(game) && !isFinished(game),
  ).length;

  useEffect(() => {
    const interval = setInterval(loadGames, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    async function loadUser() {
      try {
        const response = await api.get("/auth/me");
        setPlan(response.data.plan || "Free");
        setRole(response.data.role || "USER");
        await loadGames();
      } catch {
        localStorage.removeItem("token");
        window.location.href = "/";
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
          <button
            style={styles.navButton}
            onClick={() => (window.location.href = "/dashboard")}
          >
            Dashboard
          </button>
          <button
            style={styles.navButton}
            onClick={() => (window.location.href = "/favorites")}
          >
            Favoritos
          </button>
          <button
            style={styles.navButton}
            onClick={() => (window.location.href = "/history")}
          >
            Histórico
          </button>
          {role === "ADMIN" && (
            <button
              style={styles.adminButton}
              onClick={() => (window.location.href = "/admin")}
            >
              Admin
            </button>
          )}
          <button style={styles.logoutButton} onClick={logout}>
            Sair
          </button>
        </nav>
      </header>

      {selectedAnalysis && (
        <section style={styles.analysisPanel}>
          <button
            style={styles.closeButton}
            onClick={() => setSelectedAnalysis(null)}
          >
            Fechar
          </button>
          <span
            style={
              isLive(selectedAnalysis.game)
                ? styles.liveBadge
                : styles.futureBadge
            }
          >
            {statusText(selectedAnalysis.game)} •{" "}
            {getGameTimeText(selectedAnalysis.game)}
          </span>
          <h2 style={styles.analysisTitle}>
            {selectedAnalysis.game.teams.home.name} x{" "}
            {selectedAnalysis.game.teams.away.name}
          </h2>
          <p style={styles.subtitle}>{selectedAnalysis.game.league.name}</p>

          <div style={styles.analysisGrid}>
            <div style={styles.analysisCard}>
              <small>Entrada</small>
              <strong>{selectedAnalysis.ai?.tip || "-"}</strong>
            </div>
            <div style={styles.analysisCard}>
              <small>Odd</small>
              <strong>{selectedAnalysis.ai?.odd || "-"}</strong>
            </div>
            <div style={styles.analysisCard}>
              <small>Confiança</small>
              <strong>{selectedAnalysis.ai?.confidence || 0}%</strong>
            </div>
            <div style={styles.analysisCard}>
              <small>Risco</small>
              <strong>{selectedAnalysis.ai?.risk || "Médio"}</strong>
            </div>
          </div>

          {selectedAnalysis.ai?.analysis && (
            <p style={styles.analysisText}>{selectedAnalysis.ai.analysis}</p>
          )}
        </section>
      )}

      <section style={styles.hero}>
        <span style={styles.redPill}>🔥 JOGOS AO VIVO, HOJE E AMANHÃ</span>
        <h1 style={styles.title}>Escolha um jogo para a IA analisar</h1>
        <p style={styles.subtitle}>
          A lista agora mostra apenas jogos da API. A opção “Já salvos” foi
          removida para não misturar palpites antigos com jogos online.
        </p>

        <div style={styles.statsGrid}>
          <div style={styles.statGreen}>
            <strong>{games.length}</strong>
            <span>Jogos disponíveis</span>
          </div>
          <div style={styles.statBox}>
            <strong>{liveCount}</strong>
            <span>Ao vivo/abertos</span>
          </div>
          <div style={styles.statBox}>
            <strong>{futureCount}</strong>
            <span>Futuros</span>
          </div>
          <div style={styles.statOrange}>
            <strong>{finishedCount}</strong>
            <span>Finalizados</span>
          </div>
        </div>
      </section>

      <section style={styles.controls}>
        <button style={styles.refreshButton} onClick={loadGames}>
          {loading ? "Carregando..." : "Atualizar jogos"}
        </button>

        {[
          ["all", "Todos"],
          ["live", "🔴 Ao vivo"],
          ["today", "📌 Hoje"],
          ["tomorrow", "🗓️ Amanhã"],
          ["future", "⏳ Futuros"],
          ["finished", "🏁 Finalizados"],
        ].map(([value, label]) => (
          <button
            key={value}
            style={
              filter === value ? styles.filterButtonActive : styles.filterButton
            }
            onClick={() => {
              setFilter(value);
              setCurrentPage(1);
            }}
          >
            {label}
          </button>
        ))}

        <input
          style={styles.search}
          placeholder="Buscar time, liga ou país..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
        />
        <select
          style={styles.select}
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="time">Ordenar: horário</option>
          <option value="live">Ordenar: ao vivo</option>
          <option value="league">Ordenar: liga</option>
        </select>
      </section>

      <div style={styles.resultInfo}>
        Mostrando {paginatedGames.length} de {filteredGames.length} jogos
        filtrados
      </div>

      <section style={styles.grid}>
        {paginatedGames.map((game) => {
          const score = getGameScore(game);
          const fixtureId = game.fixture.id;
          const home = game.teams.home.name;
          const away = game.teams.away.name;

          return (
            <article key={`${game.provider}-${fixtureId}`} style={styles.card}>
              <div style={styles.cardTop}>
                <span style={styles.countryTag}>
                  {String(game.league.country || "")
                    .slice(0, 2)
                    .toUpperCase() || "FT"}
                </span>
                <strong>{game.league.name}</strong>
                <span
                  style={
                    isLive(game)
                      ? styles.liveMini
                      : isFinished(game)
                        ? styles.finishedMini
                        : styles.futureMini
                  }
                >
                  {statusText(game)}
                </span>
              </div>

              <div style={styles.teamsRow}>
                <div style={styles.teamBox}>
                  <img
                    src={game.teams.home.logo || logoFallback(home)}
                    style={styles.teamLogo}
                  />
                  <strong>{home}</strong>
                </div>

                <div style={styles.scoreBox}>
                  <span>{score.home}</span>
                  <small>-</small>
                  <span>{score.away}</span>
                  <em>{getGameTimeText(game)}</em>
                </div>

                <div style={styles.teamBox}>
                  <img
                    src={game.teams.away.logo || logoFallback(away)}
                    style={styles.teamLogo}
                  />
                  <strong>{away}</strong>
                </div>
              </div>

              <div style={styles.oddsRow}>
                <span>1: {getOdd(game, "1")}</span>
                <span>X: {getOdd(game, "X")}</span>
                <span>2: {getOdd(game, "2")}</span>
              </div>

              <button
                style={styles.analyzeButton}
                disabled={analyzingId === fixtureId}
                onClick={() => analyzeGame(game)}
              >
                {analyzingId === fixtureId
                  ? "Analisando..."
                  : "🤖 Analisar com IA"}
              </button>
            </article>
          );
        })}
      </section>

      {!loading && paginatedGames.length === 0 && (
        <section style={styles.emptyBox}>
          Nenhum jogo encontrado com os filtros atuais.
        </section>
      )}

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={styles.pageButton}
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            Anterior
          </button>
          <span>
            Página {safeCurrentPage} de {totalPages}
          </span>
          <button
            style={styles.pageButton}
            disabled={safeCurrentPage >= totalPages}
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
          >
            Próxima
          </button>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    color: "#fff",
    background:
      "linear-gradient(180deg, #020617 0%, #020617 45%, #06130b 100%)",
    padding: "28px 18px 48px",
    position: "relative",
    overflow: "hidden",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundImage: "url(/stadium-bg.jpg)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.16,
    pointerEvents: "none",
  },
  header: {
    maxWidth: 1240,
    margin: "0 auto 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    position: "relative",
    zIndex: 1,
  },
  logo: { width: 145, objectFit: "contain" },
  nav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  navButton: {
    border: "1px solid rgba(255,255,255,.22)",
    background: "rgba(255,255,255,.07)",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  adminButton: {
    border: "1px solid #facc15",
    background: "#facc15",
    color: "#020617",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  logoutButton: {
    border: "1px solid #ef4444",
    background: "transparent",
    color: "#ef4444",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  planBadge: {
    border: "1px solid #22c55e",
    background: "rgba(34,197,94,.12)",
    color: "#22c55e",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
  },
  hero: {
    maxWidth: 1240,
    margin: "0 auto 18px",
    position: "relative",
    zIndex: 1,
    background: "rgba(2,6,23,.78)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 28,
    padding: 26,
    boxShadow: "0 24px 80px rgba(0,0,0,.35)",
  },
  redPill: {
    display: "inline-block",
    background: "#ef4444",
    color: "#fff",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
  },
  title: { fontSize: 34, margin: "16px 0 8px", lineHeight: 1.05 },
  subtitle: { color: "#cbd5e1", margin: 0, lineHeight: 1.5 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 20,
  },
  statGreen: {
    background: "linear-gradient(135deg, #22c55e, #a3e635)",
    color: "#020617",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontWeight: 900,
  },
  statOrange: {
    background: "linear-gradient(135deg, #f59e0b, #f97316)",
    color: "#020617",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontWeight: 900,
  },
  statBox: {
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontWeight: 900,
  },
  controls: {
    maxWidth: 1240,
    margin: "0 auto 16px",
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  refreshButton: {
    border: "1px solid #22c55e",
    background: "transparent",
    color: "#22c55e",
    borderRadius: 14,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  filterButton: {
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  filterButtonActive: {
    border: "1px solid #22c55e",
    background: "rgba(34,197,94,.20)",
    color: "#22c55e",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  search: {
    flex: "1 1 220px",
    minWidth: 210,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(2,6,23,.72)",
    color: "#fff",
    borderRadius: 999,
    padding: "12px 16px",
    outline: "none",
  },
  select: {
    border: "1px solid rgba(255,255,255,.18)",
    background: "#020617",
    color: "#fff",
    borderRadius: 999,
    padding: "12px 16px",
    outline: "none",
  },
  resultInfo: {
    maxWidth: 1240,
    margin: "0 auto 12px",
    textAlign: "right",
    color: "#cbd5e1",
    position: "relative",
    zIndex: 1,
    fontWeight: 800,
  },
  grid: {
    maxWidth: 1240,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(245px, 1fr))",
    gap: 16,
    position: "relative",
    zIndex: 1,
  },
  card: {
    background: "linear-gradient(180deg, rgba(2,6,23,.92), rgba(15,23,42,.90))",
    border: "1px solid rgba(34,197,94,.38)",
    boxShadow: "0 18px 40px rgba(0,0,0,.32)",
    borderRadius: 22,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  cardTop: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    minHeight: 28,
    fontSize: 12,
    color: "#22c55e",
  },
  countryTag: {
    background: "#22c55e",
    color: "#020617",
    borderRadius: 6,
    padding: "5px 6px",
    fontSize: 10,
    fontWeight: 900,
  },
  liveMini: {
    marginLeft: "auto",
    background: "#ef4444",
    color: "#fff",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
  },
  finishedMini: {
    marginLeft: "auto",
    background: "#22c55e",
    color: "#020617",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
  },
  futureMini: {
    marginLeft: "auto",
    background: "#facc15",
    color: "#020617",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
  },
  teamsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 74px 1fr",
    gap: 10,
    alignItems: "center",
  },
  teamBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 900,
  },
  teamLogo: {
    width: 46,
    height: 46,
    objectFit: "contain",
    borderRadius: 12,
    background: "rgba(255,255,255,.08)",
    padding: 6,
  },
  scoreBox: {
    border: "1px solid rgba(34,197,94,.35)",
    background: "rgba(34,197,94,.07)",
    borderRadius: 16,
    minHeight: 74,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },
  oddsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  analyzeButton: {
    border: "none",
    background: "linear-gradient(135deg, #22c55e, #a3e635)",
    color: "#020617",
    borderRadius: 14,
    padding: "12px",
    cursor: "pointer",
    fontWeight: 950,
  },
  analysisPanel: {
    maxWidth: 1240,
    margin: "0 auto 18px",
    position: "relative",
    zIndex: 2,
    background: "rgba(2,6,23,.94)",
    border: "1px solid rgba(34,197,94,.35)",
    borderRadius: 24,
    padding: 22,
  },
  closeButton: {
    float: "right",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    borderRadius: 999,
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 900,
  },
  liveBadge: {
    display: "inline-block",
    background: "#ef4444",
    borderRadius: 999,
    padding: "7px 10px",
    fontWeight: 900,
  },
  futureBadge: {
    display: "inline-block",
    background: "#facc15",
    color: "#020617",
    borderRadius: 999,
    padding: "7px 10px",
    fontWeight: 900,
  },
  analysisTitle: { fontSize: 28, margin: "14px 0 4px" },
  analysisGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  analysisCard: {
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  analysisText: { color: "#e5e7eb", lineHeight: 1.6, marginTop: 16 },
  emptyBox: {
    maxWidth: 1240,
    margin: "24px auto",
    position: "relative",
    zIndex: 1,
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 20,
    padding: 22,
    textAlign: "center",
  },
  pagination: {
    maxWidth: 1240,
    margin: "24px auto 0",
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  pageButton: {
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
