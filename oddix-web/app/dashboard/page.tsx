"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../../services/api";
import Top5Tips from "../../components/oddix/Top5Tips";
import VipConversionBanner from "../../components/oddix/VipConversionBanner";
import OddixBoostPremium from "../../components/oddix/OddixBoostPremium";
import FreeLockModal from "../../components/oddix/FreeLockModal";

const FREE_GROUP_LINK = "https://chat.whatsapp.com/JQuwv77T1b8J6KMlXCEeRb";
const ESTRELABET_LINK = process.env.NEXT_PUBLIC_ESTRELABET_LINK || "https://apretailer.com.br/click/6a2102c82bfa8143b57b86d8/182492/359080/subaccount";
const LEGAL_SEAL_DARK = "/selos/estrelabet-responsabilidade-dark.png";
const LEGAL_SEAL_SMALL = "/selos/estrelabet-responsabilidade-small.png";

type TabKey = "highlights" | "live" | "pregame" | "smart" | "boost" | "playerprops" | "greens";

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

  const normalized = {
    ...game,
    provider: game.provider || game.provedor || "unknown",
    fixture: {
      ...fixture,
      id: fixture.id,
      externalId: fixture.externalId,
      date: fixture.date || fixture.data,
      timestamp: fixture.timestamp || fixture.carimboDeDataHora || fixture["carimbo de data/hora"],
      timezone: fixture.timezone || fixture.fuso || fixture["fuso horário"] || "America/Sao_Paulo",
      status: {
        ...status,
        short: normalizeStatusShort(status),
        long: status.long || status.longo || status.name || status.nome || "",
        elapsed: safeNumber(status.elapsed ?? status.decorrido ?? status.tempoDecorrido ?? status["tempo decorrido"], 0),
        extra: status.extra ?? status.prorrogacao ?? status.prorrogação ?? null,
      },
      liveClockLoadedAt: Date.now(),
      liveClockBaseElapsed: safeNumber(status.elapsed ?? status.decorrido ?? status.tempoDecorrido ?? status["tempo decorrido"], 0),
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
      ...score,
      fulltime: {
        home: homeGoals,
        away: awayGoals,
      },
    },
    oddix: {
      leagueAllowed: oddix.leagueAllowed ?? oddix.ligaPermitida ?? true,
      priorityLeague: oddix.priorityLeague ?? oddix.ligaPrioridade ?? false,
      qualityScore: safeNumber(oddix.qualityScore ?? oddix.pontuaçãoDeQualidade ?? oddix.pontuacaoQualidade, 50),
      qualityLabel: oddix.qualityLabel || oddix.rótuloDeQualidade || oddix.rotuloQualidade || "normal",
    },
  };

  return normalized;
}

function getStatusShort(game: any) {
  return normalizeStatusShort(game?.fixture?.status || game?.jogo?.status || {});
}

function isLiveStatus(status: string) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "SUSP", "INT"].includes(String(status || "").toUpperCase());
}

function isFinishedStatus(status: string) {
  return ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"].includes(String(status || "").toUpperCase());
}

function isGameLive(game: any) {
  const status = getStatusShort(game);
  const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const extra = safeNumber(game?.fixture?.status?.extra, 0);

  if (isFinishedStatus(status)) return false;
  if (!isLiveStatus(status)) return false;
  if (elapsed >= 90) return false;
  if (elapsed >= 85 && extra > 0) return false;

  return true;
}

function isGameFinished(game: any) {
  const status = getStatusShort(game);
  const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const extra = safeNumber(game?.fixture?.status?.extra, 0);

  if (isFinishedStatus(status)) return true;
  if (elapsed >= 90) return true;
  if (elapsed >= 85 && extra > 0) return true;
  return false;
}

function gameDateKey(game: any) {
  const raw = game?.fixture?.date;
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return dateKey(parsed);
}

function getLiveClockParts(game: any, tick = 0) {
  tick;

  const status = getStatusShort(game);
  const apiElapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const baseElapsed = safeNumber(game?.fixture?.liveClockBaseElapsed, apiElapsed);
  const loadedAt = safeNumber(game?.fixture?.liveClockLoadedAt, Date.now());
  const extra = safeNumber(game?.fixture?.status?.extra, 0);
  const rawLive = isLiveStatus(status) && !isFinishedStatus(status);

  if (status === "HT") {
    return { minute: 45, second: 0, extra, running: false };
  }

  if (!rawLive || apiElapsed >= 90 || (apiElapsed >= 85 && extra > 0)) {
    return { minute: apiElapsed, second: 0, extra, running: false };
  }

  const secondsSinceLoad = Math.max(0, Math.floor((Date.now() - loadedAt) / 1000));
  const totalSeconds = Math.max(0, baseElapsed * 60 + secondsSinceLoad);

  let minute = Math.floor(totalSeconds / 60);
  let second = totalSeconds % 60;

  if (["ET", "BT", "P"].includes(status)) {
    minute = Math.min(minute, 120);
  } else {
    minute = Math.min(minute, 90);
  }

  if (extra && minute >= 90) {
    minute = 90 + extra;
    second = 0;
  }

  return { minute, second, extra, running: true };
}

function getLiveElapsedMinute(game: any, tick = 0) {
  return getLiveClockParts(game, tick).minute;
}

function gameTimeLabel(game: any, tick = 0) {
  const status = getStatusShort(game);

  if (status === "HT") return "Intervalo";

  if (isGameLive(game)) {
    const clock = getLiveClockParts(game, tick);

    if (!clock.minute) return "Ao vivo";

    const secondLabel = String(clock.second).padStart(2, "0");

    if (clock.minute >= 90 && clock.extra) {
      return `90+${clock.extra}'`;
    }

    return `${clock.minute}:${secondLabel}`;
  }

  if (isGameFinished(game)) return "FT";

  return formatDateTime(game?.fixture?.date);
}

function getScore(game: any) {
  const home = safeScore(game?.goals?.home ?? game?.score?.fulltime?.home);
  const away = safeScore(game?.goals?.away ?? game?.score?.fulltime?.away);
  return {
    home: home === null ? "-" : home,
    away: away === null ? "-" : away,
  };
}

function getOddsOptions(game: any) {
  const options = game?.odds?.options || game?.odds?.opções || [];
  return Array.isArray(options) ? options : [];
}

function bestOddFromGame(game: any) {
  const options = getOddsOptions(game);
  const valid = options
    .map((item: any) => Number(item?.odd ?? item?.ímpar))
    .filter((odd: number) => Number.isFinite(odd) && odd > 1);
  if (!valid.length) return null;
  return Math.min(...valid.filter((odd: number) => odd >= 1.2)) || valid[0];
}

const DASHBOARD_MIN_SCORE = Number(process.env.NEXT_PUBLIC_ODDIX_DASHBOARD_MIN_SCORE || 0);

const ODDIX_MARKET_ROTATION = [
  "total_goals_over_safe",
  "double_chance",
  "btts_safe",
  "asian_handicap",
  "corners_safe",
  "total_goals_under_live",
];

