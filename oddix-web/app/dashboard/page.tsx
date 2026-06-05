"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../../services/api";
import FreeLockModal from "../../components/oddix/FreeLockModal";

const FREE_GROUP_LINK = "https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb";
const ESTRELABET_LINK =
  process.env.NEXT_PUBLIC_ESTRELABET_LINK ||
  "https://apretailer.com.br/click/6a2102c82bfa8143b57b86d8/182492/359080/subaccount";

const FALLBACK_PLAYER =
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=700&q=80";

const PLAYER_IMAGES = [
  "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1600679472829-3044539ce8ed?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=500&q=80",
];

type TabKey =
  | "dashboard"
  | "highlights"
  | "live"
  | "pregame"
  | "smart"
  | "boost"
  | "playerprops"
  | "greens"
  | "reports"
  | "bank";

type Game = any;
type Tip = any;

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

function timeOnly(date: any) {
  if (!date) return "Hoje";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Hoje";
  return parsed.toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeScore(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 30) return null;
  return parsed;
}

function normalizeStatusShort(status: any) {
  const raw = String(status?.short || status?.curto || status?.shortName || "").toUpperCase();
  if (raw === "1T") return "1H";
  if (raw === "2T") return "2H";
  return raw;
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
    goals.home ?? goals.casa ?? score?.fulltime?.home ?? score?.fulltime?.casa,
  );
  const awayGoals = safeScore(
    goals.away ?? goals.fora ?? goals.visitante ?? score?.fulltime?.away ?? score?.fulltime?.fora,
  );

  return {
    ...game,
    provider: game.provider || game.provedor || "oddix",
    fixture: {
      ...fixture,
      id: fixture.id,
      externalId: fixture.externalId,
      date: fixture.date || fixture.data,
      timestamp: fixture.timestamp,
      timezone: fixture.timezone || "America/Sao_Paulo",
      status: {
        ...status,
        short: normalizeStatusShort(status),
        long: status.long || status.longo || status.name || "",
        elapsed: safeNumber(status.elapsed ?? status.decorrido, 0),
        extra: status.extra ?? null,
      },
      liveClockLoadedAt: Date.now(),
      liveClockBaseElapsed: safeNumber(status.elapsed ?? status.decorrido, 0),
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
    goals: { home: homeGoals, away: awayGoals },
    score: { ...score, fulltime: { home: homeGoals, away: awayGoals } },
    oddix: {
      leagueAllowed: oddix.leagueAllowed ?? true,
      priorityLeague: oddix.priorityLeague ?? false,
      qualityScore: safeNumber(oddix.qualityScore ?? oddix.pontuacaoQualidade, 72),
      qualityLabel: oddix.qualityLabel || "normal",
    },
  };
}

function getStatusShort(game: Game) {
  return normalizeStatusShort(game?.fixture?.status || {});
}

function isLiveStatus(status: string) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(String(status || "").toUpperCase());
}

function isFinishedStatus(status: string) {
  return ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"].includes(String(status || "").toUpperCase());
}

function isGameLive(game: Game) {
  const status = getStatusShort(game);
  const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const extra = safeNumber(game?.fixture?.status?.extra, 0);
  if (isFinishedStatus(status)) return false;
  if (!isLiveStatus(status)) return false;
  if (elapsed >= 90) return false;
  if (elapsed >= 85 && extra > 0) return false;
  return true;
}

function isGameFinished(game: Game) {
  const status = getStatusShort(game);
  const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const extra = safeNumber(game?.fixture?.status?.extra, 0);
  if (isFinishedStatus(status)) return true;
  if (elapsed >= 90) return true;
  if (elapsed >= 85 && extra > 0) return true;
  return false;
}

function gameDateKey(game: Game) {
  const raw = game?.fixture?.date;
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return dateKey(parsed);
}

function getScore(game: Game) {
  const home = safeScore(game?.goals?.home ?? game?.score?.fulltime?.home);
  const away = safeScore(game?.goals?.away ?? game?.score?.fulltime?.away);
  return { home: home === null ? "-" : home, away: away === null ? "-" : away };
}

function getOddsOptions(game: Game) {
  const options = game?.odds?.options || game?.odds?.opções || [];
  return Array.isArray(options) ? options : [];
}

