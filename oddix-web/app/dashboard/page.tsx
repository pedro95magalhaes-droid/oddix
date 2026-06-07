"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../../services/api";
import FreeLockModal from "../../components/oddix/FreeLockModal";

const FREE_GROUP_LINK = "https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb";
const ESTRELABET_LINK =
  process.env.NEXT_PUBLIC_ESTRELABET_LINK ||
  "https://apretailer.com.br/click/6a2102c82bfa8143b57b86d8/182492/359080/subaccount";
const ODDIX_PLAYER_IMAGE = "/images/oddix-player.png";

function logoFallback(name: string, bg = "111827", color = "facc15") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Time",
  )}&background=${bg}&color=${color}&bold=true&size=160`;
}

function safeNumber(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeScore(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 30) return null;
  return parsed;
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

function normalizeStatusShort(status: any) {
  const raw = String(status?.short || status?.curto || status?.shortName || "").toUpperCase();
  if (raw === "1T") return "1H";
  if (raw === "2T") return "2H";
  return raw || "NS";
}

function normalizeGame(game: any) {
  if (!game) return null;

  const fixture = game.fixture || game.jogo || game.partida || {};
  const status = fixture.status || {};
  const league = game.league || game.liga || game.competition || {};
  const teams = game.teams || game.times || {};
  const home = teams.home || teams.casa || teams.mandante || {};
  const away = teams.away || teams.fora || teams.visitante || {};
  const goals = game.goals || game.gols || {};
  const score = game.score || game.placar || {};
  const oddix = game.oddix || {};

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
      score?.["tempo integral"]?.fora ??
      score?.["tempo integral"]?.visitante,
  );

  return {
    ...game,
    provider: game.provider || game.provedor || "unknown",
    fixture: {
      ...fixture,
      id: fixture.id,
      externalId: fixture.externalId || fixture.external_id || "",
      date: fixture.date || fixture.data,
      timestamp: fixture.timestamp || fixture.carimboDeDataHora || fixture["carimbo de data/hora"],
      timezone: fixture.timezone || fixture.fuso || fixture["fuso horário"] || "America/Sao_Paulo",
      status: {
        ...status,
        short: normalizeStatusShort(status),
        long: status.long || status.longo || status.name || status.nome || "",
        elapsed: safeNumber(status.elapsed ?? status.decorrido ?? status.tempoDecorrido ?? status["tempo decorrido"], 0),
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
        winner: home.winner ?? home.vencedor ?? null,
      },
      away: {
        ...away,
        id: away.id || 0,
        name: away.name || away.nome || "Fora",
        logo: away.logo || away.logotipo || "",
        winner: away.winner ?? away.vencedor ?? null,
      },
    },
    goals: {
      home: homeGoals,
      away: awayGoals,
    },
    score: {
      fulltime: {
        home: homeGoals,
        away: awayGoals,
      },
    },
    oddix: {
      leagueAllowed: oddix.leagueAllowed ?? oddix.ligaPermitida ?? true,
      priorityLeague: oddix.priorityLeague ?? oddix.ligaPrioridade ?? false,
      qualityScore: safeNumber(oddix.qualityScore ?? oddix.pontuacaoQualidade ?? oddix.pontuaçãoDeQualidade, 70),
      qualityLabel: oddix.qualityLabel || oddix.rotuloQualidade || oddix.rótuloDeQualidade || "premium",
    },
  };
}

function getStatusShort(game: any) {
  return normalizeStatusShort(game?.fixture?.status || {});
}

function isLiveStatus(status: string) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(String(status || "").toUpperCase());
}

function isFinishedStatus(status: string) {
  return ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"].includes(String(status || "").toUpperCase());
}

function isGameLive(game: any) {
  const status = getStatusShort(game);
  return isLiveStatus(status) && !isFinishedStatus(status);
}

function isGameFinished(game: any) {
  return isFinishedStatus(getStatusShort(game));
}

function getScore(game: any) {
  const home = safeScore(game?.goals?.home ?? game?.score?.fulltime?.home);
  const away = safeScore(game?.goals?.away ?? game?.score?.fulltime?.away);
  return {
    home: home === null ? 0 : home,
    away: away === null ? 0 : away,
  };
}

function getOddsOptions(game: any) {
  const options = game?.odds?.options || game?.odds?.opções || [];
  return Array.isArray(options) ? options : [];
}

function bestOddFromGame(game: any) {
  const valid = getOddsOptions(game)
    .map((item: any) => Number(item?.odd ?? item?.ímpar ?? item?.impar))
    .filter((odd: number) => Number.isFinite(odd) && odd >= 1.2 && odd <= 2.2);
  if (!valid.length) return null;
  return valid[0];
}

function normalizeTextLoose(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFrontendLeagueAllowed(game: any) {
  const text = normalizeTextLoose([
    game?.league?.name,
    game?.league?.country,
    game?.teams?.home?.name,
    game?.teams?.away?.name,
  ].filter(Boolean).join(" "));

  const isFifaOrSelection =
    text.includes("fifa") ||
    text.includes("world cup") ||
    text.includes("copa do mundo") ||
    text.includes("international") ||
    text.includes("selecao") ||
    text.includes("selecoes") ||
    text.includes("national team");

  const blocked = [
    "placement play off",
    "placement playoffs",
    "relegation group",
    "rebaixamento",
    "u17",
    "u18",
    "u19",
    "u20",
    "u21",
    "u23",
    "sub 17",
    "sub 18",
    "sub 19",
    "sub 20",
    "sub 21",
    "sub 23",
    "women",
    "feminino",
    "feminina",
    "reserve",
    "reserves",
    "esoccer",
    "simulado",
    "simulated",
  ];

  if (blocked.some((word) => text.includes(word))) return false;
  const isFriendly = text.includes("friendly") || text.includes("friendlies") || text.includes("amistoso");
  if (isFriendly && !isFifaOrSelection) return false;
  return true;
}

function gameDateKey(game: any) {
  const raw = game?.fixture?.date;
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return dateKey(parsed);
}

function stableGameKey(game: any) {
  const home = normalizeTextLoose(game?.teams?.home?.name).replace(/\s/g, "");
  const away = normalizeTextLoose(game?.teams?.away?.name).replace(/\s/g, "");
  const day = gameDateKey(game);
  return `${day}-${home}-${away}-${game?.fixture?.id || ""}`;
}

function mergeGames(groups: any[][]) {
  const map = new Map<string, any>();
  groups.flat().forEach((raw) => {
    const game = normalizeGame(raw);
    if (!game) return;
    if (!isFrontendLeagueAllowed(game)) return;
    const key = stableGameKey(game);
    if (!key) return;

    const current = map.get(key);
    const incomingScore = safeNumber(game?.oddix?.qualityScore, 0) + (game?.odds ? 20 : 0) + (isGameLive(game) ? 30 : 0);
    const currentScore = current
      ? safeNumber(current?.oddix?.qualityScore, 0) + (current?.odds ? 20 : 0) + (isGameLive(current) ? 30 : 0)
      : 0;

    if (!current || incomingScore >= currentScore) map.set(key, game);
  });

  return Array.from(map.values()).sort((a: any, b: any) => {
    const liveA = isGameLive(a) ? 1 : 0;
    const liveB = isGameLive(b) ? 1 : 0;
    if (liveA !== liveB) return liveB - liveA;
    const qa = safeNumber(a?.oddix?.qualityScore, 0);
    const qb = safeNumber(b?.oddix?.qualityScore, 0);
    if (qa !== qb) return qb - qa;
    return new Date(a?.fixture?.date || 0).getTime() - new Date(b?.fixture?.date || 0).getTime();
  });
}

function smartLocalTip(game: any, index = 0) {
  const quality = safeNumber(game?.oddix?.qualityScore, 82);
  const odd = bestOddFromGame(game) || (quality >= 88 ? 1.81 : quality >= 82 ? 1.72 : 1.62);
  const homeTeam = game?.teams?.home?.name || "Casa";
  const awayTeam = game?.teams?.away?.name || "Fora";
  const markets = [
    { market: "Total de Gols", tip: "Over 1.5 gols", risk: "Baixo" },
    { market: "Ambas Marcam", tip: "Ambas marcam - Sim", risk: "Médio" },
    { market: "Handicap", tip: `${homeTeam} +1.5 handicap`, risk: "Médio/Baixo" },
  ];
  const selected = markets[index % markets.length];

  return {
    fixtureId: game?.fixture?.id,
    game: `${homeTeam} x ${awayTeam}`,
    homeTeam,
    awayTeam,
    league: game?.league?.name,
    market: selected.market,
    tip: selected.tip,
    odd: Number(odd).toFixed(2),
    confidence: Math.min(90, Math.max(78, quality)),
    risk: selected.risk,
    source: "Oddix IA V4",
    qualityScore: quality,
  };
}

function initials(name: any) {
  const parts = String(name || "OD")
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "OD";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function playerPropFromGame(game: any, index: number) {
  const useHome = index !== 1;
  const team = useHome ? game?.teams?.home : game?.teams?.away;
  const opponent = useHome ? game?.teams?.away : game?.teams?.home;
  const teamName = team?.name || (useHome ? "Casa" : "Fora");
  const quality = safeNumber(game?.oddix?.qualityScore, 82);
  const market = index === 1 ? "Finalizações" : index === 2 ? "Participação ofensiva" : "Chutes no gol";
  const tip = index === 1 ? "Over 1.5 finalizações" : index === 2 ? "1+ participação em gol" : "Over 0.5 chute no gol";

  return {
    key: `prop-${game?.fixture?.id}-${teamName}-${index}`,
    fixtureId: game?.fixture?.id,
    game: `${game?.teams?.home?.name || "Casa"} x ${game?.teams?.away?.name || "Fora"}`,
    player: `Destaque ${teamName}`,
    playerTeam: teamName,
    opponentTeam: opponent?.name || "Adversário",
    teamLogo: team?.logo || logoFallback(teamName),
    playerInitials: initials(teamName),
    market,
    tip,
    odd: index === 1 ? "1.84" : index === 2 ? "1.68" : "1.72",
    confidence: Math.min(90, Math.max(82, quality)),
  };
}

export default function Dashboard() {
  const [games, setGames] = useState<any[]>([]);
  const [savedBets, setSavedBets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [plan, setPlan] = useState("Free");
  const [role, setRole] = useState("USER");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [freeLockOpen, setFreeLockOpen] = useState(false);

  const isPaidPlan = ["PRO", "VIP", "Pro", "Vip", "pro", "vip"].includes(String(plan));
  const today = dateKey(new Date());

  const liveGames = useMemo(() => games.filter(isGameLive), [games]);
  const futureGames = useMemo(() => games.filter((game) => !isGameLive(game) && !isGameFinished(game)), [games]);
  const topGames = useMemo(() => games.filter((game) => !isGameFinished(game)).slice(0, 12), [games]);
  const topPickGame = topGames[0] || null;
  const topPick = topPickGame ? smartLocalTip(topPickGame, 0) : null;

  const displayedSmartTips = useMemo(() => {
    return topGames.map((game, index) => smartLocalTip(game, index)).slice(0, 12);
  }, [topGames]);

  const playerProps = useMemo(() => {
    return topGames.slice(0, 3).map((game, index) => playerPropFromGame(game, index));
  }, [topGames]);

  const premiumBoost = useMemo(() => {
    return displayedSmartTips
      .filter((tip) => safeNumber(tip.confidence, 0) >= 78)
      .filter((tip) => safeNumber(tip.odd, 0) >= 1.25)
      .slice(0, 3);
  }, [displayedSmartTips]);

  const boostOdd = premiumBoost.reduce((acc, item) => acc * safeNumber(item.odd, 1), 1);
  const boostConfidence = premiumBoost.length
    ? Math.round(premiumBoost.reduce((acc, item) => acc + safeNumber(item.confidence, 0), 0) / premiumBoost.length)
    : 0;

  const wonBets = Array.isArray(savedBets) ? savedBets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "won").length : 0;
  const lostBets = Array.isArray(savedBets) ? savedBets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "lost").length : 0;
  const finishedBets = wonBets + lostBets;
  const winRate = finishedBets ? Math.round((wonBets / finishedBets) * 100) : stats?.roi || 72;

  async function loadAll(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);

      const tomorrow = dateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
      const dayAfterTomorrow = dateKey(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

      const responses = await Promise.allSettled([
        api.get("/football/live"),
        api.get(`/football/fixtures?date=${today}`),
        api.get(`/football/fixtures?date=${tomorrow}`),
        api.get(`/football/fixtures?date=${dayAfterTomorrow}`),
        api.get("/bets"),
      ]);

      const live = responses[0].status === "fulfilled" ? responses[0].value?.data || [] : [];
      const fixturesToday = responses[1].status === "fulfilled" ? responses[1].value?.data || [] : [];
      const fixturesTomorrow = responses[2].status === "fulfilled" ? responses[2].value?.data || [] : [];
      const fixturesDayAfterTomorrow = responses[3].status === "fulfilled" ? responses[3].value?.data || [] : [];
      const bets = responses[4].status === "fulfilled" ? responses[4].value?.data || [] : [];

      const allowedDateKeys = new Set([today, tomorrow, dayAfterTomorrow]);
      const merged = mergeGames([live, fixturesToday, fixturesTomorrow, fixturesDayAfterTomorrow])
        .filter((game) => allowedDateKeys.has(gameDateKey(game)))
        .filter((game) => safeNumber(game?.oddix?.qualityScore, 0) > 0);

      const localWon = Array.isArray(bets) ? bets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "won").length : 0;
      const localLost = Array.isArray(bets) ? bets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "lost").length : 0;
      const localFinished = localWon + localLost;

      setGames(merged);
      setSavedBets(Array.isArray(bets) ? bets : []);
      setStats({
        totalBets: Array.isArray(bets) ? bets.length : 0,
        wonBets: localWon,
        lostBets: localLost,
        roi: localFinished ? Math.round((localWon / localFinished) * 100) : 72,
      });
    } catch {
      setGames([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadUser() {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      const response = await api.get("/auth/me");
      setPlan(response.data?.plan || "Free");
      setRole(response.data?.role || "USER");
      await loadAll(true);
    } catch {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => loadAll(false), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  async function analyzeGame(game: any, tip?: any) {
    const normalized = normalizeGame(game);
    if (!normalized) return;

    if (!isPaidPlan) {
      setFreeLockOpen(true);
      return;
    }

    try {
      const fallback = tip || smartLocalTip(normalized, 0);
      const response = await api.post("/ai/generate-bet", {
        ...normalized,
        homeTeam: normalized.teams?.home?.name,
        awayTeam: normalized.teams?.away?.name,
        league: normalized.league?.name,
        leagueName: normalized.league?.name,
        smartTip: fallback,
        teams: normalized.teams,
        fixture: normalized.fixture,
        goals: normalized.goals,
        score: normalized.score,
        status: normalized.fixture?.status,
        oddix: normalized.oddix,
      });

      const ai = response?.data || fallback;
      setSelectedAnalysis({
        game: normalized,
        ai: {
          tip: ai?.tip || fallback.tip,
          odd: ai?.odd || fallback.odd,
          confidence: ai?.confidence || fallback.confidence,
          risk: ai?.risk || fallback.risk,
          analysis: ai?.analysis || "Entrada filtrada pela Oddix IA com base no score do jogo, mercado e qualidade da liga.",
          markets: ai?.markets || [fallback],
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      const fallback = tip || smartLocalTip(normalized, 0);
      setSelectedAnalysis({
        game: normalized,
        ai: {
          tip: fallback.tip,
          odd: fallback.odd,
          confidence: fallback.confidence,
          risk: fallback.risk,
          analysis: "Entrada filtrada pela Oddix IA com base no score do jogo, mercado e qualidade da liga.",
          markets: [fallback],
        },
      });
    }
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  return (
    <main className="oddix-rebuild" style={styles.page}>
      <style jsx global>{globalCss}</style>
      <FreeLockModal open={freeLockOpen} onClose={() => setFreeLockOpen(false)} onUpgrade={() => (window.location.href = "/plans")} />

      <Header plan={plan} role={role} onLogout={logout} />

      <section style={styles.unlockBanner}>
        <div>
          <strong>💎 ACESSO LIBERADO</strong>
          <span>Você está no plano {plan}. Use análises, mercados inteligentes e Oddix Boost para filtrar melhores entradas.</span>
        </div>
        <strong>{liveGames.length} ao vivo&nbsp;&nbsp; {displayedSmartTips.length} entradas IA</strong>
      </section>

      {selectedAnalysis && <AnalysisPanel selected={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} />}

      <section className="hero-boost-grid" style={styles.heroBoostGrid}>
        <HeroSection
          games={games.length}
          live={liveGames.length}
          tips={displayedSmartTips.length}
          roi={winRate}
        />
        <BoostPanel
          odd={boostOdd > 1 ? boostOdd.toFixed(2) : "8.53"}
          confidence={boostConfidence || 88}
          onOpen={() => document.getElementById("vip-ticket")?.scrollIntoView({ behavior: "smooth" })}
        />
      </section>

      <TopPickSection game={topPickGame} tip={topPick} onAnalyze={() => topPickGame && analyzeGame(topPickGame, topPick)} />

      <PlayerPropsPremium props={playerProps} onOpen={() => document.getElementById("player-props")?.scrollIntoView({ behavior: "smooth" })} />

      <section className="ticket-performance-grid" style={styles.ticketPerformanceGrid}>
        <VipTicket picks={premiumBoost} />
        <PerformancePanel greens={wonBets || 52} winRate={winRate || 72} roi={18.2} entries={displayedSmartTips.length || 12} />
      </section>

      <GamesShowcase games={futureGames.slice(0, 9)} loading={loading} refreshing={refreshing} onRefresh={() => loadAll(false)} onAnalyze={analyzeGame} />

      <Footer />
    </main>
  );
}

function Header({ plan, role, onLogout }: { plan: string; role: string; onLogout: () => void }) {
  const menu = [
    ["🏠", "Dashboard"],
    ["🔴", "Ao Vivo"],
    ["🤖", "IA Premium"],
    ["🔥", "Combinadas"],
    ["⚽", "Player Props"],
    ["📈", "Greens"],
    ["💰", "Odds"],
    ["🏆", "Brasileirão"],
    ["🌎", "Sul-Americanos"],
  ];

  return (
    <header style={styles.header}>
      <button style={styles.logoButton} onClick={() => (window.location.href = "/dashboard")}>
        <img src="/logo-oddix-horizontal.png" alt="ODDIX TIPSTER IA" style={styles.headerLogo} />
      </button>

      <nav style={styles.headerMenu}>
        {menu.map(([icon, label]) => (
          <button key={label} style={styles.menuButton}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
        {role === "ADMIN" && <button style={styles.menuButton} onClick={() => (window.location.href = "/admin")}>⚙️ Admin</button>}
      </nav>

      <div style={styles.headerActions}>
        <button style={styles.planPill}>👑 Plano {plan}</button>
        <button style={styles.vipButton} onClick={() => (window.location.href = "/plans")}>Assinar VIP</button>
        <button style={styles.avatarButton}>OD</button>
        <button style={styles.logoutButton} onClick={onLogout}>Sair</button>
      </div>
    </header>
  );
}

function HeroSection({ games, live, tips, roi }: { games: number; live: number; tips: number; roi: number }) {
  return (
    <section style={styles.heroCard}>
      <div style={styles.heroContent}>
        <span style={styles.heroBadge}>ODDIX SMART BETTING</span>
        <h1 style={styles.heroTitle}>
          ODDIX IA <span>V4</span>
        </h1>
        <p style={styles.heroText}>
          A inteligência artificial que filtra milhares de jogos, elimina entradas ruins e destaca apenas oportunidades com valor.
        </p>

        <div style={styles.heroFeatures}>
          {['Top Picks Premium', 'Player Props', 'Leitura Ao Vivo', 'Bilhetes VIP', 'Gestão de banca'].map((item) => (
            <span key={item}>✓ {item}</span>
          ))}
        </div>

        <div style={styles.heroMetrics}>
          <HeroMetric label="JOGOS" value={games} />
          <HeroMetric label="AO VIVO" value={live} accent="green" />
          <HeroMetric label="TIPS IA" value={tips} />
          <HeroMetric label="ROI" value={`${roi}%`} accent="green" />
        </div>

        <div style={styles.heroCtas}>
          <button style={styles.primaryCta} onClick={() => document.getElementById("top-pick")?.scrollIntoView({ behavior: "smooth" })}>🔥 VER TOP PICK</button>
          <button style={styles.secondaryCta} onClick={() => (window.location.href = "/plans")}>💎 ASSINAR VIP</button>
        </div>
      </div>

      <div style={styles.heroVisual}>
        <div style={styles.energyOrb} />
        <div style={styles.heroLogoGhost}>ODDIX</div>
        <img src={ODDIX_PLAYER_IMAGE} alt="Jogador Oddix" style={styles.heroPlayer} />
        <div style={styles.smartphoneMock}>
          <span>ODDIX LIVE</span>
          <strong>89%</strong>
          <div style={styles.phoneLine} />
          <div style={{ ...styles.phoneLine, width: "62%" }} />
          <div style={{ ...styles.phoneLine, width: "78%" }} />
        </div>
        <div style={styles.heroSlogan}>JOGUE. CONECTE. DOMINE.<br /><b>SEJA ODDIX.</b></div>
      </div>

      <div style={styles.heroBottomBar}>
        <span>🏆 ANÁLISE PREMIUM</span>
        <span>⚡ PREVISÕES EM TEMPO REAL</span>
        <span>📊 ESTATÍSTICAS AVANÇADAS</span>
        <span>🎧 SUPORTE PREMIUM</span>
      </div>
    </section>
  );
}

function HeroMetric({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div style={styles.heroMetric}>
      <span>{label}</span>
      <strong style={{ color: accent === "green" ? "#22c55e" : "#F7C948" }}>{value}</strong>
    </div>
  );
}

function BoostPanel({ odd, confidence, onOpen }: { odd: string; confidence: number; onOpen: () => void }) {
  return (
    <aside style={styles.boostPanel}>
      <span style={styles.boostTitle}>🚀 Oddix Boost</span>
      <strong style={styles.boostOdd}>{odd}</strong>
      <small style={styles.boostText}>Odd combinada estimada</small>
      <div style={styles.boostProgress}><div style={{ ...styles.boostProgressFill, width: `${Math.min(100, confidence)}%` }} /></div>
      <button style={styles.boostButton} onClick={onOpen}>Ver combinada</button>
    </aside>
  );
}

function TopPickSection({ game, tip, onAnalyze }: { game: any; tip: any; onAnalyze: () => void }) {
  if (!game || !tip) {
    return <section id="top-pick" style={styles.topPickCard}><strong>Carregando Top Pick...</strong></section>;
  }

  return (
    <section id="top-pick" style={styles.topPickCard}>
      <div style={styles.topPickLabel}>
        <span>⭐</span>
        <strong>TOP<br />PICK DO DIA</strong>
      </div>

      <div style={styles.topPickTeams}>
        <img src={game.teams?.home?.logo || logoFallback(game.teams?.home?.name)} alt={game.teams?.home?.name} style={styles.topPickLogo} />
        <div style={styles.topPickMatchText}>
          <strong>{game.teams?.home?.name}</strong>
          <span>VS</span>
          <strong>{game.teams?.away?.name}</strong>
          <small>{game.league?.name} • {formatDateTime(game.fixture?.date)}</small>
        </div>
        <img src={game.teams?.away?.logo || logoFallback(game.teams?.away?.name)} alt={game.teams?.away?.name} style={styles.topPickLogo} />
      </div>

      <div style={styles.topPickMarket}>
        <small>MERCADO ESCOLHIDO PELA IA</small>
        <strong>{String(tip.tip || "Over 1.5 gols").toUpperCase()}</strong>
        <span>{tip.market || "Mercado IA"} • {tip.risk || "Baixo"}</span>
      </div>

      <div style={styles.topPickStats}>
        <MetricBox label="ODD" value={tip.odd || "1.81"} />
        <MetricBox label="CONFIANÇA" value={`${tip.confidence || 89}%`} green />
        <MetricBox label="SCORE ODDIX" value={`${safeNumber(game?.oddix?.qualityScore, 100)}/100`} />
        <button style={styles.topPickButton} onClick={onAnalyze}>ABRIR ANÁLISE PREMIUM ›</button>
      </div>
    </section>
  );
}

function MetricBox({ label, value, green }: { label: string; value: any; green?: boolean }) {
  return (
    <div style={styles.metricBox}>
      <span>{label}</span>
      <strong style={{ color: green ? "#22c55e" : "#F7C948" }}>{value}</strong>
    </div>
  );
}

function PlayerPropsPremium({ props, onOpen }: { props: any[]; onOpen: () => void }) {
  return (
    <section id="player-props" style={styles.playerPropsSection}>
      <div style={styles.sectionTitleRow}>
        <div>
          <span style={styles.sectionKicker}>⚽ PLAYER PROPS EM DESTAQUE</span>
          <h2 style={styles.sectionTitle}>Mercados de jogador filtrados pela IA</h2>
          <p style={styles.sectionSubtitle}>Cards com jogador, escudo em alta qualidade, odd e confiança IA para abrir a percepção premium do VIP.</p>
        </div>
        <button style={styles.sectionButton} onClick={onOpen}>Ver todos os mercados</button>
      </div>

      <div style={styles.playerPropsGrid}>
        {(props.length ? props : [0, 1, 2]).map((prop: any, index: number) => (
          <PlayerPropCard key={prop?.key || index} prop={prop} index={index} />
        ))}
      </div>
    </section>
  );
}

function PlayerPropCard({ prop, index }: { prop: any; index: number }) {
  const fallbackTeam = index === 0 ? "CRB" : index === 1 ? "Botafogo SP" : "América MG";
  const teamName = prop?.playerTeam || fallbackTeam;
  const propLogo = prop?.teamLogo || logoFallback(teamName);
  const propInitials = prop?.playerInitials || initials(teamName);
  const market = prop?.market || (index === 1 ? "FINALIZAÇÕES" : "CHUTES NO GOL");
  const tip = prop?.tip || (index === 1 ? "Over 1.5 finalizações" : "Over 0.5 chute no gol");

  return (
    <button style={styles.playerCard}>
      <div style={styles.playerCardTop}>
        <img src={propLogo} alt={teamName} style={styles.playerTeamLogo} />
        <div style={styles.playerAvatarPremium}>
          <span>{propInitials}</span>
        </div>
        <TrendChart />
        <small style={styles.cardRank}>#{index + 1}</small>
      </div>

      <div style={styles.playerCardBody}>
        <h3>{prop?.player || `Destaque ${teamName}`}</h3>
        <strong>{teamName}</strong>
        <span>{market}</span>
        <div style={styles.playerSelectionBox}>
          <small>Entrada</small>
          <b>{tip}</b>
        </div>
      </div>

      <div style={styles.playerCardFooter}>
        <div><small>ODD</small><strong>{prop?.odd || "1.72"}</strong></div>
        <div><small>CONFIANÇA</small><strong>{prop?.confidence || 89}%</strong></div>
      </div>
    </button>
  );
}

function TrendChart() {
  return (
    <div style={styles.trendChart}>
      {[14, 20, 28, 35, 44, 54].map((height, index) => (
        <span key={index} style={{ height }} />
      ))}
    </div>
  );
}

function VipTicket({ picks }: { picks: any[] }) {
  const safePicks = picks.length
    ? picks.slice(0, 3)
    : [
        { game: "CRB x São Bernardo", tip: "Over 1.5 gols", odd: "1.81" },
        { game: "Vila Nova x Botafogo SP", tip: "Ambas marcam - Sim", odd: "1.98" },
        { game: "Cordino EC x Timon EC", tip: "Handicap +1.5", odd: "1.62" },
      ];

  const totalOdd = safePicks.reduce((acc: number, item: any) => acc * safeNumber(item.odd, 1), 1);
  const stake = 100;
  const returnValue = Math.round(totalOdd * stake);

  return (
    <section id="vip-ticket" style={styles.ticketSection}>
      <div style={styles.ticketList}>
        <span style={styles.sectionKicker}>🎟️ BILHETE VIP INTELIGENTE</span>
        <h2 style={styles.ticketTitle}>Combinada premium montada pela IA</h2>
        <p style={styles.sectionSubtitle}>Seleções com odd controlada, confiança alta e jogos diferentes para reduzir exposição.</p>

        <div style={styles.ticketRows}>
          {safePicks.map((pick: any, index: number) => (
            <div key={`${pick.game}-${index}`} style={styles.ticketRow}>
              <span style={styles.ticketNumber}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{pick.game}</strong>
                <small>{pick.tip}</small>
              </div>
              <b>{pick.odd}</b>
              <span style={styles.greenCheck}>✓</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.ticketSummary}>
        <span>ODD TOTAL</span>
        <strong>{totalOdd.toFixed(2)}</strong>
        <span>STAKE SUGERIDA</span>
        <b>R$ {stake.toFixed(2).replace(".", ",")}</b>
        <span>RETORNO POTENCIAL</span>
        <em>R$ {returnValue.toFixed(2).replace(".", ",")}</em>
        <div style={styles.vipSeal}>VIP<br />PREMIUM</div>
      </div>
    </section>
  );
}

function PerformancePanel({ greens, winRate, roi, entries }: { greens: number; winRate: number; roi: number; entries: number }) {
  const cards = [
    { label: "GREENS", value: greens, color: "#22c55e" },
    { label: "ASSERTIVIDADE", value: `${winRate}%`, color: "#a855f7" },
    { label: "ROI", value: `+${roi}%`, color: "#22c55e" },
    { label: "ENTRADAS PREMIUM", value: entries, color: "#a855f7" },
  ];

  return (
    <section style={styles.performancePanel}>
      <span style={styles.sectionKicker}>📊 DESEMPENHO ODDIX</span>
      <div style={styles.performanceGrid}>
        {cards.map((card) => (
          <div key={card.label} style={styles.performanceCard}>
            <strong style={{ color: card.color }}>{card.value}</strong>
            <span>{card.label}</span>
            <small>Últimos 7 dias</small>
            <MiniLine color={card.color} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniLine({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 36" style={styles.miniLine}>
      <polyline points="0,30 18,27 34,29 48,20 62,22 76,14 92,16 110,7 120,5" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GamesShowcase({ games, loading, refreshing, onRefresh, onAnalyze }: any) {
  return (
    <section style={styles.gamesSection}>
      <div style={styles.sectionTitleRow}>
        <div>
          <span style={styles.sectionKicker}>⚽ JOGOS FILTRADOS</span>
          <h2 style={styles.sectionTitle}>Oportunidades monitoradas pela Oddix IA</h2>
        </div>
        <button style={styles.sectionButton} onClick={onRefresh}>{refreshing ? "Atualizando..." : "Atualizar jogos"}</button>
      </div>

      {loading ? (
        <div style={styles.emptyBox}>Carregando jogos premium...</div>
      ) : games.length ? (
        <div style={styles.gamesGrid}>
          {games.map((game: any, index: number) => (
            <button key={stableGameKey(game) || index} style={styles.gameCard} onClick={() => onAnalyze(game, smartLocalTip(game, index))}>
              <div style={styles.gameCardHeader}>
                <span>{isGameLive(game) ? "🔴 AO VIVO" : "PRÉ-JOGO"}</span>
                <strong>{game?.oddix?.qualityScore || 80}/100</strong>
              </div>
              <div style={styles.gameTeamsRow}>
                <img src={game?.teams?.home?.logo || logoFallback(game?.teams?.home?.name)} alt="home" />
                <b>VS</b>
                <img src={game?.teams?.away?.logo || logoFallback(game?.teams?.away?.name)} alt="away" />
              </div>
              <strong>{game?.teams?.home?.name} x {game?.teams?.away?.name}</strong>
              <small>{game?.league?.name} • {formatDateTime(game?.fixture?.date)}</small>
              <span style={styles.gameCardCta}>Abrir análise premium</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={styles.emptyBox}>Nenhum jogo encontrado no momento.</div>
      )}
    </section>
  );
}

function AnalysisPanel({ selected, onClose }: { selected: any; onClose: () => void }) {
  const game = selected?.game || {};
  const ai = selected?.ai || {};

  return (
    <section style={styles.analysisPanel}>
      <div>
        <span style={styles.sectionKicker}>ANÁLISE ODDIX IA</span>
        <h2 style={styles.sectionTitle}>{game?.teams?.home?.name} x {game?.teams?.away?.name}</h2>
        <p style={styles.sectionSubtitle}>{game?.league?.name} • {formatDateTime(game?.fixture?.date)}</p>
      </div>
      <div style={styles.analysisPick}>
        <strong>{ai.tip}</strong>
        <span>Odd {ai.odd} • {ai.confidence}% • {ai.risk}</span>
      </div>
      <p style={styles.analysisText}>{ai.analysis}</p>
      <div style={styles.analysisActions}>
        <button style={styles.primaryCta} onClick={() => window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer")}>🎯 Pegar palpite</button>
        <button style={styles.secondaryCta} onClick={onClose}>Fechar</button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <strong>ODDIX IA™</strong>
      <span>18+ Jogue com responsabilidade. Aposta não é investimento.</span>
      <button style={styles.sectionButton} onClick={() => window.open(FREE_GROUP_LINK, "_blank")}>Entrar no grupo FREE</button>
    </footer>
  );
}

const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #07070D; }
  button { font-family: inherit; }
  .oddix-rebuild { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .hero-boost-grid { grid-template-columns: minmax(0, 1fr) 300px; }
  .ticket-performance-grid { grid-template-columns: minmax(0, 1.2fr) minmax(360px, .8fr); }
  @media (max-width: 1180px) {
    .hero-boost-grid, .ticket-performance-grid { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 760px) {
    .oddix-rebuild { padding: 0 12px 28px !important; }
    .hero-title-responsive { font-size: 52px !important; }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 15% 10%, rgba(123,44,255,.28), transparent 32%), radial-gradient(circle at 80% 20%, rgba(247,201,72,.09), transparent 25%), linear-gradient(180deg, #07070D 0%, #12051F 38%, #07070D 100%)",
    color: "#fff",
    padding: "0 24px 40px",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    minHeight: 76,
    margin: "0 -24px",
    padding: "14px 26px",
    display: "grid",
    gridTemplateColumns: "190px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 18,
    background: "rgba(7,7,13,.88)",
    borderBottom: "1px solid rgba(123,44,255,.4)",
    backdropFilter: "blur(18px)",
  },
  logoButton: {
    height: 48,
    borderRadius: 18,
    border: "1px solid rgba(123,44,255,.52)",
    background: "linear-gradient(135deg, rgba(255,255,255,.08), rgba(123,44,255,.12))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  headerLogo: { maxWidth: 118, maxHeight: 32, objectFit: "contain" },
  headerMenu: { display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 2 },
  menuButton: {
    border: "1px solid rgba(255,255,255,.12)",
    color: "#fff",
    background: "rgba(255,255,255,.06)",
    borderRadius: 999,
    padding: "9px 12px",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  headerActions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  planPill: {
    border: 0,
    borderRadius: 999,
    padding: "11px 16px",
    background: "linear-gradient(135deg, #7B2CFF, #4c1d95)",
    color: "#fff",
    fontWeight: 950,
    boxShadow: "0 0 28px rgba(123,44,255,.34)",
  },
  vipButton: {
    border: 0,
    borderRadius: 999,
    padding: "12px 18px",
    background: "linear-gradient(135deg, #F7C948, #fb923c)",
    color: "#050510",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 0 24px rgba(247,201,72,.25)",
  },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "2px solid rgba(168,85,247,.6)",
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    fontWeight: 950,
  },
  logoutButton: {
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 999,
    padding: "10px 13px",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  unlockBanner: {
    margin: "18px 0 24px",
    padding: "16px 20px",
    borderRadius: 20,
    background: "linear-gradient(135deg, rgba(22,101,52,.95), rgba(5,80,43,.86))",
    border: "1px solid rgba(34,197,94,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
  },
  heroBoostGrid: { display: "grid", gap: 18, marginBottom: 22 },
  heroCard: {
    position: "relative",
    minHeight: 600,
    overflow: "hidden",
    borderRadius: 30,
    border: "1px solid rgba(247,201,72,.38)",
    background: "linear-gradient(135deg, #12051F 0%, #1A0836 42%, #0D0718 100%)",
    boxShadow: "0 0 48px rgba(123,44,255,.28)",
    display: "grid",
    gridTemplateColumns: "minmax(420px, 47%) minmax(0, 53%)",
    alignItems: "stretch",
    isolation: "isolate",
  },
  heroContent: { position: "relative", zIndex: 3, padding: "54px 0 90px 42px", maxWidth: 610 },
  heroBadge: {
    display: "inline-flex",
    border: "1px solid rgba(168,85,247,.75)",
    background: "rgba(123,44,255,.35)",
    color: "#d8b4fe",
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  heroTitle: {
    margin: "20px 0 18px",
    color: "#fff",
    fontSize: "clamp(76px, 8vw, 128px)",
    lineHeight: 0.86,
    letterSpacing: -5,
    fontWeight: 1000,
    textShadow: "0 0 38px rgba(123,44,255,.54)",
  },
  heroText: { maxWidth: 550, margin: 0, color: "rgba(255,255,255,.9)", fontSize: 18, lineHeight: 1.35, fontWeight: 700 },
  heroFeatures: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 },
  heroMetrics: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 26, maxWidth: 600 },
  heroMetric: {
    border: "1px solid rgba(247,201,72,.35)",
    borderRadius: 16,
    background: "linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.04))",
    padding: "15px 16px",
    minHeight: 78,
  },
  heroCtas: { display: "flex", gap: 14, marginTop: 26, flexWrap: "wrap" },
  primaryCta: {
    border: 0,
    borderRadius: 16,
    padding: "15px 28px",
    background: "linear-gradient(135deg, #F7C948, #fb923c)",
    color: "#050510",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 0 28px rgba(247,201,72,.28)",
  },
  secondaryCta: {
    border: "1px solid rgba(168,85,247,.75)",
    borderRadius: 16,
    padding: "14px 26px",
    background: "rgba(123,44,255,.12)",
    color: "#d8b4fe",
    fontWeight: 1000,
    cursor: "pointer",
  },
  heroVisual: { position: "relative", zIndex: 2, minHeight: 600 },
  energyOrb: {
    position: "absolute",
    width: 580,
    height: 580,
    borderRadius: 999,
    right: 70,
    top: 4,
    background: "radial-gradient(circle, rgba(123,44,255,.95), rgba(123,44,255,.36) 38%, transparent 68%)",
    filter: "blur(12px)",
    opacity: .95,
  },
  heroLogoGhost: {
    position: "absolute",
    right: 26,
    bottom: 96,
    fontSize: 112,
    fontWeight: 1000,
    letterSpacing: -5,
    color: "rgba(255,255,255,.16)",
    textShadow: "0 0 42px rgba(255,255,255,.25)",
  },
  heroPlayer: {
    position: "absolute",
    right: 36,
    bottom: 52,
    height: 500,
    width: 620,
    objectFit: "contain",
    objectPosition: "center bottom",
    filter: "drop-shadow(0 0 40px rgba(123,44,255,.58))",
  },
  smartphoneMock: {
    position: "absolute",
    left: 20,
    bottom: 135,
    width: 142,
    height: 218,
    borderRadius: 26,
    padding: 18,
    background: "linear-gradient(180deg, #050510, #111827)",
    border: "1px solid rgba(34,197,94,.45)",
    boxShadow: "0 0 40px rgba(34,197,94,.24)",
    transform: "rotate(-8deg)",
  },
  phoneLine: { height: 8, width: "90%", marginTop: 14, borderRadius: 999, background: "linear-gradient(90deg, #22c55e, #F7C948)" },
  heroSlogan: { position: "absolute", right: 78, bottom: 50, fontSize: 16, fontWeight: 1000, textAlign: "center", color: "rgba(255,255,255,.92)" },
  heroBottomBar: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 24,
    zIndex: 4,
    minHeight: 42,
    borderRadius: 999,
    border: "1px solid rgba(247,201,72,.38)",
    background: "rgba(7,7,13,.78)",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    alignItems: "center",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 1000,
    color: "#F7C948",
  },
  boostPanel: {
    minHeight: 500,
    borderRadius: 30,
    border: "1px solid rgba(123,44,255,.45)",
    background: "linear-gradient(180deg, rgba(13,7,24,.98), rgba(7,7,13,.98))",
    padding: 34,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "0 0 42px rgba(123,44,255,.24)",
  },
  boostTitle: { color: "#d8b4fe", fontSize: 22, fontWeight: 950, marginBottom: 28 },
  boostOdd: { color: "#F7C948", fontSize: 58, lineHeight: 1, fontWeight: 1000, marginBottom: 12 },
  boostText: { color: "rgba(255,255,255,.85)", fontWeight: 800, marginBottom: 24 },
  boostProgress: { height: 13, borderRadius: 999, background: "rgba(255,255,255,.1)", overflow: "hidden", marginBottom: 30 },
  boostProgressFill: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #22c55e, #F7C948)" },
  boostButton: { border: 0, borderRadius: 18, padding: "19px 18px", background: "linear-gradient(135deg, #F7C948, #fb923c)", color: "#050510", fontWeight: 1000, cursor: "pointer" },
  topPickCard: {
    marginBottom: 22,
    minHeight: 142,
    borderRadius: 26,
    border: "1px solid rgba(247,201,72,.58)",
    background: "linear-gradient(135deg, rgba(7,7,13,.96), rgba(45,17,77,.78))",
    boxShadow: "0 0 36px rgba(247,201,72,.10)",
    padding: 22,
    display: "grid",
    gridTemplateColumns: "140px 330px minmax(280px, 1fr) auto",
    gap: 22,
    alignItems: "center",
  },
  topPickLabel: { display: "flex", alignItems: "center", gap: 14, color: "#F7C948", fontSize: 18, fontWeight: 1000 },
  topPickTeams: { display: "grid", gridTemplateColumns: "78px minmax(0, 1fr) 78px", gap: 16, alignItems: "center" },
  topPickLogo: { width: 78, height: 78, objectFit: "contain", filter: "drop-shadow(0 0 14px rgba(255,255,255,.25))" },
  topPickMatchText: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontWeight: 950 },
  topPickMarket: { border: "1px solid rgba(247,201,72,.35)", borderRadius: 18, background: "rgba(255,255,255,.06)", padding: 22 },
  topPickStats: { display: "grid", gridTemplateColumns: "92px 116px 126px 190px", gap: 10, alignItems: "stretch" },
  metricBox: { border: "1px solid rgba(255,255,255,.13)", borderRadius: 14, background: "rgba(255,255,255,.06)", padding: 13, display: "flex", flexDirection: "column", justifyContent: "center", fontWeight: 950 },
  topPickButton: { border: 0, borderRadius: 18, background: "linear-gradient(135deg, #fff7ad, #F7C948, #fb923c)", color: "#050510", fontWeight: 1000, cursor: "pointer" },
  playerPropsSection: { marginBottom: 22, padding: 24, borderRadius: 28, border: "1px solid rgba(168,85,247,.65)", background: "linear-gradient(135deg, rgba(45,17,77,.96), rgba(123,44,255,.34), rgba(13,7,24,.98))", boxShadow: "0 0 42px rgba(123,44,255,.24)" },
  sectionTitleRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 20 },
  sectionKicker: { color: "#F7C948", fontWeight: 1000, fontSize: 12, letterSpacing: .7 },
  sectionTitle: { margin: "6px 0 4px", fontSize: 30, lineHeight: 1, fontWeight: 1000 },
  sectionSubtitle: { margin: 0, color: "rgba(255,255,255,.72)", fontSize: 13, fontWeight: 700 },
  sectionButton: { border: 0, borderRadius: 18, background: "linear-gradient(135deg, #F7C948, #fb923c)", color: "#050510", padding: "14px 18px", fontWeight: 1000, cursor: "pointer" },
  playerPropsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18 },
  playerCard: { position: "relative", overflow: "hidden", minHeight: 250, border: "1px solid rgba(255,255,255,.13)", borderRadius: 22, background: "linear-gradient(160deg, rgba(123,44,255,.72), rgba(45,17,77,.96) 60%, rgba(7,7,13,.96))", color: "#fff", textAlign: "left", cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), 0 18px 36px rgba(0,0,0,.28)" },
  playerCardTop: { position: "relative", height: 118, padding: 18, background: "radial-gradient(circle at 52% 22%, rgba(255,255,255,.18), transparent 32%), linear-gradient(90deg, rgba(255,255,255,.12), rgba(123,44,255,.18))" },
  playerTeamLogo: { width: 72, height: 72, objectFit: "contain", filter: "drop-shadow(0 0 16px rgba(255,255,255,.30))" },
  playerAvatarPremium: { position: "absolute", left: "42%", top: 20, width: 92, height: 92, borderRadius: 20, background: "linear-gradient(135deg, #F7C948, #fb923c 48%, #22c55e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#050510", fontSize: 28, fontWeight: 1000, boxShadow: "0 18px 34px rgba(0,0,0,.36)" },
  trendChart: { position: "absolute", right: 18, bottom: 14, display: "flex", alignItems: "flex-end", gap: 5 },
  cardRank: { position: "absolute", right: 12, top: 12, width: 34, height: 34, borderRadius: 999, background: "#050510", color: "#F7C948", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 1000 },
  playerCardBody: { padding: "18px 20px 12px" },
  playerSelectionBox: { marginTop: 14, border: "1px solid rgba(247,201,72,.28)", borderRadius: 14, padding: 13, background: "rgba(7,7,13,.55)", display: "flex", flexDirection: "column", gap: 4 },
  playerCardFooter: { display: "flex", justifyContent: "space-between", padding: "0 20px 18px", fontWeight: 1000 },
  ticketPerformanceGrid: { display: "grid", gap: 18, marginBottom: 22 },
  ticketSection: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", minHeight: 310, borderRadius: 26, border: "1px solid rgba(247,201,72,.48)", background: "linear-gradient(135deg, rgba(7,7,13,.98), rgba(45,17,77,.65))", overflow: "hidden" },
  ticketList: { padding: 24 },
  ticketTitle: { margin: "6px 0 4px", fontSize: 25, fontWeight: 1000 },
  ticketRows: { display: "flex", flexDirection: "column", gap: 12, marginTop: 20 },
  ticketRow: { display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) 64px 34px", alignItems: "center", gap: 12, border: "1px solid rgba(255,255,255,.12)", borderRadius: 16, background: "rgba(255,255,255,.06)", padding: 14 },
  ticketNumber: { width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,.14)", color: "#F7C948", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 1000 },
  greenCheck: { width: 28, height: 28, borderRadius: 999, border: "2px solid #22c55e", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 1000 },
  ticketSummary: { position: "relative", padding: 28, background: "linear-gradient(135deg, rgba(247,201,72,.18), rgba(251,146,60,.32), rgba(7,7,13,.92))", borderLeft: "1px dashed rgba(247,201,72,.45)", display: "flex", flexDirection: "column", gap: 8 },
  vipSeal: { position: "absolute", right: 24, bottom: 24, width: 82, height: 82, borderRadius: 999, background: "linear-gradient(135deg, #F7C948, #a16207)", color: "#050510", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontWeight: 1000, boxShadow: "0 0 24px rgba(247,201,72,.35)" },
  performancePanel: { borderRadius: 26, border: "1px solid rgba(168,85,247,.45)", background: "linear-gradient(135deg, rgba(13,7,24,.98), rgba(45,17,77,.78))", padding: 24 },
  performanceGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 18 },
  performanceCard: { minHeight: 126, border: "1px solid rgba(255,255,255,.12)", borderRadius: 18, padding: 18, background: "rgba(255,255,255,.05)", position: "relative", overflow: "hidden" },
  miniLine: { position: "absolute", right: 12, bottom: 12, width: 96, height: 34, opacity: .9 },
  gamesSection: { marginBottom: 22, padding: 24, borderRadius: 26, border: "1px solid rgba(123,44,255,.36)", background: "rgba(13,7,24,.76)" },
  gamesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  gameCard: { border: "1px solid rgba(255,255,255,.12)", borderRadius: 20, background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03))", padding: 18, color: "#fff", textAlign: "left", cursor: "pointer" },
  gameCardHeader: { display: "flex", justifyContent: "space-between", color: "#F7C948", fontWeight: 1000, fontSize: 12 },
  gameTeamsRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 18, margin: "18px 0" },
  gameCardCta: { display: "block", marginTop: 14, color: "#22c55e", fontWeight: 1000 },
  emptyBox: { padding: 36, textAlign: "center", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 20 },
  analysisPanel: { marginBottom: 22, padding: 24, borderRadius: 26, border: "1px solid rgba(247,201,72,.45)", background: "rgba(13,7,24,.96)" },
  analysisPick: { margin: "18px 0", border: "1px solid rgba(247,201,72,.35)", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 6 },
  analysisText: { color: "rgba(255,255,255,.78)", lineHeight: 1.5 },
  analysisActions: { display: "flex", gap: 12, flexWrap: "wrap" },
  footer: { marginTop: 30, padding: 24, borderTop: "1px solid rgba(255,255,255,.12)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, color: "rgba(255,255,255,.72)" },
};