function seededHash(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function marketAlreadyUsedKey(tip: any) {
  return String(tip?.tip || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d+(?:[.,]\d+)?/g, "x")
    .replace(/\b(casa|fora|time|jogo|ao vivo|pre jogo|pré jogo)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function smartLocalTip(game: any) {
  const quality = safeNumber(game?.oddix?.qualityScore, 50);
  const live = isGameLive(game);
  const score = getScore(game);
  const totalGoals = safeNumber(score.home, 0) + safeNumber(score.away, 0);
  const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const odd = bestOddFromGame(game) || (quality >= 85 ? 1.62 : quality >= 75 ? 1.55 : 1.45);
  const homeTeam = game?.teams?.home?.name || "Casa";
  const awayTeam = game?.teams?.away?.name || "Fora";
  const seed = seededHash(`${game?.fixture?.id || ""}-${homeTeam}-${awayTeam}-${game?.league?.name || ""}`);
  const rotationKey = ODDIX_MARKET_ROTATION[seed % ODDIX_MARKET_ROTATION.length];

  let market = "Oddix Boost";
  let tip = "Over 1.5 gols";
  let confidence = Math.min(91, Math.max(68, quality));
  let risk = quality >= 85 ? "Baixo" : quality >= 75 ? "Médio/Baixo" : "Médio";

  if (live) {
    if (elapsed < 15) {
      market = "Ao Vivo Protegido";
      tip = "Aguardar minuto 15+ para entrada";
      confidence = Math.max(66, quality - 8);
      risk = "Médio";
    } else if (elapsed <= 35 && totalGoals === 0) {
      market = "Total de Gols";
      tip = "Over 0.5 gols no jogo";
      confidence = Math.min(87, quality + 3);
    } else if (elapsed >= 55 && totalGoals >= 2) {
      market = "Total de Gols";
      tip = "Under 5.5 gols";
      confidence = Math.min(88, quality + 2);
    } else if (elapsed >= 35 && totalGoals <= 1) {
      market = "Dupla Chance";
      tip = "Dupla chance do time dominante";
      confidence = Math.min(84, quality);
    } else {
      market = "Total de Gols";
      tip = totalGoals >= 2 ? "Under 5.5 gols" : "Over 1.5 gols";
      confidence = Math.min(85, quality);
    }
  } else {
    switch (rotationKey) {
      case "double_chance":
        market = "Dupla Chance";
        tip = quality >= 82 ? `${homeTeam} ou empate` : "Dupla chance mais segura";
        confidence = Math.min(88, quality + 1);
        break;
      case "btts_safe":
        market = "Ambas Marcam";
        tip = "Ambas marcam - Sim";
        confidence = Math.min(84, quality - 2);
        risk = "Médio";
        break;
      case "asian_handicap":
        market = "Handicap";
        tip = `${homeTeam} +1.5 handicap`;
        confidence = Math.min(86, quality);
        break;
      case "corners_safe":
        market = "Escanteios";
        tip = "Over 6.5 escanteios";
        confidence = Math.min(82, quality - 4);
        risk = "Médio";
        break;
      case "total_goals_under_live":
        market = "Total de Gols";
        tip = "Under 3.5 gols";
        confidence = Math.min(84, quality - 1);
        break;
      default:
        market = "Total de Gols";
        tip = "Over 1.5 gols";
        confidence = Math.min(89, quality + 1);
        break;
    }
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
    confidence,
    risk,
    source: "Oddix Boost V2 Local",
    qualityScore: quality,
  };
}

function dedupeSmartTips(tips: any[]) {
  const usedGames = new Set<string>();
  const usedMarkets = new Map<string, number>();
  const output: any[] = [];

  for (const tip of tips || []) {
    const gameKey = String(tip?.fixtureId || tip?.game || "").toLowerCase();
    const marketKey = marketAlreadyUsedKey(tip);
    const confidence = safeNumber(tip?.confidence, 0);
    const quality = safeNumber(tip?.qualityScore, 0);

    if (!gameKey || confidence < 65 || quality < DASHBOARD_MIN_SCORE) continue;
    if (usedGames.has(gameKey)) continue;

    const currentMarketCount = usedMarkets.get(marketKey) || 0;
    if (marketKey && currentMarketCount >= 2) continue;

    usedGames.add(gameKey);
    usedMarkets.set(marketKey, currentMarketCount + 1);
    output.push(tip);
  }

  return output;
}

function normalizeSmartTip(raw: any, game?: any) {
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
    confidence: safeNumber(raw?.confidence || raw?.confiança || raw?.confianca, base?.oddix?.qualityScore || 70),
    risk: raw?.risk || raw?.risco || "Médio",
    source: raw?.source || "Odds API",
    qualityScore: safeNumber(raw?.qualityScore || base?.oddix?.qualityScore, 60),
    raw,
  };
}

function normalizeName(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|sc|ec|afc|cf|club|clube|city|legion|cidade|u20|u21|u23|women|woman|w)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasTeamName(value: any) {
  const normalized = normalizeName(value);

  const aliases: Record<string, string> = {
    "birmingham": "birmingham",
    "birmingham legion": "birmingham",
    "louisville": "louisville",
    "louisville city": "louisville",
    "paulinia fu": "paulinia",
    "operario pr": "operario",
    "operario": "operario",
  };

  return aliases[normalized] || normalized;
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
    "placement play offs",
    "jogo de colocacao",
    "playoffs de colocacao",
    "play off de colocacao",
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

function stableGameKey(game: any) {
  const home = aliasTeamName(game?.teams?.home?.name);
  const away = aliasTeamName(game?.teams?.away?.name);
  const day = gameDateKey(game);

  // Chave principal por data + times normalizados, porque live/fixtures podem vir com IDs diferentes
  // e nomes diferentes para o mesmo jogo. Ex.: Birmingham x Louisville City / Birmingham Legion x Louisville City FC.
  if (home && away && day) return `match-${day}-${home}-${away}`;

  const id = game?.fixture?.id;
  if (id) return `fixture-${id}`;

  return `${day}-${home}-${away}`;
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
    if (!current) {
      map.set(key, game);
      return;
    }

    const currentScore = safeNumber(current?.oddix?.qualityScore, 0) + (current?.odds ? 20 : 0);
    const incomingScore = safeNumber(game?.oddix?.qualityScore, 0) + (game?.odds ? 20 : 0);
    if (incomingScore >= currentScore) map.set(key, game);
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

function getStatusLabel(game: any, tick = 0) {
  if (isGameLive(game)) return `● Ao vivo ${gameTimeLabel(game, tick)}`;
  if (isGameFinished(game)) return "Finalizado";
  return "Começa em breve";
}

function qualityBadge(score: number) {
  if (score >= 85) return "Premium";
  if (score >= 70) return "Boa";
  if (score >= 55) return "Normal";
  return "Baixa";
}

function getGameByTip(tip: any, games: any[]) {
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


function isPlayerPropTip(tip: any) {
  const key = String(tip?.key || tip?.marketKey || tip?.raw?.key || tip?.raw?.marketKey || "").toLowerCase();
  const category = String(tip?.category || tip?.raw?.category || "").toLowerCase();
  const market = String(tip?.market || tip?.marketName || tip?.raw?.market || "").toLowerCase();
  const text = String(tip?.tip || tip?.selection || "").toLowerCase();

  return (
    key.startsWith("player_") ||
    category.includes("player") ||
    market.includes("player") ||
    market.includes("jogador") ||
    text.includes("chute no gol") ||
    text.includes("finalização") ||
    text.includes("finalizacao") ||
    text.includes("assistência") ||
    text.includes("assistencia")
  );
}

function extractPlayerPropsFromTips(tips: any[]) {
  const props: any[] = [];

  for (const tip of tips || []) {
    if (Array.isArray(tip?.playerProps)) {
      tip.playerProps.forEach((item: any) => props.push({ ...item, game: tip.game, fixtureId: tip.fixtureId, league: tip.league }));
    }

    if (Array.isArray(tip?.markets)) {
      tip.markets.filter(isPlayerPropTip).forEach((item: any) => props.push({ ...item, game: tip.game, fixtureId: tip.fixtureId, league: tip.league }));
    }

    if (Array.isArray(tip?.raw?.playerProps)) {
      tip.raw.playerProps.forEach((item: any) => props.push({ ...item, game: tip.game, fixtureId: tip.fixtureId, league: tip.league }));
    }

    if (Array.isArray(tip?.raw?.markets)) {
      tip.raw.markets.filter(isPlayerPropTip).forEach((item: any) => props.push({ ...item, game: tip.game, fixtureId: tip.fixtureId, league: tip.league }));
    }

    if (isPlayerPropTip(tip)) {
      props.push(tip);
    }
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
    .slice(0, 20);
}


function buildEstimatedPlayerPropsFromGames(games: any[]) {
  const props: any[] = [];

  for (const game of games || []) {
    const playerName = getPlayerNameFromLineup(game);
    if (!playerName) continue;

    const quality = safeNumber(game?.oddix?.qualityScore, 70);
    if (quality < DASHBOARD_MIN_SCORE) continue;

    const fixtureId = game?.fixture?.id;
    const homeTeam = game?.teams?.home?.name || "Casa";
    const awayTeam = game?.teams?.away?.name || "Fora";
    const league = game?.league?.name || "Liga";
    const baseConfidence = Math.min(88, Math.max(72, quality));

    props.push({
      key: "player_shots_on_target_estimated",
      category: "Player Props",
      market: "Jogador chutes no gol",
      player: playerName,
      tip: `${playerName} Over 0.5 chute no gol`,
      odd: quality >= 85 ? "1.72" : quality >= 75 ? "1.85" : "1.95",
      confidence: Math.min(88, baseConfidence + 2),
      risk: quality >= 85 ? "Baixo" : "Médio",
      source: "Oddix Player Props IA",
      bookmaker: "Oddix estimada",
      fixtureId,
      game: `${homeTeam} x ${awayTeam}`,
      homeTeam,
      awayTeam,
      league,
      isEstimated: true,
    });

    props.push({
      key: "player_shots_estimated",
      category: "Player Props",
      market: "Jogador finalizações",
      player: playerName,
      tip: `${playerName} Over 1.5 finalizações`,
      odd: quality >= 85 ? "1.62" : quality >= 75 ? "1.76" : "1.90",
      confidence: baseConfidence,
      risk: quality >= 85 ? "Baixo" : "Médio",
      source: "Oddix Player Props IA",
      bookmaker: "Oddix estimada",
      fixtureId,
      game: `${homeTeam} x ${awayTeam}`,
      homeTeam,
      awayTeam,
      league,
      isEstimated: true,
    });
  }

  const seen = new Set<string>();

  return props
    .filter((item) => {
      const key = `${item.fixtureId || ""}-${item.tip || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => safeNumber(b.confidence, 0) - safeNumber(a.confidence, 0))
    .slice(0, 20);
}

export default function Dashboard() {
  const [games, setGames] = useState<any[]>([]);
  const [smartTips, setSmartTips] = useState<any[]>([]);
  const [savedBets, setSavedBets] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [plan, setPlan] = useState("Free");
  const [role, setRole] = useState("USER");
  const [activeTab, setActiveTab] = useState<TabKey>("highlights");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [selectedMatchDetail, setSelectedMatchDetail] = useState<any>(null);
  const [selectedStats, setSelectedStats] = useState<any>(null);
  const [analyzingId, setAnalyzingId] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const [freeLockOpen, setFreeLockOpen] = useState(false);

  const isPaidPlan = ["PRO", "VIP", "Pro", "Vip", "pro", "vip"].includes(String(plan));
  const today = dateKey(new Date());

  const liveGames = useMemo(() => games.filter(isGameLive), [games]);
  const futureGames = useMemo(() => games.filter((game) => !isGameLive(game) && !isGameFinished(game)), [games]);
  const finishedGames = useMemo(() => games.filter(isGameFinished), [games]);

  const leagues = useMemo(() => {
    return Array.from(new Set(games.map((game) => game?.league?.name).filter(Boolean))).sort();
  }, [games]);

  const topGames = useMemo(() => {
    return [...games]
      .filter((game) => !isGameFinished(game))
      .filter((game) => safeNumber(game?.oddix?.qualityScore, 0) >= DASHBOARD_MIN_SCORE)
      .sort((a, b) => safeNumber(b?.oddix?.qualityScore, 0) - safeNumber(a?.oddix?.qualityScore, 0))
      .slice(0, 12);
  }, [games]);

  const localTips = useMemo(() => {
    return dedupeSmartTips(topGames.map((game) => smartLocalTip(game)));
  }, [topGames]);

  const displayedSmartTips = useMemo(() => {
    return dedupeSmartTips(smartTips.length ? smartTips : localTips).slice(0, 12);
  }, [smartTips, localTips]);

  const playerPropsTips = useMemo(() => {
    const realProps = extractPlayerPropsFromTips(displayedSmartTips);
    if (realProps.length) return realProps;
    return buildEstimatedPlayerPropsFromGames(topGames);
  }, [displayedSmartTips, topGames]);

  const filteredGames = useMemo(() => {
    const q = search.toLowerCase().trim();

    return games
      .filter((game) => {
        if (leagueFilter !== "all" && game?.league?.name !== leagueFilter) return false;

        if (activeTab === "live" && !isGameLive(game)) return false;
        if (activeTab === "pregame" && (isGameLive(game) || isGameFinished(game))) return false;
        if (activeTab === "highlights" && safeNumber(game?.oddix?.qualityScore, 0) < DASHBOARD_MIN_SCORE) return false;
        if (activeTab === "smart" && safeNumber(game?.oddix?.qualityScore, 0) < DASHBOARD_MIN_SCORE) return false;
        if (activeTab === "playerprops" && safeNumber(game?.oddix?.qualityScore, 0) < DASHBOARD_MIN_SCORE) return false;
        if (activeTab === "greens" && !isGameFinished(game)) return false;

        if (!q) return true;

        const haystack = [
          game?.teams?.home?.name,
          game?.teams?.away?.name,
          game?.league?.name,
          game?.league?.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const searchTerms = q.split(" ").map((term) => term.trim()).filter(Boolean);

        return searchTerms.some((term) => haystack.includes(term));
      })
      .slice(0, activeTab === "highlights" ? 160 : 220);
  }, [games, leagueFilter, search, activeTab]);

  async function loadAll(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);

      const tomorrow = dateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));

      const responses = await Promise.allSettled([
        api.get("/football/live"),
        api.get(`/football/fixtures?date=${today}`),
        api.get(`/football/fixtures?date=${tomorrow}`),
        api.get("/bets"),
        api.get("/favorite"),
      ]);

      const live = responses[0].status === "fulfilled" ? responses[0].value?.data || [] : [];
      const fixturesToday = responses[1].status === "fulfilled" ? responses[1].value?.data || [] : [];
      const fixturesTomorrow = responses[2].status === "fulfilled" ? responses[2].value?.data || [] : [];
      const bets = responses[3].status === "fulfilled" ? responses[3].value?.data || [] : [];
      const favs = responses[4].status === "fulfilled" ? responses[4].value?.data || [] : [];

      const allowedDateKeys = new Set([today, tomorrow]);
      const merged = mergeGames([live, fixturesToday, fixturesTomorrow])
        .filter((game) => allowedDateKeys.has(gameDateKey(game)))
        .filter((game) => safeNumber(game?.oddix?.qualityScore, 0) >= DASHBOARD_MIN_SCORE);

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
        roi: finishedBets ? Math.round((wonBets / finishedBets) * 100) : 0,
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
    const timer = setInterval(() => {
      setLiveTick((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => loadAll(false), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  async function openMatchDetail(rawGame: any) {
    const game = normalizeGame(rawGame);
    if (!game) return;

    setSelectedMatchDetail({
      game,
      stats: null,
      loadingStats: true,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const fixtureId = game.fixture?.id;

      if (!fixtureId) {
        setSelectedMatchDetail({
          game,
          stats: null,
          loadingStats: false,
        });
        return;
      }

      const statsResponse = await api.get(`/football/statistics/${fixtureId}`);

      setSelectedMatchDetail({
        game,
        stats: statsResponse.data || null,
        loadingStats: false,
      });
    } catch {
      setSelectedMatchDetail({
        game,
        stats: null,
        loadingStats: false,
      });
    }
  }

  async function analyzeGame(rawGame: any, smartTip?: any) {
    const game = normalizeGame(rawGame);
    if (!game) return;

    if (!isPaidPlan) {
      setFreeLockOpen(true);
      return;
    }

    try {
      const fixtureId = game.fixture?.id;
      setAnalyzingId(fixtureId);
      setSelectedStats(null);

      const [aiResponse, statsResponse] = await Promise.allSettled([
        api.post("/ai/generate-bet", {
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
        }),
        fixtureId ? api.get(`/football/statistics/${fixtureId}`) : Promise.resolve({ data: null }),
      ]);

      const ai = aiResponse.status === "fulfilled" ? aiResponse.value?.data : null;
      const statsData = statsResponse.status === "fulfilled" ? statsResponse.value?.data : null;
      const fallbackAi = smartTip || smartLocalTip(game);

      setSelectedStats(statsData);
      setSelectedAnalysis({
        game,
        ai: {
          tip: ai?.tip || fallbackAi.tip,
          odd: ai?.odd || fallbackAi.odd,
          confidence: ai?.confidence || fallbackAi.confidence,
          risk: ai?.risk || fallbackAi.risk,
          analysis:
            ai?.analysis ||
            `Entrada sugerida pela Oddix usando qualidade do jogo (${game.oddix?.qualityScore}) e mercado disponível.`,
          markets: ai?.markets || [fallbackAi],
          multiples: ai?.multiples || null,
        },
        smartTip: fallbackAi,
        saved: isSavedGame(game),
        savedBetId: getSavedBetId(game),
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      alert("Erro ao analisar jogo.");
    } finally {
      setAnalyzingId(null);
    }
  }

  function isSavedGame(game: any) {
    const id = String(game?.fixture?.id || "");
    return savedBets.some((bet) => String(bet?.fixtureId || "") === id);
  }

  function getSavedBetId(game: any) {
    const id = String(game?.fixture?.id || "");
    return savedBets.find((bet) => String(bet?.fixtureId || "") === id)?.id;
  }

  async function saveAnalysisToDashboard() {
    if (!selectedAnalysis) return;

    try {
      setSaving(true);
      const game = selectedAnalysis.game;
      const ai = selectedAnalysis.ai;
      const score = getScore(game);

      if (selectedAnalysis.saved || isSavedGame(game)) {
        alert("Esse jogo já foi salvo.");
        return;
      }

      const created = await api.post("/admin/bets", {
        homeTeam: game.teams?.home?.name || "",
        awayTeam: game.teams?.away?.name || "",
        league: game.league?.name || "",
        tip: ai.tip || "",
        odd: Number(ai.odd || 0),
        confidence: Number(ai.confidence || 0),
        status: "open",
        homeLogo: game.teams?.home?.logo || "",
        awayLogo: game.teams?.away?.logo || "",
        leagueLogo: game.league?.logo || "",
        fixtureId: game.fixture?.id ? String(game.fixture.id) : "",
        gameDate: game.fixture?.date || "",
        homeScore: score.home === "-" ? null : Number(score.home),
        awayScore: score.away === "-" ? null : Number(score.away),
        statusShort: game.fixture?.status?.short || "",
        elapsed: game.fixture?.status?.elapsed ?? null,
        provider: game.provider || "unknown",
        markets: ai.markets || [],
        multiples: ai.multiples || null,
        analysis: ai.analysis || "",
        risk: ai.risk || "Médio",
      });

      await loadAll(false);
      setSelectedAnalysis({ ...selectedAnalysis, saved: true, savedBetId: created.data?.id });
      alert("Análise salva com sucesso.");
    } catch {
      alert("Erro ao salvar análise.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  function openEstrelaBet(event?: any) {
    event?.stopPropagation?.();
    window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer");
  }

  function openSportsButton(action: string) {
    if (action === "dashboard") {
      setActiveTab("highlights");
      setLeagueFilter("all");
      setSearch("");
      return;
    }

    if (action === "live") {
      setActiveTab("live");
      setLeagueFilter("all");
      setSearch("");
      return;
    }

    if (action === "smart") {
      setActiveTab("smart");
      setLeagueFilter("all");
      setSearch("");
      return;
    }

    if (action === "boost") {
      setActiveTab("boost");
      setLeagueFilter("all");
      setSearch("");
      return;
    }

    if (action === "playerprops") {
      setActiveTab("playerprops");
      setLeagueFilter("all");
      setSearch("");
      return;
    }

    if (action === "greens") {
      setActiveTab("greens");
      setLeagueFilter("all");
      setSearch("");
      return;
    }

    if (action === "odds") {
      setActiveTab("smart");
      setLeagueFilter("all");
      setSearch("");
      return;
    }

    if (action === "brasil") {
      setActiveTab("highlights");
      setLeagueFilter("all");
      setSearch("brasil");
      return;
    }

    if (action === "sulamericanos") {
      setActiveTab("highlights");
      setLeagueFilter("all");
      setSearch("argentina chile uruguay paraguay colombia ecuador peru bolivia brasil");
      return;
    }
  }

  function buildBoost() {
    const picks = displayedSmartTips
      .filter((tip) => safeNumber(tip.confidence, 0) >= 70)
      .slice(0, 3);

    const combinedOdd = picks.reduce((acc, item) => acc * safeNumber(item.odd, 1.35), 1);
    const confidence = picks.length
      ? Math.round(picks.reduce((acc, item) => acc + safeNumber(item.confidence, 70), 0) / picks.length)
      : 0;

    return { picks, combinedOdd: combinedOdd.toFixed(2), confidence };
  }

  const boost = buildBoost();

  const top5Tips = [...displayedSmartTips]
    .filter((tip) => safeNumber(tip.confidence, 0) >= 65)
    .sort((a, b) => {
      const confidenceDiff = safeNumber(b.confidence, 0) - safeNumber(a.confidence, 0);
      if (confidenceDiff !== 0) return confidenceDiff;
      return safeNumber(b.qualityScore, 0) - safeNumber(a.qualityScore, 0);
    })
    .slice(0, 5);

  const premiumBoost = [...displayedSmartTips]
    .filter((tip) => safeNumber(tip.confidence, 0) >= 75)
    .filter((tip) => safeNumber(tip.odd, 0) >= 1.25)
    .filter((tip) => safeNumber(tip.odd, 0) <= 2.05)
    .sort((a, b) => {
      const scoreA = safeNumber(a.confidence, 0) + safeNumber(a.qualityScore, 0) * 0.35 - safeNumber(a.odd, 0) * 2;
      const scoreB = safeNumber(b.confidence, 0) + safeNumber(b.qualityScore, 0) * 0.35 - safeNumber(b.odd, 0) * 2;
      return scoreB - scoreA;
    })
    .slice(0, 3);

  const boostOdd = premiumBoost.reduce((acc, item) => acc * safeNumber(item.odd, 1), 1);
  const boostConfidence = premiumBoost.length
    ? Math.round(premiumBoost.reduce((acc, item) => acc + safeNumber(item.confidence, 0), 0) / premiumBoost.length)
    : 0;

  return (
    <main style={styles.page}>
      <FreeLockModal
        open={freeLockOpen}
        onClose={() => setFreeLockOpen(false)}
        onUpgrade={() => (window.location.href = "/plans")}
      />
      <header style={styles.topHeader}>
        <div style={styles.brand} onClick={() => (window.location.href = "/dashboard")}>
          <img
            src="/logo-oddix-horizontal.png"
            alt="ODDIX TIPSTER IA"
            style={styles.brandLogo}
          />
        </div>

        <div style={styles.headerActions}>
          <button style={styles.headerPill}>Plano {plan}</button>
          <button style={styles.headerButton} onClick={() => openSportsButton("live")}>Ao vivo</button>
          
          
          <button style={styles.vipButton} onClick={() => (window.location.href = "/plans")}>Assinar VIP</button>
          <button style={styles.logoutButton} onClick={logout}>Sair</button>
        </div>
      </header>

      <section style={styles.sportsRail}>
        {[
          { label: "⚽ Futebol", action: "dashboard" },
          { label: "🔴 Ao Vivo", action: "live" },
          { label: "🤖 IA Premium", action: "smart" },
          { label: "🔥 Combinadas", action: "boost" },
          { label: "⚽ Player Props", action: "playerprops" },
          { label: "📈 Greens", action: "greens" },
          { label: "💰 Odds", action: "odds" },
          { label: "🏆 Brasileirão", action: "brasil" },
          { label: "🌎 Sul-Americanos", action: "sulamericanos" },
          ...(role === "ADMIN" ? [{ label: "⚙️ Admin", action: "admin" }] : []),
        ].map((item) => (
          <button
            key={item.label}
            style={styles.sportItem}
            onClick={() => {
              if (item.action === "admin") {
                window.location.href = "/admin";
                return;
              }

              openSportsButton(item.action);
            }}
          >
            {item.label}
          </button>
        ))}
      </section>

      <VipConversionBanner
        plan={plan}
        liveGames={liveGames.length}
        topTips={top5Tips.length}
        onUpgrade={() => (window.location.href = "/plans")}
      />

      {selectedMatchDetail && (
        <MatchDetailPanel
          data={{ ...selectedMatchDetail, liveTick }}
          onClose={() => setSelectedMatchDetail(null)}
          onAnalyze={(game: any) => analyzeGame(game)}
        />
      )}

      {selectedAnalysis && (
        <section style={styles.analysisPanel}>
          <div style={styles.analysisTop}>
            <div>
              <span style={styles.sectionKicker}>ANÁLISE ODDIX IA</span>
              <h2 style={styles.analysisTitle}>
                {selectedAnalysis.game.teams?.home?.name} x {selectedAnalysis.game.teams?.away?.name}
              </h2>
              <p style={styles.muted}>{selectedAnalysis.game.league?.name} • {formatDateTime(selectedAnalysis.game.fixture?.date)}</p>
            </div>
            <button style={styles.closeButton} onClick={() => setSelectedAnalysis(null)}>Fechar</button>
          </div>

          <div style={styles.analysisBody}>
            <div style={styles.matchSummary}>
              <TeamLogo game={selectedAnalysis.game} side="home" />
              <div style={styles.bigScore}>{getScore(selectedAnalysis.game).home} <span>-</span> {getScore(selectedAnalysis.game).away}</div>
              <TeamLogo game={selectedAnalysis.game} side="away" />
            </div>

            <div style={styles.pickBoxLarge}>
              <small>Entrada sugerida</small>
              <strong>{selectedAnalysis.ai.tip}</strong>
              <div style={styles.pickMetrics}>
                <span>Odd {selectedAnalysis.ai.odd}</span>
                <span>{selectedAnalysis.ai.confidence}%</span>
                <span>{selectedAnalysis.ai.risk}</span>
              </div>
            </div>
          </div>

          <p style={styles.analysisText}>{selectedAnalysis.ai.analysis}</p>

          {Array.isArray(selectedAnalysis.ai.markets) && selectedAnalysis.ai.markets.length > 0 && (
            <div style={styles.marketList}>
              {selectedAnalysis.ai.markets.slice(0, 5).map((market: any, index: number) => (
                <div key={index} style={styles.marketRow}>
                  <span>{index + 1}</span>
                  <strong>{market.tip || market.selection || market.market}</strong>
                  <small>{market.market || "Mercado"} • Odd {market.odd || "-"} • {market.confidence || selectedAnalysis.ai.confidence}%</small>
                </div>
              ))}
            </div>
          )}

          <div style={styles.analysisActions}>
            <button style={selectedAnalysis.saved ? styles.savedButton : styles.saveButton} disabled={saving || selectedAnalysis.saved} onClick={saveAnalysisToDashboard}>
              {selectedAnalysis.saved ? "✅ Já salvo" : saving ? "Salvando..." : "Salvar análise"}
            </button>
            {selectedAnalysis.savedBetId && (
              <button style={styles.secondaryButton} onClick={() => (window.location.href = `/dashboard/bet/${selectedAnalysis.savedBetId}`)}>Ver salvo</button>
            )}
          </div>
        </section>
      )}

      <section style={styles.heroGrid}>
        <div style={styles.heroMain}>
          <span style={styles.sectionKicker}>ODDIX SMART BETTING</span>
          <h1>Palpites com IA, odds e ranking de qualidade.</h1>
          <p>
            Agora o Oddix organiza os jogos como casa de aposta: destaques, ao vivo, pré-jogo, odds inteligentes e combinadas VIP.
          </p>
          <div style={styles.heroStats}>
            <InfoMetric label="Jogos" value={games.length} />
            <InfoMetric label="Ao vivo" value={liveGames.length} />
            <InfoMetric label="Tips IA" value={displayedSmartTips.length} />
            <InfoMetric label="ROI" value={`${stats?.roi ?? 0}%`} />
          </div>
        </div>

        <div style={styles.vipPanel}>
          <span>Oddix Boost</span>
          <strong>{boost.combinedOdd}</strong>
          <small>Odd combinada estimada</small>
          <div style={styles.confidenceBar}><div style={{ ...styles.confidenceFill, width: `${Math.min(100, boost.confidence)}%` }} /></div>
          <button style={styles.vipFullButton} onClick={() => setActiveTab("boost")}>Ver combinada</button>
        </div>
      </section>

      <MarketingBanner
        mainGame={topGames[0]}
        secondaryGames={topGames.slice(1, 4)}
        liveTick={liveTick}
        onAnalyze={openMatchDetail}
        onVip={() => (window.location.href = "/plans")}
      />

      <section style={{ margin: "0 26px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 18 }}>
          <Top5Tips
            tips={top5Tips}
            onOpen={(tip: any) => {
              const game = getGameByTip(tip, games);
              if (game) openMatchDetail(game);
            }}
          />

          <OddixBoostPremium
            picks={premiumBoost}
            combinedOdd={boostOdd ? boostOdd.toFixed(2) : "0.00"}
            confidence={boostConfidence}
            isPaidPlan={isPaidPlan}
            onUpgrade={() => (window.location.href = "/plans")}
            onOpen={(tip: any) => {
              const game = getGameByTip(tip, games);
              if (game) openMatchDetail(game);
            }}
          />
        </div>
      </section>

      <section style={styles.featuredStrip}>
        {topGames.slice(0, 4).map((game) => (
          <FeaturedGame key={stableGameKey(game)} game={game} liveTick={liveTick} onAnalyze={() => openMatchDetail(game)} />
        ))}
      </section>

      <section style={styles.tabsWrapper}>
        <div style={styles.tabs}>
          {[
            { key: "highlights", label: "Destaques" },
            { key: "live", label: "Ao vivo" },
            { key: "pregame", label: "Começa em breve" },
            { key: "smart", label: "IA Premium" },
            { key: "boost", label: "Combinadas" },
            { key: "playerprops", label: "Player Props" },
            { key: "greens", label: "Greens" },
          ].map((tab) => (
            <button
              key={tab.key}
              style={activeTab === tab.key ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab.key as TabKey)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.searchCard}>
            <strong>Filtros</strong>
            <input style={styles.searchInput} placeholder="Buscar time ou liga" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select style={styles.selectInput} value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}>
              <option value="all">Todas as ligas</option>
              {leagues.map((league) => <option key={league} value={league}>{league}</option>)}
            </select>
            <button style={styles.refreshButton} onClick={() => loadAll(false)}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
          </div>

          <div style={styles.sideCard}>
            <h3>Geral</h3>
            <SideLine label="Jogos" value={games.length} />
            <SideLine label="Ao vivo" value={liveGames.length} />
            <SideLine label="Pré-jogo" value={futureGames.length} />
          </div>

          <div style={styles.sideCardPurple}>
            <h3>Grupo FREE</h3>
            <p>Receba amostras e chamadas para o VIP.</p>
            <button style={styles.freeButton} onClick={() => window.open(FREE_GROUP_LINK, "_blank")}>Entrar no grupo</button>
          </div>

          <div style={styles.partnerSideCard}>
            <span style={styles.partnerSideKicker}>Parceiro Oddix</span>
            <h3>EstrelaBet</h3>
            <p>Aposte usando o link oficial da Oddix.</p>
            <button style={styles.partnerSideButton} onClick={() => window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer")}>💰 Apostar agora</button>
            <img src={LEGAL_SEAL_SMALL} alt="18+ Jogue com responsabilidade. Aposta não é investimento." style={styles.partnerSealImage} />
          </div>
        </aside>

        <section style={styles.mainContent}>
          {activeTab === "smart" && (
            <SmartTipsSection tips={displayedSmartTips} games={games} liveTick={liveTick} onAnalyze={openMatchDetail} />
          )}

          {activeTab === "boost" && (
            <BoostSection boost={boost} games={games} onAnalyze={openMatchDetail} />
          )}

          {activeTab === "playerprops" && (
            <PlayerPropsSection
              props={playerPropsTips}
              games={games}
              isPaidPlan={isPaidPlan}
              onUpgrade={() => (window.location.href = "/plans")}
              onAnalyze={openMatchDetail}
            />
          )}

          {activeTab !== "smart" && activeTab !== "boost" && activeTab !== "playerprops" && (
            <>
              <div style={styles.sectionHeader}>
                <div>
                  <h2>{getTabTitle(activeTab)}</h2>
                  <p>{filteredGames.length} jogos encontrados</p>
                </div>
              </div>

              {loading ? (
                <div style={styles.emptyBox}>Carregando jogos...</div>
              ) : filteredGames.length ? (
                <div style={styles.gamesGrid}>
                  {filteredGames.map((game) => (
                    <GameCard
                      key={stableGameKey(game)}
                      game={game}
                      liveTick={liveTick}
                      saved={isSavedGame(game)}
                      analyzing={analyzingId === game?.fixture?.id}
                      onAnalyze={() => openMatchDetail(game)}
                      onOpenSaved={() => {
                        const id = getSavedBetId(game);
                        if (id) window.location.href = `/dashboard/bet/${id}`;
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={styles.emptyBox}>Nenhum jogo encontrado.</div>
              )}
            </>
          )}
        </section>
      </section>

      <footer style={styles.footer}>
        <strong>ODDIX</strong>
        <span>IA • Odds • Pré-jogo • Ao vivo • Gestão de banca</span>
        <img src={LEGAL_SEAL_DARK} alt="18+ Jogue com responsabilidade. Aposta não é investimento." style={styles.footerLegalSeal} />
      </footer>
    </main>
  );
}

function getTabTitle(tab: TabKey) {
  const map: Record<TabKey, string> = {
    highlights: "Destaques IA",
    live: "Jogos ao vivo",
    pregame: "Começa em breve",
    smart: "IA Premium",
    boost: "Combinadas Oddix",
    playerprops: "Player Props IA",
    greens: "Finalizados / Greens",
  };
  return map[tab];
}

function InfoMetric({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.infoMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SideLine({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.sideLine}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamLogo({ game, side }: { game: any; side: "home" | "away" }) {
  const team = game?.teams?.[side] || {};
  return (
    <div style={styles.teamLogoBox}>
      <img src={team.logo || logoFallback(team.name)} style={styles.teamLogo} />
      <strong>{team.name}</strong>
    </div>
  );
}



function getStatFromApi(stats: any, teamIndex: number, labels: string[]) {
  const team = stats?.teams?.[teamIndex];

  if (!team || !Array.isArray(team.statistics)) return null;

  const found = team.statistics.find((item: any) => {
    const type = String(item?.type || item?.name || item?.label || "").toLowerCase();
    return labels.some((label) => type.includes(label.toLowerCase()));
  });

  return found?.value ?? null;
}

function getFastStats(game: any, stats: any) {
  const score = getScore(game);
  const totalGoals = safeNumber(score.home, 0) + safeNumber(score.away, 0);
  const elapsed = getLiveElapsedMinute(game);
  const quality = safeNumber(game?.oddix?.qualityScore, 0);
  const odds = getOddsOptions(game);

  return {
    cardsHome: getStatFromApi(stats, 0, ["Yellow Cards", "Cartões"]) || "-",
    cardsAway: getStatFromApi(stats, 1, ["Yellow Cards", "Cartões"]) || "-",
    shotsHome: getStatFromApi(stats, 0, ["Total Shots", "Chutes"]) || "-",
    shotsAway: getStatFromApi(stats, 1, ["Total Shots", "Chutes"]) || "-",
    shotsOnHome: getStatFromApi(stats, 0, ["Shots on Goal", "No gol"]) || "-",
    shotsOnAway: getStatFromApi(stats, 1, ["Shots on Goal", "No gol"]) || "-",
    cornersHome: getStatFromApi(stats, 0, ["Corner Kicks", "Escanteios"]) || "-",
    cornersAway: getStatFromApi(stats, 1, ["Corner Kicks", "Escanteios"]) || "-",
    possessionHome: getStatFromApi(stats, 0, ["Ball Possession", "Posse"]) || "-",
    possessionAway: getStatFromApi(stats, 1, ["Ball Possession", "Posse"]) || "-",
    totalGoals,
    elapsed,
    quality,
    oddsCount: odds.length,
  };
}


function getPlayerNameFromLineup(game: any) {
  const lineups = game?.lineups || game?.escalações || game?.escalacoes || [];

  if (Array.isArray(lineups)) {
    for (const lineup of lineups) {
      const starters = lineup?.startXI || lineup?.startXi || lineup?.titulares || lineup?.players || [];
      if (Array.isArray(starters) && starters.length) {
        const first = starters.find((item: any) => {
          const name =
            item?.player?.name ||
            item?.player?.nome ||
            item?.name ||
            item?.nome ||
            item?.athlete?.name;

          return !!name;
        });

        if (first) {
          return (
            first?.player?.name ||
            first?.player?.nome ||
            first?.name ||
            first?.nome ||
            first?.athlete?.name
          );
        }
      }
    }
  }

  const incidents = game?.incidents || game?.eventos || [];

  if (Array.isArray(incidents)) {
    const scorer = incidents.find((item: any) => {
      const type = String(item?.type || item?.tipo || "").toLowerCase();
      return type.includes("goal") || type.includes("gol");
    });

    if (scorer) {
      return scorer?.player?.name || scorer?.player?.nome || scorer?.playerName || scorer?.nome || null;
    }
  }

  return null;
}

function getPlayerPropMarkets(game: any) {
  const playerName = getPlayerNameFromLineup(game);

  if (!playerName) {
    return [
      {
        label: "Aguardando escalações para Player Props",
        odd: "Indisponível",
      },
      {
        label: "Mercados de jogador aparecem quando a API retornar odds reais",
        odd: "PRO/VIP",
      },
    ];
  }
  const quality = safeNumber(game?.oddix?.qualityScore, 70);
  const live = isGameLive(game);
  const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
  const tipOdd = quality >= 80 ? "1.75" : quality >= 70 ? "1.90" : "2.05";

  const base = [
    {
      label: `${playerName} +0.5 chute no gol`,
      odd: tipOdd,
    },
    {
      label: `${playerName} +1 finalização`,
      odd: quality >= 75 ? "1.55" : "1.70",
    },
  ];

  if (live && elapsed <= 70) {
    base.push({
      label: `${playerName} participa de gol`,
      odd: quality >= 80 ? "2.60" : "3.10",
    });
  }

  return base;
}

function buildMarketGroups(game: any) {
  const tip = smartLocalTip(game);
  const options = getOddsOptions(game);
  const home = game?.teams?.home?.name || "Casa";
  const away = game?.teams?.away?.name || "Fora";
  const quality = safeNumber(game?.oddix?.qualityScore, 70);

  const oneXtwo = options.length
    ? options.slice(0, 3).map((item: any) => ({
        label: item.name || item.nome || item.selection || "-",
        odd: item.odd || item.ímpar || "-",
      }))
    : [
        { label: home, odd: "2.05" },
        { label: "Empate", odd: "3.20" },
        { label: away, odd: "3.40" },
      ];

  return [
    {
      title: "Resultado Final",
      tag: "CA",
      markets: oneXtwo,
    },
    {
      title: "Gols",
      tag: "IA",
      markets: [
        { label: "Over 0.5 gols", odd: quality >= 75 ? "1.18" : "1.25" },
        { label: "Over 1.5 gols", odd: quality >= 75 ? "1.42" : "1.55" },
        { label: "Under 4.5 gols", odd: tip.tip.includes("Under 4.5") ? tip.odd : "1.35" },
      ],
    },
    {
      title: "Mercado Inteligente Oddix",
      tag: "VIP",
      markets: [
        { label: tip.tip, odd: tip.odd },
        { label: `Confiança ${tip.confidence}%`, odd: tip.risk },
        { label: "Score IA", odd: String(tip.qualityScore) },
      ],
    },
    {
      title: "Jogador — Chutes no Gol",
      tag: "PLAYER",
      markets: getPlayerPropMarkets(game),
    },
  ];
}

function MatchDetailPanel({
  data,
  onClose,
  onAnalyze,
}: {
  data: any;
  onClose: () => void;
  onAnalyze: (game: any) => void;
}) {
  const game = data?.game;
  const stats = data?.stats;
  const score = getScore(game);
  const fastStats = getFastStats(game, stats);
  const tip = smartLocalTip(game);
  const marketGroups = buildMarketGroups(game);

  return (
    <section style={styles.matchDetailPanel}>
      <div style={styles.matchDetailTop}>
        <button style={styles.matchBackButton} onClick={onClose}>
          ← Voltar
        </button>

        <div style={styles.matchTopTitle}>
          <strong>{game?.league?.name}</strong>
          <span>{game?.league?.country || "Oddix Arena"}</span>
        </div>

        <button style={styles.matchAnalyzeButton} onClick={() => onAnalyze(game)}>
          🤖 Análise IA
        </button>
      </div>

      <div style={styles.matchScoreHeader}>
        <div style={styles.matchTeamBig}>
          <img src={game?.teams?.home?.logo || logoFallback(game?.teams?.home?.name)} style={styles.matchTeamBigLogo} />
          <strong>{game?.teams?.home?.name}</strong>
        </div>

        <div style={styles.matchCenterBig}>
          <span style={styles.matchLivePill}>{getStatusLabel(game, data?.liveTick || 0)}</span>
          <strong>{score.home} - {score.away}</strong>
          <small>{gameTimeLabel(game, data?.liveTick || 0)}</small>
        </div>

        <div style={styles.matchTeamBig}>
          <img src={game?.teams?.away?.logo || logoFallback(game?.teams?.away?.name)} style={styles.matchTeamBigLogo} />
          <strong>{game?.teams?.away?.name}</strong>
        </div>
      </div>

      <div style={styles.matchTabs}>
        {["Jogos", "Estatísticas", "Confronto direto", "Linha do tempo", "Escalações"].map((tab, index) => (
          <button key={tab} style={index === 1 ? styles.matchTabActive : styles.matchTab}>
            {index === 0 ? "🎲" : index === 1 ? "📊" : index === 2 ? "🤝" : index === 3 ? "🎙️" : "👕"} {tab}
          </button>
        ))}
      </div>

      <div style={styles.matchBodyGrid}>
        <div style={styles.matchStatsBox}>
          <div style={styles.matchStatsHeader}>
            <strong>ESTATÍSTICAS AO VIVO</strong>
            <span>{data?.loadingStats ? "Carregando..." : stats?.available ? "Dados reais" : "Dados rápidos"}</span>
          </div>

          <StatsCompare label="Cartões" left={fastStats.cardsHome} right={fastStats.cardsAway} />
          <StatsCompare label="Chutes" left={fastStats.shotsHome} right={fastStats.shotsAway} />
          <StatsCompare label="Chutes a gol" left={fastStats.shotsOnHome} right={fastStats.shotsOnAway} />
          <StatsCompare label="Escanteios" left={fastStats.cornersHome} right={fastStats.cornersAway} />
          <StatsCompare label="Posse de bola" left={fastStats.possessionHome} right={fastStats.possessionAway} />

          <div style={styles.attackRow}>
            <div>
              <span>⚽ Gols</span>
              <strong>{fastStats.totalGoals}</strong>
            </div>
            <div>
              <span>⏱ Minuto</span>
              <strong>{gameTimeLabel(game, data?.liveTick || 0)}</strong>
            </div>
            <div>
              <span>🔥 Score IA</span>
              <strong>{fastStats.quality}</strong>
            </div>
          </div>
        </div>

        <div style={styles.matchTipBox}>
          <span style={styles.sectionKicker}>PALPITE AO VIVO</span>
          <h3>{tip.tip}</h3>
          <div style={styles.matchTipMetrics}>
            <span>Odd {tip.odd}</span>
            <span>{tip.confidence}%</span>
            <span>{tip.risk}</span>
          </div>
          <p>
            Entrada sugerida cruzando placar, minuto, qualidade do jogo, odds disponíveis, escalação e mercados de jogador quando a API retornar dados.
          </p>
          <button style={styles.vipFullButton} onClick={() => onAnalyze(game)}>
            Ver análise completa
          </button>
        </div>
      </div>

      <div style={styles.marketTabs}>
        {["Destaques", "Gols", "Jogador", "Escanteios", "1º/2º Tempo", "Apostas"].map((tab, index) => (
          <button key={tab} style={index === 0 ? styles.marketTabActive : styles.marketTab}>
            {tab}
          </button>
        ))}
      </div>

      <div style={styles.marketGroups}>
        {marketGroups.map((group) => (
          <div key={group.title} style={styles.marketGroup}>
            <div style={styles.marketGroupHead}>
              <strong>{group.title}</strong>
              <span>{group.tag}</span>
            </div>

            <div style={styles.marketButtons}>
              {group.markets.map((market: any, index: number) => (
                <button key={`${market.label}-${index}`} style={styles.marketOddButton}>
                  <span>{market.label}</span>
                  <strong>{market.odd}</strong>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsCompare({ label, left, right }: { label: string; left: any; right: any }) {
  const leftNumber = Number(String(left).replace(/[^0-9.]/g, ""));
  const rightNumber = Number(String(right).replace(/[^0-9.]/g, ""));
  const total = Number.isFinite(leftNumber + rightNumber) && leftNumber + rightNumber > 0 ? leftNumber + rightNumber : 1;
  const leftPercent = Math.min(100, Math.max(8, Math.round((leftNumber / total) * 100)));

  return (
    <div style={styles.statsCompare}>
      <strong>{left}</strong>
      <div style={styles.statsBarWrap}>
        <span>{label}</span>
        <div style={styles.statsBar}>
          <div style={{ ...styles.statsBarLeft, width: `${leftPercent}%` }} />
          <div style={{ ...styles.statsBarRight, width: `${100 - leftPercent}%` }} />
        </div>
      </div>
      <strong>{right}</strong>
    </div>
  );
}

function MarketingBanner({
  mainGame,
  secondaryGames,
  onAnalyze,
  onVip,
  liveTick = 0,
}: {
  mainGame: any;
  secondaryGames: any[];
  onAnalyze: (game: any) => void;
  onVip: () => void;
  liveTick?: number;
}) {
  const game = mainGame;
  const tip = game ? smartLocalTip(game) : null;
  const score = game ? getScore(game) : { home: "-", away: "-" };

  return (
    <section style={styles.marketingBanner}>
      <div style={styles.marketingGlow} />

      <div style={styles.marketingContent}>
        <span style={styles.marketingKicker}>🔥 ODDIX ARENA VIP</span>

        <h2 style={styles.marketingTitle}>
          Sala VIP com entradas filtradas por IA.
        </h2>

        <p style={styles.marketingText}>
          O Oddix cruza jogos ao vivo, odds, placar, tempo de jogo e qualidade da liga
          para destacar as melhores oportunidades antes do mercado mexer.
        </p>

        {game && (
          <div style={styles.marketingMatchCard}>
            <div style={styles.marketingTeam}>
              <img
                src={game?.teams?.home?.logo || logoFallback(game?.teams?.home?.name)}
                style={styles.marketingTeamLogo}
              />
              <strong>{game?.teams?.home?.name}</strong>
            </div>

            <div style={styles.marketingScoreBox}>
              <span>{isGameLive(game) ? gameTimeLabel(game, liveTick) : formatDateTime(game?.fixture?.date)}</span>
              <strong>{score.home} - {score.away}</strong>
            </div>

            <div style={styles.marketingTeam}>
              <img
                src={game?.teams?.away?.logo || logoFallback(game?.teams?.away?.name)}
                style={styles.marketingTeamLogo}
              />
              <strong>{game?.teams?.away?.name}</strong>
            </div>
          </div>
        )}

        {tip && (
          <div style={styles.marketingPick}>
            <span>Palpite IA</span>
            <strong>{tip.tip}</strong>
            <div style={styles.marketingPickMeta}>
              <small>Odd {tip.odd}</small>
              <small>{tip.confidence}% confiança</small>
              <small>{tip.risk}</small>
            </div>
          </div>
        )}

        <div style={styles.marketingActions}>
          {game && (
            <button style={styles.marketingPrimaryButton} onClick={() => onAnalyze(game)}>
              Ver análise IA
            </button>
          )}

          <button style={styles.marketingVipButton} onClick={onVip}>
            Quero ser VIP
          </button>
        </div>
      </div>

      <div style={styles.playerArea}>
        <div style={styles.playerCard}>
          <img
            src="https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=90"
            alt="Jogador de futebol"
            style={styles.playerPhoto}
          />

          <div style={styles.playerShine} />

          <div style={styles.playerOverlay}>
            <strong>ODDIX TIPSTER IA</strong>
            <span>Análise ao vivo • Odds • Gestão de banca</span>
          </div>
        </div>

        <div style={styles.miniBannerGrid}>
          {secondaryGames.map((item: any) => {
            const itemTip = smartLocalTip(item);

            return (
              <button
                key={stableGameKey(item)}
                style={styles.miniMarketingCard}
                onClick={() => onAnalyze(item)}
              >
                <div style={styles.miniTeams}>
                  <img
                    src={item?.teams?.home?.logo || logoFallback(item?.teams?.home?.name)}
                    style={styles.miniLogo}
                  />
                  <span>x</span>
                  <img
                    src={item?.teams?.away?.logo || logoFallback(item?.teams?.away?.name)}
                    style={styles.miniLogo}
                  />
                </div>
                <strong>{itemTip.tip}</strong>
                <small>{itemTip.confidence}% • Odd {itemTip.odd}</small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeaturedGame({ game, liveTick, onAnalyze }: { game: any; liveTick?: number; onAnalyze: () => void }) {
  const score = getScore(game);
  const quality = safeNumber(game?.oddix?.qualityScore, 0);
  const tip = smartLocalTip(game);

  return (
    <div style={styles.featuredCard} onClick={onAnalyze}>
      <div style={styles.featuredHeader}>
        <span>{isGameLive(game) ? `● Ao vivo ${gameTimeLabel(game, liveTick || 0)}` : formatDateTime(game?.fixture?.date)}</span>
        <small>{game?.league?.name}</small>
      </div>
      <div style={styles.featuredTeams}>
        <TeamMini team={game?.teams?.home} />
        <strong style={styles.featuredScore}>{score.home} - {score.away}</strong>
        <TeamMini team={game?.teams?.away} />
      </div>
      <div style={styles.featuredPick}>
        <span>{tip.tip}</span>
        <strong>{quality}%</strong>
      </div>
      <button style={styles.partnerMiniButton} onClick={(event) => { event.stopPropagation(); window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer"); }}>💰 Apostar na EstrelaBet</button>
    </div>
  );
}

function TeamMini({ team }: { team: any }) {
  return (
    <div style={styles.teamMini}>
      <img src={team?.logo || logoFallback(team?.name)} style={styles.teamMiniLogo} />
      <span>{team?.name}</span>
    </div>
  );
}

function GameCard({ game, liveTick = 0, saved, analyzing, onAnalyze, onOpenSaved }: any) {
  const score = getScore(game);
  const quality = safeNumber(game?.oddix?.qualityScore, 0);
  const tip = smartLocalTip(game);
  const live = isGameLive(game);

  return (
    <article style={live ? styles.gameCardLive : styles.gameCard} onClick={onAnalyze}>
      <div style={styles.cardTop}>
        <span style={live ? styles.liveBadge : styles.statusBadge}>{getStatusLabel(game, liveTick)}</span>
        <span style={styles.qualityBadge}>{qualityBadge(quality)} {quality}</span>
      </div>

      <div style={styles.leagueLine}>
        <img src={game?.league?.logo || logoFallback(game?.league?.name, "7c3aed", "ffffff")} style={styles.leagueLogo} />
        <span>{game?.league?.name}</span>
      </div>

      <div style={styles.matchLine}>
        <TeamMini team={game?.teams?.home} />
        <div style={styles.scoreBox}>{score.home}<span>-</span>{score.away}</div>
        <TeamMini team={game?.teams?.away} />
      </div>

      <div style={styles.pickBox}>
        <small>Palpite IA</small>
        <strong>{tip.tip}</strong>
        <div style={styles.pickMetrics}>
          <span>Odd {tip.odd}</span>
          <span>{tip.confidence}%</span>
          <span>{tip.risk}</span>
        </div>
      </div>

      <div style={styles.cardActions}>
        {saved ? (
          <button style={styles.savedSmallButton} onClick={(event) => { event.stopPropagation(); onOpenSaved(); }}>✅ Ver salvo</button>
        ) : (
          <button style={styles.analyzeButton} onClick={(event) => { event.stopPropagation(); onAnalyze(); }}>{analyzing ? "Abrindo..." : "Ver jogo"}</button>
        )}
        <button style={styles.betNowButton} onClick={(event) => { event.stopPropagation(); window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer"); }}>💰 Apostar agora</button>
      </div>
    </article>
  );
}

function SmartTipsSection({ tips, games, liveTick = 0, onAnalyze }: any) {
  const liveGames = games.filter(isGameLive).slice(0, 6);

  return (
    <section>
      <div style={styles.sectionHeader}>
        <div>
          <h2>IA Premium com Odds</h2>
          <p>Ao clicar em IA Premium, veja primeiro os jogos ao vivo com estatísticas rápidas e depois as entradas ranqueadas.</p>
        </div>
      </div>

      {liveGames.length > 0 && (
        <div style={styles.liveStatsGrid}>
          {liveGames.map((game: any) => {
            const score = getScore(game);
            const tip = smartLocalTip(game);
            const elapsed = safeNumber(game?.fixture?.status?.elapsed, 0);
            const totalGoals = safeNumber(score.home, 0) + safeNumber(score.away, 0);
            const quality = safeNumber(game?.oddix?.qualityScore, 0);
            const odds = getOddsOptions(game);

            return (
              <button
                key={stableGameKey(game)}
                style={styles.liveStatsCard}
                onClick={() => onAnalyze(game, tip)}
              >
                <div style={styles.liveStatsTop}>
                  <span style={styles.livePulse}>● Ao vivo {gameTimeLabel(game, liveTick)}</span>
                  <strong>{qualityBadge(quality)} {quality}</strong>
                </div>

                <div style={styles.liveStatsTeams}>
                  <TeamMini team={game?.teams?.home} />
                  <div style={styles.liveStatsScore}>{score.home} - {score.away}</div>
                  <TeamMini team={game?.teams?.away} />
                </div>

                <div style={styles.liveStatsNumbers}>
                  <span>Gols: {totalGoals}</span>
                  <span>Odds: {odds.length || 0}</span>
                  <span>Mercado: {tip.market}</span>
                </div>

                <div style={styles.liveStatsPick}>
                  <small>Palpite ao vivo</small>
                  <strong>{tip.tip}</strong>
                  <span>Odd {tip.odd} • {tip.confidence}% • {tip.risk}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div style={styles.smartList}>
        {tips.slice(0, 12).map((tip: any, index: number) => {
          const game = getGameByTip(tip, games);
          return (
            <div key={`${tip.fixtureId || index}-${tip.tip}`} style={styles.smartRow}>
              <span style={styles.smartRank}>{index + 1}</span>
              <div style={styles.smartInfo}>
                <strong>{tip.game}</strong>
                <small>{tip.league}</small>
              </div>
              <div style={styles.smartPick}>
                <strong>{tip.tip}</strong>
                <small>{tip.market}</small>
              </div>
              <div style={styles.smartNumbers}>
                <span>Odd {tip.odd}</span>
                <span>{tip.confidence}%</span>
                <span>{tip.risk}</span>
              </div>
              <button style={styles.rowButton} onClick={() => game && onAnalyze(game, tip)}>Analisar</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}



function playerNameFromProp(prop: any) {
  const explicit =
    prop?.player ||
    prop?.playerName ||
    prop?.athlete ||
    prop?.name ||
    prop?.raw?.player ||
    prop?.raw?.playerName ||
    "";

  if (explicit) return String(explicit);

  const tip = String(prop?.tip || prop?.selection || prop?.market || "");
  const cleaned = tip
    .replace(/\b(mais de|menos de|over|under)\b/gi, "")
    .replace(/\d+([.,]\d+)?/g, "")
    .replace(/\b(chutes no gol|chutes|finalizações|finalizacoes|assistências|assistencias|gol a qualquer momento|sot|shots on target|shots)\b/gi, "")
    .replace(/[+:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 3) return "Jogador Oddix";
  return cleaned.split(" ").slice(0, 3).join(" ");
}

function playerPhotoFromProp(prop: any) {
  const photo =
    prop?.playerPhoto ||
    prop?.photo ||
    prop?.image ||
    prop?.avatar ||
    prop?.raw?.playerPhoto ||
    prop?.raw?.photo ||
    prop?.raw?.image ||
    "";

  if (photo) return photo;

  const name = playerNameFromProp(prop);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4c1d95&color=facc15&bold=true&size=256`;
}

function playerPropType(prop: any) {
  const text = String(`${prop?.market || ""} ${prop?.marketName || ""} ${prop?.tip || ""}`).toLowerCase();

  if (text.includes("chute no gol") || text.includes("shots on target") || text.includes("sot")) return "Chutes no Gol";
  if (text.includes("finaliza") || text.includes("shots") || text.includes("chutes")) return "Finalizações";
  if (text.includes("assist")) return "Assistência";
  if (text.includes("gol")) return "Gol";
  return "Player Prop";
}

function playerPropLine(prop: any) {
  const tip = String(prop?.tip || prop?.selection || prop?.market || "").trim();

  if (!tip) return "Mercado de jogador";

  return tip
    .replace(playerNameFromProp(prop), "")
    .replace(/\s+/g, " ")
    .trim() || tip;
}

function PlayerPropsSection({ props, games, isPaidPlan, onUpgrade, onAnalyze }: any) {
  const safeProps = Array.isArray(props) ? props : [];

  return (
    <section>
      <div style={styles.playerPropsHero}>
        <div>
          <span style={styles.sectionKicker}>PLAYER PROPS IA</span>
          <h2>Cards de jogador com mercado real</h2>
          <p>
            Chutes no gol, finalizações, assistência e gol. A Oddix só destaca
            jogador quando encontra linha real de odds ou escalação confiável no jogo.
          </p>
        </div>

        {!isPaidPlan && (
          <button style={styles.vipFullButton} onClick={onUpgrade}>
            🔒 Liberar PRO/VIP
          </button>
        )}
      </div>

      {safeProps.length ? (
        <div style={styles.playerPropsGrid}>
          {safeProps.map((prop: any, index: number) => {
            const game = getGameByTip(prop, games);
            const playerName = playerNameFromProp(prop);
            const playerPhoto = playerPhotoFromProp(prop);
            const type = playerPropType(prop);
            const line = playerPropLine(prop);

            return (
              <article key={`${prop.fixtureId || index}-${prop.tip || prop.selection}`} style={styles.playerPropCard}>
                <div style={styles.playerPropTop}>
                  <div style={styles.playerPhotoWrap}>
                    <img
                      src={playerPhoto}
                      alt={playerName}
                      style={styles.playerPhoto}
                      onError={(event) => {
                        event.currentTarget.src = logoFallback(playerName, "4c1d95", "facc15");
                      }}
                    />
                  </div>

                  <div style={styles.playerPropBadge}>
                    <span>#{index + 1}</span>
                    <strong>{prop.confidence || "-"}%</strong>
                  </div>
                </div>

                <div style={styles.playerPropBody}>
                  <span style={styles.playerPropType}>{type}</span>
                  <h3>{playerName}</h3>

                  <div style={styles.playerPropGame}>
                    <strong>{prop.game || game ? `${game?.teams?.home?.name || prop.homeTeam || ""} x ${game?.teams?.away?.name || prop.awayTeam || ""}` : "Jogo Oddix"}</strong>
                    <small>{prop.league || game?.league?.name || prop.bookmaker || "Mercado real"}</small>
                  </div>

                  <div style={styles.playerPropPick}>
                    <span>Entrada</span>
                    <strong>{line}</strong>
                  </div>

                  <div style={styles.playerPropMetrics}>
                    <div>
                      <span>Odd</span>
                      <strong>{prop.odd || "-"}</strong>
                    </div>
                    <div>
                      <span>Risco</span>
                      <strong>{prop.risk || "Médio"}</strong>
                    </div>
                  </div>

                  <button
                    style={isPaidPlan ? styles.playerPropButton : styles.playerPropLockButton}
                    onClick={() => {
                      if (!isPaidPlan) {
                        onUpgrade();
                        return;
                      }

                      if (game) onAnalyze(game);
                    }}
                  >
                    {isPaidPlan ? "Ver análise do jogo" : "🔒 Liberar análise"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div style={styles.playerPropsEmpty}>
          <div style={styles.playerPropsEmptyIcon}>⚽</div>
          <h3>Player Props aguardando odds reais</h3>
          <p>
            Quando a Odds API retornar mercados reais ou quando houver escalação confiável,
            os cards de jogador aparecem aqui com foto, linha, odd e análise.
          </p>
        </div>
      )}
    </section>
  );
}

function BoostSection({ boost, games, onAnalyze }: any) {
  const picks = boost?.picks || [];
  const stake = 10;
  const possibleReturn = safeNumber(boost?.combinedOdd, 0) * stake;

  return (
    <section>
      <div style={styles.betSlipShell}>
        <div style={styles.betSlipTopGlow} />

        <div style={styles.betSlipHeader}>
          <div>
            <span style={styles.betSlipKicker}>ODDIX BOOST VIP</span>
            <h2 style={styles.betSlipTitle}>Bilhete automático</h2>
            <p style={styles.betSlipSubtitle}>Múltipla montada com até 3 entradas de maior confiança.</p>
          </div>

          <div style={styles.betSlipStatusBox}>
            <span>Bilhete</span>
            <strong>Aberto</strong>
          </div>
        </div>

        <div style={styles.betSlipDivider}>
          <span />
          <small>COMBINADA ODDIX</small>
          <span />
        </div>

        <div style={styles.betSlipSelections}>
          {picks.map((pick: any, index: number) => {
            const game = getGameByTip(pick, games);
            const odd = safeNumber(pick.odd, 1).toFixed(2);
            const confidence = safeNumber(pick.confidence, 0);
            const risk = pick.risk || "Médio";

            return (
              <article key={`${pick.fixtureId || index}-${pick.tip}`} style={styles.betSlipRow}>
                <div style={styles.betSlipRowLeft}>
                  <div style={styles.betSlipPickNumber}>{index + 1}</div>
                  <div>
                    <div style={styles.betSlipGame}>{pick.game}</div>
                    <div style={styles.betSlipLeague}>{pick.league || "Oddix IA"}</div>
                  </div>
                </div>

                <div style={styles.betSlipMarketBox}>
                  <span>{pick.market || "Mercado IA"}</span>
                  <strong>{pick.tip}</strong>
                </div>

                <div style={styles.betSlipOddBox}>
                  <span>ODD</span>
                  <strong>{odd}</strong>
                </div>

                <div style={styles.betSlipMetaRow}>
                  <span>Confiança {confidence}%</span>
                  <span>Risco {risk}</span>
                  <button style={styles.betSlipMiniButton} onClick={() => game && onAnalyze(game, pick)}>
                    Análise
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div style={styles.betSlipTotals}>
          <div style={styles.betSlipTotalLine}>
            <span>Entradas</span>
            <strong>{picks.length}</strong>
          </div>
          <div style={styles.betSlipTotalLine}>
            <span>Odd combinada</span>
            <strong>{boost.combinedOdd}</strong>
          </div>
          <div style={styles.betSlipTotalLine}>
            <span>Confiança média</span>
            <strong>{boost.confidence}%</strong>
          </div>
          <div style={styles.betSlipTotalLine}>
            <span>Simulação R$ {stake.toFixed(2).replace('.', ',')}</span>
            <strong>R$ {possibleReturn.toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>

        <button style={styles.betSlipMainButton} onClick={() => window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer")}>
          💰 Apostar bilhete na EstrelaBet
        </button>

        <p style={styles.betSlipWarning}>Jogue com responsabilidade. Apostas envolvem risco e não garantem retorno.</p>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {

  partnerMiniButton: {
    marginTop: 12,
    width: "100%",
    border: 0,
    borderRadius: 999,
    padding: "11px 14px",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(250,204,21,.22)",
  },
  betNowButton: {
    border: 0,
    borderRadius: 999,
    padding: "11px 14px",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(250,204,21,.22)",
  },
  boostActionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 12,
  },
  rowBetButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
  },

  playerPropsHero: {
    background: "linear-gradient(135deg,#111827,#4c1d95,#7c3aed)",
    color: "white",
    borderRadius: 30,
    padding: 24,
    marginBottom: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    boxShadow: "0 18px 45px rgba(76,29,149,.20)",
    border: "1px solid rgba(255,255,255,.14)",
  },
  playerPropsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
    gap: 18,
  },
  playerPropCard: {
    overflow: "hidden",
    background: "linear-gradient(180deg,#111827,#1f123d)",
    color: "white",
    borderRadius: 28,
    border: "1px solid rgba(250,204,21,.24)",
    boxShadow: "0 18px 45px rgba(0,0,0,.22)",
  },
  playerPropTop: {
    position: "relative",
    height: 210,
    background: "radial-gradient(circle at 50% 15%,rgba(250,204,21,.34),rgba(124,58,237,.20),rgba(0,0,0,.20))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  playerPhotoWrap: {
    width: 172,
    height: 172,
    borderRadius: "50%",
    padding: 6,
    background: "linear-gradient(135deg,#facc15,#7c3aed)",
    boxShadow: "0 20px 45px rgba(0,0,0,.35)",
  },
  playerPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    background: "#111827",
    border: "4px solid rgba(255,255,255,.20)",
  },
  playerPropBadge: {
    position: "absolute",
    right: 14,
    top: 14,
    background: "rgba(0,0,0,.58)",
    border: "1px solid rgba(250,204,21,.28)",
    borderRadius: 18,
    padding: "9px 11px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    alignItems: "center",
    color: "#facc15",
    fontWeight: 900,
  },
  playerPropBody: {
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  playerPropType: {
    alignSelf: "flex-start",
    background: "rgba(250,204,21,.16)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,.26)",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: .5,
  },
  playerPropGame: {
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  playerPropPick: {
    background: "rgba(0,0,0,.34)",
    border: "1px solid rgba(250,204,21,.20)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  playerPropMetrics: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  playerPropButton: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 15,
    padding: "13px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  playerPropLockButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 15,
    padding: "13px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  playerPropsEmpty: {
    background: "white",
    color: "#111827",
    borderRadius: 28,
    padding: 26,
    textAlign: "center",
    border: "1px solid #ede9fe",
  },
  playerPropsEmptyIcon: {
    width: 70,
    height: 70,
    margin: "0 auto 12px",
    borderRadius: 22,
    background: "linear-gradient(135deg,#7c3aed,#facc15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
  },

  page: {
    minHeight: "100vh",
    color: "#111827",
    background: "#f5f3ff",
    fontFamily: "Arial, sans-serif",
  },
  topHeader: {
    background: "linear-gradient(135deg,#5b21b6,#8b5cf6,#a855f7)",
    color: "white",
    padding: "14px 26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    position: "sticky",
    top: 0,
    zIndex: 20,
    boxShadow: "0 12px 35px rgba(76,29,149,.28)",
  },
  brand: {
    width: 430,
    minWidth: 430,
    height: 104,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.20)",
    borderRadius: 28,
    padding: "10px 22px",
    boxShadow: "0 14px 34px rgba(0,0,0,.22)",
  },
  brandLogo: {
    width: "100%",
    height: 88,
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
    filter: "drop-shadow(0 0 16px rgba(0,0,0,.70))",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  headerPill: {
    background: "rgba(255,255,255,.18)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.2)",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 800,
  },
  headerButton: {
    background: "rgba(255,255,255,.12)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  adminButton: {
    background: "#111827",
    color: "#fff",
    border: 0,
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  vipButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 999,
    padding: "11px 18px",
    cursor: "pointer",
    fontWeight: 900,
  },
  logoutButton: {
    background: "transparent",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.35)",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  sportsRail: {
    background: "linear-gradient(135deg,#6d28d9,#9333ea)",
    padding: "14px 26px 24px",
    display: "flex",
    gap: 12,
    overflowX: "auto",
  },
  sportItem: {
    minWidth: 118,
    height: 68,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,.24)",
    background: "rgba(255,255,255,.13)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 10px 24px rgba(76,29,149,.20)",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    gap: 18,
    margin: "24px 26px 18px",
  },
  heroMain: {
    background: "white",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 18px 45px rgba(17,24,39,.09)",
  },
  sectionKicker: {
    color: "#7c3aed",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: 12,
    marginTop: 18,
  },
  infoMetric: {
    background: "#f5f3ff",
    border: "1px solid #ede9fe",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  vipPanel: {
    background: "linear-gradient(145deg,#111827,#4c1d95)",
    color: "white",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 45px rgba(76,29,149,.28)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    justifyContent: "center",
  },
  confidenceBar: {
    height: 10,
    background: "rgba(255,255,255,.12)",
    borderRadius: 999,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    background: "linear-gradient(90deg,#22c55e,#facc15)",
  },
  vipFullButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 10,
  },
  matchDetailPanel: {
    margin: "22px 26px",
    background: "white",
    borderRadius: 28,
    overflow: "hidden",
    boxShadow: "0 24px 70px rgba(17,24,39,.16)",
    border: "1px solid #ede9fe",
  },
  matchDetailTop: {
    background: "linear-gradient(135deg,#5b21b6,#8b5cf6,#a855f7)",
    color: "white",
    padding: "18px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  matchBackButton: {
    background: "rgba(255,255,255,.14)",
    color: "white",
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  matchTopTitle: {
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
    gap: 3,
  },
  matchAnalyzeButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  matchScoreHeader: {
    background: "linear-gradient(135deg,#6d28d9,#9333ea)",
    color: "white",
    padding: "26px 22px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 18,
  },
  matchTeamBig: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    fontSize: 18,
    fontWeight: 900,
  },
  matchTeamBigLogo: {
    width: 58,
    height: 58,
    objectFit: "contain",
    background: "rgba(255,255,255,.14)",
    borderRadius: 18,
    padding: 8,
  },
  matchCenterBig: {
    minWidth: 170,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
  },
  matchLivePill: {
    background: "rgba(255,255,255,.90)",
    color: "#047857",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 900,
  },
  matchTabs: {
    display: "flex",
    gap: 8,
    padding: "12px 22px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    overflowX: "auto",
  },
  matchTab: {
    background: "transparent",
    color: "#6b7280",
    border: 0,
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 800,
  },
  matchTabActive: {
    background: "#ecfdf5",
    color: "#059669",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 900,
  },
  matchBodyGrid: {
    display: "grid",
    gridTemplateColumns: "1.3fr .7fr",
    gap: 18,
    padding: 22,
  },
  matchStatsBox: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 18,
  },
  matchStatsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 18,
    color: "#6b7280",
    fontSize: 12,
  },
  statsCompare: {
    display: "grid",
    gridTemplateColumns: "54px 1fr 54px",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  statsBarWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: 800,
  },
  statsBar: {
    height: 5,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    display: "flex",
  },
  statsBarLeft: {
    height: "100%",
    background: "#111827",
  },
  statsBarRight: {
    height: "100%",
    background: "#ef4444",
  },
  attackRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 10,
    marginTop: 18,
  },
  matchTipBox: {
    background: "linear-gradient(145deg,#111827,#4c1d95)",
    color: "white",
    borderRadius: 22,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  matchTipMetrics: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  marketTabs: {
    display: "flex",
    gap: 8,
    padding: "0 22px 14px",
    overflowX: "auto",
  },
  marketTab: {
    background: "transparent",
    border: 0,
    color: "#64748b",
    padding: "11px 16px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  marketTabActive: {
    background: "#ede9fe",
    border: 0,
    color: "#7c3aed",
    padding: "11px 16px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  marketGroups: {
    padding: "0 22px 24px",
    display: "grid",
    gap: 14,
  },
  marketGroup: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    overflow: "hidden",
  },
  marketGroupHead: {
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  marketButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 8,
    padding: 12,
  },
  marketOddButton: {
    background: "#e5e7eb",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    alignItems: "center",
    fontWeight: 900,
  },
  marketingBanner: {
    position: "relative",
    margin: "0 26px 20px",
    minHeight: 360,
    borderRadius: 30,
    overflow: "hidden",
    color: "white",
    background:
      "linear-gradient(120deg,rgba(17,24,39,.98),rgba(76,29,149,.96),rgba(124,58,237,.88)), url('https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1800&q=90')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    boxShadow: "0 22px 65px rgba(76,29,149,.30)",
    display: "grid",
    gridTemplateColumns: "1.15fr .85fr",
    gap: 22,
    padding: 28,
  },
  marketingGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 18% 15%, rgba(250,204,21,.26), transparent 28%), radial-gradient(circle at 78% 20%, rgba(34,197,94,.22), transparent 30%), radial-gradient(circle at 45% 90%, rgba(168,85,247,.36), transparent 36%)",
    pointerEvents: "none",
  },
  marketingContent: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 14,
  },
  marketingKicker: {
    width: "fit-content",
    background: "rgba(250,204,21,.18)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,.36)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
  },
  marketingTitle: {
    margin: 0,
    maxWidth: 720,
    fontSize: 39,
    lineHeight: 1.07,
    letterSpacing: -1,
  },
  marketingText: {
    maxWidth: 660,
    margin: 0,
    color: "#ddd6fe",
    fontSize: 16,
    lineHeight: 1.55,
  },
  marketingMatchCard: {
    maxWidth: 680,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 14,
    background: "rgba(255,255,255,.11)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 22,
    padding: 16,
    backdropFilter: "blur(10px)",
  },
  marketingTeam: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  marketingTeamLogo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    flexShrink: 0,
  },
  marketingScoreBox: {
    minWidth: 120,
    background: "#0f172a",
    borderRadius: 18,
    padding: "10px 14px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,.14)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  marketingPick: {
    maxWidth: 680,
    background: "linear-gradient(135deg,rgba(34,197,94,.20),rgba(250,204,21,.16))",
    border: "1px solid rgba(34,197,94,.28)",
    borderRadius: 22,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  marketingPickMeta: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#dcfce7",
    fontWeight: 800,
  },
  marketingActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 4,
  },
  marketingPrimaryButton: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 16,
    padding: "14px 18px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(34,197,94,.30)",
  },
  marketingVipButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 16,
    padding: "14px 18px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(250,204,21,.25)",
  },
  playerArea: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    minWidth: 0,
  },
  playerCard: {
    minHeight: 260,
    borderRadius: 26,
    overflow: "hidden",
    position: "relative",
    background: "#111827",
    border: "1px solid rgba(255,255,255,.18)",
    boxShadow: "0 18px 42px rgba(0,0,0,.32)",
  },
  playerImage: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.52)), url('https://images.unsplash.com/photo-1534474491051-94d140b820e8?auto=format&fit=crop&w=1000&q=90')",
    backgroundSize: "cover",
    backgroundPosition: "center top",
    transform: "scale(1.05)",
  },
  playerShine: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg,rgba(17,24,39,.20),rgba(76,29,149,.10),rgba(0,0,0,.65)), radial-gradient(circle at 25% 15%, rgba(250,204,21,.20), transparent 32%)",
    pointerEvents: "none",
  },
  playerOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    background: "rgba(0,0,0,.56)",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    backdropFilter: "blur(10px)",
  },
  miniBannerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 10,
  },
  miniMarketingCard: {
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.10)",
    color: "white",
    borderRadius: 20,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 116,
    backdropFilter: "blur(10px)",
  },
  miniTeams: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  miniLogo: {
    width: 28,
    height: 28,
    objectFit: "contain",
  },
  featuredStrip: {
    margin: "0 26px 20px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 14,
  },
  featuredCard: {
    minHeight: 165,
    background: "linear-gradient(135deg,#2e1065,#7c3aed)",
    borderRadius: 24,
    padding: 16,
    color: "white",
    cursor: "pointer",
    boxShadow: "0 16px 35px rgba(76,29,149,.25)",
  },
  featuredHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    opacity: 0.9,
  },
  featuredTeams: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
  },
  featuredScore: {
    background: "rgba(255,255,255,.16)",
    borderRadius: 14,
    padding: "8px 12px",
  },
  featuredPick: {
    marginTop: 14,
    background: "rgba(255,255,255,.14)",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  },
  teamMini: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },
  teamMiniLogo: {
    width: 28,
    height: 28,
    objectFit: "contain",
    flexShrink: 0,
  },
  tabsWrapper: {
    margin: "0 26px 18px",
    background: "white",
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(17,24,39,.06)",
    overflowX: "auto",
  },
  tabs: {
    display: "flex",
    gap: 8,
    padding: 8,
    minWidth: 680,
  },
  tab: {
    background: "transparent",
    border: 0,
    padding: "13px 18px",
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: 800,
    color: "#6b7280",
  },
  tabActive: {
    background: "#7c3aed",
    color: "white",
    border: 0,
    padding: "13px 18px",
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: 900,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: 18,
    margin: "0 26px 28px",
    alignItems: "start",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  searchCard: {
    background: "white",
    borderRadius: 22,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 12px 30px rgba(17,24,39,.07)",
  },
  searchInput: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "12px 14px",
    outline: "none",
  },
  selectInput: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "12px 14px",
    outline: "none",
    background: "white",
  },
  refreshButton: {
    background: "#111827",
    color: "white",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  sideCard: {
    background: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 12px 30px rgba(17,24,39,.07)",
  },
  sideCardPurple: {
    background: "linear-gradient(145deg,#7c3aed,#4c1d95)",
    color: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 12px 30px rgba(76,29,149,.2)",
  },
  sideLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    borderBottom: "1px solid #f3f4f6",
    padding: "9px 0",
  },
  freeButton: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  mainContent: {
    minWidth: 0,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  gamesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(295px,1fr))",
    gap: 14,
  },
  gameCard: {
    background: "white",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 12px 30px rgba(17,24,39,.07)",
    border: "1px solid #f3f4f6",
  },
  gameCardLive: {
    background: "white",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 12px 30px rgba(239,68,68,.13)",
    border: "1px solid rgba(239,68,68,.35)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  liveBadge: {
    background: "#dc2626",
    color: "white",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 900,
    minWidth: 92,
    textAlign: "center",
  },
  statusBadge: {
    background: "#ede9fe",
    color: "#6d28d9",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  qualityBadge: {
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  leagueLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#6b7280",
    fontSize: 13,
    minHeight: 30,
  },
  leagueLogo: {
    width: 22,
    height: 22,
    objectFit: "contain",
  },
  matchLine: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
    margin: "16px 0",
  },
  scoreBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#111827",
    color: "white",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900,
  },
  pickBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 13,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  pickBoxLarge: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },
  pickMetrics: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  cardActions: {
    marginTop: 13,
    display: "flex",
    gap: 8,
  },
  analyzeButton: {
    width: "100%",
    background: "#7c3aed",
    color: "white",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  savedSmallButton: {
    width: "100%",
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  liveStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))",
    gap: 14,
    marginBottom: 18,
  },
  liveStatsCard: {
    background: "linear-gradient(145deg,#111827,#312e81,#581c87)",
    color: "white",
    border: "1px solid rgba(239,68,68,.38)",
    borderRadius: 24,
    padding: 16,
    cursor: "pointer",
    boxShadow: "0 16px 35px rgba(76,29,149,.18)",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  liveStatsTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  livePulse: {
    background: "#dc2626",
    color: "white",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  liveStatsTeams: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
  },
  liveStatsScore: {
    background: "#020617",
    color: "white",
    borderRadius: 16,
    padding: "11px 14px",
    fontWeight: 900,
    fontSize: 18,
  },
  liveStatsNumbers: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
  },
  liveStatsPick: {
    background: "rgba(255,255,255,.11)",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 18,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  smartList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  smartRow: {
    background: "white",
    borderRadius: 20,
    padding: 14,
    display: "grid",
    gridTemplateColumns: "42px 1.4fr 1.2fr 1fr auto",
    gap: 12,
    alignItems: "center",
    boxShadow: "0 10px 28px rgba(17,24,39,.06)",
  },
  smartRank: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "#7c3aed",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },
  smartInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  smartPick: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  smartNumbers: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    color: "#4b5563",
    fontWeight: 800,
  },
  rowButton: {
    background: "#111827",
    color: "white",
    border: 0,
    borderRadius: 12,
    padding: "10px 13px",
    cursor: "pointer",
    fontWeight: 800,
  },
  betSlipShell: {
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(180deg,#ffffff,#f8fafc)",
    borderRadius: 28,
    padding: 0,
    border: "1px solid #e5e7eb",
    boxShadow: "0 24px 70px rgba(17,24,39,.14)",
  },
  betSlipTopGlow: {
    height: 8,
    background: "linear-gradient(90deg,#7c3aed,#facc15,#fb923c)",
  },
  betSlipHeader: {
    padding: "22px 24px 18px",
    background: "linear-gradient(135deg,#111827,#32106d,#5b21b6)",
    color: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  betSlipKicker: {
    display: "inline-flex",
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: 950,
    color: "#facc15",
  },
  betSlipTitle: {
    margin: "7px 0 5px",
    fontSize: 28,
    lineHeight: 1,
  },
  betSlipSubtitle: {
    margin: 0,
    color: "rgba(255,255,255,.78)",
    fontWeight: 700,
  },
  betSlipStatusBox: {
    minWidth: 132,
    background: "rgba(255,255,255,.13)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 18,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  betSlipDivider: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 12,
    padding: "14px 24px",
    color: "#6b7280",
    fontWeight: 950,
    letterSpacing: 1.4,
    fontSize: 11,
  },
  betSlipSelections: {
    padding: "0 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  betSlipRow: {
    position: "relative",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "1.1fr 1.2fr 96px",
    gap: 14,
    alignItems: "center",
    boxShadow: "0 12px 28px rgba(17,24,39,.06)",
  },
  betSlipRowLeft: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    minWidth: 0,
  },
  betSlipPickNumber: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "#7c3aed",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    flexShrink: 0,
  },
  betSlipGame: {
    fontWeight: 950,
    color: "#111827",
  },
  betSlipLeague: {
    marginTop: 3,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 800,
  },
  betSlipMarketBox: {
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 16,
    padding: "11px 13px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  betSlipOddBox: {
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    borderRadius: 16,
    padding: "11px 12px",
    textAlign: "center",
    boxShadow: "0 12px 24px rgba(251,146,60,.18)",
  },
  betSlipMetaRow: {
    gridColumn: "1 / -1",
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    borderTop: "1px solid #f1f5f9",
    paddingTop: 12,
  },
  betSlipMiniButton: {
    marginLeft: "auto",
    border: 0,
    background: "#111827",
    color: "white",
    borderRadius: 12,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  betSlipTotals: {
    margin: "0 18px 14px",
    background: "#0f172a",
    color: "white",
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 12,
  },
  betSlipTotalLine: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  betSlipMainButton: {
    margin: "0 18px 12px",
    width: "calc(100% - 36px)",
    border: 0,
    borderRadius: 18,
    padding: "15px 18px",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 16px 30px rgba(251,146,60,.2)",
  },
  betSlipWarning: {
    margin: "0 18px 18px",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  analysisPanel: {
    margin: "22px 26px",
    background: "white",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 20px 55px rgba(17,24,39,.14)",
    border: "1px solid #ede9fe",
  },
  analysisTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
  },
  analysisTitle: {
    margin: "8px 0 4px",
    fontSize: 28,
  },
  muted: {
    color: "#6b7280",
  },
  closeButton: {
    background: "#fee2e2",
    color: "#991b1b",
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  analysisBody: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginTop: 18,
  },
  matchSummary: {
    background: "#f5f3ff",
    borderRadius: 20,
    padding: 18,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 12,
  },
  teamLogoBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 8,
  },
  teamLogo: {
    width: 58,
    height: 58,
    objectFit: "contain",
  },
  bigScore: {
    fontSize: 34,
    fontWeight: 900,
    color: "#4c1d95",
  },
  analysisText: {
    background: "#f8fafc",
    borderRadius: 18,
    padding: 16,
    color: "#374151",
    lineHeight: 1.55,
  },
  marketList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 10,
  },
  marketRow: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  analysisActions: {
    display: "flex",
    gap: 10,
    marginTop: 16,
  },
  saveButton: {
    background: "#22c55e",
    color: "#052e16",
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  savedButton: {
    background: "#facc15",
    color: "#111827",
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "not-allowed",
  },
  secondaryButton: {
    background: "#111827",
    color: "white",
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  emptyBox: {
    background: "white",
    borderRadius: 22,
    padding: 30,
    textAlign: "center",
    color: "#6b7280",
    boxShadow: "0 12px 30px rgba(17,24,39,.07)",
  },
  footer: {
    margin: "26px",
    padding: "18px 0 30px",
    display: "flex",
    gap: 12,
    color: "#6b7280",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  partnerSideCard: {
    background: "linear-gradient(145deg,#07142f,#111827)",
    border: "1px solid rgba(59,130,246,.28)",
    borderRadius: 22,
    padding: 18,
    color: "#fff",
    boxShadow: "0 16px 35px rgba(17,24,39,.18)",
  },
  partnerSideKicker: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  partnerSideButton: {
    width: "100%",
    marginTop: 10,
    marginBottom: 12,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 950,
    cursor: "pointer",
  },
  partnerSealImage: {
    width: "100%",
    height: "auto",
    display: "block",
    borderRadius: 12,
    background: "rgba(255,255,255,.04)",
  },
  footerLegalSeal: {
    width: 260,
    maxWidth: "42vw",
    height: "auto",
    display: "block",
    marginTop: 0,
    marginLeft: "auto",
    opacity: .95,
  },

};