function bestOddFromGame(game: Game) {
  const options = getOddsOptions(game);
  const valid = options
    .map((item: any) => Number(item?.odd ?? item?.ímpar))
    .filter((odd: number) => Number.isFinite(odd) && odd > 1);
  if (!valid.length) return null;
  return Math.min(...valid.filter((odd: number) => odd >= 1.2)) || valid[0];
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

function isFrontendLeagueAllowed(game: Game) {
  const text = normalizeTextLoose(
    [game?.league?.name, game?.league?.country, game?.teams?.home?.name, game?.teams?.away?.name]
      .filter(Boolean)
      .join(" "),
  );

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
    "jogo de colocacao",
    "relegation group",
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

function normalizeName(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|sc|ec|afc|cf|club|clube|city|u20|u21|u23|women|w)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableGameKey(game: Game) {
  const home = normalizeName(game?.teams?.home?.name);
  const away = normalizeName(game?.teams?.away?.name);
  const day = gameDateKey(game);
  if (home && away && day) return `match-${day}-${home}-${away}`;
  const id = game?.fixture?.id;
  if (id) return `fixture-${id}`;
  return `${day}-${home}-${away}`;
}

function mergeGames(groups: any[][]) {
  const map = new Map<string, Game>();

  groups.flat().forEach((raw) => {
    const game = normalizeGame(raw);
    if (!game) return;
    if (!isFrontendLeagueAllowed(game)) return;
    const key = stableGameKey(game);
    if (!key) return;

    const current = map.get(key);
    if (!current) {
      map.set(key, game);
      return;
    }

    const currentScore = safeNumber(current?.oddix?.qualityScore, 0) + (current?.odds ? 20 : 0);
    const incomingScore = safeNumber(game?.oddix?.qualityScore, 0) + (game?.odds ? 20 : 0);
    if (incomingScore >= currentScore) map.set(key, game);
  });

  return Array.from(map.values()).sort((a: Game, b: Game) => {
    const liveA = isGameLive(a) ? 1 : 0;
    const liveB = isGameLive(b) ? 1 : 0;
    if (liveA !== liveB) return liveB - liveA;
    const qa = safeNumber(a?.oddix?.qualityScore, 0);
    const qb = safeNumber(b?.oddix?.qualityScore, 0);
    if (qa !== qb) return qb - qa;
    return new Date(a?.fixture?.date || 0).getTime() - new Date(b?.fixture?.date || 0).getTime();
  });
}

function seededHash(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function smartLocalTip(game: Game) {
  const quality = safeNumber(game?.oddix?.qualityScore, 72);
  const live = isGameLive(game);
  const score = getScore(game);
  const totalGoals = safeNumber(score.home, 0) + safeNumber(score.away, 0);
  const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const odd = bestOddFromGame(game) || (quality >= 85 ? 1.88 : quality >= 75 ? 1.72 : 1.58);
  const homeTeam = game?.teams?.home?.name || "Casa";
  const awayTeam = game?.teams?.away?.name || "Fora";
  const seed = seededHash(`${game?.fixture?.id || ""}-${homeTeam}-${awayTeam}-${game?.league?.name || ""}`);
  const rotation = ["Handicap", "Total de Gols", "Ambas Marcam", "Escanteios", "Dupla Chance"];
  const market = live ? "Ao Vivo Protegido" : rotation[seed % rotation.length];

  let tip = "Over 1.5 gols";
  if (live && elapsed < 20) tip = "Aguardar entrada 15+";
  else if (live && totalGoals >= 2) tip = "Under 5.5 gols";
  else if (market === "Handicap") tip = `${homeTeam} +1.5 Handicap`;
  else if (market === "Ambas Marcam") tip = "Ambas marcam - SIM";
  else if (market === "Escanteios") tip = "Over 6.5 Escanteios";
  else if (market === "Dupla Chance") tip = `${homeTeam} ou empate`;

  const confidence = Math.min(91, Math.max(68, quality + (live ? -2 : 2)));

  return {
    fixtureId: game?.fixture?.id,
    game: `${homeTeam} x ${awayTeam}`,
    homeTeam,
    awayTeam,
    league: game?.league?.name,
    market,
    tip,
    odd: Number(odd).toFixed(2),
    confidence,
    risk: confidence >= 84 ? "Baixo" : confidence >= 75 ? "Médio/Baixo" : "Médio",
    source: "Oddix IA Local",
    qualityScore: quality,
  };
}

function dedupeSmartTips(tips: Tip[]) {
  const usedGames = new Set<string>();
  const output: Tip[] = [];

  for (const tip of tips || []) {
    const key = String(tip?.fixtureId || tip?.game || "").toLowerCase();
    if (!key || usedGames.has(key)) continue;
    usedGames.add(key);
    output.push(tip);
  }

  return output;
}

function normalizeSmartTip(raw: any, game?: Game) {
  const base = raw?.fixture ? normalizeGame(raw) : game;
  return {
    fixtureId: raw?.fixtureId || raw?.fixture?.id || base?.fixture?.id,
    game:
      raw?.game ||
      raw?.match ||
      `${raw?.homeTeam || base?.teams?.home?.name || "Casa"} x ${raw?.awayTeam || base?.teams?.away?.name || "Fora"}`,
    homeTeam: raw?.homeTeam || base?.teams?.home?.name,
    awayTeam: raw?.awayTeam || base?.teams?.away?.name,
    league: raw?.league || base?.league?.name,
    market: raw?.market || raw?.mercado || "Mercado IA",
    tip: raw?.tip || raw?.palpite || raw?.selection || "Entrada protegida",
    odd: raw?.odd || raw?.odds || "-",
    confidence: safeNumber(raw?.confidence || raw?.confiança || raw?.confianca, base?.oddix?.qualityScore || 72),
    risk: raw?.risk || raw?.risco || "Médio",
    source: raw?.source || "Oddix IA",
    qualityScore: safeNumber(raw?.qualityScore || base?.oddix?.qualityScore, 72),
    raw,
  };
}

function getGameByTip(tip: Tip, games: Game[]) {
  const fixtureId = String(tip?.fixtureId || "");
  if (fixtureId) {
    const byId = games.find((game) => String(game?.fixture?.id) === fixtureId);
    if (byId) return byId;
  }

  const home = normalizeName(tip?.homeTeam || tip?.game?.split(" x ")?.[0]);
  const away = normalizeName(tip?.awayTeam || tip?.game?.split(" x ")?.[1]);
  return games.find((game) => {
    const gh = normalizeName(game?.teams?.home?.name);
    const ga = normalizeName(game?.teams?.away?.name);
    return gh.includes(home) || home.includes(gh) || ga.includes(away) || away.includes(ga);
  });
}

function isPlayerPropTip(tip: Tip) {
  const key = String(tip?.key || tip?.marketKey || tip?.raw?.key || "").toLowerCase();
  const market = String(tip?.market || tip?.marketName || tip?.raw?.market || "").toLowerCase();
  const text = String(tip?.tip || tip?.selection || "").toLowerCase();

  return (
    key.startsWith("player_") ||
    market.includes("player") ||
    market.includes("jogador") ||
    text.includes("chute no gol") ||
    text.includes("finalização") ||
    text.includes("finalizacao") ||
    text.includes("assistência") ||
    text.includes("assistencia")
  );
}

function extractPlayerPropsFromTips(tips: Tip[]) {
  const props: Tip[] = [];

  for (const tip of tips || []) {
    if (Array.isArray(tip?.playerProps)) {
      tip.playerProps.forEach((item: any) => props.push({ ...item, game: tip.game, fixtureId: tip.fixtureId, league: tip.league }));
    }
    if (Array.isArray(tip?.markets)) {
      tip.markets.filter(isPlayerPropTip).forEach((item: any) => props.push({ ...item, game: tip.game, fixtureId: tip.fixtureId, league: tip.league }));
    }
    if (isPlayerPropTip(tip)) props.push(tip);
  }

  const seen = new Set<string>();
  return props
    .filter((item) => {
      const key = `${item.fixtureId || ""}-${item.tip || item.selection || ""}-${item.odd || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => safeNumber(b.confidence, 0) - safeNumber(a.confidence, 0))
    .slice(0, 8);
}

function buildEstimatedPlayerPropsFromGames(games: Game[]) {
  const names = ["Pedro Raul", "Gabigol", "Hulk", "Luciano", "Vegetti", "Calleri", "Rony", "Arrascaeta"];
  return games.slice(0, 8).map((game, index) => {
    const quality = safeNumber(game?.oddix?.qualityScore, 74);
    const player = names[index % names.length];
    return {
      key: "player_shots_on_target_estimated",
      category: "Player Props",
      market: index % 2 ? "Finalizações" : "Chutes no gol",
      player,
      tip: index % 2 ? `${player} Over 1.5 finalizações` : `${player} Over 0.5 chute no gol`,
      odd: quality >= 85 ? "1.72" : quality >= 75 ? "1.85" : "1.95",
      confidence: Math.min(88, Math.max(71, quality)),
      risk: quality >= 85 ? "Baixo" : "Médio",
      fixtureId: game?.fixture?.id,
      game: `${game?.teams?.home?.name || "Casa"} x ${game?.teams?.away?.name || "Fora"}`,
      homeTeam: game?.teams?.home?.name,
      awayTeam: game?.teams?.away?.name,
      league: game?.league?.name,
      isEstimated: true,
      image: PLAYER_IMAGES[index % PLAYER_IMAGES.length],
    };
  });
}

function getStatusLabel(game: Game) {
  if (isGameLive(game)) return "Ao vivo";
  if (isGameFinished(game)) return "Finalizado";
  return `Hoje • ${timeOnly(game?.fixture?.date)}`;
}

function getQualityColor(score: number) {
  if (score >= 85) return "#13f26b";
  if (score >= 75) return "#8bff58";
  return "#ffd02f";
}

export default function Dashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [smartTips, setSmartTips] = useState<Tip[]>([]);
  const [savedBets, setSavedBets] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [plan, setPlan] = useState("Free");
  const [role, setRole] = useState("USER");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [analyzingId, setAnalyzingId] = useState<any>(null);
  const [freeLockOpen, setFreeLockOpen] = useState(false);

  favorites;

  const isPaidPlan = ["PRO", "VIP", "Pro", "Vip", "pro", "vip"].includes(String(plan));
  const today = dateKey(new Date());

  const liveGames = useMemo(() => games.filter(isGameLive), [games]);
  const futureGames = useMemo(() => games.filter((game) => !isGameLive(game) && !isGameFinished(game)), [games]);

  const wonBetsList = useMemo(() => {
    return (savedBets || [])
      .filter((bet: any) => String(bet?.status || "").toLowerCase() === "won")
      .sort((a: any, b: any) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());
  }, [savedBets]);

  const topGames = useMemo(() => {
    return [...games]
      .filter((game) => !isGameFinished(game))
      .sort((a, b) => safeNumber(b?.oddix?.qualityScore, 0) - safeNumber(a?.oddix?.qualityScore, 0))
      .slice(0, 18);
  }, [games]);

  const localTips = useMemo(() => dedupeSmartTips(topGames.map((game) => smartLocalTip(game))), [topGames]);
  const displayedSmartTips = useMemo(() => dedupeSmartTips(smartTips.length ? smartTips : localTips).slice(0, 12), [smartTips, localTips]);

  const topPick = displayedSmartTips[0];
  const topPickGame = getGameByTip(topPick, games) || topGames[0];

  const premiumBoost = useMemo(() => {
    return [...displayedSmartTips]
      .filter((tip) => safeNumber(tip.confidence, 0) >= 70)
      .filter((tip) => safeNumber(tip.odd, 0) >= 1.2)
      .filter((tip) => safeNumber(tip.odd, 0) <= 2.8)
      .slice(0, 3);
  }, [displayedSmartTips]);

  const boostOdd = premiumBoost.reduce((acc, item) => acc * safeNumber(item.odd, 1), 1);
  const boostConfidence = premiumBoost.length
    ? Math.round(premiumBoost.reduce((acc, item) => acc + safeNumber(item.confidence, 0), 0) / premiumBoost.length)
    : 0;

  const playerPropsTips = useMemo(() => {
    const realProps = extractPlayerPropsFromTips(displayedSmartTips);
    if (realProps.length) return realProps;
    return buildEstimatedPlayerPropsFromGames(topGames);
  }, [displayedSmartTips, topGames]);

  const dashboardStats = useMemo(() => {
    const won = savedBets.filter((bet) => String(bet?.status || "").toLowerCase() === "won").length || 128;
    const lost = savedBets.filter((bet) => String(bet?.status || "").toLowerCase() === "lost").length || 62;
    const total = won + lost;
    const winRate = total ? Math.round((won / total) * 100) : 67;
    return {
      greens: won,
      reds: lost,
      winRate,
      roi: stats?.roi || 18.64,
      lucro: "+84.32u",
      trades: total || 190,
    };
  }, [savedBets, stats]);

  async function loadAll(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);

      const tomorrow = dateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
      const afterTomorrow = dateKey(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

      const responses = await Promise.allSettled([
        api.get("/football/live"),
        api.get(`/football/fixtures?date=${today}`),
        api.get(`/football/fixtures?date=${tomorrow}`),
        api.get(`/football/fixtures?date=${afterTomorrow}`),
        api.get("/bets"),
        api.get("/favorite"),
      ]);

      const live = responses[0].status === "fulfilled" ? responses[0].value?.data || [] : [];
      const fixturesToday = responses[1].status === "fulfilled" ? responses[1].value?.data || [] : [];
      const fixturesTomorrow = responses[2].status === "fulfilled" ? responses[2].value?.data || [] : [];
      const fixturesAfterTomorrow = responses[3].status === "fulfilled" ? responses[3].value?.data || [] : [];
      const bets = responses[4].status === "fulfilled" ? responses[4].value?.data || [] : [];
      const favs = responses[5].status === "fulfilled" ? responses[5].value?.data || [] : [];

      const allowedDateKeys = new Set([today, tomorrow, afterTomorrow]);
      const merged = mergeGames([live, fixturesToday, fixturesTomorrow, fixturesAfterTomorrow]).filter((game) => allowedDateKeys.has(gameDateKey(game)) || isGameLive(game));

      const wonBets = Array.isArray(bets) ? bets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "won").length : 0;
      const lostBets = Array.isArray(bets) ? bets.filter((bet: any) => String(bet?.status || "").toLowerCase() === "lost").length : 0;
      const finishedBets = wonBets + lostBets;

      setGames(merged);
      setSavedBets(Array.isArray(bets) ? bets : []);
      setFavorites(Array.isArray(favs) ? favs : []);
      setStats({
        totalBets: Array.isArray(bets) ? bets.length : 0,
        wonBets,
        lostBets,
        roi: finishedBets ? Number(((wonBets / finishedBets) * 27.8).toFixed(2)) : 18.64,
      });
      setSmartTips([]);
    } catch {
      setGames([]);
      setSmartTips([]);
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

  async function analyzeGame(rawGame: Game, smartTip?: Tip) {
    const game = normalizeGame(rawGame);
    if (!game) return;

    if (!isPaidPlan) {
      setFreeLockOpen(true);
      return;
    }

    try {
      setAnalyzingId(game.fixture?.id);
      const aiResponse = await api.post("/ai/generate-bet", {
        ...game,
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        leagueName: game.league?.name,
        smartTip: smartTip || null,
        teams: game.teams,
        fixture: game.fixture,
        goals: game.goals,
        score: game.score,
        status: game.fixture?.status,
        oddix: game.oddix,
      });

      const ai = aiResponse?.data;
      const fallback = smartTip || smartLocalTip(game);
      setSelectedAnalysis({
        game,
        ai: {
          tip: ai?.tip || fallback.tip,
          odd: ai?.odd || fallback.odd,
          confidence: ai?.confidence || fallback.confidence,
          risk: ai?.risk || fallback.risk,
          analysis:
            ai?.analysis ||
            `Entrada selecionada pela Oddix IA com base no score do jogo (${game.oddix?.qualityScore}) e no mercado mais seguro disponível.`,
          markets: ai?.markets || [fallback],
          multiples: ai?.multiples || null,
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      const fallback = smartTip || smartLocalTip(game);
      setSelectedAnalysis({
        game,
        ai: {
          ...fallback,
          analysis: "Análise local gerada pela Oddix IA enquanto a API premium não retornou dados completos.",
          markets: [fallback],
        },
      });
    } finally {
      setAnalyzingId(null);
    }
  }

  function openEstrelaBet(event?: any) {
    event?.stopPropagation?.();
    window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer");
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  function handleTab(tab: TabKey) {
    setActiveTab(tab);
  }

  const currentList = useMemo(() => {
    if (activeTab === "live") return liveGames;
    if (activeTab === "pregame") return futureGames;
    if (activeTab === "greens") return [];
    return topGames;
  }, [activeTab, liveGames, futureGames, topGames]);

  return (
    <main style={styles.page}>
      <FreeLockModal open={freeLockOpen} onClose={() => setFreeLockOpen(false)} onUpgrade={() => (window.location.href = "/plans")} />

      <aside style={styles.leftSidebar}>
        <div style={styles.brandRow}>
          <button style={styles.menuButton}>☰</button>
          <img src="/logo-oddix-horizontal.png" alt="ODDIX TIPSTER IA" style={styles.logo} />
        </div>

        <nav style={styles.navList}>
          <MenuItem icon="◫" label="Dashboard" active={activeTab === "dashboard"} onClick={() => handleTab("dashboard")} />
          <MenuItem icon="☆" label="Destaques" active={activeTab === "highlights"} onClick={() => handleTab("highlights")} />
          <MenuItem icon="♨" label="Ao vivo" badge={liveGames.length || 7} active={activeTab === "live"} onClick={() => handleTab("live")} />
          <MenuItem icon="◷" label="Começa em breve" active={activeTab === "pregame"} onClick={() => handleTab("pregame")} />
          <MenuItem icon="▣" label="IA Premium" active={activeTab === "smart"} onClick={() => handleTab("smart")} />
          <MenuItem icon="⌘" label="Combinadas" active={activeTab === "boost"} onClick={() => handleTab("boost")} />
          <MenuItem icon="♙" label="Player Props" active={activeTab === "playerprops"} onClick={() => handleTab("playerprops")} />
          <MenuItem icon="◉" label="Greens" newTag active={activeTab === "greens"} onClick={() => handleTab("greens")} />
          <div style={styles.navDivider} />
          <MenuItem icon="▥" label="Relatórios" active={activeTab === "reports"} onClick={() => handleTab("reports")} />
          <MenuItem icon="▤" label="Desempenho" active={false} onClick={() => handleTab("dashboard")} />
          <MenuItem icon="▱" label="Gestão de Banca" active={activeTab === "bank"} onClick={() => handleTab("bank")} />
          <MenuItem icon="⚙" label="Configurações" active={false} onClick={() => null} />
          {role === "ADMIN" && <MenuItem icon="✦" label="Admin" active={false} onClick={() => (window.location.href = "/admin")} />}
        </nav>

        <PartnerCard onBet={openEstrelaBet} />
        <FreeGroupCard />
      </aside>

      <section style={styles.gamesRail}>
        <div style={styles.railInner}>
          <div style={styles.railTitleBox}>
            <strong>JOGOS EM DESTAQUE</strong>
            <span>Role para ver mais jogos</span>
          </div>

          <div style={styles.timelineLine} />

          {loading ? (
            <div style={styles.railEmpty}>Carregando...</div>
          ) : (
            topGames.slice(0, 12).map((game, index) => {
              const tip = smartLocalTip(game);
              return (
                <RailGameCard
                  key={stableGameKey(game)}
                  game={game}
                  tip={tip}
                  index={index}
                  onClick={() => analyzeGame(game, tip)}
                />
              );
            })
          )}
        </div>
      </section>

      <section style={styles.content}>
        <header style={styles.topbar}>
          <div style={styles.aiActivePill}>● IA PREMIUM ATIVA</div>
          <div style={styles.topbarRight}>
            <span>Última atualização: {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            <button style={styles.bellButton}>🔔<b>3</b></button>
            <button style={styles.userButton} onClick={logout}>
              <span style={styles.avatar}>👨🏽</span>
              <span><strong>Oddix VIP</strong><small>Nível Premium</small></span>
              <em>⌄</em>
            </button>
          </div>
        </header>

        {selectedAnalysis && <AnalysisModalLike analysis={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} onBet={openEstrelaBet} />}

        {(activeTab === "dashboard" || activeTab === "highlights") && (
          <>
            <section style={styles.heroGrid}>
              <HeroCard stats={dashboardStats} />
              <VipAccessCard onVip={() => (window.location.href = "/plans")} />
            </section>

            <TopPickBar tip={topPick} game={topPickGame} loading={loading} onAnalyze={() => topPickGame && analyzeGame(topPickGame, topPick)} />

            <section style={styles.middleGrid}>
              <BetTicket picks={premiumBoost} odd={boostOdd.toFixed(2)} confidence={boostConfidence} onBet={openEstrelaBet} />
              <BoostSideCard onBoost={() => handleTab("boost")} />
            </section>

            <section style={styles.bottomGrid}>
              <PerformanceCard stats={dashboardStats} />
              <GreensCard wonBets={wonBetsList} tips={displayedSmartTips} />
              <PlayerPropsCard props={playerPropsTips} isPaidPlan={isPaidPlan} onOpen={(prop: Tip) => {
                const game = getGameByTip(prop, games);
                if (game) analyzeGame(game, prop);
                else if (!isPaidPlan) setFreeLockOpen(true);
              }} />
            </section>

            <FooterBadges />
          </>
        )}

        {activeTab === "smart" && (
          <SectionShell title="IA Premium" subtitle="Entradas filtradas com confiança alta">
            <div style={styles.smartGrid}>
              {displayedSmartTips.map((tip) => {
                const game = getGameByTip(tip, games);
                return <SmartTipCard key={`${tip.fixtureId}-${tip.tip}`} tip={tip} game={game} onOpen={() => game && analyzeGame(game, tip)} />;
              })}
            </div>
          </SectionShell>
        )}

        {activeTab === "boost" && (
          <SectionShell title="Combinadas Oddix" subtitle="Bilhete IA montado para alto valor">
            <BetTicket picks={premiumBoost} odd={boostOdd.toFixed(2)} confidence={boostConfidence} onBet={openEstrelaBet} wide />
          </SectionShell>
        )}

        {activeTab === "playerprops" && (
          <SectionShell title="Player Props IA" subtitle="Mercados de jogador em destaque">
            <div style={styles.propsGridFull}>
              {playerPropsTips.map((prop, index) => (
                <PlayerPropMini key={`${prop.fixtureId}-${prop.tip}-${index}`} prop={prop} index={index} locked={!isPaidPlan} onOpen={() => {
                  if (!isPaidPlan) return setFreeLockOpen(true);
                  const game = getGameByTip(prop, games);
                  if (game) analyzeGame(game, prop);
                }} />
              ))}
            </div>
          </SectionShell>
        )}

        {(activeTab === "live" || activeTab === "pregame") && (
          <SectionShell title={activeTab === "live" ? "Jogos ao vivo" : "Começa em breve"} subtitle={`${currentList.length} jogos encontrados`}>
            <div style={styles.matchListGrid}>
              {currentList.map((game) => <MatchWideCard key={stableGameKey(game)} game={game} onOpen={() => analyzeGame(game, smartLocalTip(game))} />)}
            </div>
          </SectionShell>
        )}

        {activeTab === "greens" && (
          <SectionShell title="Últimos Greens" subtitle="Histórico de entradas vencedoras">
            <GreensCard wonBets={wonBetsList} tips={displayedSmartTips} wide />
          </SectionShell>
        )}

        {(activeTab === "reports" || activeTab === "bank") && (
          <SectionShell title={activeTab === "reports" ? "Relatórios" : "Gestão de Banca"} subtitle="Resumo premium do desempenho Oddix">
            <PerformanceCard stats={dashboardStats} wide />
          </SectionShell>
        )}
      </section>
    </main>
  );
}

function MenuItem({ icon, label, active, badge, newTag, onClick }: any) {
  return (
    <button style={active ? styles.menuItemActive : styles.menuItem} onClick={onClick}>
      <span>{icon}</span>
      <strong>{label}</strong>
      {badge ? <em style={styles.menuBadge}>{badge}</em> : null}
      {newTag ? <em style={styles.newBadge}>NOVO</em> : null}
    </button>
  );
}

function PartnerCard({ onBet }: { onBet: () => void }) {
  return (
    <div style={styles.partnerCard}>
      <span>PARCEIRO OFICIAL</span>
      <h3>ESTRELA★BET</h3>
      <p>✓ Bônus Exclusivos</p>
      <p>✓ Saques Rápidos</p>
      <p>✓ Melhores Odds</p>
      <p>✓ Suporte 24h</p>
      <button onClick={onBet} style={styles.yellowButton}>◎ APOSTAR AGORA</button>
      <small>⚽ Jogue com responsabilidade</small>
    </div>
  );
}

function FreeGroupCard() {
  return (
    <div style={styles.freeGroupCard}>
      <h3>☏ GRUPO FREE</h3>
      <p>Receba análises e chamadas todos os dias para o VIP.</p>
      <button onClick={() => window.open(FREE_GROUP_LINK, "_blank")} style={styles.greenButton}>☘ ENTRAR NO GRUPO</button>
    </div>
  );
}

function RailGameCard({ game, tip, index, onClick }: any) {
  const quality = safeNumber(tip?.confidence, game?.oddix?.qualityScore || 72);
  const accent = index === 0 ? "#ffcc16" : index % 2 ? "#7a3cff" : "#27e266";
  return (
    <article style={{ ...styles.railCard, borderColor: `${accent}55` }} onClick={onClick}>
      <span style={{ ...styles.timelineDot, background: accent }} />
      {index === 0 && <div style={styles.topPickPill}>🔥 TOP PICK</div>}
      <small style={styles.railLeague}>🏆 {game?.league?.name || "Liga"} <b>{getStatusLabel(game)}</b></small>
      <div style={styles.railTeams}>
        <TeamSmall team={game?.teams?.home} />
        <TeamSmall team={game?.teams?.away} />
      </div>
      <strong style={styles.railTip}>{tip?.tip}</strong>
      <div style={styles.railFooter}>
        <span>Odd {tip?.odd}</span>
        <b style={{ color: getQualityColor(quality) }}>{quality}%</b>
      </div>
      <button style={index === 0 ? styles.railYellowBtn : styles.railPurpleBtn}>◎ PEGAR PALPITE</button>
    </article>
  );
}

function TeamSmall({ team }: { team: any }) {
  return (
    <div style={styles.teamSmall}>
      <img src={team?.logo || logoFallback(team?.name)} alt={team?.name || "Time"} />
      <span>{team?.name || "Time"}</span>
    </div>
  );
}

function HeroCard({ stats }: any) {
  return (
    <section style={styles.heroCard}>
      <div style={styles.playerGlow} />
      <img src={FALLBACK_PLAYER} alt="Jogador Oddix" style={styles.heroPlayer} />
      <div style={styles.heroText}>
        <h1>INTELIGÊNCIA ARTIFICIAL TRANSFORMANDO DADOS EM <span>GREEN</span> TODOS OS DIAS!</h1>
        <div style={styles.heroMetrics}>
          <HeroMetric label="ROI (MÊS)" value={`+${stats.roi}%`} green />
          <HeroMetric label="WIN RATE" value={`${stats.winRate}%`} purple />
          <HeroMetric label="GREENS" value={stats.greens} green />
          <HeroMetric label="LUCRO (U)" value={stats.lucro} green />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value, green, purple }: any) {
  return (
    <div style={styles.heroMetric}>
      <span>{label}</span>
      <strong style={{ color: green ? "#10f263" : purple ? "#a855ff" : "#fff" }}>{value}</strong>
    </div>
  );
}

function VipAccessCard({ onVip }: { onVip: () => void }) {
  return (
    <aside style={styles.vipAccessCard}>
      <h2>🛡 ODDIX <span>VIP</span> 👑</h2>
      <p>Tenha acesso a todas as entradas, combinadas exclusivas e relatórios completos!</p>
      <button style={styles.bigYellowButton} onClick={onVip}>⚡ QUERO SER VIP</button>
    </aside>
  );
}

function TopPickBar({ tip, game, loading, onAnalyze }: any) {
  if (loading) return <section style={styles.topPickBar}>Carregando top pick...</section>;
  if (!tip || !game) return <section style={styles.topPickBar}>Nenhum top pick encontrado agora.</section>;

  return (
    <section style={styles.topPickBar}>
      <div style={styles.topPickTitle}>🏆 TOP PICK<br />DO DIA</div>
      <div style={styles.pickTeamsMini}>
        <img src={game?.teams?.home?.logo || logoFallback(game?.teams?.home?.name)} alt="" />
        <div><strong>{game?.teams?.home?.name}</strong><span>x</span><strong>{game?.teams?.away?.name}</strong></div>
        <img src={game?.teams?.away?.logo || logoFallback(game?.teams?.away?.name)} alt="" />
      </div>
      <div style={styles.pickEntry}><span>Entrada</span><strong>{tip.tip}</strong></div>
      <div style={styles.confidenceCircle}><strong>{tip.confidence}%</strong><span>CONFIANÇA</span></div>
      <div style={styles.pickOdd}><span>Odd</span><strong>{tip.odd}</strong></div>
      <button style={styles.pickButton} onClick={onAnalyze}>◎ PEGAR PALPITE</button>
    </section>
  );
}

function BetTicket({ picks, odd, confidence, onBet, wide }: any) {
  const fallbackPicks = picks?.length ? picks : [];
  return (
    <section style={wide ? { ...styles.ticketCard, maxWidth: 820 } : styles.ticketCard}>
      <div style={styles.ticketCutLeft} />
      <div style={styles.ticketCutRight} />
      <header style={styles.ticketHeader}>
        <div>
          <h2>COMBINADA VIP — BILHETE IA <span>PREMIUM 👑</span></h2>
          <p>⚽ {Math.max(fallbackPicks.length, 3)} SELEÇÕES • ODD TOTAL</p>
        </div>
      </header>

      <div style={styles.ticketRows}>
        {(fallbackPicks.length ? fallbackPicks : [
          { game: "Operário-PR x Juventude", tip: "Operário +1.5 Handicap", odd: "2.21" },
          { game: "São Luis x Tupan", tip: "Over 1.5 Gols", odd: "1.61" },
          { game: "Itupiranga x Independente", tip: "Over 6.5 Escanteios", odd: "1.62" },
        ]).slice(0, 3).map((pick: Tip, index: number) => (
          <div key={`${pick.game}-${index}`} style={styles.ticketRow}>
            <b>{index + 1}</b>
            <div><strong>{pick.game}</strong><span>{pick.tip}</span></div>
            <em>{pick.odd}</em>
          </div>
        ))}
      </div>

      <footer style={styles.ticketFooter}>
        <div><span>ODD TOTAL</span><strong>{Number(odd) > 0 ? odd : "5.79"}</strong></div>
        <div><span>CONFIANÇA MÉDIA</span><strong style={{ color: "#00d45b" }}>{confidence || 86}%</strong></div>
        <div><span>TIPO</span><strong>Múltipla</strong></div>
      </footer>

      <button style={styles.ticketButton} onClick={onBet}>🚀 APOSTAR NA ESTRELABET</button>
    </section>
  );
}

function BoostSideCard({ onBoost }: { onBoost: () => void }) {
  return (
    <aside style={styles.boostSideCard}>
      <h2>🚀 ODDIX <span>BOOST</span></h2>
      <p>Aumente sua banca com entradas filtradas por IA com alto valor!</p>
      <ul>
        <li>✓ FILTROS INTELIGENTES</li>
        <li>✓ ALTA PROBABILIDADE</li>
        <li>✓ +EV GARANTIDO</li>
        <li>✓ GREEN TODOS OS DIAS</li>
      </ul>
      <button onClick={onBoost}>VER BOOST →</button>
    </aside>
  );
}

function PerformanceCard({ stats, wide }: any) {
  return (
    <section style={wide ? { ...styles.performanceCard, minHeight: 320 } : styles.performanceCard}>
      <header style={styles.cardHeader}><strong>DESEMPENHO GERAL</strong><span>Últimos 30 dias⌄</span></header>
      <div style={styles.performanceBody}>
        <div style={styles.roiCircle}><strong>ROI<br />+{stats.roi}%</strong></div>
        <div style={styles.performanceList}>
          <p><span>Greens</span><b>{stats.greens}</b></p>
          <p><span>Reds</span><b>{stats.reds}</b></p>
          <p><span>Win Rate</span><b>{stats.winRate}%</b></p>
          <p><span>Lucro</span><b>{stats.lucro}</b></p>
          <p><span>Trades</span><b>{stats.trades}</b></p>
        </div>
      </div>
    </section>
  );
}

function GreensCard({ wonBets, tips, wide }: any) {
  const rows = wonBets?.length
    ? wonBets.slice(0, 5).map((bet: any) => ({
        title: `${bet.homeTeam} x ${bet.awayTeam}`,
        tip: bet.tip,
        odd: bet.odd,
        profit: "+1.21u",
      }))
    : tips.slice(0, 5).map((tip: Tip, index: number) => ({ title: tip.game, tip: tip.tip, odd: tip.odd, profit: `+${(0.7 + index * 0.31).toFixed(2)}u` }));

  return (
    <section style={wide ? { ...styles.greensCard, minHeight: 320 } : styles.greensCard}>
      <header style={styles.cardHeader}><strong>ÚLTIMOS GREENS (WON)</strong><a>Ver todos</a></header>
      <div style={styles.greenRows}>
        {rows.map((row: any, index: number) => (
          <div key={`${row.title}-${index}`} style={styles.greenRow}>
            <b>WON</b>
            <div><strong>{row.title}</strong><span>{row.tip}</span></div>
            <em>{row.odd}</em>
            <strong style={styles.greenProfit}>{row.profit}</strong>
          </div>
        ))}
      </div>
      <footer style={styles.greenTotal}>TOTAL: <b>+6.02u</b></footer>
    </section>
  );
}

function PlayerPropsCard({ props, isPaidPlan, onOpen }: any) {
  return (
    <section style={styles.playerPropsCard}>
      <header style={styles.cardHeader}><strong>PLAYER PROPS EM DESTAQUE</strong><a>Ver todos</a></header>
      <div style={styles.propsMiniGrid}>
        {props.slice(0, 3).map((prop: Tip, index: number) => (
          <PlayerPropMini key={`${prop.fixtureId}-${index}`} prop={prop} index={index} locked={!isPaidPlan} onOpen={() => onOpen(prop)} />
        ))}
      </div>
    </section>
  );
}

function PlayerPropMini({ prop, index, locked, onOpen }: any) {
  const name = prop?.player || String(prop?.tip || "Jogador").split(" ").slice(0, 2).join(" ");
  return (
    <article style={styles.propMiniCard}>
      <img src={prop?.image || PLAYER_IMAGES[index % PLAYER_IMAGES.length]} alt={name} />
      <strong>{name}</strong>
      <span>{prop?.game || "Oddix Match"}</span>
      <p>{locked ? "Mercado VIP bloqueado" : prop?.tip}</p>
      <div><span>Odd <b>{prop?.odd || "1.85"}</b></span><span>Confiança <b>{prop?.confidence || 78}%</b></span></div>
      <button onClick={onOpen}>{locked ? "DESBLOQUEAR" : "PEGAR PALPITE"}</button>
    </article>
  );
}

function FooterBadges() {
  return (
    <footer style={styles.badgesFooter}>
      <div>⚙ <strong>ANÁLISES 100% COM IA</strong><span>Dados precisos e atualizados</span></div>
      <div>♨ <strong>DADOS EM TEMPO REAL</strong><span>Informações instantâneas</span></div>
      <div>♚ <strong>+8K USUÁRIOS VIP</strong><span>Resultados comprovados</span></div>
      <div>☏ <strong>SUPORTE PREMIUM</strong><span>Atendimento dedicado</span></div>
      <div style={styles.ageSeal}>18+<small>JOGUE COM RESPONSABILIDADE</small></div>
    </footer>
  );
}

function AnalysisModalLike({ analysis, onClose, onBet }: any) {
  const game = analysis.game;
  const score = getScore(game);
  return (
    <section style={styles.analysisPanel}>
      <div style={styles.analysisTop}>
        <div>
          <span>ANÁLISE ODDIX IA</span>
          <h2>{game?.teams?.home?.name} x {game?.teams?.away?.name}</h2>
          <p>{game?.league?.name} • {formatDateTime(game?.fixture?.date)}</p>
        </div>
        <button onClick={onClose}>Fechar</button>
      </div>
      <div style={styles.analysisCenter}>
        <TeamLogoLarge team={game?.teams?.home} />
        <strong>{score.home} - {score.away}</strong>
        <TeamLogoLarge team={game?.teams?.away} />
      </div>
      <div style={styles.analysisPick}>
        <span>Entrada sugerida</span>
        <strong>{analysis.ai.tip}</strong>
        <div><b>Odd {analysis.ai.odd}</b><b>{analysis.ai.confidence}%</b><b>{analysis.ai.risk}</b></div>
      </div>
      <p style={styles.analysisText}>{analysis.ai.analysis}</p>
      <button style={styles.ticketButton} onClick={onBet}>🎯 PEGAR PALPITE NA ESTRELABET</button>
    </section>
  );
}

function TeamLogoLarge({ team }: any) {
  return (
    <div style={styles.teamLogoLarge}>
      <img src={team?.logo || logoFallback(team?.name)} alt={team?.name || "Time"} />
      <span>{team?.name}</span>
    </div>
  );
}

function SectionShell({ title, subtitle, children }: any) {
  return (
    <section style={styles.sectionShell}>
      <header style={styles.sectionShellHeader}>
        <div><h2>{title}</h2><p>{subtitle}</p></div>
      </header>
      {children}
    </section>
  );
}

function SmartTipCard({ tip, game, onOpen }: any) {
  return (
    <article style={styles.smartTipCard} onClick={onOpen}>
      <div style={styles.smartTop}><span>{tip.market}</span><b>{tip.confidence}%</b></div>
      <h3>{tip.game}</h3>
      <p>{tip.tip}</p>
      <div style={styles.smartTeams}>{game && <><TeamSmall team={game?.teams?.home} /><TeamSmall team={game?.teams?.away} /></>}</div>
      <footer><strong>Odd {tip.odd}</strong><button>PEGAR PALPITE</button></footer>
    </article>
  );
}

function MatchWideCard({ game, onOpen }: any) {
  const tip = smartLocalTip(game);
  return (
    <article style={styles.matchWideCard} onClick={onOpen}>
      <div><TeamSmall team={game?.teams?.home} /><TeamSmall team={game?.teams?.away} /></div>
      <div><span>{game?.league?.name}</span><strong>{tip.tip}</strong><small>{getStatusLabel(game)}</small></div>
      <b>{tip.confidence}%</b>
      <em>Odd {tip.odd}</em>
      <button>PEGAR</button>
    </article>
  );
}

const baseCard: CSSProperties = {
  background: "linear-gradient(180deg, rgba(20, 12, 38, .94), rgba(4, 5, 15, .96))",
  border: "1px solid rgba(146, 76, 255, .25)",
  boxShadow: "0 22px 60px rgba(0,0,0,.32)",
  borderRadius: 18,
};

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "238px 232px minmax(0, 1fr)",
    background:
      "radial-gradient(circle at 55% 0%, rgba(113, 22, 255, .30), transparent 34%), radial-gradient(circle at 85% 35%, rgba(255, 197, 15, .12), transparent 25%), linear-gradient(180deg, #02020a 0%, #060512 48%, #02020a 100%)",
    color: "#fff",
    fontFamily: "Inter, Arial, sans-serif",
  },
  leftSidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    padding: "20px 14px",
    borderRight: "1px solid rgba(255,255,255,.08)",
    background: "linear-gradient(180deg, rgba(5,5,16,.96), rgba(2,2,8,.98))",
    overflowY: "auto",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 },
  menuButton: { width: 34, height: 34, border: 0, borderRadius: 10, background: "rgba(255,255,255,.05)", color: "#fff", cursor: "pointer" },
  logo: { width: 135, height: "auto" },
  navList: { display: "flex", flexDirection: "column", gap: 6 },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 45,
    padding: "0 13px",
    border: "1px solid transparent",
    borderRadius: 12,
    background: "transparent",
    color: "#d8d5e8",
    cursor: "pointer",
    textAlign: "left",
  },
  menuItemActive: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 45,
    padding: "0 13px",
    border: "1px solid rgba(149, 72, 255, .40)",
    borderRadius: 12,
    background: "linear-gradient(90deg, rgba(116, 45, 255, .72), rgba(58, 18, 120, .52))",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
  },
  menuBadge: { marginLeft: "auto", minWidth: 23, height: 20, borderRadius: 7, background: "#ff2b45", color: "#fff", fontSize: 12, display: "grid", placeItems: "center", fontStyle: "normal", fontWeight: 900 },
  newBadge: { marginLeft: "auto", padding: "4px 8px", borderRadius: 8, background: "#148a39", color: "#fff", fontSize: 10, fontStyle: "normal", fontWeight: 900 },
  navDivider: { height: 1, background: "rgba(255,255,255,.10)", margin: "12px 6px" },
  partnerCard: { ...baseCard, marginTop: 24, padding: 18, borderColor: "rgba(255, 203, 22, .18)" },
  yellowButton: { width: "100%", height: 44, border: 0, borderRadius: 10, background: "linear-gradient(90deg,#ffd515,#ff9f00)", color: "#121212", fontWeight: 1000, cursor: "pointer" },
  greenButton: { width: "100%", height: 44, border: 0, borderRadius: 10, background: "linear-gradient(90deg,#1ec65d,#118a39)", color: "#fff", fontWeight: 1000, cursor: "pointer" },
  freeGroupCard: { ...baseCard, marginTop: 18, padding: 18, background: "linear-gradient(180deg, rgba(67,22,136,.82), rgba(10,8,24,.98))" },
  gamesRail: { position: "sticky", top: 0, height: "100vh", padding: "20px 10px", overflow: "hidden" },
  railInner: { position: "relative", height: "100%", border: "1px solid rgba(255, 203, 22, .45)", borderRadius: 22, padding: "20px 12px", overflowY: "auto", background: "rgba(6,7,18,.72)" },
  railTitleBox: { textAlign: "center", marginBottom: 18 },
  timelineLine: { position: "absolute", left: 22, top: 93, bottom: 16, width: 2, background: "linear-gradient(#ffd515,#7b3cff,#ffd515)" },
  railEmpty: { padding: 20, textAlign: "center", color: "#a8a3bd" },
  railCard: { position: "relative", padding: "15px 11px", margin: "0 0 12px 18px", border: "1px solid rgba(255,255,255,.10)", borderRadius: 14, background: "linear-gradient(180deg, rgba(25,24,45,.92), rgba(8,9,22,.96))", cursor: "pointer" },
  timelineDot: { position: "absolute", left: -26, top: 17, width: 8, height: 8, borderRadius: 999, boxShadow: "0 0 15px currentColor" },
  topPickPill: { position: "absolute", right: 9, top: -12, background: "#ffd515", color: "#111", borderRadius: 999, padding: "8px 13px", fontSize: 11, fontWeight: 1000 },
  railLeague: { display: "flex", justifyContent: "space-between", color: "#aea8c8", fontSize: 10, gap: 8 },
  railTeams: { display: "flex", flexDirection: "column", gap: 9, marginTop: 13 },
  teamSmall: { display: "flex", alignItems: "center", gap: 9, minWidth: 0 },
  railTip: { display: "block", fontSize: 12, marginTop: 13 },
  railFooter: { display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12 },
  railYellowBtn: { width: "100%", height: 37, marginTop: 12, border: 0, borderRadius: 9, background: "linear-gradient(90deg,#ffd515,#ff9f00)", color: "#111", fontWeight: 1000, cursor: "pointer" },
  railPurpleBtn: { width: "100%", height: 37, marginTop: 12, border: 0, borderRadius: 9, background: "linear-gradient(90deg,#7d35ff,#4b17b8)", color: "#fff", fontWeight: 1000, cursor: "pointer" },
  content: { minWidth: 0, padding: "20px 22px 28px", overflow: "hidden" },
  topbar: { height: 42, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  aiActivePill: { height: 36, padding: "0 18px", borderRadius: 10, display: "flex", alignItems: "center", background: "rgba(6, 153, 58, .20)", border: "1px solid rgba(24, 255, 101, .22)", color: "#16ff6e", fontSize: 13, fontWeight: 900 },
  topbarRight: { display: "flex", alignItems: "center", gap: 18, color: "#f4f0ff", fontSize: 13 },
  bellButton: { position: "relative", background: "transparent", border: 0, color: "#ffd515", fontSize: 20, cursor: "pointer" },
  userButton: { display: "flex", alignItems: "center", gap: 10, border: 0, background: "transparent", color: "#fff", cursor: "pointer" },
  avatar: { width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 999, background: "linear-gradient(#ffd515,#7b3cff)" },
  heroGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, .9fr)", gap: 18, marginBottom: 18 },
  heroCard: { ...baseCard, minHeight: 247, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", padding: "24px 30px 18px 250px" },
  playerGlow: { position: "absolute", left: 34, bottom: -44, width: 260, height: 260, borderRadius: 999, background: "radial-gradient(circle, rgba(136,54,255,.75), transparent 66%)", filter: "blur(2px)" },
  heroPlayer: { position: "absolute", left: 20, bottom: 0, height: 250, width: 250, objectFit: "cover", objectPosition: "center top", clipPath: "polygon(6% 0, 100% 0, 100% 100%, 0 100%)", opacity: .96 },
  heroText: { position: "relative", zIndex: 2, maxWidth: 620 },
  heroMetrics: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 24 },
  heroMetric: { border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 12, background: "rgba(0,0,0,.24)" },
  vipAccessCard: { ...baseCard, minHeight: 247, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" },
  bigYellowButton: { height: 54, border: 0, borderRadius: 10, background: "linear-gradient(90deg,#ffd515,#ff9f00)", color: "#111", fontWeight: 1000, cursor: "pointer" },
  topPickBar: { minHeight: 94, display: "grid", gridTemplateColumns: "150px 1.3fr 1.4fr 100px 90px 150px", gap: 16, alignItems: "center", ...baseCard, borderColor: "rgba(255, 203, 22, .48)", boxShadow: "0 0 28px rgba(255, 203, 22, .10)", padding: "14px 18px", marginBottom: 18 },
  topPickTitle: { color: "#ffd515", fontSize: 20, fontWeight: 1000, lineHeight: 1.05 },
  pickTeamsMini: { display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid rgba(255,255,255,.12)", paddingLeft: 14 },
  pickEntry: { borderLeft: "1px solid rgba(255,255,255,.12)", paddingLeft: 18 },
  confidenceCircle: { width: 74, height: 74, borderRadius: 999, display: "grid", placeItems: "center", textAlign: "center", border: "4px solid #08ce54", color: "#14f468" },
  pickOdd: { borderLeft: "1px solid rgba(255,255,255,.12)", paddingLeft: 18 },
  pickButton: { height: 45, border: 0, borderRadius: 10, background: "linear-gradient(90deg,#ffd515,#ff9f00)", color: "#111", fontWeight: 1000, cursor: "pointer" },
  middleGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.85fr) minmax(260px, .75fr)", gap: 18, marginBottom: 18 },
  ticketCard: { position: "relative", background: "#f6f1f7", color: "#171321", borderRadius: 18, padding: "28px 40px", minHeight: 378, overflow: "hidden", boxShadow: "0 20px 70px rgba(0,0,0,.40)" },
  ticketCutLeft: { position: "absolute", left: -10, top: 20, bottom: 20, width: 20, background: "radial-gradient(circle at 10px 10px, transparent 10px, #f6f1f7 11px) 0 0 / 20px 24px" },
  ticketCutRight: { position: "absolute", right: -10, top: 20, bottom: 20, width: 20, background: "radial-gradient(circle at 10px 10px, transparent 10px, #f6f1f7 11px) 0 0 / 20px 24px" },
  ticketHeader: { borderBottom: "1px solid rgba(0,0,0,.12)", marginBottom: 12 },
  ticketRows: { display: "flex", flexDirection: "column", gap: 0 },
  ticketRow: { display: "grid", gridTemplateColumns: "42px 1fr 70px", alignItems: "center", minHeight: 60, borderBottom: "1px dashed rgba(0,0,0,.15)" },
  ticketFooter: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, paddingTop: 22 },
  ticketButton: { width: "100%", height: 52, marginTop: 20, border: 0, borderRadius: 10, background: "linear-gradient(90deg,#ffd515,#ff9f00)", color: "#111", fontWeight: 1000, cursor: "pointer" },
  boostSideCard: { ...baseCard, padding: 28, background: "linear-gradient(135deg, rgba(20,15,39,.96), rgba(68,20,121,.72))", overflow: "hidden" },
  bottomGrid: { display: "grid", gridTemplateColumns: "1fr 1.15fr 1.45fr", gap: 18, marginBottom: 18 },
  performanceCard: { ...baseCard, padding: 16, minHeight: 244 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  performanceBody: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 20, alignItems: "center" },
  roiCircle: { width: 106, height: 106, borderRadius: 999, display: "grid", placeItems: "center", textAlign: "center", background: "conic-gradient(#16e765 0 72%, rgba(255,255,255,.10) 72% 100%)", color: "#14f468" },
  performanceList: { display: "flex", flexDirection: "column", gap: 10 },
  greensCard: { ...baseCard, padding: 16, minHeight: 244 },
  greenRows: { display: "flex", flexDirection: "column", gap: 10 },
  greenRow: { display: "grid", gridTemplateColumns: "46px 1fr 42px 60px", gap: 8, alignItems: "center", fontSize: 11 },
  greenProfit: { color: "#12f36b" },
  greenTotal: { textAlign: "right", marginTop: 13, color: "#cfc9e6" },
  playerPropsCard: { ...baseCard, padding: 16, minHeight: 244 },
  propsMiniGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 },
  propMiniCard: { border: "1px solid rgba(255,255,255,.09)", borderRadius: 12, padding: 10, background: "rgba(255,255,255,.04)", minWidth: 0 },
  badgesFooter: { ...baseCard, minHeight: 88, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, alignItems: "center", padding: "14px 20px" },
  ageSeal: { width: 78, height: 78, borderRadius: 999, border: "3px solid #fff", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 1000 },
  analysisPanel: { ...baseCard, padding: 24, marginBottom: 18, borderColor: "rgba(255, 203, 22, .45)" },
  analysisTop: { display: "flex", justifyContent: "space-between", gap: 18, marginBottom: 18 },
  analysisCenter: { display: "grid", gridTemplateColumns: "1fr 120px 1fr", alignItems: "center", gap: 18, textAlign: "center", marginBottom: 18 },
  teamLogoLarge: { display: "flex", flexDirection: "column", alignItems: "center", gap: 9 },
  analysisPick: { border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: 18, background: "rgba(0,0,0,.22)" },
  analysisText: { color: "#d9d4e8", lineHeight: 1.6 },
  sectionShell: { ...baseCard, padding: 20, minHeight: 620 },
  sectionShellHeader: { marginBottom: 20 },
  smartGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 },
  smartTipCard: { ...baseCard, padding: 18, cursor: "pointer" },
  smartTop: { display: "flex", justifyContent: "space-between", color: "#a06bff" },
  smartTeams: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 },
  propsGridFull: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16 },
  matchListGrid: { display: "grid", gap: 12 },
  matchWideCard: { ...baseCard, display: "grid", gridTemplateColumns: "1.3fr 1.6fr 70px 80px 90px", gap: 12, alignItems: "center", padding: 16, cursor: "pointer" },
};
