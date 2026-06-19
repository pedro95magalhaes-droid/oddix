"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../../services/api";

const ESTRELABET_LINK =
  process.env.NEXT_PUBLIC_ESTRELABET_LINK ||
  "https://apretailer.com.br/click/6a2102c82bfa8143b57b86d8/182492/359080/subaccount";
const SUPPORT_WHATSAPP_LINK = process.env.NEXT_PUBLIC_ODDIX_SUPPORT_WHATSAPP || "";
const ODDIX_PLAYER_IMAGE = "/images/oddix-player.png";

type TabKey = "dashboard" | "live" | "top" | "playerprops" | "results" | "favorites" | "vip" | "virtual";

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function safeNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatusShort(status: any) {
  const raw = String(status?.short || status?.curto || status?.shortName || "").toUpperCase();
  if (raw === "1T") return "1H";
  if (raw === "2T") return "2H";
  return raw;
}

function isLiveStatus(status: string) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(String(status || "").toUpperCase());
}

function isFinishedStatus(status: string) {
  return ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"].includes(String(status || "").toUpperCase());
}

function logoFallback(name: string, bg = "111827", color = "ffffff") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Time")}&background=${bg}&color=${color}&bold=true`;
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

  return {
    ...game,
    provider: game.provider || game.provedor || "unknown",
    fixture: {
      ...fixture,
      id: fixture.id || fixture.externalId || game.fixtureId,
      date: fixture.date || fixture.data || game.gameDate,
      status: {
        ...status,
        short: normalizeStatusShort(status),
        long: status.long || status.longo || status.name || "",
        elapsed: safeNumber(status.elapsed ?? status.decorrido, 0),
      },
    },
    league: {
      ...league,
      name: league.name || league.nome || game.league || "Liga",
      country: league.country || league.pais || "",
      logo: league.logo || "",
    },
    teams: {
      home: {
        ...home,
        name: home.name || home.nome || game.homeTeam || "Casa",
        logo: home.logo || game.homeLogo || "",
      },
      away: {
        ...away,
        name: away.name || away.nome || game.awayTeam || "Fora",
        logo: away.logo || game.awayLogo || "",
      },
    },
    goals: {
      home: goals.home ?? score?.fulltime?.home ?? game.homeScore ?? null,
      away: goals.away ?? score?.fulltime?.away ?? game.awayScore ?? null,
    },
    oddix: {
      qualityScore: safeNumber(oddix.qualityScore ?? oddix.pontuacaoQualidade, 70),
      qualityLabel: oddix.qualityLabel || "Premium",
    },
    odds: game.odds || {},
  };
}

function getStatusShort(game: any) {
  return normalizeStatusShort(game?.fixture?.status || {});
}

function isGameLive(game: any) {
  const status = getStatusShort(game);
  return isLiveStatus(status) && !isFinishedStatus(status);
}

function isGameFinished(game: any) {
  return isFinishedStatus(getStatusShort(game));
}

function getOddsOptions(game: any) {
  const options = game?.odds?.options || game?.odds?.opções || [];
  return Array.isArray(options) ? options : [];
}

function getBestSafeOdd(game: any) {
  const valid = getOddsOptions(game)
    .map((item: any) => Number(item?.odd ?? item?.value ?? item?.price))
    .filter((odd: number) => Number.isFinite(odd) && odd >= 1.2 && odd <= 2.5)
    .sort((a: number, b: number) => Math.abs(a - 1.65) - Math.abs(b - 1.65));

  return valid[0] || null;
}

function formatDateTime(date: any) {
  if (!date) return "Hoje";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Hoje";
  return parsed.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function gameDateKey(game: any) {
  const raw = game?.fixture?.date;
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return dateKey(parsed);
}

function normalizeText(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFrontendLeagueAllowed(game: any) {
  const text = normalizeText([
    game?.league?.name,
    game?.league?.country,
    game?.teams?.home?.name,
    game?.teams?.away?.name,
  ].filter(Boolean).join(" "));

  const blocked = [
    "u17", "u18", "u19", "u20", "u21", "u23",
    "sub 17", "sub 18", "sub 19", "sub 20", "sub 21", "sub 23",
    "women", "feminino", "feminina", "reserve", "reserves",
    "esoccer", "simulado", "simulated",
  ];

  return !blocked.some((word) => text.includes(word));
}

function stableGameKey(game: any) {
  const home = normalizeText(game?.teams?.home?.name);
  const away = normalizeText(game?.teams?.away?.name);
  const day = gameDateKey(game);
  if (home && away && day) return `${day}-${home}-${away}`;
  return String(game?.fixture?.id || `${home}-${away}`);
}

function mergeGames(groups: any[][]) {
  const map = new Map<string, any>();

  groups.flat().forEach((raw) => {
    const game = normalizeGame(raw);
    if (!game || !isFrontendLeagueAllowed(game)) return;

    const key = stableGameKey(game);
    const current = map.get(key);
    if (!current) {
      map.set(key, game);
      return;
    }

    const incomingScore = safeNumber(game?.oddix?.qualityScore, 0) + (getBestSafeOdd(game) ? 25 : 0);
    const currentScore = safeNumber(current?.oddix?.qualityScore, 0) + (getBestSafeOdd(current) ? 25 : 0);

    if (incomingScore >= currentScore) map.set(key, game);
  });

  return Array.from(map.values()).sort((a: any, b: any) => {
    if (isGameLive(a) !== isGameLive(b)) return isGameLive(b) ? 1 : -1;
    return safeNumber(b?.oddix?.qualityScore, 0) - safeNumber(a?.oddix?.qualityScore, 0);
  });
}

function buildSmartTip(game: any) {
  const homeTeam = game?.teams?.home?.name || "Casa";
  const awayTeam = game?.teams?.away?.name || "Fora";
  const quality = safeNumber(game?.oddix?.qualityScore, 70);
  const odd = getBestSafeOdd(game) || (quality >= 90 ? 1.72 : quality >= 80 ? 1.85 : 2.0);

  let tip = "Over 1.5 gols";
  let market = "Total de Gols";
  if (quality >= 92) {
    tip = "Over 1.5 gols";
    market = "Entrada Premium";
  } else if (quality >= 84) {
    tip = `${homeTeam} ou empate`;
    market = "Dupla Chance";
  } else if (isGameLive(game)) {
    tip = "Over 0.5 gol ao vivo";
    market = "Ao Vivo";
  }

  return {
    fixtureId: game?.fixture?.id,
    game: `${homeTeam} x ${awayTeam}`,
    homeTeam,
    awayTeam,
    league: game?.league?.name,
    market,
    tip,
    odd: Number(odd).toFixed(2),
    confidence: Math.min(94, Math.max(68, Math.round(quality * 0.92))),
    risk: quality >= 85 ? "Baixo" : "Médio",
    qualityScore: quality,
  };
}

function findGameByTip(tip: any, games: any[]) {
  const id = String(tip?.fixtureId || "");
  if (id) {
    const byId = games.find((game) => String(game?.fixture?.id || "") === id);
    if (byId) return byId;
  }

  const home = normalizeText(tip?.homeTeam);
  const away = normalizeText(tip?.awayTeam);

  return games.find((game) => normalizeText(game?.teams?.home?.name).includes(home) && normalizeText(game?.teams?.away?.name).includes(away)) || null;
}

function getPlayerPhoto(prop: any) {
  return prop?.playerPhoto || prop?.photo || prop?.image || prop?.player?.photo || prop?.player?.image || "";
}

function getPlayerName(prop: any) {
  return prop?.playerName || prop?.player || prop?.name || prop?.player?.name || "Jogador Oddix";
}

function getPropTip(prop: any) {
  return prop?.tip || prop?.selection || prop?.market || "Mais de 0.5 chute no gol";
}


function normalizeVirtualTopPick(pick: any) {
  const topPick = pick?.topPick || pick?.top_pick || pick?.principal || null;

  if (!topPick) return null;

  return {
    id: String(pick?.id || `${pick?.homeTeam || pick?.timeA}-${pick?.awayTeam || pick?.timeB}`),
    league: pick?.league || pick?.liga || pick?.competition || "Virtual",
    homeTeam: pick?.homeTeam || pick?.timeA || pick?.casa || "Casa",
    awayTeam: pick?.awayTeam || pick?.timeB || pick?.fora || "Fora",
    timeLabel: pick?.timeLabel || pick?.horario || `${pick?.hora || ""}:${pick?.minuto || ""}`,
    market: topPick.market || topPick.mercado || "Mercado Virtual",
    selection: topPick.selection || topPick.selecao || topPick.escolha || "Entrada Virtual",
    odd: safeNumber(topPick.odd, 0) || topPick.odd || "-",
    score: safeNumber(topPick.score ?? topPick.pontuacao ?? topPick["pontuação"], 0),
    confidence: safeNumber(topPick.confidence ?? topPick.confianca ?? topPick["confiança"], 0),
    risk: topPick.risk || topPick.risco || "Baixo",
    reason: topPick.reason || topPick.motivo || "Padrão estatístico detectado pela IA Virtual.",
  };
}


export default function Dashboard() {
  const [games, setGames] = useState<any[]>([]);
  const [savedBets, setSavedBets] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [plan, setPlan] = useState("Free");
  const [role, setRole] = useState("USER");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [analyzingId, setAnalyzingId] = useState<any>(null);
  const [realPlayerProps, setRealPlayerProps] = useState<any[]>([]);
  const [playerPropsLoading, setPlayerPropsLoading] = useState(false);
  const [virtualTopPick, setVirtualTopPick] = useState<any>(null);
  const [virtualLoading, setVirtualLoading] = useState(false);

  const today = dateKey(new Date());
  const isPaidPlan = ["PRO", "VIP", "Pro", "Vip", "pro", "vip"].includes(String(plan));

  const liveGames = useMemo(() => games.filter(isGameLive), [games]);
  const futureGames = useMemo(() => games.filter((game) => !isGameLive(game) && !isGameFinished(game)), [games]);
  const finishedGames = useMemo(() => games.filter(isGameFinished), [games]);

  const stats = useMemo(() => {
    const won = savedBets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "won").length;
    const lost = savedBets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "lost").length;
    const finished = won + lost;
    return {
      totalBets: savedBets.length,
      wonBets: won,
      lostBets: lost,
      roi: finished ? Math.round((won / finished) * 100) : 0,
      accuracy: finished ? Math.round((won / finished) * 100) : 0,
    };
  }, [savedBets]);

  const leagues = useMemo(() => {
    return Array.from(new Set(games.map((game) => game?.league?.name).filter(Boolean))).sort();
  }, [games]);

  const topGames = useMemo(() => {
    return [...games]
      .filter((game) => !isGameFinished(game))
      .sort((a, b) => safeNumber(b?.oddix?.qualityScore, 0) - safeNumber(a?.oddix?.qualityScore, 0))
      .slice(0, 16);
  }, [games]);

  const smartTips = useMemo(() => {
    const seen = new Set<string>();
    return topGames
      .map(buildSmartTip)
      .filter((tip) => {
        const key = String(tip.fixtureId || tip.game);
        if (seen.has(key)) return false;
        seen.add(key);
        return safeNumber(tip.confidence, 0) >= 65;
      })
      .slice(0, 8);
  }, [topGames]);

  const topPick = useMemo(() => {
    return [...smartTips].sort((a, b) => {
      const scoreA = safeNumber(a.qualityScore, 0) * 0.62 + safeNumber(a.confidence, 0) * 0.38;
      const scoreB = safeNumber(b.qualityScore, 0) * 0.62 + safeNumber(b.confidence, 0) * 0.38;
      return scoreB - scoreA;
    })[0] || null;
  }, [smartTips]);

  const topPickGame = useMemo(() => {
    return topPick ? findGameByTip(topPick, games) || topGames[0] : topGames[0] || null;
  }, [topPick, games, topGames]);

  const boostPicks = useMemo(() => {
    return smartTips
      .filter((tip) => safeNumber(tip.confidence, 0) >= 72)
      .filter((tip) => safeNumber(tip.odd, 0) <= 2.15)
      .slice(0, 3);
  }, [smartTips]);

  const boostOdd = boostPicks.reduce((acc, item) => acc * safeNumber(item.odd, 1), 1);
  const boostConfidence = boostPicks.length
    ? Math.round(boostPicks.reduce((acc, item) => acc + safeNumber(item.confidence, 0), 0) / boostPicks.length)
    : 0;

  const topGameIds = useMemo(() => topGames.slice(0, 6).map((game) => String(game?.fixture?.id || "")).filter(Boolean).join("|"), [topGames]);

  const homePlayerProp = useMemo(() => {
    return realPlayerProps[0] || null;
  }, [realPlayerProps]);

  const filteredGames = useMemo(() => {
    const q = search.toLowerCase().trim();

    return games.filter((game) => {
      if (leagueFilter !== "all" && game?.league?.name !== leagueFilter) return false;
      if (activeTab === "live" && !isGameLive(game)) return false;
      if (activeTab === "top" && !topGames.some((top) => String(top?.fixture?.id) === String(game?.fixture?.id))) return false;
      if (activeTab === "results" && !isGameFinished(game)) return false;
      if (!q) return true;

      const haystack = [
        game?.teams?.home?.name,
        game?.teams?.away?.name,
        game?.league?.name,
        game?.league?.country,
      ].filter(Boolean).join(" ").toLowerCase();

      return q.split(" ").filter(Boolean).some((term) => haystack.includes(term));
    }).slice(0, 24);
  }, [games, activeTab, topGames, search, leagueFilter]);

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
        api.get("/favorite"),
      ]);

      const live = responses[0].status === "fulfilled" ? responses[0].value?.data || [] : [];
      const fixturesToday = responses[1].status === "fulfilled" ? responses[1].value?.data || [] : [];
      const fixturesTomorrow = responses[2].status === "fulfilled" ? responses[2].value?.data || [] : [];
      const fixturesDayAfterTomorrow = responses[3].status === "fulfilled" ? responses[3].value?.data || [] : [];
      const bets = responses[4].status === "fulfilled" ? responses[4].value?.data || [] : [];
      const favs = responses[5].status === "fulfilled" ? responses[5].value?.data || [] : [];

      const allowedDateKeys = new Set([today, tomorrow, dayAfterTomorrow]);
      const merged = mergeGames([live, fixturesToday, fixturesTomorrow, fixturesDayAfterTomorrow])
        .filter((game) => {
          const key = gameDateKey(game);
          return !key || allowedDateKeys.has(key);
        });

      setGames(merged);
      setSavedBets(Array.isArray(bets) ? bets : []);
      setFavorites(Array.isArray(favs) ? favs : []);
    } catch {
      setGames([]);
      setSavedBets([]);
      setFavorites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadRealPlayerProps() {
    const ids = topGameIds.split("|").filter(Boolean);

    if (!ids.length) {
      setRealPlayerProps([]);
      return;
    }

    try {
      setPlayerPropsLoading(true);
      const responses = await Promise.allSettled(ids.map((fixtureId) => api.get(`/football/player-props/${fixtureId}`)));
      const props = responses.flatMap((response: any) => {
        if (response.status !== "fulfilled") return [];
        const data = response.value?.data || {};
        const rows = data.playerProps || data.props || [];
        return Array.isArray(rows) ? rows : [];
      });

      const seen = new Set<string>();
      const unique = props
        .filter((prop: any) => getPlayerPhoto(prop))
        .filter((prop: any) => {
          const key = `${prop.fixtureId || ""}-${prop.playerId || getPlayerName(prop)}-${getPropTip(prop)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a: any, b: any) => safeNumber(b?.confidence ?? b?.confiança, 0) - safeNumber(a?.confidence ?? a?.confiança, 0))
        .slice(0, 8);

      setRealPlayerProps(unique);
    } catch {
      setRealPlayerProps([]);
    } finally {
      setPlayerPropsLoading(false);
    }
  }


  async function loadVirtualTopPick() {
    try {
      setVirtualLoading(true);
      const response = await api.get("/virtual/top-picks?league=euro&historyLimit=300");
      const rows = response.data?.topPicks || response.data?.top_picks || response.data?.picks || [];
      const normalized = Array.isArray(rows)
        ? rows.map(normalizeVirtualTopPick).filter(Boolean)
        : [];

      setVirtualTopPick(normalized[0] || null);
    } catch {
      setVirtualTopPick(null);
    } finally {
      setVirtualLoading(false);
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
    loadVirtualTopPick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => loadAll(false), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  useEffect(() => {
    loadRealPlayerProps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topGameIds]);

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  function openSupport() {
    if (SUPPORT_WHATSAPP_LINK) {
      window.open(SUPPORT_WHATSAPP_LINK, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = "/support";
  }

  function openEstrelaBet() {
    window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer");
  }

  function openPlans() {
    window.location.href = "/plans";
  }

  async function analyzeGame(rawGame: any, smartTip?: any) {
    const game = normalizeGame(rawGame);
    if (!game) return;

    if (!isPaidPlan) {
      setSelectedAnalysis({
        game,
        ai: {
          tip: smartTip?.tip || "Análise bloqueada",
          odd: smartTip?.odd || "-",
          confidence: smartTip?.confidence || 0,
          risk: "VIP",
          analysis: "A análise completa está disponível na plataforma VIP.",
        },
        locked: true,
      });
      return;
    }

    try {
      const fixtureId = game.fixture?.id;
      setAnalyzingId(fixtureId);

      const aiResponse = await api.post("/ai/generate-bet", {
        ...game,
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        smartTip: smartTip || null,
      });

      setSelectedAnalysis({
        game,
        ai: aiResponse.data || smartTip || buildSmartTip(game),
        locked: false,
      });
    } catch {
      setSelectedAnalysis({
        game,
        ai: smartTip || buildSmartTip(game),
        locked: false,
      });
    } finally {
      setAnalyzingId(null);
    }
  }

  function sidebarNavigate(tab: TabKey) {
    if (tab === "virtual") {
      window.location.href = "/virtual";
      return;
    }
    if (tab === "favorites") {
      window.location.href = "/favorites";
      return;
    }
    if (tab === "vip") {
      openPlans();
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="oddix-v37-page oddix-v39-autofit">
      <style jsx global>{globalCss}</style>

      <aside className="oddix-v37-sidebar">
        <button className="oddix-v37-sidebar-menu">☰</button>

        <div className="oddix-v37-logo">
          <img src="/images/oddix-player.png" alt="Oddix" />
          <div>
            <strong>ODDIX</strong>
            <span>TIPSTER IA</span>
          </div>
        </div>

        <nav className="oddix-v37-nav">
          <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => sidebarNavigate("dashboard")}>⌂ Dashboard</button>
          <button className={activeTab === "top" ? "active" : ""} onClick={() => sidebarNavigate("top")}>🔥 Top Picks</button>
          <button className={activeTab === "playerprops" ? "active" : ""} onClick={() => sidebarNavigate("playerprops")}>♙ Player Props</button>
          <button className={activeTab === "virtual" ? "active" : ""} onClick={() => sidebarNavigate("virtual")}>⚡ Virtual</button>
          <button className={activeTab === "live" ? "active" : ""} onClick={() => sidebarNavigate("live")}>⌁ Ao Vivo</button>
          <button className={activeTab === "results" ? "active" : ""} onClick={() => sidebarNavigate("results")}>▥ Resultados</button>
          <button onClick={() => sidebarNavigate("favorites")}>☆ Favoritos</button>
          <button onClick={() => sidebarNavigate("vip")}>♛ VIP</button>
          <button onClick={openSupport}>☊ Suporte</button>
        </nav>

        <div className="oddix-v37-search">
          <label>Buscar</label>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar liga ou time..." />
          <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)}>
            <option value="all">Todas as ligas</option>
            {leagues.map((league) => (
              <option key={league} value={league}>{league}</option>
            ))}
          </select>
          <button onClick={() => loadAll(false)}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
        </div>

        <div className="oddix-v37-side-card">
          <h3>ESTATÍSTICAS RÁPIDAS</h3>
          <p><span>Jogos Analisados</span><strong>{games.length}</strong></p>
          <p><span>Ao Vivo</span><strong>{liveGames.length}</strong></p>
          <p><span>Pré-Jogo</span><strong>{futureGames.length}</strong></p>
          <p><span>Tips IA Hoje</span><strong>{smartTips.length}</strong></p>
          <p><span>Virtual AI</span><strong>{virtualTopPick ? "ON" : "..."}</strong></p>
        </div>

        <div className="oddix-v37-support">
          <h3>SUPORTE</h3>
          <p>Dúvidas sobre acesso, planos ou pagamento.</p>
          <button onClick={openSupport}>Abrir WhatsApp</button>
        </div>

        <div className="oddix-v37-partner">
          <span>PARCEIRO OFICIAL</span>
          <strong>ESTRELA<span>BET</span></strong>
          <button onClick={openEstrelaBet}>Apostar Agora</button>
        </div>
      </aside>

      <section className="oddix-v37-content">
        <header className="oddix-v37-header">
          <div className="oddix-v37-tabs">
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => sidebarNavigate("dashboard")}>▦ Dashboard</button>
            <button className={activeTab === "live" ? "active" : ""} onClick={() => sidebarNavigate("live")}>⌾ Ao Vivo</button>
            <button className={activeTab === "top" ? "active" : ""} onClick={() => sidebarNavigate("top")}>🔥 Top Picks</button>
            <button className={activeTab === "playerprops" ? "active" : ""} onClick={() => sidebarNavigate("playerprops")}>♙ Player Props</button>
            <button className={activeTab === "virtual" ? "active" : ""} onClick={() => sidebarNavigate("virtual")}>⚡ Virtual</button>
            <button className={activeTab === "results" ? "active" : ""} onClick={() => sidebarNavigate("results")}>▥ Resultados</button>
            <button onClick={() => setActiveTab("top")}>🎯 Odds</button>
            <button onClick={() => { setActiveTab("dashboard"); setSearch("brasil"); }}>🏆 Brasileirão</button>
            <button onClick={() => { setActiveTab("dashboard"); setSearch("argentina chile uruguay paraguay colombia ecuador peru bolivia brasil"); }}>🌐 Sul-Americanos</button>
          </div>

          <div className="oddix-v37-user-actions">
            <span>Plano {plan}</span>
            <button onClick={openPlans}>♛ Seja VIP</button>
            <button onClick={logout}>Sair</button>
          </div>
        </header>

        <section className="oddix-v37-hero">
          <div className="oddix-v37-hero-copy">
            <div className="oddix-v37-brand-text">
              <strong>ODDIX <span>AI</span></strong>
              <small>SPORTS INTELLIGENCE PLATFORM</small>
            </div>

            <h1>Análises esportivas com <span>Inteligência Artificial.</span></h1>
            <p>Plataforma premium com odds reais, estatísticas avançadas, Top Picks, Player Props e filtros inteligentes para decisões mais seguras.</p>

            <div className="oddix-v37-badges">
              <span>✓ Odds Reais</span>
              <span>✓ IA Proprietária</span>
              <span>✓ Player Props Premium</span>
              <span>✓ Estatísticas Avançadas</span>
              <span>✓ Resultados Verificados</span>
              <span>✓ Plataforma Web Premium</span>
            </div>

            <div className="oddix-v37-hero-actions">
              <button onClick={() => setActiveTab("top")}>Ver análises →</button>
              <button onClick={() => sidebarNavigate("virtual")}>⚡ Oddix Virtual</button>
              <button onClick={openPlans}>♛ Desbloquear Plataforma VIP</button>
            </div>
          </div>

          <div className="oddix-v37-hero-player">
            <img src={ODDIX_PLAYER_IMAGE} alt="Oddix Player" />
          </div>

          <div className="oddix-v37-hero-metrics">
            <MetricCard icon="📡" label="Jogos Ao Vivo" value={liveGames.length} sub="AGORA" />
            <MetricCard icon="🔥" label="Top Picks" value={smartTips.length} sub="HOJE" />
            <MetricCard icon="📈" label="Assertividade" value={`${stats.accuracy}%`} sub="ÚLTIMOS 30 DIAS" green />
            <MetricCard icon="🎯" label="Player Props" value={realPlayerProps.length ? "Premium" : "Premium"} sub="EXCLUSIVO" purple />
          </div>

          <div className="oddix-v37-hero-footer">
            <span>🛡 Dados 100% Reais</span>
            <span>♙ IA Proprietária Oddix</span>
            <span>⚡ Atualização em Tempo Real</span>
          </div>
        </section>

        <section className="oddix-v37-top-pick">
          <div className="oddix-v37-section-title">
            <h2>★ TOP PICK DO DIA</h2>
            <span>🏆 Score: {topPick ? Math.min(100, safeNumber(topPick.qualityScore, 90)) : 0}/100</span>
          </div>

          {topPick && topPickGame ? (
            <div className="oddix-v37-ticket">
              <TeamBlock name={topPickGame?.teams?.home?.name} logo={topPickGame?.teams?.home?.logo} />
              <div className="oddix-v37-match-center">
                <strong>{topPickGame?.league?.name || "Liga Premium"}</strong>
                <small>{formatDateTime(topPickGame?.fixture?.date)}</small>
                <em>VS</em>
              </div>
              <TeamBlock name={topPickGame?.teams?.away?.name} logo={topPickGame?.teams?.away?.logo} />

              <div className="oddix-v37-ticket-panel">
                <div>
                  <span>MERCADO</span>
                  <strong>{topPick.tip}</strong>
                  <small>{topPick.market}</small>
                </div>
                <div>
                  <span>ODD</span>
                  <strong>{topPick.odd}</strong>
                </div>
                <div>
                  <span>CONFIANÇA</span>
                  <strong className="green">{topPick.confidence}%</strong>
                  <small>{topPick.confidence >= 85 ? "MUITO ALTA" : "CONTROLADA"}</small>
                </div>
                <button onClick={() => analyzeGame(topPickGame, topPick)}>
                  {analyzingId === topPickGame?.fixture?.id ? "Analisando..." : "VER ANÁLISE COMPLETA →"}
                </button>
              </div>
            </div>
          ) : (
            <div className="oddix-v37-empty">Aguardando jogo com odds e qualidade suficiente para montar o Top Pick.</div>
          )}
        </section>


        <section className="oddix-v40-virtual-pick">
          <div className="oddix-v37-section-title">
            <h2>⚡ VIRTUAL PICK DO DIA</h2>
            <span>{virtualTopPick ? `Score ${virtualTopPick.score}/100` : virtualLoading ? "Carregando..." : "Virtual AI"}</span>
          </div>

          {virtualTopPick ? (
            <div className="oddix-v40-virtual-ticket">
              <div>
                <small>{virtualTopPick.league} • {virtualTopPick.timeLabel}</small>
                <h3>{virtualTopPick.homeTeam} x {virtualTopPick.awayTeam}</h3>
                <p>{virtualTopPick.reason}</p>
              </div>

              <div className="oddix-v40-virtual-market">
                <span>MELHOR MERCADO</span>
                <strong>{virtualTopPick.selection}</strong>
                <small>{virtualTopPick.market}</small>
              </div>

              <div className="oddix-v40-virtual-numbers">
                <div>
                  <span>ODD</span>
                  <strong>{virtualTopPick.odd}</strong>
                </div>
                <div>
                  <span>CONFIANÇA</span>
                  <strong>{virtualTopPick.confidence}%</strong>
                </div>
              </div>

              <button onClick={() => sidebarNavigate("virtual")}>ABRIR ODDIX VIRTUAL →</button>
            </div>
          ) : (
            <div className="oddix-v37-empty">
              {virtualLoading ? "Buscando Top Pick Virtual..." : "Aguardando dados do Oddix Virtual."}
            </div>
          )}
        </section>

        <section className="oddix-v37-main-grid">
          <div className="oddix-v37-results">
            <h2>📊 RESULTADOS REAIS</h2>
            <div className="oddix-v37-results-grid">
              <ResultCard value={stats.wonBets} label="GREENS" tone="green" />
              <ResultCard value={stats.lostBets} label="REDS" tone="red" />
              <ResultCard value={`${stats.roi}%`} label="ROI" tone="green" />
              <ResultCard value={`${stats.accuracy}%`} label="ASSERTIVIDADE" tone="green" bars />
              <ResultCard value={Math.max(0, stats.wonBets - stats.lostBets)} label="TIPS VENCEDORAS" tone="gold" />
            </div>
            <small>* Números atualizados automaticamente com base nas análises salvas da IA Oddix.</small>
          </div>

          <div className="oddix-v37-player-prop">
            <div className="oddix-v37-card-head">
              <h2>🔥 PLAYER PROP DO DIA</h2>
              <span>PREMIUM</span>
            </div>

            {homePlayerProp ? (
              <div className="oddix-v37-prop-body">
                <img src={getPlayerPhoto(homePlayerProp)} alt={getPlayerName(homePlayerProp)} />
                <div>
                  <h3>{getPlayerName(homePlayerProp)}</h3>
                  <p>{homePlayerProp?.teamName || homePlayerProp?.team || homePlayerProp?.game || "Mercado premium"}</p>
                  <label>MERCADO</label>
                  <strong>{getPropTip(homePlayerProp)}</strong>
                  <div className="oddix-v37-prop-metrics">
                    <span>Odd <b>{homePlayerProp?.odd || "1.85"}</b></span>
                    <span>Confiança <b>{safeNumber(homePlayerProp?.confidence ?? homePlayerProp?.confiança, 88)}%</b></span>
                  </div>
                  <button onClick={openPlans}>VER ANÁLISE COMPLETA →</button>
                </div>
              </div>
            ) : (
              <div className="oddix-v37-prop-empty">
                {playerPropsLoading ? "Buscando Player Props reais..." : "Player Props reais aparecem quando houver escalação, foto e mercado disponível."}
              </div>
            )}
          </div>
        </section>

        <section className="oddix-v37-bottom-grid">
          <div className="oddix-v37-list-card">
            <div className="oddix-v37-card-head">
              <h2>◎ TOP 5 TIPS DA IA</h2>
              <button onClick={() => setActiveTab("top")}>Ver todas →</button>
            </div>

            {smartTips.slice(0, 5).map((tip, index) => (
              <button key={`${tip.fixtureId || index}-${tip.tip}`} className="oddix-v37-tip-row" onClick={() => {
                const game = findGameByTip(tip, games);
                if (game) analyzeGame(game, tip);
              }}>
                <span>{index + 1}</span>
                <strong>{tip.tip}</strong>
                <small>{tip.game}</small>
                <b>{tip.odd}</b>
                <em>{tip.confidence}%</em>
              </button>
            ))}

            {!smartTips.length && <div className="oddix-v37-empty">Aguardando entradas IA com qualidade suficiente.</div>}
          </div>

          <div className="oddix-v37-list-card">
            <div className="oddix-v37-card-head">
              <h2>🔥 ODDIX BOOST</h2>
              <span>BOOST</span>
            </div>

            {boostPicks.length ? (
              <>
                {boostPicks.map((tip, index) => (
                  <button key={`${tip.fixtureId || index}-${tip.tip}`} className="oddix-v37-boost-row" onClick={() => {
                    const game = findGameByTip(tip, games);
                    if (game) analyzeGame(game, tip);
                  }}>
                    <div>
                      <strong>{tip.tip}</strong>
                      <small>{tip.game}</small>
                    </div>
                    <b>{tip.odd}</b>
                    <em>{tip.confidence}%</em>
                  </button>
                ))}

                <div className="oddix-v37-boost-footer">
                  <span>Odd combinada</span>
                  <strong>{boostOdd ? boostOdd.toFixed(2) : "0.00"}</strong>
                  <span>Confiança média</span>
                  <strong>{boostConfidence}%</strong>
                </div>
              </>
            ) : (
              <div className="oddix-v37-empty">Aguardando 3 entradas com confiança alta e odd protegida.</div>
            )}
          </div>

          <div className="oddix-v37-vip-card">
            <h2>DESBLOQUEIE O MÁXIMO DO ODDIX</h2>
            <p>Tenha acesso a análises exclusivas, filtros avançados, histórico completo e muito mais.</p>
            <button onClick={openPlans}>ASSINAR VIP AGORA ♛</button>
          </div>
        </section>

        <section className="oddix-v37-games">
          <div className="oddix-v37-card-head">
            <h2>{activeTab === "live" ? "📡 JOGOS AO VIVO" : activeTab === "results" ? "📊 RESULTADOS" : "⚽ JOGOS ANALISADOS"}</h2>
            <span>{filteredGames.length} jogos</span>
          </div>

          <div className="oddix-v37-games-grid">
            {filteredGames.map((game: any, index: number) => (
              <article key={`${game?.fixture?.id || index}-${game?.teams?.home?.name}`} className="oddix-v37-game-card" onClick={() => analyzeGame(game)}>
                <div className="oddix-v37-game-top">
                  <span>{isGameLive(game) ? "● AO VIVO" : isGameFinished(game) ? "FINALIZADO" : "PRÉ-JOGO"}</span>
                  <b>{safeNumber(game?.oddix?.qualityScore, 0)}</b>
                </div>

                <small>{game?.league?.name || "Liga"}</small>

                <div className="oddix-v37-game-teams">
                  <div>
                    <img src={game?.teams?.home?.logo || logoFallback(game?.teams?.home?.name)} alt="" />
                    <strong>{game?.teams?.home?.name}</strong>
                  </div>
                  <em>VS</em>
                  <div>
                    <img src={game?.teams?.away?.logo || logoFallback(game?.teams?.away?.name)} alt="" />
                    <strong>{game?.teams?.away?.name}</strong>
                  </div>
                </div>

                <button>{isPaidPlan ? "Analisar jogo" : "Desbloquear análise"}</button>
              </article>
            ))}
          </div>

          {loading && <div className="oddix-v37-empty">Carregando jogos da plataforma...</div>}
          {!loading && !filteredGames.length && <div className="oddix-v37-empty">Nenhum jogo encontrado para este filtro.</div>}
        </section>

        <footer className="oddix-v39-footer">
          <div>
            <strong>ODDIX <span>AI</span></strong>
            <p>Sports Intelligence Platform com análises IA, odds reais, Player Props e histórico de performance.</p>
          </div>

          <nav>
            <button onClick={() => sidebarNavigate("dashboard")}>Dashboard</button>
            <button onClick={() => sidebarNavigate("top")}>Top Picks</button>
            <button onClick={() => sidebarNavigate("playerprops")}>Player Props</button>
            <button onClick={() => sidebarNavigate("virtual")}>Virtual AI</button>
            <button onClick={() => sidebarNavigate("results")}>Resultados</button>
            <button onClick={openPlans}>VIP</button>
            <button onClick={openSupport}>Suporte</button>
          </nav>

          <div>
            <span>Parceiro</span>
            <button onClick={openEstrelaBet}>EstrelaBet</button>
            <small>Jogue com responsabilidade. Conteúdo para maiores de 18 anos.</small>
          </div>
        </footer>

      </section>

      {selectedAnalysis && (
        <div className="oddix-v37-modal">
          <div>
            <button onClick={() => setSelectedAnalysis(null)}>×</button>
            <span>{selectedAnalysis.locked ? "🔒 PLATAFORMA VIP" : "🤖 ANÁLISE ODDIX AI"}</span>
            <h2>{selectedAnalysis.game?.teams?.home?.name} x {selectedAnalysis.game?.teams?.away?.name}</h2>
            <p>{selectedAnalysis.ai?.analysis || "Análise gerada pela inteligência Oddix com base nos dados disponíveis."}</p>
            <div className="oddix-v37-modal-pick">
              <strong>{selectedAnalysis.ai?.tip || "Entrada inteligente"}</strong>
              <span>Odd {selectedAnalysis.ai?.odd || "-"}</span>
              <span>Confiança {selectedAnalysis.ai?.confidence || 0}%</span>
            </div>
            {selectedAnalysis.locked && <button onClick={openPlans}>Desbloquear Plataforma VIP</button>}
          </div>
        </div>
      )}
    </main>
  );
}

function MetricCard({ icon, label, value, sub, green, purple }: any) {
  return (
    <div className={`oddix-v37-metric ${green ? "green" : ""} ${purple ? "purple" : ""}`}>
      <span>{icon} {label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function TeamBlock({ name, logo }: any) {
  return (
    <div className="oddix-v37-team">
      <img src={logo || logoFallback(name)} alt={name || "Time"} />
      <strong>{name || "Time"}</strong>
    </div>
  );
}

function ResultCard({ value, label, tone, bars }: any) {
  return (
    <div className={`oddix-v37-result-card ${tone || ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>ÚLTIMOS 30 DIAS</small>
      {bars ? (
        <div className="oddix-v37-mini-bars">
          {Array.from({ length: 8 }).map((_, index) => <i key={index} style={{ height: `${30 + index * 7}%` }} />)}
        </div>
      ) : (
        <div className="oddix-v37-sparkline" />
      )}
    </div>
  );
}

const globalCss = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    width: 100%;
    max-width: 100%;
    margin: 0;
    overflow-x: hidden;
    background: #020202;
  }

  button,
  input,
  select {
    font-family: inherit;
  }

  .oddix-v37-page {
    min-height: 100dvh;
    background:
      radial-gradient(circle at 80% 0%, rgba(234,179,8,.18), transparent 34%),
      radial-gradient(circle at 5% 20%, rgba(124,58,237,.13), transparent 30%),
      #020202;
    color: #fff;
    display: grid;
    grid-template-columns: 292px minmax(0, 1fr);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .oddix-v37-sidebar {
    position: sticky;
    top: 0;
    height: 100dvh;
    overflow-y: auto;
    background:
      linear-gradient(180deg, rgba(6,6,7,.98), rgba(0,0,0,.98));
    border-right: 1px solid rgba(250,204,21,.18);
    padding: 24px 20px;
    box-shadow: 20px 0 60px rgba(0,0,0,.45);
    z-index: 20;
  }

  .oddix-v37-sidebar-menu {
    width: 30px;
    height: 30px;
    border: 0;
    background: transparent;
    color: #fff;
    font-size: 20px;
    margin-bottom: 12px;
    cursor: pointer;
  }

  .oddix-v37-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
  }

  .oddix-v37-logo img {
    width: 86px;
    height: 86px;
    object-fit: contain;
    filter: drop-shadow(0 0 18px rgba(250,204,21,.34));
  }

  .oddix-v37-logo strong {
    display: block;
    font-size: 54px;
    font-weight: 1000;
    font-style: italic;
    letter-spacing: -1px;
  }

  .oddix-v37-logo span {
    display: block;
    color: #facc15;
    font-size: 11px;
    font-weight: 1000;
    letter-spacing: 1.8px;
  }

  .oddix-v37-nav {
    display: grid;
    gap: 8px;
    margin-bottom: 22px;
  }

  .oddix-v37-nav button {
    width: 100%;
    border: 1px solid transparent;
    background: transparent;
    color: #fff;
    border-radius: 14px;
    padding: 14px 14px;
    text-align: left;
    font-weight: 900;
    cursor: pointer;
    transition: .2s ease;
  }

  .oddix-v37-nav button:hover,
  .oddix-v37-nav button.active {
    background: linear-gradient(90deg, rgba(250,204,21,.22), rgba(250,204,21,.04));
    border-color: rgba(250,204,21,.55);
    color: #facc15;
  }

  .oddix-v37-search,
  .oddix-v37-side-card,
  .oddix-v37-support,
  .oddix-v37-partner {
    border: 1px solid rgba(255,255,255,.11);
    background: rgba(255,255,255,.035);
    border-radius: 18px;
    padding: 14px;
    margin-bottom: 14px;
  }

  .oddix-v37-search label,
  .oddix-v37-side-card h3,
  .oddix-v37-support h3,
  .oddix-v37-partner span {
    color: #facc15;
    font-size: 13px;
    font-weight: 1000;
    letter-spacing: .5px;
  }

  .oddix-v37-search input,
  .oddix-v37-search select {
    width: 100%;
    margin-top: 10px;
    background: #050505;
    border: 1px solid rgba(255,255,255,.12);
    color: #fff;
    border-radius: 12px;
    padding: 12px;
    outline: 0;
  }

  .oddix-v37-search button,
  .oddix-v37-support button,
  .oddix-v37-partner button {
    width: 100%;
    margin-top: 10px;
    border: 0;
    border-radius: 12px;
    background: linear-gradient(135deg, #facc15, #f97316);
    color: #050505;
    padding: 12px;
    font-weight: 1000;
    cursor: pointer;
  }

  .oddix-v37-side-card p {
    display: flex;
    justify-content: space-between;
    margin: 9px 0;
    color: rgba(255,255,255,.75);
    font-size: 13px;
    font-weight: 700;
  }

  .oddix-v37-side-card strong {
    color: #facc15;
  }

  .oddix-v37-support p {
    color: rgba(255,255,255,.66);
    font-size: 13px;
    line-height: 1.4;
  }

  .oddix-v37-support button {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
  }

  .oddix-v37-partner strong {
    display: block;
    font-size: 54px;
    margin: 12px 0;
  }

  .oddix-v37-partner strong span {
    color: #facc15;
  }

  .oddix-v37-content {
    min-width: 0;
    padding: 28px 34px 56px;
  }

  .oddix-v37-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 16px;
  }

  .oddix-v37-tabs {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    background: rgba(0,0,0,.78);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 999px;
    padding: 8px;
    scrollbar-width: none;
  }

  .oddix-v37-tabs::-webkit-scrollbar {
    display: none;
  }

  .oddix-v37-tabs button {
    flex: 0 0 auto;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #fff;
    padding: 13px 17px;
    font-weight: 1000;
    text-transform: uppercase;
    font-size: 12px;
    cursor: pointer;
  }

  .oddix-v37-tabs button.active {
    background: linear-gradient(135deg, #facc15, #f59e0b);
    color: #050505;
    box-shadow: 0 0 26px rgba(250,204,21,.32);
  }

  .oddix-v37-user-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .oddix-v37-user-actions span,
  .oddix-v37-user-actions button {
    border-radius: 999px;
    padding: 12px 16px;
    font-weight: 1000;
    font-size: 12px;
  }

  .oddix-v37-user-actions span {
    background: linear-gradient(135deg, #6d28d9, #4c1d95);
  }

  .oddix-v37-user-actions button {
    border: 1px solid rgba(250,204,21,.4);
    background: #050505;
    color: #facc15;
    cursor: pointer;
  }

  .oddix-v37-hero {
    position: relative;
    overflow: hidden;
    min-height: 540px;
    border-radius: 28px;
    border: 1px solid rgba(250,204,21,.35);
    background:
      linear-gradient(90deg, rgba(0,0,0,.96) 0%, rgba(4,4,4,.94) 38%, rgba(93,64,9,.84) 100%),
      radial-gradient(circle at 80% 12%, rgba(250,204,21,.32), transparent 34%);
    box-shadow: 0 24px 80px rgba(0,0,0,.58), inset 0 1px 0 rgba(250,204,21,.14);
    margin-bottom: 18px;
    padding: 48px 46px 64px;
    display: grid;
    grid-template-columns: minmax(420px, .95fr) minmax(390px, .86fr) minmax(300px, .48fr);
    gap: 24px;
    align-items: center;
  }

  .oddix-v37-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(120deg, transparent 0 49%, rgba(255,255,255,.035) 50%, transparent 51%),
      radial-gradient(circle at 65% 48%, rgba(250,204,21,.18), transparent 38%);
    background-size: 36px 36px, auto;
    opacity: .55;
    pointer-events: none;
  }

  .oddix-v37-hero > * {
    position: relative;
    z-index: 2;
  }

  .oddix-v37-brand-text strong {
    display: block;
    font-size: clamp(74px, 7.4vw, 118px);
    line-height: .78;
    font-weight: 1000;
    font-style: italic;
    letter-spacing: -4px;
  }

  .oddix-v37-brand-text strong span {
    color: #facc15;
  }

  .oddix-v37-brand-text small {
    display: block;
    margin-top: 16px;
    color: #fff;
    font-size: 15px;
    letter-spacing: 5px;
    font-weight: 1000;
  }

  .oddix-v37-hero h1 {
    margin: 22px 0 14px;
    font-size: clamp(38px, 3.8vw, 60px);
    line-height: .98;
    letter-spacing: -2px;
  }

  .oddix-v37-hero h1 span {
    color: #facc15;
  }

  .oddix-v37-hero p {
    max-width: 620px;
    color: rgba(255,255,255,.82);
    line-height: 1.52;
    font-weight: 650;
  }

  .oddix-v37-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 18px 0 22px;
  }

  .oddix-v37-badges span {
    border: 1px solid rgba(250,204,21,.35);
    background: rgba(0,0,0,.38);
    color: #fff;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 900;
  }

  .oddix-v37-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .oddix-v37-hero-actions button {
    border-radius: 14px;
    padding: 15px 24px;
    font-weight: 1000;
    cursor: pointer;
  }

  .oddix-v37-hero-actions button:first-child {
    border: 0;
    background: linear-gradient(135deg, #facc15, #f59e0b);
    color: #050505;
  }

  .oddix-v37-hero-actions button:last-child {
    border: 1px solid rgba(250,204,21,.48);
    background: rgba(0,0,0,.34);
    color: #fff;
  }

  .oddix-v37-hero-player {
    align-self: end;
    display: flex;
    justify-content: center;
  }

  .oddix-v37-hero-player img {
    width: min(650px, 116%);
    max-height: 520px;
    object-fit: contain;
    object-position: bottom center;
    filter: drop-shadow(0 24px 40px rgba(0,0,0,.8));
  }

  .oddix-v37-hero-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .oddix-v37-metric {
    min-height: 148px;
    border: 1px solid rgba(250,204,21,.42);
    background: rgba(0,0,0,.38);
    border-radius: 16px;
    padding: 18px;
  }

  .oddix-v37-metric span {
    color: #fff;
    font-size: 13px;
    font-weight: 900;
  }

  .oddix-v37-metric strong {
    display: block;
    margin-top: 10px;
    color: #fff;
    font-size: 54px;
    font-weight: 1000;
  }

  .oddix-v37-metric.green strong {
    color: #22c55e;
  }

  .oddix-v37-metric.purple strong {
    color: #a855f7;
    font-size: 30px;
  }

  .oddix-v37-metric small {
    color: rgba(255,255,255,.7);
    font-size: 12px;
    font-weight: 900;
  }

  .oddix-v37-hero-footer {
    position: absolute;
    left: 34px;
    right: 34px;
    bottom: 0;
    min-height: 38px;
    border-top: 1px solid rgba(255,255,255,.10);
    background: rgba(0,0,0,.38);
    display: flex;
    align-items: center;
    gap: 28px;
    color: #a3e635;
    font-size: 12px;
    font-weight: 900;
    padding: 0 18px;
  }

  .oddix-v37-top-pick,
  .oddix-v37-results,
  .oddix-v37-player-prop,
  .oddix-v37-list-card,
  .oddix-v37-vip-card,
  .oddix-v37-games {
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(4,4,4,.9);
    border-radius: 22px;
    box-shadow: 0 22px 60px rgba(0,0,0,.42);
  }

  .oddix-v37-top-pick {
    border-color: rgba(250,204,21,.85);
    background:
      radial-gradient(circle at 20% 0%, rgba(250,204,21,.22), transparent 36%),
      linear-gradient(90deg, rgba(6,6,5,.98), rgba(34,20,4,.98));
    margin-bottom: 18px;
    padding: 22px 26px 24px;
    box-shadow: 0 0 28px rgba(250,204,21,.18), 0 20px 70px rgba(0,0,0,.52);
  }

  .oddix-v37-section-title,
  .oddix-v37-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
  }

  .oddix-v37-section-title h2,
  .oddix-v37-card-head h2 {
    margin: 0;
    color: #facc15;
    font-size: 19px;
    letter-spacing: .6px;
    font-weight: 1000;
  }

  .oddix-v37-section-title span,
  .oddix-v37-card-head span {
    border: 1px solid rgba(250,204,21,.45);
    background: rgba(250,204,21,.1);
    color: #facc15;
    border-radius: 999px;
    padding: 8px 12px;
    font-weight: 1000;
    font-size: 12px;
  }

  .oddix-v37-ticket {
    display: grid;
    grid-template-columns: minmax(190px, .82fr) 164px minmax(190px, .82fr) minmax(620px, 1.86fr);
    gap: 18px;
    align-items: center;
  }

  .oddix-v37-team {
    text-align: center;
  }

  .oddix-v37-team img {
    width: 140px;
    height: 140px;
    object-fit: contain;
    filter: drop-shadow(0 12px 18px rgba(0,0,0,.6));
  }

  .oddix-v37-team strong {
    display: block;
    margin-top: 10px;
    font-size: 16px;
    text-transform: uppercase;
    font-weight: 1000;
  }

  .oddix-v37-match-center {
    text-align: center;
  }

  .oddix-v37-match-center strong {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    font-weight: 1000;
  }

  .oddix-v37-match-center small {
    display: block;
    margin: 6px 0 10px;
    color: rgba(255,255,255,.75);
    font-weight: 800;
  }

  .oddix-v37-match-center em {
    width: 64px;
    height: 64px;
    border-radius: 999px;
    margin: auto;
    background: #facc15;
    color: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    font-style: normal;
    font-weight: 1000;
    box-shadow: 0 0 24px rgba(250,204,21,.34);
  }

  .oddix-v37-ticket-panel {
    display: grid;
    grid-template-columns: 1.2fr .8fr 1fr 1.1fr;
    border: 1px solid rgba(250,204,21,.28);
    border-radius: 16px;
    overflow: hidden;
  }

  .oddix-v37-ticket-panel > div {
    min-height: 142px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-right: 1px solid rgba(250,204,21,.18);
    padding: 14px 18px;
  }

  .oddix-v37-ticket-panel span {
    color: rgba(255,255,255,.72);
    font-size: 12px;
    font-weight: 1000;
  }

  .oddix-v37-ticket-panel strong {
    margin-top: 8px;
    color: #facc15;
    font-size: 54px;
    line-height: .95;
    font-weight: 1000;
    text-transform: uppercase;
  }

  .oddix-v37-ticket-panel strong.green {
    color: #22c55e;
    font-size: 54px;
  }

  .oddix-v37-ticket-panel small {
    margin-top: 8px;
    color: rgba(255,255,255,.78);
    font-weight: 800;
  }

  .oddix-v37-ticket-panel button {
    border: 0;
    background: linear-gradient(135deg, #facc15, #f59e0b);
    color: #050505;
    font-weight: 1000;
    cursor: pointer;
    padding: 18px;
    font-size: 15px;
  }

  .oddix-v37-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(390px, .78fr);
    gap: 18px;
    margin-bottom: 18px;
  }

  .oddix-v37-results,
  .oddix-v37-player-prop,
  .oddix-v37-list-card,
  .oddix-v37-vip-card,
  .oddix-v37-games {
    padding: 18px;
  }

  .oddix-v37-results-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }

  .oddix-v37-result-card {
    min-height: 156px;
    border: 1px solid rgba(255,255,255,.13);
    background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
    border-radius: 14px;
    padding: 18px;
  }

  .oddix-v37-result-card strong {
    display: block;
    font-size: 44px;
    color: #22c55e;
    line-height: 1;
    font-weight: 1000;
  }

  .oddix-v37-result-card.red strong {
    color: #ef4444;
  }

  .oddix-v37-result-card span {
    display: block;
    margin-top: 9px;
    font-size: 14px;
    font-weight: 1000;
  }

  .oddix-v37-result-card small {
    color: rgba(255,255,255,.62);
    font-size: 11px;
    font-weight: 800;
  }

  .oddix-v37-sparkline {
    height: 34px;
    margin-top: 18px;
    background:
      linear-gradient(135deg, transparent 0 18%, #22c55e 19% 21%, transparent 22% 34%, #22c55e 35% 37%, transparent 38% 52%, #22c55e 53% 55%, transparent 56% 70%, #22c55e 71% 73%, transparent 74%);
    opacity: .9;
  }

  .oddix-v37-result-card.red .oddix-v37-sparkline {
    background:
      linear-gradient(135deg, transparent 0 18%, #ef4444 19% 21%, transparent 22% 34%, #ef4444 35% 37%, transparent 38% 52%, #ef4444 53% 55%, transparent 56% 70%, #ef4444 71% 73%, transparent 74%);
  }

  .oddix-v37-mini-bars {
    height: 40px;
    display: flex;
    align-items: end;
    gap: 5px;
    margin-top: 14px;
  }

  .oddix-v37-mini-bars i {
    width: 10px;
    border-radius: 5px 5px 0 0;
    background: #22c55e;
  }

  .oddix-v37-player-prop {
    border-color: rgba(168,85,247,.5);
    background:
      radial-gradient(circle at 80% 0%, rgba(168,85,247,.18), transparent 38%),
      rgba(4,4,4,.92);
  }

  .oddix-v37-prop-body {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 16px;
    align-items: end;
  }

  .oddix-v37-prop-body img {
    width: 190px;
    height: 250px;
    object-fit: contain;
    object-position: bottom center;
    filter: drop-shadow(0 18px 25px rgba(0,0,0,.6));
  }

  .oddix-v37-prop-body h3 {
    margin: 0;
    font-size: 26px;
    text-transform: uppercase;
  }

  .oddix-v37-prop-body p {
    margin: 4px 0 12px;
    color: rgba(255,255,255,.65);
    font-size: 13px;
    font-weight: 800;
  }

  .oddix-v37-prop-body label {
    color: #a3e635;
    font-size: 11px;
    font-weight: 1000;
  }

  .oddix-v37-prop-body strong {
    display: block;
    margin: 7px 0 12px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px;
    padding: 12px;
  }

  .oddix-v37-prop-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .oddix-v37-prop-metrics span {
    border: 1px solid rgba(250,204,21,.22);
    border-radius: 12px;
    padding: 12px;
    color: rgba(255,255,255,.7);
    font-size: 12px;
    font-weight: 900;
  }

  .oddix-v37-prop-metrics b {
    color: #facc15;
    float: right;
  }

  .oddix-v37-prop-body button {
    width: 100%;
    margin-top: 12px;
    border: 0;
    border-radius: 12px;
    background: linear-gradient(135deg, #7e22ce, #581c87);
    color: #fff;
    padding: 13px;
    font-weight: 1000;
    cursor: pointer;
  }

  .oddix-v37-bottom-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(310px, .72fr);
    gap: 18px;
    margin-bottom: 18px;
  }

  .oddix-v37-tip-row,
  .oddix-v37-boost-row {
    width: 100%;
    border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.035);
    color: #fff;
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 9px;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 90px 64px 58px;
    gap: 10px;
    align-items: center;
    text-align: left;
    cursor: pointer;
  }

  .oddix-v37-tip-row span {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(250,204,21,.16);
    color: #facc15;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 1000;
  }

  .oddix-v37-tip-row small {
    color: rgba(255,255,255,.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .oddix-v37-tip-row b,
  .oddix-v37-boost-row b {
    color: #facc15;
  }

  .oddix-v37-tip-row em,
  .oddix-v37-boost-row em {
    background: rgba(34,197,94,.16);
    color: #22c55e;
    border-radius: 8px;
    padding: 6px;
    font-style: normal;
    text-align: center;
    font-weight: 1000;
  }

  .oddix-v37-boost-row {
    grid-template-columns: minmax(0, 1fr) 64px 58px;
  }

  .oddix-v37-boost-row div {
    display: flex;
    flex-direction: column;
  }

  .oddix-v37-boost-row small {
    color: rgba(255,255,255,.58);
  }

  .oddix-v37-boost-footer {
    border-top: 1px solid rgba(255,255,255,.1);
    padding-top: 12px;
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    gap: 10px;
    color: rgba(255,255,255,.72);
    font-weight: 900;
  }

  .oddix-v37-boost-footer strong {
    color: #facc15;
  }

  .oddix-v37-vip-card {
    border-color: rgba(250,204,21,.55);
    background:
      radial-gradient(circle at 80% 0%, rgba(250,204,21,.25), transparent 38%),
      linear-gradient(135deg, rgba(29,19,3,.98), rgba(5,5,5,.98));
  }

  .oddix-v37-vip-card h2 {
    margin: 0 0 12px;
    color: #facc15;
  }

  .oddix-v37-vip-card p {
    color: rgba(255,255,255,.72);
    line-height: 1.45;
  }

  .oddix-v37-vip-card button {
    width: 100%;
    margin-top: 12px;
    border: 0;
    border-radius: 12px;
    background: linear-gradient(135deg, #facc15, #f59e0b);
    color: #050505;
    padding: 14px;
    font-weight: 1000;
    cursor: pointer;
  }

  .oddix-v37-games-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }

  .oddix-v37-game-card {
    border: 1px solid rgba(255,255,255,.11);
    background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
    border-radius: 18px;
    padding: 18px;
    cursor: pointer;
    transition: .2s ease;
  }

  .oddix-v37-game-card:hover {
    transform: translateY(-3px);
    border-color: rgba(250,204,21,.44);
  }

  .oddix-v37-game-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .oddix-v37-game-top span {
    color: #22c55e;
    font-weight: 1000;
    font-size: 12px;
  }

  .oddix-v37-game-top b {
    color: #facc15;
  }

  .oddix-v37-game-card > small {
    display: block;
    color: rgba(255,255,255,.6);
    margin-bottom: 12px;
    font-weight: 800;
  }

  .oddix-v37-game-teams {
    display: grid;
    grid-template-columns: 1fr 48px 1fr;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .oddix-v37-game-teams img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .oddix-v37-game-teams strong {
    display: block;
    margin-top: 6px;
    font-size: 13px;
  }

  .oddix-v37-game-teams em {
    width: 42px;
    height: 42px;
    border-radius: 999px;
    background: rgba(250,204,21,.16);
    color: #facc15;
    display: flex;
    align-items: center;
    justify-content: center;
    font-style: normal;
    font-weight: 1000;
  }

  .oddix-v37-game-card button {
    width: 100%;
    margin-top: 14px;
    border: 0;
    border-radius: 12px;
    background: #facc15;
    color: #050505;
    padding: 12px;
    font-weight: 1000;
    cursor: pointer;
  }

  .oddix-v37-empty,
  .oddix-v37-prop-empty {
    border: 1px dashed rgba(250,204,21,.28);
    border-radius: 14px;
    padding: 18px;
    color: rgba(255,255,255,.7);
    background: rgba(255,255,255,.03);
  }


  /* V39 refinement: bilhete sem texto quebrado, footer e acabamento */
  .oddix-v37-ticket-panel {
    grid-template-columns: minmax(220px, 1.24fr) minmax(124px, .62fr) minmax(164px, .78fr) minmax(210px, .98fr);
  }

  .oddix-v37-ticket-panel > div {
    min-width: 0;
  }

  .oddix-v37-ticket-panel strong {
    word-break: normal !important;
    overflow-wrap: normal !important;
    hyphens: none !important;
    white-space: normal !important;
    display: block !important;
    -webkit-line-clamp: unset !important;
    -webkit-box-orient: initial !important;
    overflow: visible !important;
  }

  .oddix-v37-ticket-panel > div:first-child strong {
    font-size: clamp(24px, 2vw, 34px);
    line-height: 1.08;
    max-width: 100%;
  }

  .oddix-v37-ticket-panel button {
    min-width: 190px;
    padding: 20px 18px;
    font-size: 14px;
    line-height: 1.2;
  }

  .oddix-v37-team img {
    aspect-ratio: 1 / 1;
    object-fit: contain !important;
    object-position: center center;
    flex-shrink: 0;
    image-rendering: auto;
  }

  .oddix-v37-results-grid {
    align-items: stretch;
  }

  .oddix-v37-result-card.gold strong,
  .oddix-v37-result-card.gold span {
    color: #facc15;
  }

  .oddix-v37-result-card.gold .oddix-v37-sparkline {
    background:
      linear-gradient(135deg, transparent 0 18%, #facc15 19% 21%, transparent 22% 34%, #facc15 35% 37%, transparent 38% 52%, #facc15 53% 55%, transparent 56% 70%, #facc15 71% 73%, transparent 74%);
  }

  .oddix-v37-player-prop {
    min-height: 100%;
  }

  .oddix-v37-prop-body {
    align-items: center;
  }

  .oddix-v37-prop-body img {
    object-fit: contain !important;
    object-position: bottom center !important;
    max-height: 260px;
  }

  .oddix-v37-prop-metrics b {
    font-size: 22px;
    font-weight: 1000;
  }

  .oddix-v39-footer {
    margin-top: 18px;
    border: 1px solid rgba(250,204,21,.18);
    background:
      radial-gradient(circle at 20% 0%, rgba(250,204,21,.13), transparent 36%),
      linear-gradient(135deg, rgba(5,5,5,.96), rgba(16,12,3,.96));
    border-radius: 22px;
    padding: 22px;
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(300px, 1.2fr) minmax(220px, .8fr);
    gap: 18px;
    align-items: center;
    box-shadow: 0 20px 60px rgba(0,0,0,.34);
  }

  .oddix-v39-footer strong {
    display: block;
    font-size: 34px;
    font-weight: 1000;
    font-style: italic;
    letter-spacing: -1px;
  }

  .oddix-v39-footer strong span {
    color: #facc15;
  }

  .oddix-v39-footer p,
  .oddix-v39-footer small {
    color: rgba(255,255,255,.68);
    line-height: 1.45;
    font-weight: 750;
  }

  .oddix-v39-footer nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .oddix-v39-footer button {
    border: 1px solid rgba(250,204,21,.26);
    background: rgba(0,0,0,.28);
    color: #fff;
    border-radius: 999px;
    padding: 10px 13px;
    font-weight: 900;
    cursor: pointer;
  }

  .oddix-v39-footer div:last-child {
    display: grid;
    gap: 8px;
  }

  .oddix-v39-footer div:last-child span {
    color: #facc15;
    font-weight: 1000;
    font-size: 12px;
    letter-spacing: 1px;
  }

  .oddix-v39-footer div:last-child button {
    background: linear-gradient(135deg, #facc15, #f59e0b);
    color: #050505;
  }



  /* V39.1 AUTO-FIT RESPONSIVO: evita quebra em notebook, meia tela e zoom */
  :root {
    --oddix-sidebar-w: clamp(214px, 18vw, 292px);
    --oddix-content-pad: clamp(12px, 2vw, 34px);
    --oddix-card-radius: clamp(16px, 1.6vw, 28px);
    --oddix-fit-font: clamp(11px, .78vw, 14px);
  }

  html,
  body,
  .oddix-v39-autofit {
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }

  .oddix-v39-autofit {
    grid-template-columns: var(--oddix-sidebar-w) minmax(0, 1fr) !important;
    font-size: var(--oddix-fit-font);
  }

  .oddix-v39-autofit .oddix-v37-sidebar {
    width: var(--oddix-sidebar-w);
    padding: clamp(12px, 1.35vw, 20px) !important;
  }

  .oddix-v39-autofit .oddix-v37-content {
    min-width: 0 !important;
    width: 100% !important;
    max-width: calc(100vw - var(--oddix-sidebar-w)) !important;
    padding: var(--oddix-content-pad) !important;
  }

  .oddix-v39-autofit .oddix-v37-header,
  .oddix-v39-autofit .oddix-v37-hero,
  .oddix-v39-autofit .oddix-v37-top-pick,
  .oddix-v39-autofit .oddix-v37-main-grid,
  .oddix-v39-autofit .oddix-v37-bottom-grid,
  .oddix-v39-autofit .oddix-v37-games,
  .oddix-v39-autofit .oddix-v39-footer {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .oddix-v39-autofit .oddix-v37-tabs {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    flex: 1 1 auto;
  }

  .oddix-v39-autofit .oddix-v37-tabs::-webkit-scrollbar {
    display: none;
  }

  .oddix-v39-autofit .oddix-v37-tabs button {
    padding: clamp(9px, .9vw, 13px) clamp(10px, 1.1vw, 17px) !important;
    font-size: clamp(10px, .72vw, 12px) !important;
  }

  .oddix-v39-autofit .oddix-v37-user-actions {
    flex: 0 0 auto;
  }

  .oddix-v39-autofit .oddix-v37-user-actions span,
  .oddix-v39-autofit .oddix-v37-user-actions button {
    padding: clamp(9px, .85vw, 12px) clamp(10px, 1vw, 16px) !important;
    font-size: clamp(10px, .72vw, 12px) !important;
  }

  .oddix-v39-autofit .oddix-v37-hero {
    min-height: clamp(430px, 39vw, 540px) !important;
    padding: clamp(24px, 3vw, 48px) clamp(22px, 2.8vw, 46px) clamp(54px, 4.5vw, 64px) !important;
    grid-template-columns: minmax(340px, .95fr) minmax(260px, .72fr) minmax(220px, .45fr) !important;
    gap: clamp(12px, 1.5vw, 24px) !important;
  }

  .oddix-v39-autofit .oddix-v37-brand-text strong {
    font-size: clamp(56px, 6.2vw, 108px) !important;
    letter-spacing: clamp(-4px, -.28vw, -1px) !important;
  }

  .oddix-v39-autofit .oddix-v37-brand-text small {
    font-size: clamp(10px, .95vw, 15px) !important;
    letter-spacing: clamp(2.5px, .4vw, 5px) !important;
  }

  .oddix-v39-autofit .oddix-v37-hero h1 {
    font-size: clamp(32px, 3.3vw, 56px) !important;
    max-width: 640px;
  }

  .oddix-v39-autofit .oddix-v37-hero p {
    font-size: clamp(12px, .9vw, 15px);
    max-width: 590px;
  }

  .oddix-v39-autofit .oddix-v37-badges {
    gap: 7px !important;
  }

  .oddix-v39-autofit .oddix-v37-badges span {
    padding: clamp(6px, .6vw, 8px) clamp(8px, .75vw, 12px) !important;
    font-size: clamp(10px, .72vw, 12px) !important;
    white-space: nowrap;
  }

  .oddix-v39-autofit .oddix-v37-hero-player img {
    width: min(100%, clamp(330px, 36vw, 620px)) !important;
    max-height: clamp(300px, 34vw, 500px) !important;
  }

  .oddix-v39-autofit .oddix-v37-hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: clamp(8px, .9vw, 12px) !important;
  }

  .oddix-v39-autofit .oddix-v37-metric {
    min-height: clamp(104px, 9.5vw, 142px) !important;
    padding: clamp(12px, 1.1vw, 18px) !important;
  }

  .oddix-v39-autofit .oddix-v37-metric strong {
    font-size: clamp(28px, 2.7vw, 46px) !important;
  }

  .oddix-v39-autofit .oddix-v37-metric.purple strong {
    font-size: clamp(20px, 1.85vw, 30px) !important;
    line-height: 1.05;
  }

  .oddix-v39-autofit .oddix-v37-ticket {
    grid-template-columns: minmax(138px, .7fr) clamp(74px, 8vw, 164px) minmax(138px, .7fr) minmax(420px, 1.65fr) !important;
    gap: clamp(10px, 1.1vw, 18px) !important;
  }

  .oddix-v39-autofit .oddix-v37-team img {
    width: clamp(82px, 8.5vw, 140px) !important;
    height: clamp(82px, 8.5vw, 140px) !important;
  }

  .oddix-v39-autofit .oddix-v37-team strong {
    font-size: clamp(12px, 1vw, 16px) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel {
    grid-template-columns: minmax(150px, 1.12fr) minmax(86px, .55fr) minmax(112px, .72fr) minmax(150px, .9fr) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel > div,
  .oddix-v39-autofit .oddix-v37-ticket-panel button {
    min-height: clamp(104px, 9vw, 142px) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel > div:first-child strong {
    font-size: clamp(22px, 2.1vw, 34px) !important;
    line-height: 1.05 !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel strong.green {
    font-size: clamp(34px, 3.6vw, 54px) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel button {
    font-size: clamp(11px, .9vw, 14px) !important;
    min-width: 0 !important;
    white-space: normal;
  }

  .oddix-v39-autofit .oddix-v37-main-grid {
    grid-template-columns: minmax(0, 1.4fr) minmax(320px, .72fr) !important;
    gap: clamp(12px, 1.35vw, 18px) !important;
  }

  .oddix-v39-autofit .oddix-v37-results-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    gap: clamp(8px, .9vw, 14px) !important;
  }

  .oddix-v39-autofit .oddix-v37-result-card {
    min-height: clamp(126px, 10vw, 156px) !important;
    padding: clamp(12px, 1vw, 16px) !important;
  }

  .oddix-v39-autofit .oddix-v37-result-card strong {
    font-size: clamp(30px, 3vw, 44px) !important;
  }

  .oddix-v39-autofit .oddix-v37-player-prop {
    min-width: 0;
  }

  .oddix-v39-autofit .oddix-v37-prop-body {
    grid-template-columns: clamp(130px, 13vw, 190px) minmax(0, 1fr) !important;
  }

  .oddix-v39-autofit .oddix-v37-prop-body img {
    width: clamp(130px, 13vw, 190px) !important;
    height: clamp(178px, 17vw, 250px) !important;
  }

  .oddix-v39-autofit .oddix-v37-bottom-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(260px, .72fr) !important;
    gap: clamp(12px, 1.35vw, 18px) !important;
  }

  @media (max-width: 1380px) {
    :root {
      --oddix-sidebar-w: 232px;
      --oddix-content-pad: 18px;
    }

    .oddix-v39-autofit .oddix-v37-logo strong {
      font-size: 28px !important;
    }

    .oddix-v39-autofit .oddix-v37-logo img {
      width: 68px !important;
      height: 68px !important;
    }

    .oddix-v39-autofit .oddix-v37-hero {
      grid-template-columns: minmax(0, 1fr) minmax(240px, .58fr) !important;
      min-height: 430px !important;
    }

    .oddix-v39-autofit .oddix-v37-hero-metrics {
      grid-column: 1 / -1;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket {
      grid-template-columns: minmax(130px, .8fr) 120px minmax(130px, .8fr) !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel {
      grid-column: 1 / -1;
      grid-template-columns: minmax(190px, 1.2fr) minmax(110px, .65fr) minmax(140px, .8fr) minmax(190px, 1fr) !important;
    }

    .oddix-v39-autofit .oddix-v37-results-grid {
      grid-template-columns: repeat(5, minmax(118px, 1fr)) !important;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: thin;
    }
  }

  @media (max-width: 1120px) {
    :root {
      --oddix-sidebar-w: 1fr;
      --oddix-content-pad: 14px;
    }

    .oddix-v39-autofit {
      grid-template-columns: 1fr !important;
    }

    .oddix-v39-autofit .oddix-v37-content {
      max-width: 100vw !important;
    }

    .oddix-v39-autofit .oddix-v37-sidebar {
      position: relative !important;
      width: 100% !important;
      height: auto !important;
    }

    .oddix-v39-autofit .oddix-v37-hero,
    .oddix-v39-autofit .oddix-v37-main-grid,
    .oddix-v39-autofit .oddix-v37-bottom-grid {
      grid-template-columns: 1fr !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket {
      grid-template-columns: 1fr !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 720px) {
    .oddix-v39-autofit .oddix-v37-hero {
      padding: 22px 16px 58px !important;
    }

    .oddix-v39-autofit .oddix-v37-hero-metrics,
    .oddix-v39-autofit .oddix-v37-ticket-panel,
    .oddix-v39-autofit .oddix-v37-prop-body,
    .oddix-v39-autofit .oddix-v37-results-grid {
      grid-template-columns: 1fr !important;
    }

    .oddix-v39-autofit .oddix-v37-results-grid {
      overflow-x: visible;
    }
  }


  /* V39.2 FINAL FIXES: corrige logo cortada, Premium quebrado, Top Pick e botão instalar */
  .oddix-v39-autofit .oddix-v37-logo,
  .oddix-v39-autofit .oddix-v37-logo div {
    min-width: 0 !important;
    overflow: hidden !important;
  }

  .oddix-v39-autofit .oddix-v37-logo strong {
    display: block !important;
    max-width: 100% !important;
    font-size: clamp(23px, 2vw, 32px) !important;
    line-height: .92 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: clip !important;
    letter-spacing: -1px !important;
  }

  .oddix-v39-autofit .oddix-v37-logo span {
    display: block !important;
    max-width: 100% !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .oddix-v39-autofit .oddix-v37-hero {
    grid-template-columns: minmax(420px, 1.05fr) minmax(330px, .72fr) minmax(230px, .42fr) !important;
  }

  .oddix-v39-autofit .oddix-v37-hero-player {
    justify-content: flex-end !important;
    transform: translateX(4%) !important;
  }

  .oddix-v39-autofit .oddix-v37-hero-player img {
    width: min(112%, clamp(390px, 40vw, 680px)) !important;
  }

  .oddix-v39-autofit .oddix-v37-metric strong,
  .oddix-v39-autofit .oddix-v37-metric.purple strong {
    word-break: normal !important;
    overflow-wrap: normal !important;
    hyphens: none !important;
    max-width: 100% !important;
    overflow: hidden !important;
    text-overflow: clip !important;
  }

  .oddix-v39-autofit .oddix-v37-metric:not(.purple) strong {
    white-space: nowrap !important;
  }

  .oddix-v39-autofit .oddix-v37-metric.purple strong {
    font-size: clamp(17px, 1.55vw, 26px) !important;
    line-height: 1.06 !important;
    white-space: nowrap !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel {
    grid-template-columns: minmax(260px, 1.38fr) minmax(112px, .58fr) minmax(142px, .7fr) minmax(190px, .92fr) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel > div:first-child {
    padding-left: clamp(16px, 1.5vw, 26px) !important;
    padding-right: clamp(16px, 1.5vw, 26px) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel > div:first-child strong {
    display: block !important;
    font-size: clamp(21px, 1.7vw, 30px) !important;
    line-height: 1.08 !important;
    letter-spacing: -.5px !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    hyphens: none !important;
    white-space: normal !important;
    max-width: 100% !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel > div:first-child small {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel > div:nth-child(2) strong {
    white-space: nowrap !important;
    font-size: clamp(32px, 3vw, 50px) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel strong.green {
    white-space: nowrap !important;
    font-size: clamp(34px, 3.2vw, 52px) !important;
  }

  .oddix-v39-autofit .oddix-v37-ticket-panel button {
    min-width: 0 !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    padding-left: clamp(14px, 1.2vw, 20px) !important;
    padding-right: clamp(14px, 1.2vw, 20px) !important;
  }

  .oddix-v39-autofit .oddix-v37-team img {
    aspect-ratio: 1 / 1 !important;
    object-fit: contain !important;
    object-position: center center !important;
    image-rendering: auto !important;
  }

  .oddix-v39-autofit .oddix-v37-prop-body img {
    object-fit: contain !important;
    object-position: bottom center !important;
  }

  /* Botão de instalar app sempre no canto, nunca em cima do conteúdo */
  .oddix-dashboard-install,
  .oddix-install-button,
  .install-app-button,
  button[aria-label*="Instalar"],
  button[title*="Instalar"] {
    position: fixed !important;
    right: 22px !important;
    bottom: 22px !important;
    left: auto !important;
    top: auto !important;
    transform: none !important;
    z-index: 80 !important;
    max-width: min(260px, calc(100vw - 44px)) !important;
    box-shadow: 0 18px 40px rgba(249,115,22,.35) !important;
  }

  @media (max-width: 1380px) {
    .oddix-v39-autofit .oddix-v37-hero {
      grid-template-columns: minmax(0, 1.05fr) minmax(300px, .62fr) !important;
    }

    .oddix-v39-autofit .oddix-v37-hero-player {
      transform: translateX(0) !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel {
      grid-template-columns: minmax(260px, 1.32fr) minmax(110px, .62fr) minmax(142px, .72fr) minmax(185px, .92fr) !important;
    }
  }

  @media (max-width: 1240px) {
    .oddix-v39-autofit .oddix-v37-ticket-panel {
      grid-template-columns: minmax(230px, 1.22fr) minmax(100px, .62fr) minmax(130px, .72fr) minmax(165px, .9fr) !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel > div:first-child strong {
      font-size: clamp(20px, 2vw, 27px) !important;
    }

    .oddix-v39-autofit .oddix-v37-metric.purple strong {
      white-space: normal !important;
    }
  }

  @media (max-width: 1120px) {
    .oddix-v39-autofit .oddix-v37-logo strong {
      font-size: 32px !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel {
      grid-template-columns: 1fr 1fr !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel > div:first-child strong {
      font-size: 30px !important;
    }
  }

  @media (max-width: 720px) {
    .oddix-v39-autofit .oddix-v37-logo strong {
      font-size: 28px !important;
    }

    .oddix-v39-autofit .oddix-v37-metric strong,
    .oddix-v39-autofit .oddix-v37-metric.purple strong {
      white-space: normal !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel {
      grid-template-columns: 1fr !important;
    }

    .oddix-v39-autofit .oddix-v37-ticket-panel > div:first-child strong {
      font-size: 28px !important;
    }

    .oddix-dashboard-install,
    .oddix-install-button,
    .install-app-button,
    button[aria-label*="Instalar"],
    button[title*="Instalar"] {
      right: 12px !important;
      bottom: 12px !important;
    }
  }


  /* V40 PREMIUM RESPONSIVO + ODDIX VIRTUAL */
  :root {
    --oddix-v40-sidebar: clamp(218px, 15.5vw, 276px);
    --oddix-v40-pad: clamp(14px, 1.7vw, 30px);
    --oddix-v40-radius: clamp(16px, 1.4vw, 28px);
  }

  html,
  body,
  .oddix-v37-page {
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }

  .oddix-v37-page,
  .oddix-v39-autofit {
    grid-template-columns: var(--oddix-v40-sidebar) minmax(0, 1fr) !important;
  }

  .oddix-v37-sidebar {
    width: var(--oddix-v40-sidebar) !important;
    max-width: var(--oddix-v40-sidebar) !important;
    padding: clamp(14px, 1.35vw, 22px) !important;
    overflow-x: hidden !important;
  }

  .oddix-v37-logo {
    min-width: 0 !important;
    gap: clamp(6px, .6vw, 10px) !important;
  }

  .oddix-v37-logo img {
    width: clamp(58px, 5vw, 76px) !important;
    height: clamp(58px, 5vw, 76px) !important;
    flex: 0 0 auto !important;
  }

  .oddix-v37-logo div {
    min-width: 0 !important;
    overflow: hidden !important;
  }

  .oddix-v37-logo strong {
    font-size: clamp(26px, 2.45vw, 44px) !important;
    line-height: .9 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: clip !important;
  }

  .oddix-v37-logo span {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .oddix-v37-content {
    min-width: 0 !important;
    max-width: calc(100vw - var(--oddix-v40-sidebar)) !important;
    padding: var(--oddix-v40-pad) !important;
  }

  .oddix-v37-header,
  .oddix-v37-hero,
  .oddix-v37-top-pick,
  .oddix-v37-main-grid,
  .oddix-v37-bottom-grid,
  .oddix-v37-games,
  .oddix-v39-footer,
  .oddix-v40-virtual-pick {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .oddix-v37-header {
    align-items: flex-start !important;
  }

  .oddix-v37-tabs {
    flex: 1 1 auto !important;
    max-width: 100% !important;
  }

  .oddix-v37-user-actions {
    flex: 0 0 auto !important;
  }

  .oddix-v37-hero {
    min-height: clamp(390px, 34vw, 510px) !important;
    padding: clamp(24px, 3vw, 42px) clamp(20px, 2.7vw, 40px) clamp(52px, 4.2vw, 62px) !important;
    grid-template-columns: minmax(360px, 1.08fr) minmax(280px, .76fr) minmax(210px, .5fr) !important;
    gap: clamp(12px, 1.4vw, 22px) !important;
  }

  .oddix-v37-brand-text strong {
    font-size: clamp(52px, 5vw, 90px) !important;
    letter-spacing: clamp(-3px, -.22vw, -1px) !important;
  }

  .oddix-v37-brand-text small {
    font-size: clamp(10px, .88vw, 13px) !important;
    letter-spacing: clamp(2px, .32vw, 4px) !important;
  }

  .oddix-v37-hero h1 {
    font-size: clamp(30px, 3vw, 52px) !important;
  }

  .oddix-v37-hero-player img {
    width: min(112%, clamp(320px, 34vw, 590px)) !important;
    max-height: clamp(290px, 31vw, 480px) !important;
  }

  .oddix-v37-metric {
    min-height: clamp(104px, 8vw, 138px) !important;
    padding: clamp(12px, 1vw, 17px) !important;
  }

  .oddix-v37-metric strong {
    font-size: clamp(28px, 3vw, 48px) !important;
    white-space: nowrap !important;
  }

  .oddix-v37-metric.purple strong {
    font-size: clamp(18px, 1.7vw, 28px) !important;
  }

  .oddix-v37-ticket {
    grid-template-columns: minmax(120px, .78fr) clamp(82px, 8vw, 138px) minmax(120px, .78fr) minmax(360px, 1.55fr) !important;
    gap: clamp(10px, 1.2vw, 18px) !important;
  }

  .oddix-v37-team img {
    width: clamp(82px, 7vw, 128px) !important;
    height: clamp(82px, 7vw, 128px) !important;
  }

  .oddix-v37-ticket-panel {
    grid-template-columns: minmax(190px, 1.22fr) minmax(95px, .62fr) minmax(122px, .75fr) minmax(170px, 1fr) !important;
  }

  .oddix-v37-ticket-panel > div,
  .oddix-v37-ticket-panel button {
    min-height: clamp(104px, 8.5vw, 132px) !important;
    min-width: 0 !important;
  }

  .oddix-v37-ticket-panel strong {
    font-size: clamp(24px, 2.55vw, 46px) !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
  }

  .oddix-v37-ticket-panel strong.green {
    font-size: clamp(30px, 3vw, 50px) !important;
  }

  .oddix-v37-main-grid {
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr) !important;
  }

  .oddix-v37-results-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) !important;
  }

  .oddix-v37-result-card {
    min-height: 142px !important;
  }

  .oddix-v37-bottom-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
  }

  .oddix-v37-games-grid {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
  }

  .oddix-v37-tip-row {
    grid-template-columns: 30px minmax(0, 1fr) minmax(70px, .5fr) 54px 52px !important;
  }

  .oddix-v40-virtual-pick {
    border: 1px solid rgba(34,197,94,.36);
    background:
      radial-gradient(circle at 16% 0%, rgba(34,197,94,.20), transparent 34%),
      linear-gradient(135deg, rgba(3,12,8,.97), rgba(4,4,4,.94));
    border-radius: 22px;
    box-shadow: 0 22px 60px rgba(0,0,0,.42);
    margin-bottom: 18px;
    padding: 20px 24px;
  }

  .oddix-v40-virtual-ticket {
    display: grid;
    grid-template-columns: minmax(260px, 1.1fr) minmax(230px, .95fr) minmax(190px, .72fr) minmax(170px, .62fr);
    gap: 14px;
    align-items: stretch;
  }

  .oddix-v40-virtual-ticket h3 {
    margin: 6px 0 8px;
    font-size: clamp(24px, 2.6vw, 40px);
    line-height: 1.02;
  }

  .oddix-v40-virtual-ticket p,
  .oddix-v40-virtual-ticket small {
    color: rgba(255,255,255,.68);
    font-weight: 750;
    line-height: 1.42;
  }

  .oddix-v40-virtual-market,
  .oddix-v40-virtual-numbers div {
    border: 1px solid rgba(34,197,94,.22);
    background: rgba(0,0,0,.30);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .oddix-v40-virtual-market span,
  .oddix-v40-virtual-numbers span {
    color: #86efac;
    font-size: 11px;
    font-weight: 1000;
    letter-spacing: .4px;
  }

  .oddix-v40-virtual-market strong {
    color: #facc15;
    font-size: clamp(24px, 2.4vw, 38px);
    line-height: 1.05;
    font-weight: 1000;
    text-transform: uppercase;
  }

  .oddix-v40-virtual-numbers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .oddix-v40-virtual-numbers strong {
    color: #22c55e;
    font-size: clamp(26px, 2.4vw, 42px);
    font-weight: 1000;
  }

  .oddix-v40-virtual-ticket button {
    border: 0;
    border-radius: 16px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    font-weight: 1000;
    cursor: pointer;
    padding: 16px;
  }

  .oddix-v39-footer nav {
    align-content: center;
  }

  @media (max-width: 1460px) {
    .oddix-v37-hero {
      grid-template-columns: minmax(0, 1.05fr) minmax(280px, .62fr) !important;
    }

    .oddix-v37-hero-metrics {
      grid-column: 1 / -1;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    }

    .oddix-v37-ticket {
      grid-template-columns: minmax(130px, .8fr) 120px minmax(130px, .8fr) !important;
    }

    .oddix-v37-ticket-panel {
      grid-column: 1 / -1;
    }

    .oddix-v40-virtual-ticket {
      grid-template-columns: minmax(260px, 1fr) minmax(230px, .9fr) minmax(210px, .8fr);
    }

    .oddix-v40-virtual-ticket button {
      grid-column: 1 / -1;
      min-height: 54px;
    }
  }

  @media (max-width: 1180px) {
    :root {
      --oddix-v40-sidebar: 1fr;
    }

    .oddix-v37-page,
    .oddix-v39-autofit {
      grid-template-columns: 1fr !important;
    }

    .oddix-v37-sidebar {
      position: relative !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      display: grid;
      grid-template-columns: 1fr;
    }

    .oddix-v37-content {
      max-width: 100vw !important;
    }

    .oddix-v37-hero,
    .oddix-v37-main-grid {
      grid-template-columns: 1fr !important;
    }

    .oddix-v37-hero-player {
      display: none !important;
    }

    .oddix-v37-hero-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .oddix-v37-ticket,
    .oddix-v40-virtual-ticket {
      grid-template-columns: 1fr !important;
    }

    .oddix-v37-ticket-panel {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 720px) {
    .oddix-v37-content {
      padding: 12px !important;
    }

    .oddix-v37-header,
    .oddix-v37-user-actions,
    .oddix-v37-hero-actions {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .oddix-v37-user-actions button,
    .oddix-v37-user-actions span {
      width: 100%;
      text-align: center;
    }

    .oddix-v37-hero {
      padding: 22px 16px 58px !important;
    }

    .oddix-v37-hero-metrics,
    .oddix-v37-ticket-panel,
    .oddix-v37-results-grid,
    .oddix-v40-virtual-numbers {
      grid-template-columns: 1fr !important;
    }

    .oddix-v37-hero-footer {
      left: 14px;
      right: 14px;
      overflow-x: auto;
      gap: 14px;
    }
  }


  .oddix-v37-modal {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0,0,0,.74);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .oddix-v37-modal > div {
    width: min(560px, 100%);
    border: 1px solid rgba(250,204,21,.45);
    background: linear-gradient(145deg, #050505, #211504);
    border-radius: 24px;
    padding: 24px;
    position: relative;
  }

  .oddix-v37-modal > div > button:first-child {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 999px;
    background: rgba(255,255,255,.1);
    color: #fff;
    font-size: 24px;
    cursor: pointer;
  }

  .oddix-v37-modal span {
    color: #facc15;
    font-weight: 1000;
  }

  .oddix-v37-modal h2 {
    margin: 14px 0 10px;
  }

  .oddix-v37-modal p {
    color: rgba(255,255,255,.72);
    line-height: 1.55;
  }

  .oddix-v37-modal-pick {
    display: grid;
    gap: 10px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 14px;
    padding: 14px;
    margin: 14px 0;
  }

  .oddix-v37-modal > div > button:last-child {
    width: 100%;
    border: 0;
    border-radius: 12px;
    background: #facc15;
    color: #050505;
    padding: 14px;
    font-weight: 1000;
    cursor: pointer;
  }


  /* V38: anti-corte premium dos quadrados/cards */
  .oddix-v37-metric,
  .oddix-v37-result-card,
  .oddix-v37-ticket-panel,
  .oddix-v37-ticket-panel > div,
  .oddix-v37-player-prop,
  .oddix-v37-list-card,
  .oddix-v37-vip-card,
  .oddix-v37-game-card,
  .oddix-v37-search,
  .oddix-v37-side-card,
  .oddix-v37-support,
  .oddix-v37-partner {
    overflow: hidden;
    min-width: 0;
  }

  .oddix-v37-metric span,
  .oddix-v37-metric strong,
  .oddix-v37-metric small,
  .oddix-v37-result-card span,
  .oddix-v37-result-card strong,
  .oddix-v37-result-card small,
  .oddix-v37-ticket-panel span,
  .oddix-v37-ticket-panel strong,
  .oddix-v37-ticket-panel small,
  .oddix-v37-prop-body h3,
  .oddix-v37-prop-body p,
  .oddix-v37-prop-body strong,
  .oddix-v37-tip-row strong,
  .oddix-v37-boost-row strong,
  .oddix-v37-game-card strong {
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .oddix-v37-metric {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .oddix-v37-metric strong {
    line-height: 1;
    word-break: keep-all;
  }

  .oddix-v37-metric span {
    line-height: 1.25;
  }

  .oddix-v37-metric small {
    margin-top: 6px;
    line-height: 1.2;
  }

  .oddix-v37-ticket-panel strong {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .oddix-v37-ticket-panel button {
    min-height: 142px;
    white-space: normal;
    line-height: 1.16;
  }

  .oddix-v37-result-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .oddix-v37-result-card strong {
    white-space: nowrap;
  }

  .oddix-v37-prop-body strong {
    line-height: 1.28;
    min-height: 52px;
  }

  .oddix-v37-prop-metrics span {
    min-width: 0;
    overflow: hidden;
  }

  .oddix-v37-prop-metrics b {
    float: none;
    display: block;
    margin-top: 5px;
    font-size: 18px;
  }

  .oddix-v37-game-teams strong {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }


  @media (max-width: 1280px) {
    .oddix-v37-page {
      grid-template-columns: 220px minmax(0, 1fr);
    }

    .oddix-v37-content {
      padding: 18px;
    }

    .oddix-v37-hero {
      grid-template-columns: minmax(0, 1fr) minmax(300px, .68fr);
      min-height: auto;
    }

    .oddix-v37-hero-metrics {
      grid-column: 1 / -1;
      grid-template-columns: repeat(4, minmax(150px, 1fr));
    }

    .oddix-v37-ticket {
      grid-template-columns: 1fr 120px 1fr;
    }

    .oddix-v37-ticket-panel {
      grid-column: 1 / -1;
      grid-template-columns: minmax(190px, 1.2fr) minmax(120px, .72fr) minmax(150px, .92fr) minmax(180px, 1.05fr);
    }

    .oddix-v37-bottom-grid {
      grid-template-columns: 1fr 1fr;
    }

    .oddix-v37-vip-card {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 980px) {
    .oddix-v37-page {
      grid-template-columns: 1fr;
    }

    .oddix-v37-sidebar {
      position: relative;
      height: auto;
    }

    .oddix-v37-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .oddix-v37-header {
      flex-direction: column;
      align-items: stretch;
    }

    .oddix-v37-hero,
    .oddix-v37-main-grid,
    .oddix-v37-bottom-grid {
      grid-template-columns: 1fr;
    }

    .oddix-v37-hero-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .oddix-v37-results-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .oddix-v39-footer {
      grid-template-columns: 1fr;
    }

    .oddix-v37-ticket {
      grid-template-columns: 1fr;
    }

    .oddix-v37-ticket-panel {
      grid-template-columns: 1fr;
    }

    .oddix-v37-ticket-panel button,
    .oddix-v37-ticket-panel > div {
      min-height: 96px;
    }

    .oddix-v37-ticket-panel > div {
      border-right: 0;
      border-bottom: 1px solid rgba(250,204,21,.18);
    }
  }

  @media (max-width: 620px) {
    .oddix-v37-content,
    .oddix-v37-sidebar {
      padding: 12px;
    }

    .oddix-v37-hero {
      padding: 22px 16px 48px;
    }

    .oddix-v37-brand-text strong {
      font-size: 46px;
    }

    .oddix-v37-brand-text small {
      font-size: 11px;
      letter-spacing: 3px;
    }

    .oddix-v37-hero h1 {
      font-size: 54px;
    }

    .oddix-v37-hero-metrics,
    .oddix-v37-results-grid,
    .oddix-v37-nav,
    .oddix-v37-prop-body,
    .oddix-v39-footer {
      grid-template-columns: 1fr;
    }

    .oddix-v37-hero-footer {
      left: 16px;
      right: 16px;
      gap: 10px;
      overflow-x: auto;
    }

    .oddix-v37-tip-row {
      grid-template-columns: 30px 1fr 52px;
    }

    .oddix-v37-tip-row small,
    .oddix-v37-tip-row em {
      display: none;
    }
  }
`;

const styles: Record<string, CSSProperties> = {};
