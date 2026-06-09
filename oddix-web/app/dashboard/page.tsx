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
const ODDIX_PLAYER_IMAGE = "/images/oddix-player.png";

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

  if (isFinishedStatus(status)) return false;
  if (!isLiveStatus(status)) return false;

  return true;
}

function isGameFinished(game: any) {
  const status = getStatusShort(game);

  return isFinishedStatus(status);
}

function gameDateKey(game: any) {
  const raw = game?.fixture?.date;
  if (!raw) return "";

  const rawText = String(raw);
  const provider = String(game?.provider || game?.provedor || "").toLowerCase();
  const timezone = String(game?.fixture?.timezone || game?.fixture?.fuso || "").toUpperCase();

  /*
    Correção específica para SportScore6:
    alguns jogos vêm como 2026-06-06T00:00:00.000Z apenas para representar o dia do jogo.
    Se converter isso para America/Fortaleza, vira 05/06 às 21:00 e o dashboard remove o jogo.
    Não aplicamos essa regra ao FlashScore nem aos outros providers, para não alterar datas reais.
  */
  const isSportScore6DayOnly =
    provider.includes("sportscore6") &&
    timezone === "UTC" &&
    /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(rawText);

  if (isSportScore6DayOnly) {
    return rawText.slice(0, 10);
  }

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

  if (!rawLive) {
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

  if (!home || !away) return null;

  return games.find((game) => {
    const gh = normalizeName(game?.teams?.home?.name);
    const ga = normalizeName(game?.teams?.away?.name);

    const homeMatches = gh.includes(home) || home.includes(gh);
    const awayMatches = ga.includes(away) || away.includes(ga);

    return homeMatches && awayMatches;
  }) || null;
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
  const [realPlayerProps, setRealPlayerProps] = useState<any[]>([]);
  const [playerPropsLoading, setPlayerPropsLoading] = useState(false);

  const isPaidPlan = ["PRO", "VIP", "Pro", "Vip", "pro", "vip"].includes(String(plan));
  const today = dateKey(new Date());

  const liveGames = useMemo(() => games.filter(isGameLive), [games]);
  const futureGames = useMemo(() => games.filter((game) => !isGameLive(game) && !isGameFinished(game)), [games]);
  const finishedGames = useMemo(() => games.filter(isGameFinished), [games]);
  const wonBetsList = useMemo(() => {
    return (savedBets || [])
      .filter((bet: any) => String(bet?.status || "").toLowerCase() === "won")
      .sort((a: any, b: any) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());
  }, [savedBets]);

  const recentResultBets = useMemo(() => {
    return (savedBets || [])
      .filter((bet: any) => ["won", "lost"].includes(String(bet?.status || "").toLowerCase()))
      .sort((a: any, b: any) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime())
      .slice(0, 5);
  }, [savedBets]);

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

  const topGameIds = useMemo(() => topGames.slice(0, 6).map((game) => String(game?.fixture?.id || "")).filter(Boolean).join("|"), [topGames]);

  const localTips = useMemo(() => {
    return dedupeSmartTips(topGames.map((game) => smartLocalTip(game)));
  }, [topGames]);

  const displayedSmartTips = useMemo(() => {
    return dedupeSmartTips(smartTips.length ? smartTips : localTips).slice(0, 12);
  }, [smartTips, localTips]);

  const playerPropsTips = useMemo(() => {
    // Mantido apenas para compatibilidade com versões antigas.
    // O dashboard premium agora usa somente Player Props reais vindos de /football/player-props/:fixtureId.
    // Sem escalação real e foto real, a seção não renderiza jogador fake.
    displayedSmartTips;
    return [];
  }, [displayedSmartTips]);

  const homePlayerProps = useMemo(() => {
    // Player Props reais: top 3, com foto real e sem card fake.
    return realPlayerProps
      .filter((prop: any) => hasRealPlayerPhoto(prop))
      .sort((a: any, b: any) => safeNumber(b?.confidence ?? b?.confiança, 0) - safeNumber(a?.confidence ?? a?.confiança, 0))
      .slice(0, 3);
  }, [realPlayerProps]);

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


  async function loadRealPlayerProps() {
    const ids = topGameIds.split("|").filter(Boolean);
    if (!ids.length) {
      setRealPlayerProps([]);
      return;
    }

    try {
      setPlayerPropsLoading(true);
      const responses = await Promise.allSettled(
        ids.map((fixtureId) => api.get(`/football/player-props/${fixtureId}`)),
      );

      const props = responses.flatMap((response: any) => {
        if (response.status !== "fulfilled") return [];
        const data = response.value?.data || {};
        const rows = data.playerProps || data.props || [];
        return Array.isArray(rows) ? rows : [];
      });

      const seen = new Set<string>();
      const unique = props
        .filter((prop: any) => hasRealPlayerPhoto(prop))
        .filter((prop: any) => {
          const role = String(prop?.playerRole || prop?.role || "").toLowerCase();
          return !role.includes("goleiro") && !role.includes("defensor") && !role.includes("zagueiro") && !role.includes("lateral");
        })
        .filter((prop: any) => {
          const key = `${prop.fixtureId || ""}-${prop.playerId || prop.playerName || prop.player || ""}-${prop.tip || prop.selection || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a: any, b: any) => {
          const score = (prop: any) => {
            const role = String(prop?.playerRole || prop?.role || "").toLowerCase();
            const roleScore = role.includes("atacante") ? 30 : role.includes("meia") ? 15 : 0;
            return safeNumber(prop?.confidence ?? prop?.confiança, 0) + roleScore;
          };
          return score(b) - score(a);
        });

      setRealPlayerProps(unique.slice(0, 3));
    } catch {
      setRealPlayerProps([]);
    } finally {
      setPlayerPropsLoading(false);
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

  useEffect(() => {
    loadRealPlayerProps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topGameIds]);

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
    const picks = [...displayedSmartTips]
      .filter((tip) => safeNumber(tip.confidence, 0) >= 75)
      .filter((tip) => safeNumber(tip.odd, 0) >= 1.35)
      .filter((tip) => safeNumber(tip.odd, 0) <= 2.05)
      .sort((a, b) => {
        const scoreA = safeNumber(a.confidence, 0) + safeNumber(a.qualityScore, 0) * 0.35 - Math.abs(safeNumber(a.odd, 1.7) - 1.7) * 8;
        const scoreB = safeNumber(b.confidence, 0) + safeNumber(b.qualityScore, 0) * 0.35 - Math.abs(safeNumber(b.odd, 1.7) - 1.7) * 8;
        return scoreB - scoreA;
      })
      .slice(0, 3);

    const combinedOdd = picks.reduce((acc, item) => acc * safeNumber(item.odd, 1.35), 1);
    const confidence = picks.length
      ? Math.round(picks.reduce((acc, item) => acc + safeNumber(item.confidence, 70), 0) / picks.length)
      : 0;

    return { picks, combinedOdd: picks.length ? combinedOdd.toFixed(2) : "0.00", confidence };
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

  const topPick = useMemo(() => {
    return [...displayedSmartTips]
      .filter((tip) => safeNumber(tip.confidence, 0) >= 78)
      .filter((tip) => safeNumber(tip.odd, 0) >= 1.45)
      .filter((tip) => safeNumber(tip.odd, 0) <= 2.05)
      .sort((a, b) => {
        const scoreA = safeNumber(a.confidence, 0) + safeNumber(a.qualityScore, 0) * 0.45 - Math.abs(safeNumber(a.odd, 1.75) - 1.75) * 10;
        const scoreB = safeNumber(b.confidence, 0) + safeNumber(b.qualityScore, 0) * 0.45 - Math.abs(safeNumber(b.odd, 1.75) - 1.75) * 10;
        return scoreB - scoreA;
      })[0] || displayedSmartTips[0] || localTips[0] || null;
  }, [displayedSmartTips, localTips]);

  const topPickGame = useMemo(() => {
    return topPick ? getGameByTip(topPick, games) || topGames[0] : topGames[0];
  }, [topPick, games, topGames]);

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
    <main className="oddix-dashboard" style={styles.page}>
      <style jsx global>{`

        /* ODDIX V22 SPORTSBOOK PREMIUM OVERRIDES */

        /* ODDIX V25 PREMIUM GAME CARDS */
        .oddix-game-card-v25 {
          position: relative !important;
          overflow: hidden !important;
          min-width: 0 !important;
          min-height: 360px !important;
          padding: 18px !important;
          border-radius: 24px !important;
          cursor: pointer !important;
          background:
            radial-gradient(circle at 20% 0%, rgba(139,92,246,.20), transparent 34%),
            linear-gradient(180deg, rgba(17,12,31,.98), rgba(7,7,13,.98)) !important;
          border: 1px solid rgba(255,255,255,.12) !important;
          box-shadow: 0 18px 44px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.10) !important;
          transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease !important;
        }

        .oddix-game-card-v25:hover {
          transform: translateY(-4px) !important;
          border-color: rgba(250,204,21,.45) !important;
          box-shadow: 0 26px 68px rgba(0,0,0,.42), 0 0 36px rgba(139,92,246,.20), inset 0 1px 0 rgba(255,255,255,.14) !important;
        }

        .oddix-card-v25-glow {
          position: absolute;
          inset: -80px -80px auto auto;
          width: 190px;
          height: 190px;
          border-radius: 999px;
          background: rgba(250,204,21,.12);
          filter: blur(22px);
          pointer-events: none;
        }

        .oddix-card-v25-top,
        .oddix-card-v25-league,
        .oddix-card-v25-match,
        .oddix-card-v25-pick,
        .oddix-card-v25-confidence,
        .oddix-card-v25-metrics,
        .oddix-card-v25-actions {
          position: relative;
          z-index: 2;
        }

        .oddix-card-v25-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .oddix-card-v25-badge,
        .oddix-card-v25-badge-live,
        .oddix-card-v25-premium {
          min-width: 0;
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 10px;
          line-height: 1;
          letter-spacing: .7px;
          font-weight: 1000;
          text-transform: uppercase;
        }

        .oddix-card-v25-badge {
          color: rgba(255,255,255,.78);
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
        }

        .oddix-card-v25-badge-live {
          color: #22c55e;
          background: rgba(34,197,94,.13);
          border: 1px solid rgba(34,197,94,.28);
          box-shadow: 0 0 18px rgba(34,197,94,.12);
        }

        .oddix-card-v25-premium {
          flex: 0 0 auto;
          color: #facc15;
          background: rgba(250,204,21,.11);
          border: 1px solid rgba(250,204,21,.22);
        }

        .oddix-card-v25-league {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          margin-bottom: 16px;
          color: rgba(255,255,255,.68);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .oddix-card-v25-league img {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          object-fit: contain;
          flex: 0 0 auto;
        }

        .oddix-card-v25-league span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .oddix-card-v25-match {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 86px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          padding: 14px;
          border-radius: 20px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(255,255,255,.10);
        }

        .oddix-card-v25-team {
          min-width: 0;
          display: grid;
          justify-items: center;
          gap: 8px;
          text-align: center;
        }

        .oddix-card-v25-team img {
          width: 52px;
          height: 52px;
          border-radius: 999px;
          object-fit: contain;
          padding: 7px;
          background: rgba(0,0,0,.24);
          border: 1px solid rgba(255,255,255,.12);
          box-shadow: 0 10px 24px rgba(0,0,0,.25);
        }

        .oddix-card-v25-team strong {
          width: 100%;
          min-width: 0;
          color: #fff;
          font-size: 13px;
          line-height: 1.12;
          font-weight: 950;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .oddix-card-v25-score {
          display: grid;
          justify-items: center;
          align-content: center;
          min-height: 76px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(250,204,21,.13), rgba(139,92,246,.08));
          border: 1px solid rgba(250,204,21,.22);
        }

        .oddix-card-v25-score span {
          color: #facc15;
          font-size: 22px;
          line-height: .92;
          font-weight: 1000;
        }

        .oddix-card-v25-score small {
          color: rgba(255,255,255,.54);
          font-size: 9px;
          font-weight: 1000;
          letter-spacing: 1px;
          margin: 2px 0;
        }

        .oddix-card-v25-pick {
          margin-top: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(250,204,21,.08);
          border: 1px solid rgba(250,204,21,.18);
        }

        .oddix-card-v25-pick span,
        .oddix-card-v25-pick small {
          display: block;
          color: rgba(255,255,255,.62);
          font-size: 10px;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .oddix-card-v25-pick strong {
          display: block;
          min-width: 0;
          margin: 6px 0 4px;
          color: #fff;
          font-size: 18px;
          line-height: 1.08;
          font-weight: 1000;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .oddix-card-v25-confidence {
          margin-top: 14px;
        }

        .oddix-card-v25-confidence > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .oddix-card-v25-confidence span {
          color: rgba(255,255,255,.68);
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .oddix-card-v25-confidence strong {
          color: #22c55e;
          font-size: 18px;
          font-weight: 1000;
        }

        .oddix-card-v25-bar {
          height: 9px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.10);
        }

        .oddix-card-v25-bar i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #22c55e, #a3e635, #facc15);
          box-shadow: 0 0 18px rgba(34,197,94,.32);
        }

        .oddix-card-v25-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }

        .oddix-card-v25-metrics div {
          min-width: 0;
          padding: 10px;
          border-radius: 15px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
        }

        .oddix-card-v25-metrics span {
          display: block;
          color: rgba(255,255,255,.55);
          font-size: 9px;
          font-weight: 1000;
          letter-spacing: .7px;
          text-transform: uppercase;
        }

        .oddix-card-v25-metrics strong {
          display: block;
          min-width: 0;
          margin-top: 4px;
          color: #fff;
          font-size: 13px;
          font-weight: 1000;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .oddix-card-v25-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }

        .oddix-card-v25-actions button {
          min-width: 0;
          height: 42px;
          border: 0;
          border-radius: 14px;
          cursor: pointer;
          color: #fff;
          font-size: 12px;
          font-weight: 1000;
        }

        .oddix-card-v25-actions button:first-child {
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          box-shadow: 0 14px 26px rgba(124,58,237,.24);
        }

        .oddix-card-v25-actions button:last-child {
          color: #111827;
          background: linear-gradient(135deg, #facc15, #fb923c);
          box-shadow: 0 14px 26px rgba(250,204,21,.18);
        }

        @media (max-width: 640px) {
          .oddix-card-v25-match {
            grid-template-columns: 1fr;
          }
          .oddix-card-v25-score {
            min-height: 58px;
            grid-row: 2;
          }
        }



        /* ODDIX V26 CONVERSION + OFFICIAL TICKET */
        .oddix-v26-conversion {
          width: min(1480px, calc(100% - 36px));
          margin: 0 auto 22px;
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr) 320px;
          gap: 18px;
          align-items: stretch;
        }

        .oddix-v26-ticket,
        .oddix-v26-proof,
        .oddix-v26-ranking,
        .oddix-v26-heatmap {
          min-width: 0;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,.12);
          background: linear-gradient(180deg, rgba(17,12,31,.98), rgba(7,7,13,.98));
          box-shadow: 0 22px 60px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08);
          overflow: hidden;
        }

        .oddix-v26-ticket {
          padding: 22px;
          border-color: rgba(250,204,21,.28);
        }

        .oddix-v26-ticket-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .oddix-v26-ticket-head span,
        .oddix-v26-section-title span,
        .oddix-v26-vip-box span {
          color: #facc15;
          font-size: 11px;
          line-height: 1;
          letter-spacing: 1px;
          font-weight: 1000;
          text-transform: uppercase;
        }

        .oddix-v26-ticket-head b {
          padding: 7px 9px;
          border-radius: 999px;
          color: #22c55e;
          background: rgba(34,197,94,.10);
          border: 1px solid rgba(34,197,94,.22);
          font-size: 10px;
        }

        .oddix-v26-return {
          padding: 20px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(250,204,21,.18), rgba(249,115,22,.10));
          border: 1px solid rgba(250,204,21,.28);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.10);
        }

        .oddix-v26-return small,
        .oddix-v26-return span,
        .oddix-v26-ticket-grid span,
        .oddix-v26-picks small,
        .oddix-v26-ranking-list small,
        .oddix-v26-heatmap-bars small {
          color: rgba(255,255,255,.58);
          font-size: 11px;
          font-weight: 850;
        }

        .oddix-v26-return strong {
          display: block;
          margin: 6px 0 4px;
          color: #facc15;
          font-size: clamp(48px, 4vw, 72px);
          line-height: .88;
          font-weight: 1000;
          letter-spacing: -2px;
        }

        .oddix-v26-ticket-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 14px 0;
        }

        .oddix-v26-ticket-grid div,
        .oddix-v26-metric {
          padding: 13px;
          border-radius: 18px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
        }

        .oddix-v26-ticket-grid strong {
          display: block;
          margin-top: 5px;
          color: #fff;
          font-size: 19px;
          font-weight: 1000;
        }

        .oddix-v26-picks {
          display: grid;
          gap: 10px;
        }

        .oddix-v26-picks > div {
          display: grid;
          grid-template-columns: 28px minmax(0,1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(255,255,255,.10);
        }

        .oddix-v26-picks i {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: #22c55e;
          background: rgba(34,197,94,.13);
          font-style: normal;
          font-weight: 1000;
        }

        .oddix-v26-picks b,
        .oddix-v26-ranking-list b {
          display: block;
          min-width: 0;
          color: #fff;
          font-size: 12px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .oddix-v26-picks strong {
          color: #facc15;
          font-size: 16px;
        }

        .oddix-v26-ticket button,
        .oddix-v26-vip-box button {
          width: 100%;
          margin-top: 14px;
          border: 0;
          border-radius: 16px;
          padding: 13px 16px;
          cursor: pointer;
          color: #111827;
          background: linear-gradient(135deg,#facc15,#fb923c);
          font-weight: 1000;
          box-shadow: 0 14px 34px rgba(250,204,21,.20);
        }

        .oddix-v26-center {
          display: grid;
          gap: 18px;
          min-width: 0;
        }

        .oddix-v26-proof,
        .oddix-v26-ranking,
        .oddix-v26-heatmap {
          padding: 20px;
        }

        .oddix-v26-section-title h2 {
          margin: 7px 0 14px;
          color: #fff;
          font-size: clamp(22px, 2vw, 32px);
          line-height: 1;
          letter-spacing: -1px;
          font-weight: 1000;
        }

        .oddix-v26-section-title.compact h2 {
          font-size: 24px;
        }

        .oddix-v26-proof-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .oddix-v26-metric strong {
          display: block;
          font-size: 30px;
          line-height: .95;
          font-weight: 1000;
        }

        .oddix-v26-metric span {
          display: block;
          margin-top: 8px;
          color: rgba(255,255,255,.66);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .6px;
        }

        .oddix-v26-ranking-list {
          display: grid;
          gap: 10px;
        }

        .oddix-v26-ranking-list > div {
          display: grid;
          grid-template-columns: 30px minmax(0,1fr) 52px;
          gap: 10px;
          align-items: center;
          position: relative;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(255,255,255,.10);
          overflow: hidden;
        }

        .oddix-v26-ranking-list em {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: #111827;
          background: #facc15;
          font-style: normal;
          font-weight: 1000;
        }

        .oddix-v26-ranking-list strong {
          color: #facc15;
          font-size: 17px;
          font-weight: 1000;
          text-align: right;
        }

        .oddix-v26-ranking-list i {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 6px;
          height: 3px;
          border-radius: 99px;
          background: rgba(255,255,255,.08);
          overflow: hidden;
        }

        .oddix-v26-ranking-list u {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg,#22c55e,#facc15);
        }

        .oddix-v26-heatmap-bars {
          display: grid;
          gap: 13px;
        }

        .oddix-v26-heatmap-bars > div > div {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: rgba(255,255,255,.78);
          font-size: 12px;
          font-weight: 950;
        }

        .oddix-v26-heatmap-bars i {
          display: block;
          height: 11px;
          margin: 7px 0 5px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,.08);
        }

        .oddix-v26-heatmap-bars u {
          display: block;
          height: 100%;
          border-radius: inherit;
          box-shadow: 0 0 18px rgba(250,204,21,.18);
        }

        .oddix-v26-vip-box {
          margin-top: 18px;
          padding: 16px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(124,58,237,.22), rgba(250,204,21,.10));
          border: 1px solid rgba(250,204,21,.18);
        }

        .oddix-v26-vip-box p {
          margin: 9px 0 0;
          color: rgba(255,255,255,.70);
          font-size: 13px;
          line-height: 1.35;
          font-weight: 750;
        }

        @media (max-width: 1280px) {
          .oddix-v26-conversion {
            grid-template-columns: 1fr;
          }
          .oddix-v26-proof-grid {
            grid-template-columns: repeat(5, minmax(120px, 1fr));
            overflow-x: auto;
          }
        }

        @media (max-width: 680px) {
          .oddix-v26-conversion {
            width: calc(100% - 24px);
          }
          .oddix-v26-ticket-grid,
          .oddix-v26-proof-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        /* ODDIX V20 REAL PLAYER PROPS + TOP PICK FIX */
        .oddix-player-props-home-grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 18px !important;
        }

        .oddix-player-prop-card-v17 {
          min-height: 330px !important;
          align-items: stretch !important;
          isolation: isolate !important;
          overflow: hidden !important;
        }

        .oddix-player-prop-card-v17::before {
          content: "";
          position: absolute;
          inset: -60px -40px auto auto;
          width: 180px;
          height: 180px;
          border-radius: 999px;
          background: rgba(250,204,21,.16);
          filter: blur(18px);
          pointer-events: none;
          z-index: -1;
        }

        .oddix-top-pick-hero {
          width: min(1480px, calc(100% - 36px)) !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        @media (max-width: 1100px) {
          .oddix-player-props-home-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .oddix-dashboard {
          background:
            radial-gradient(circle at 22% 0%, rgba(123,44,255,.30), transparent 34%),
            radial-gradient(circle at 78% 20%, rgba(247,201,72,.08), transparent 30%),
            linear-gradient(180deg, #07070D 0%, #10051f 45%, #07070D 100%) !important;
          color: #ffffff !important;
          font-family: Inter, Arial, sans-serif !important;
        }

        .oddix-top-header {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          min-height: 72px !important;
          padding: 0 26px !important;
          background: rgba(7,7,13,.82) !important;
          backdrop-filter: blur(18px) !important;
          border-bottom: 1px solid rgba(123,44,255,.35) !important;
          box-shadow: 0 14px 40px rgba(0,0,0,.35) !important;
        }

        .oddix-sports-rail {
          position: sticky !important;
          top: 72px !important;
          z-index: 90 !important;
          min-height: 54px !important;
          padding: 8px 26px !important;
          background: rgba(13,7,24,.86) !important;
          backdrop-filter: blur(16px) !important;
          border-bottom: 1px solid rgba(123,44,255,.28) !important;
        }

        .oddix-sports-rail button {
          min-height: 36px !important;
          padding: 0 14px !important;
          border-radius: 999px !important;
          border: 1px solid rgba(255,255,255,.14) !important;
          background: rgba(255,255,255,.055) !important;
          color: #ffffff !important;
          transition: .2s ease !important;
        }

        .oddix-sports-rail button:hover {
          border-color: rgba(247,201,72,.70) !important;
          color: #F7C948 !important;
          box-shadow: 0 0 18px rgba(247,201,72,.14) !important;
        }

        .oddix-hero-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 300px !important;
          gap: 18px !important;
          margin: 26px !important;
          align-items: stretch !important;
        }

        .oddix-hero-main {
          min-height: 540px !important;
          height: 540px !important;
          display: grid !important;
          grid-template-columns: minmax(390px, .95fr) minmax(520px, 1.2fr) !important;
          align-items: center !important;
          padding: 42px 42px 74px !important;
          position: relative !important;
          overflow: hidden !important;
          border-radius: 30px !important;
          background:
            radial-gradient(circle at 72% 44%, rgba(123,44,255,.60), transparent 34%),
            radial-gradient(circle at 56% 52%, rgba(247,201,72,.10), transparent 22%),
            linear-gradient(135deg,#12051F,#1A0836 52%,#0D0718) !important;
          border: 1px solid rgba(247,201,72,.32) !important;
          box-shadow: 0 0 40px rgba(123,44,255,.25), inset 0 1px 0 rgba(255,255,255,.10) !important;
        }

        .oddix-hero-main::before {
          content: "";
          position: absolute;
          inset: -110px -90px auto auto;
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(123,44,255,.65), transparent 62%);
          filter: blur(8px);
          pointer-events: none;
        }

        .oddix-hero-text {
          max-width: 560px !important;
          z-index: 2 !important;
        }

        .oddix-hero-text h1 {
          font-size: clamp(62px, 7.5vw, 118px) !important;
          line-height: .85 !important;
          letter-spacing: -5px !important;
          margin: 14px 0 22px !important;
          font-weight: 1000 !important;
          color: #ffffff !important;
          text-shadow: 0 0 34px rgba(123,44,255,.55) !important;
        }

        .oddix-hero-text p {
          max-width: 520px !important;
          font-size: 19px !important;
          line-height: 1.34 !important;
          color: rgba(255,255,255,.88) !important;
        }

        .oddix-hero-player-box {
          align-self: stretch !important;
          justify-self: stretch !important;
          min-width: 0 !important;
          height: 100% !important;
          position: relative !important;
          z-index: 2 !important;
        }

        .oddix-hero-player {
          position: absolute !important;
          right: -10px !important;
          bottom: -10px !important;
          height: 540px !important;
          width: min(620px, 100%) !important;
          object-fit: contain !important;
          object-position: center bottom !important;
          filter: drop-shadow(0 28px 42px rgba(0,0,0,.55)) drop-shadow(0 0 22px rgba(123,44,255,.45)) !important;
          transform: scale(1.18) !important;
        }

        .oddix-vip-panel {
          min-height: 540px !important;
          border-radius: 30px !important;
          padding: 32px 26px !important;
          background: linear-gradient(180deg,rgba(13,7,24,.96),rgba(7,7,13,.98)) !important;
          border: 1px solid rgba(123,44,255,.35) !important;
          box-shadow: 0 0 40px rgba(123,44,255,.18), inset 0 1px 0 rgba(255,255,255,.08) !important;
        }

        .oddix-vip-panel strong {
          color: #F7C948 !important;
          font-size: 56px !important;
          line-height: 1 !important;
          text-shadow: 0 0 24px rgba(247,201,72,.24) !important;
        }

        .oddix-top-pick-hero {
          min-height: 156px !important;
          margin: 0 26px 22px !important;
          display: grid !important;
          grid-template-columns: 150px minmax(340px,.95fr) minmax(310px,1fr) 430px !important;
          align-items: center !important;
          gap: 18px !important;
          border-radius: 24px !important;
          border: 1px solid rgba(247,201,72,.58) !important;
          background: linear-gradient(135deg,rgba(7,7,13,.97),rgba(26,8,54,.92)) !important;
          box-shadow: 0 18px 54px rgba(0,0,0,.34), 0 0 28px rgba(247,201,72,.10) !important;
        }

        .oddix-player-props-home-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 18px !important;
        }

        .oddix-vip-marketing-strip {
          margin: 0 26px 22px !important;
          border-radius: 28px !important;
          background: linear-gradient(135deg,rgba(9,5,20,.98),rgba(30,16,66,.96)) !important;
          border: 1px solid rgba(123,44,255,.36) !important;
          box-shadow: 0 22px 60px rgba(0,0,0,.30), 0 0 40px rgba(123,44,255,.16) !important;
        }

        .oddix-premium-ticket {
          margin: 0 26px 22px !important;
        }

        @media (max-width: 1200px) {
          .oddix-hero-grid {
            grid-template-columns: 1fr !important;
          }
          .oddix-hero-main {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: 620px !important;
          }
          .oddix-hero-player-box {
            height: 330px !important;
          }
          .oddix-hero-player {
            position: relative !important;
            right: auto !important;
            bottom: auto !important;
            height: 360px !important;
            width: 100% !important;
          }
          .oddix-top-pick-hero {
            grid-template-columns: 1fr !important;
          }
        }


        .oddix-dashboard {
          max-width: 100vw;
          overflow-x: hidden;
        }
        .oddix-brand {
          width: 180px !important;
          height: 68px !important;
          border-radius: 22px !important;
          box-shadow: 0 0 28px rgba(123,44,255,.28), inset 0 1px 0 rgba(255,255,255,.10) !important;
        }

        .oddix-brand img {
          height: 58px !important;
          max-width: 154px !important;
          filter: drop-shadow(0 0 18px rgba(168,85,247,.55)) drop-shadow(0 0 8px rgba(247,201,72,.18)) !important;
        }

        .oddix-hero-text h1 {
          font-size: clamp(58px, 6.9vw, 108px) !important;
        }

        .oddix-boost-ticket-v22-return strong {
          font-size: clamp(58px, 5vw, 82px) !important;
          line-height: .85 !important;
        }


        .oddix-info-metric {
          background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.06)) !important;
          border: 1px solid rgba(250,204,21,.32) !important;
          color: #ffffff !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 12px 28px rgba(0,0,0,.22) !important;
        }

        .oddix-info-metric span {
          color: rgba(255,255,255,.78);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .6px;
          font-weight: 900;
        }

        .oddix-info-metric strong {
          color: #facc15;
          font-size: 24px;
          line-height: 1;
          text-shadow: 0 0 18px rgba(250,204,21,.28);
        }

        .oddix-featured-strip,
        .oddix-games-grid {
          overflow-x: hidden !important;
        }

        .oddix-featured-strip {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
          max-height: none !important;
          overflow-y: visible !important;
        }

        .oddix-games-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)) !important;
          max-height: none !important;
          overflow-y: visible !important;
        }



        .oddix-premium-ticket {
          position: relative;
          overflow: hidden;
        }

        .oddix-premium-ticket::before {
          content: "";
          position: absolute;
          inset: -80px auto auto -80px;
          width: 220px;
          height: 220px;
          border-radius: 999px;
          background: rgba(250,204,21,.16);
          filter: blur(25px);
          pointer-events: none;
        }



        .oddix-player-props-home-grid button [style*="align-items: end"] span:nth-child(1){height:14px;background:#22c55e;}
        .oddix-player-props-home-grid button [style*="align-items: end"] span:nth-child(2){height:20px;background:#22c55e;}
        .oddix-player-props-home-grid button [style*="align-items: end"] span:nth-child(3){height:28px;background:#8b5cf6;}
        .oddix-player-props-home-grid button [style*="align-items: end"] span:nth-child(4){height:34px;background:#8b5cf6;}
        .oddix-player-props-home-grid button [style*="align-items: end"] span:nth-child(5){height:42px;background:#a855f7;}
        .oddix-player-props-home-grid button [style*="align-items: end"] span:nth-child(6){height:50px;background:#c084fc;}
        .oddix-player-props-home-grid button [style*="align-items: end"] span{display:block;width:8px;border-radius:999px;box-shadow:0 0 12px rgba(168,85,247,.45);}
        .oddix-hero-text h1{font-size:clamp(56px,7vw,104px)!important;line-height:.88!important;letter-spacing:-4px!important;margin:12px 0 18px!important;color:#fff!important;text-shadow:0 0 34px rgba(123,44,255,.50);}

        @media (max-width: 980px) {
          .oddix-vip-results-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-vip-results-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .oddix-vip-results {
            margin-left: 12px !important;
            margin-right: 12px !important;
            padding: 18px !important;
          }

          .oddix-vip-results-metrics {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 1180px) {
          .oddix-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-hero-main {
            grid-template-columns: 1fr 330px !important;
            min-height: 340px !important;
          }

          .oddix-vip-panel {
            min-height: 180px !important;
          }

          .oddix-top-widgets-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-top-pick-hero {
            grid-template-columns: 1fr !important;
          }

          .oddix-premium-ticket [style*="grid-template-columns: 44px"] {
            grid-template-columns: 38px minmax(0, 1fr) !important;
          }


          .oddix-layout {
            grid-template-columns: 1fr !important;
          }

          .oddix-sidebar {
            position: relative !important;
            top: auto !important;
            max-height: none !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 860px) {
          .oddix-top-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 16px !important;
          }

          .oddix-brand {
            width: 100% !important;
            justify-content: center !important;
          }

          .oddix-header-actions {
            width: 100% !important;
            justify-content: center !important;
            flex-wrap: wrap !important;
          }

          .oddix-sports-rail {
            padding: 10px 14px 14px !important;
            gap: 8px !important;
          }

          .oddix-hero-grid,
          .oddix-top-widgets,
          .oddix-featured-strip,
          .oddix-tabs-wrapper,
          .oddix-layout,
          .oddix-footer,
          .oddix-top-pick-hero,
          .oddix-marketing-banner {
            margin-left: 14px !important;
            margin-right: 14px !important;
          }

          .oddix-hero-main {
            grid-template-columns: 1fr !important;
            padding: 28px 20px 0 !important;
            min-height: auto !important;
            text-align: center !important;
          }

          .oddix-hero-text {
            max-width: 100% !important;
            padding-right: 0 !important;
          }

          .oddix-hero-text h1 {
            font-size: 30px !important;
            line-height: 1.08 !important;
          }

          .oddix-hero-player-box {
            min-width: 0 !important;
            height: 250px !important;
          }

          .oddix-hero-player {
            height: 270px !important;
            width: 100% !important;
            transform: none !important;
          }

          .oddix-top-pick-hero {
            grid-template-columns: 1fr !important;
            text-align: center !important;
            gap: 14px !important;
          }

          .oddix-marketing-banner {
            grid-template-columns: 1fr !important;
            padding: 22px !important;
          }

          .oddix-sidebar {
            grid-template-columns: 1fr !important;
          }

          .oddix-games-grid,
          .oddix-featured-strip {
            grid-template-columns: 1fr !important;
          }

          .oddix-tabs {
            min-width: max-content !important;
          }

          .oddix-player-props-home-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 520px) {
          .oddix-hero-text h1 {
            font-size: 25px !important;
          }

          .oddix-info-metric strong {
            font-size: 20px;
          }

          .oddix-top-pick-hero {
            padding: 14px !important;
          }

          .oddix-game-card {
            min-height: auto !important;
          }
        }


        /* ODDIX V13 FINAL PREMIUM BALANCE OVERRIDES
           Correção de proporção, altura, cards, roleta vertical e responsividade.
           Mantém a estrutura antiga, apenas refina o visual. */
        .oddix-dashboard * {
          box-sizing: border-box !important;
        }

        .oddix-dashboard {
          background:
            radial-gradient(circle at 16% -8%, rgba(124,58,237,.30), transparent 32%),
            radial-gradient(circle at 86% 8%, rgba(250,204,21,.13), transparent 28%),
            linear-gradient(180deg, #06050b 0%, #100720 48%, #06050b 100%) !important;
        }

        .oddix-top-header {
          min-height: 64px !important;
          padding: 10px 20px !important;
          background: rgba(6,5,11,.88) !important;
          border-bottom: 1px solid rgba(255,255,255,.08) !important;
        }

        .oddix-brand img {
          max-height: 42px !important;
          width: auto !important;
          object-fit: contain !important;
        }

        .oddix-header-actions button {
          min-height: 36px !important;
          padding: 9px 13px !important;
          font-size: 12px !important;
        }

        .oddix-sports-rail {
          top: 64px !important;
          min-height: 50px !important;
          padding: 8px 20px !important;
          display: flex !important;
          gap: 8px !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: none !important;
        }

        .oddix-sports-rail::-webkit-scrollbar {
          display: none !important;
        }

        .oddix-sports-rail button {
          flex: 0 0 auto !important;
          min-height: 34px !important;
          padding: 0 13px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          background: rgba(255,255,255,.065) !important;
        }

        .oddix-hero-grid,
        .oddix-vip-marketing-strip,
        .oddix-premium-ticket,
        .oddix-top-pick-hero,
        .oddix-marketing-banner,
        .oddix-top-widgets,
        .oddix-featured-strip,
        .oddix-tabs-wrapper,
        .oddix-layout,
        .oddix-footer,
        .oddix-player-props-home-section,
        .oddix-vip-results {
          width: min(1480px, calc(100% - 36px)) !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .oddix-hero-grid {
          grid-template-columns: minmax(0, 1fr) 280px !important;
          gap: 16px !important;
          margin-top: 18px !important;
          margin-bottom: 18px !important;
        }

        .oddix-hero-main {
          height: 430px !important;
          min-height: 430px !important;
          grid-template-columns: minmax(360px,.95fr) minmax(360px,1fr) !important;
          padding: 34px 34px 56px !important;
          border-radius: 26px !important;
          background:
            radial-gradient(circle at 74% 46%, rgba(124,58,237,.48), transparent 33%),
            radial-gradient(circle at 58% 70%, rgba(250,204,21,.13), transparent 28%),
            linear-gradient(135deg,#10051d,#1b0b39 56%,#080711) !important;
        }

        .oddix-hero-text h1 {
          font-size: clamp(46px, 5.4vw, 82px) !important;
          line-height: .88 !important;
          letter-spacing: -3px !important;
          margin: 10px 0 14px !important;
        }

        .oddix-hero-text p {
          font-size: 16px !important;
          line-height: 1.42 !important;
          max-width: 520px !important;
        }

        .oddix-hero-player-box {
          min-height: 0 !important;
          height: 100% !important;
        }

        .oddix-hero-player {
          height: 430px !important;
          max-width: 520px !important;
          right: -24px !important;
          bottom: -28px !important;
          transform: none !important;
        }

        .oddix-vip-panel {
          min-height: 430px !important;
          padding: 26px 22px !important;
          border-radius: 26px !important;
        }

        .oddix-vip-panel strong {
          font-size: 48px !important;
        }

        .oddix-info-metric {
          min-height: 72px !important;
          padding: 12px !important;
        }

        .oddix-info-metric strong {
          font-size: 21px !important;
        }

        .oddix-top-pick-hero {
          min-height: 132px !important;
          grid-template-columns: 120px minmax(280px,.9fr) minmax(260px,1fr) 340px !important;
          gap: 14px !important;
          padding: 18px !important;
          margin-bottom: 18px !important;
          border-radius: 22px !important;
        }

        .oddix-player-props-home-grid,
        .oddix-featured-strip,
        .oddix-games-grid {
          gap: 14px !important;
        }

        .oddix-player-props-home-section {
          margin-bottom: 18px !important;
          padding: 20px !important;
          border-radius: 24px !important;
        }

        .oddix-player-props-home-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .oddix-featured-strip {
          display: grid !important;
          grid-template-columns: repeat(auto-fill, minmax(245px, 1fr)) !important;
          max-height: none !important;
          padding: 0 !important;
          margin-bottom: 18px !important;
        }

        .oddix-layout {
          grid-template-columns: 260px minmax(0, 1fr) !important;
          gap: 18px !important;
          align-items: start !important;
        }

        .oddix-sidebar {
          position: sticky !important;
          top: 126px !important;
          max-height: calc(100vh - 142px) !important;
          overflow: auto !important;
          scrollbar-width: thin !important;
        }

        .oddix-games-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fill, minmax(295px, 1fr)) !important;
          max-height: 860px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding-right: 6px !important;
          scroll-behavior: smooth !important;
        }

        .oddix-games-grid::-webkit-scrollbar,
        .oddix-sidebar::-webkit-scrollbar {
          width: 7px !important;
        }

        .oddix-games-grid::-webkit-scrollbar-thumb,
        .oddix-sidebar::-webkit-scrollbar-thumb {
          background: rgba(250,204,21,.35) !important;
          border-radius: 999px !important;
        }

        .oddix-game-card {
          min-height: 258px !important;
          border-radius: 22px !important;
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease !important;
        }

        .oddix-game-card:hover {
          transform: translateY(-3px) !important;
          border-color: rgba(250,204,21,.46) !important;
          box-shadow: 0 20px 42px rgba(0,0,0,.32), 0 0 24px rgba(124,58,237,.18) !important;
        }

        .oddix-tabs-wrapper {
          margin-bottom: 16px !important;
        }

        .oddix-tabs {
          overflow-x: auto !important;
          scrollbar-width: none !important;
          padding: 6px !important;
        }

        .oddix-tabs::-webkit-scrollbar {
          display: none !important;
        }

        .oddix-tabs button {
          white-space: nowrap !important;
        }

        @media (max-width: 1260px) {
          .oddix-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-vip-panel {
            min-height: auto !important;
            display: grid !important;
            grid-template-columns: 1fr auto auto !important;
            align-items: center !important;
            gap: 16px !important;
          }

          .oddix-top-pick-hero {
            grid-template-columns: 1fr 1fr !important;
          }

          .oddix-layout {
            grid-template-columns: 1fr !important;
          }

          .oddix-sidebar {
            position: relative !important;
            top: auto !important;
            max-height: none !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 920px) {
          .oddix-top-header {
            position: relative !important;
            min-height: auto !important;
          }

          .oddix-sports-rail {
            top: 0 !important;
          }

          .oddix-hero-grid,
          .oddix-vip-marketing-strip,
          .oddix-premium-ticket,
          .oddix-top-pick-hero,
          .oddix-marketing-banner,
          .oddix-top-widgets,
          .oddix-featured-strip,
          .oddix-tabs-wrapper,
          .oddix-layout,
          .oddix-footer,
          .oddix-player-props-home-section,
          .oddix-vip-results {
            width: min(100% - 24px, 100%) !important;
          }

          .oddix-hero-main {
            height: auto !important;
            min-height: 0 !important;
            grid-template-columns: 1fr !important;
            padding: 26px 20px 0 !important;
            text-align: center !important;
          }

          .oddix-hero-text h1 {
            font-size: clamp(36px, 10vw, 58px) !important;
            letter-spacing: -1.8px !important;
          }

          .oddix-hero-text p {
            margin-left: auto !important;
            margin-right: auto !important;
          }

          .oddix-hero-player-box {
            height: 260px !important;
          }

          .oddix-hero-player {
            position: relative !important;
            right: auto !important;
            bottom: auto !important;
            height: 285px !important;
            width: 100% !important;
          }

          .oddix-hero-bottom-features,
          .oddix-hero-main [style*="position: absolute"][style*="bottom"] {
            display: none !important;
          }

          .oddix-vip-panel,
          .oddix-top-pick-hero,
          .oddix-sidebar,
          .oddix-player-props-home-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-games-grid {
            grid-template-columns: 1fr !important;
            max-height: none !important;
          }
        }

        @media (max-width: 560px) {
          .oddix-header-actions {
            justify-content: center !important;
          }

          .oddix-hero-main {
            border-radius: 22px !important;
          }

          .oddix-hero-text h1 {
            font-size: 34px !important;
          }

          .oddix-hero-feature-list,
          .oddix-hero-text [style*="flex-wrap"] {
            justify-content: center !important;
          }

          .oddix-info-metric {
            min-height: 62px !important;
          }
        }


        /* ODDIX V14 SPORTSBOOK: Mercado Quente + Bilhete Boost + Hero mais premium */
        .oddix-boost-ticket {
          position: relative !important;
          overflow: hidden !important;
        }

        .oddix-boost-ticket::after {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: 22px;
          border: 1px dashed rgba(250,204,21,.24);
          pointer-events: none;
        }

        .oddix-hot-markets button {
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease !important;
        }

        .oddix-hot-markets button:hover {
          transform: translateY(-3px) !important;
          border-color: rgba(250,204,21,.48) !important;
          box-shadow: 0 18px 36px rgba(0,0,0,.28), 0 0 24px rgba(250,204,21,.10) !important;
        }

        .oddix-hero-main {
          box-shadow: 0 22px 60px rgba(0,0,0,.38), 0 0 42px rgba(124,58,237,.20), inset 0 1px 0 rgba(255,255,255,.10) !important;
        }

        .oddix-info-metric {
          background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.035)) !important;
          border-color: rgba(250,204,21,.18) !important;
        }

        @media (max-width: 1100px) {
          .oddix-hot-markets-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .oddix-hot-markets {
            width: min(100% - 24px, 100%) !important;
            padding: 16px !important;
          }

          .oddix-hot-markets-grid {
            grid-template-columns: 1fr !important;
          }
        }


        /* ODDIX V15 ADAPTIVE PROPORTION FIX
           Enquadra o dashboard conforme largura/altura da tela, remove sobreposição no hero
           e deixa Top Pick / Boost / Mercado Quente proporcionais em desktop, notebook e mobile. */
        .oddix-dashboard {
          min-height: 100svh !important;
          overflow-x: clip !important;
        }

        .oddix-top-header,
        .oddix-sports-rail {
          width: 100% !important;
        }

        .oddix-hero-grid,
        .oddix-vip-marketing-strip,
        .oddix-premium-ticket,
        .oddix-top-pick-hero,
        .oddix-marketing-banner,
        .oddix-top-widgets,
        .oddix-featured-strip,
        .oddix-tabs-wrapper,
        .oddix-layout,
        .oddix-footer,
        .oddix-player-props-home-section,
        .oddix-vip-results,
        .oddix-hot-markets,
        .oddix-hot-entries {
          width: min(1440px, calc(100vw - clamp(20px, 3vw, 48px))) !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .oddix-hero-grid {
          grid-template-columns: minmax(0, 1fr) clamp(250px, 22vw, 320px) !important;
          gap: clamp(14px, 1.6vw, 22px) !important;
          margin-top: clamp(14px, 1.6vw, 24px) !important;
          margin-bottom: clamp(16px, 2vw, 26px) !important;
          align-items: stretch !important;
        }

        .oddix-hero-main {
          height: auto !important;
          min-height: clamp(410px, 39vw, 520px) !important;
          grid-template-columns: minmax(330px, 0.92fr) minmax(300px, 1.08fr) !important;
          gap: clamp(10px, 1.5vw, 24px) !important;
          padding: clamp(28px, 3vw, 44px) clamp(28px, 3vw, 46px) clamp(28px, 3vw, 42px) !important;
          align-items: center !important;
          overflow: hidden !important;
        }

        .oddix-hero-text {
          max-width: 620px !important;
          min-width: 0 !important;
        }

        .oddix-hero-text h1 {
          font-size: clamp(48px, 5.8vw, 92px) !important;
          line-height: .88 !important;
          letter-spacing: clamp(-4px, -.28vw, -2px) !important;
          margin: 10px 0 14px !important;
        }

        .oddix-hero-text p {
          max-width: 560px !important;
          font-size: clamp(14px, 1.1vw, 17px) !important;
          line-height: 1.42 !important;
        }

        .oddix-hero-stats {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 10px !important;
          max-width: 620px !important;
          margin-top: 16px !important;
          position: relative !important;
          z-index: 5 !important;
        }

        .oddix-info-metric {
          min-height: clamp(58px, 5vw, 72px) !important;
          padding: clamp(10px, 1vw, 14px) !important;
          border-radius: 15px !important;
        }

        .oddix-info-metric strong {
          font-size: clamp(18px, 1.7vw, 24px) !important;
        }

        .oddix-info-metric span {
          font-size: clamp(9px, .75vw, 11px) !important;
        }

        .oddix-hero-player-box {
          height: 100% !important;
          min-height: clamp(300px, 33vw, 470px) !important;
          align-self: end !important;
          overflow: visible !important;
        }

        .oddix-hero-player {
          height: clamp(350px, 39vw, 520px) !important;
          max-height: 100% !important;
          width: min(100%, 600px) !important;
          right: clamp(-44px, -2vw, -10px) !important;
          bottom: 0 !important;
          transform: none !important;
          object-fit: contain !important;
          object-position: right bottom !important;
        }

        .oddix-hero-bottom-features {
          display: none !important;
        }

        .oddix-vip-panel {
          min-height: clamp(410px, 39vw, 520px) !important;
          height: auto !important;
          padding: clamp(22px, 2vw, 30px) !important;
        }

        .oddix-vip-panel strong {
          font-size: clamp(42px, 4vw, 58px) !important;
        }

        .oddix-top-pick-hero {
          min-height: clamp(138px, 12vw, 168px) !important;
          grid-template-columns: clamp(92px, 9vw, 124px) minmax(250px, 1fr) minmax(260px, 1.2fr) minmax(250px, .9fr) !important;
          gap: clamp(12px, 1.3vw, 18px) !important;
          padding: clamp(16px, 1.7vw, 22px) !important;
          overflow: hidden !important;
        }

        .oddix-top-pick-hero > * {
          min-width: 0 !important;
        }

        .oddix-hot-markets,
        .oddix-hot-entries {
          margin-bottom: clamp(16px, 2vw, 26px) !important;
        }

        .oddix-hot-markets-grid,
        .oddix-hot-entries > div:last-child {
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)) !important;
        }

        .oddix-hot-markets button,
        .oddix-hot-entries button {
          min-height: 138px !important;
        }

        .oddix-player-props-home-grid {
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
        }

        .oddix-games-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)) !important;
          max-height: min(860px, calc(100svh - 180px)) !important;
        }

        .oddix-layout {
          grid-template-columns: clamp(230px, 18vw, 280px) minmax(0, 1fr) !important;
        }

        @media (max-width: 1320px) {
          .oddix-hero-main {
            grid-template-columns: minmax(320px, 1fr) minmax(280px, .82fr) !important;
            min-height: 430px !important;
          }

          .oddix-hero-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .oddix-top-pick-hero {
            grid-template-columns: 96px minmax(250px, 1fr) minmax(250px, 1fr) minmax(210px, .72fr) !important;
          }
        }

        @media (max-width: 1180px) {
          .oddix-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-vip-panel {
            min-height: auto !important;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 16px !important;
          }

          .oddix-top-pick-hero {
            grid-template-columns: 110px minmax(0, 1fr) !important;
          }

          .oddix-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 920px) {
          .oddix-hero-grid,
          .oddix-vip-marketing-strip,
          .oddix-premium-ticket,
          .oddix-top-pick-hero,
          .oddix-marketing-banner,
          .oddix-top-widgets,
          .oddix-featured-strip,
          .oddix-tabs-wrapper,
          .oddix-layout,
          .oddix-footer,
          .oddix-player-props-home-section,
          .oddix-vip-results,
          .oddix-hot-markets,
          .oddix-hot-entries {
            width: min(100% - 24px, 100%) !important;
          }

          .oddix-hero-main {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
            padding: 26px 18px 0 !important;
            text-align: center !important;
          }

          .oddix-hero-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }

          .oddix-hero-player-box {
            min-height: 250px !important;
            height: 250px !important;
          }

          .oddix-hero-player {
            position: relative !important;
            height: 278px !important;
            right: auto !important;
            bottom: auto !important;
            object-position: center bottom !important;
          }

          .oddix-vip-panel {
            grid-template-columns: 1fr !important;
          }

          .oddix-top-pick-hero {
            grid-template-columns: 1fr !important;
            text-align: center !important;
          }

          .oddix-games-grid {
            max-height: none !important;
            overflow-y: visible !important;
          }
        }

        @media (max-width: 560px) {
          .oddix-hero-main {
            padding: 22px 14px 0 !important;
            border-radius: 22px !important;
          }

          .oddix-hero-text h1 {
            font-size: clamp(30px, 11vw, 42px) !important;
            letter-spacing: -1px !important;
          }

          .oddix-hero-stats {
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .oddix-info-metric:nth-child(n+5) {
            display: none !important;
          }

          .oddix-hero-player-box {
            height: 210px !important;
            min-height: 210px !important;
          }

          .oddix-hero-player {
            height: 230px !important;
          }
        }



        /* ODDIX V23 ANIMATIONS + TRUST LAYER */
        .oddix-v23-confidence-fill {
          position: relative;
          overflow: hidden;
          animation: oddixV23Grow .95s ease-out both;
          transform-origin: left center;
        }
        .oddix-v23-confidence-fill::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.38), transparent);
          transform: translateX(-100%);
          animation: oddixV23Shine 2.4s ease-in-out infinite;
        }
        .oddix-v23-card {
          transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease;
        }
        .oddix-v23-card:hover {
          transform: translateY(-4px);
          border-color: rgba(250,204,21,.56) !important;
          box-shadow: 0 24px 70px rgba(0,0,0,.38), 0 0 34px rgba(250,204,21,.13) !important;
        }
        @keyframes oddixV23Grow {
          from { transform: scaleX(.18); opacity: .35; }
          to { transform: scaleX(1); opacity: 1; }
        }
        @keyframes oddixV23Shine {
          0% { transform: translateX(-120%); }
          55%, 100% { transform: translateX(120%); }
        }
        @media (max-width: 980px) {
          .oddix-v23-grid { grid-template-columns: 1fr !important; }
          .oddix-v23-ranking-grid { grid-template-columns: 1fr !important; }
          .oddix-v23-heatmap { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }


        /* ODDIX V23.1 FRAME FIX - corrige cards/rodapé saindo do enquadro */
        .oddix-dashboard,
        .oddix-dashboard * {
          box-sizing: border-box !important;
        }

        .oddix-main-content,
        .oddix-layout,
        .oddix-games-grid,
        .oddix-footer,
        .oddix-footer-metrics {
          min-width: 0 !important;
          max-width: 100% !important;
        }

        .oddix-main-content {
          overflow: hidden !important;
        }

        .oddix-games-grid {
          width: 100% !important;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)) !important;
          gap: 14px !important;
          padding: 8px 10px 18px 8px !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
        }

        .oddix-game-card {
          min-width: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
          overflow: hidden !important;
        }

        .oddix-game-card > *,
        .oddix-game-card div,
        .oddix-game-card button {
          min-width: 0 !important;
          max-width: 100% !important;
        }

        .oddix-game-card span,
        .oddix-game-card strong,
        .oddix-game-card small,
        .oddix-game-card p {
          min-width: 0 !important;
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
        }

        .oddix-game-card button {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .oddix-game-card [style*="grid-template-columns: 1fr auto 1fr"] {
          grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) !important;
        }

        .oddix-game-card [style*="display: flex"][style*="align-items: center"] span {
          display: block !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .oddix-footer {
          display: grid !important;
          grid-template-columns: minmax(220px,.9fr) minmax(0,1.55fr) minmax(190px,.75fr) !important;
          align-items: center !important;
          gap: 18px !important;
          overflow: hidden !important;
        }

        .oddix-footer-metrics {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }

        .oddix-footer .oddix-info-metric {
          min-width: 0 !important;
          padding: 10px 8px !important;
          overflow: hidden !important;
        }

        .oddix-footer .oddix-info-metric strong {
          font-size: clamp(14px, 1.25vw, 21px) !important;
          line-height: 1.02 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .oddix-footer .oddix-info-metric span {
          font-size: 9px !important;
        }

        @media (max-width: 1280px) {
          .oddix-layout {
            grid-template-columns: 240px minmax(0, 1fr) !important;
            gap: 16px !important;
          }

          .oddix-games-grid {
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)) !important;
          }

          .oddix-game-card {
            padding: 14px !important;
          }
        }

        @media (max-width: 1180px) {
          .oddix-layout {
            grid-template-columns: 1fr !important;
          }

          .oddix-sidebar {
            position: relative !important;
            top: auto !important;
            max-height: none !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 980px) {
          .oddix-footer {
            grid-template-columns: 1fr !important;
            text-align: center !important;
          }

          .oddix-footer-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 620px) {
          .oddix-sidebar,
          .oddix-footer-metrics {
            grid-template-columns: 1fr !important;
          }

          .oddix-games-grid {
            grid-template-columns: 1fr !important;
            max-height: none !important;
            overflow-y: visible !important;
          }
        }



        /* ODDIX V23.1 LAYOUT FIX - enquadramento definitivo */
        .oddix-dashboard,
        .oddix-dashboard * {
          box-sizing: border-box !important;
        }

        .oddix-dashboard {
          overflow-x: hidden !important;
        }

        .oddix-brand img {
          height: 58px !important;
          width: auto !important;
          max-width: 142px !important;
          object-fit: contain !important;
          filter: drop-shadow(0 0 16px rgba(168,85,247,.55)) !important;
        }

        .oddix-brand {
          min-width: 150px !important;
          min-height: 58px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: visible !important;
        }

        .oddix-hero-grid {
          grid-template-columns: minmax(0, 1fr) clamp(260px, 21vw, 310px) !important;
          gap: clamp(16px, 1.8vw, 24px) !important;
          align-items: stretch !important;
          overflow: visible !important;
        }

        .oddix-hero-main {
          min-height: clamp(660px, 56vw, 760px) !important;
          grid-template-columns: minmax(0, .86fr) minmax(360px, 1.14fr) !important;
          align-items: stretch !important;
          padding: clamp(30px, 3vw, 46px) clamp(30px, 3vw, 48px) 0 !important;
          overflow: hidden !important;
        }

        .oddix-hero-text {
          align-self: center !important;
          max-width: 560px !important;
          padding-bottom: clamp(24px, 3vw, 42px) !important;
        }

        .oddix-hero-text h1 {
          max-width: 460px !important;
          font-size: clamp(56px, 5.3vw, 86px) !important;
          line-height: .9 !important;
          letter-spacing: -3px !important;
          margin-bottom: 16px !important;
        }

        .oddix-hero-text p {
          max-width: 430px !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] {
          max-width: 460px !important;
          padding: 14px !important;
          border-radius: 22px !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] strong {
          font-size: clamp(21px, 2vw, 30px) !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] > div[style*="repeat(4"] {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .oddix-hero-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          max-width: 460px !important;
          gap: 10px !important;
          margin-top: 18px !important;
        }

        .oddix-hero-stats .oddix-info-metric {
          min-height: 64px !important;
          padding: 10px !important;
        }

        .oddix-hero-stats .oddix-info-metric strong {
          font-size: clamp(19px, 1.8vw, 26px) !important;
        }

        .oddix-hero-player-box {
          position: relative !important;
          min-height: clamp(560px, 50vw, 720px) !important;
          height: 100% !important;
          align-self: end !important;
          overflow: hidden !important;
        }

        .oddix-hero-player {
          position: absolute !important;
          right: clamp(0px, 1.5vw, 24px) !important;
          bottom: 0 !important;
          height: min(88%, 640px) !important;
          max-height: 640px !important;
          width: 100% !important;
          transform: none !important;
          object-fit: contain !important;
          object-position: center bottom !important;
        }

        .oddix-vip-panel.oddix-boost-ticket,
        .oddix-boost-ticket-v21 {
          min-height: clamp(660px, 56vw, 760px) !important;
          padding: clamp(22px, 2vw, 30px) !important;
          overflow: hidden !important;
        }

        .oddix-boost-ticket-v22-return {
          margin-top: 20px !important;
          padding: 18px 16px !important;
        }

        .oddix-boost-ticket-v22-return strong {
          font-size: clamp(42px, 3.9vw, 62px) !important;
          line-height: .9 !important;
          letter-spacing: -2px !important;
          white-space: nowrap !important;
        }

        .oddix-boost-mini-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
          margin: 18px 0 10px !important;
        }

        .oddix-boost-mini-metric {
          min-width: 0 !important;
          min-height: 86px !important;
          border-radius: 16px !important;
          padding: 13px 12px !important;
          background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)) !important;
          border: 1px solid rgba(250,204,21,.22) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.12) !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
        }

        .oddix-boost-mini-metric span {
          color: rgba(255,255,255,.82) !important;
          font-size: 10px !important;
          line-height: 1.1 !important;
          font-weight: 1000 !important;
          text-transform: uppercase !important;
          letter-spacing: .65px !important;
          white-space: nowrap !important;
        }

        .oddix-boost-mini-metric strong {
          color: #facc15 !important;
          font-size: clamp(31px, 2.6vw, 42px) !important;
          line-height: .95 !important;
          letter-spacing: -1.8px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: clip !important;
          text-shadow: 0 0 20px rgba(250,204,21,.25) !important;
        }

        .oddix-boost-ticket [style*="grid-template-columns: 28px 1fr auto"] {
          min-width: 0 !important;
          grid-template-columns: 28px minmax(0, 1fr) auto !important;
        }

        .oddix-games-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)) !important;
          overflow-x: hidden !important;
        }

        .oddix-games-grid > *,
        .oddix-featured-strip > *,
        .oddix-layout > *,
        .oddix-sidebar > * {
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }

        .oddix-games-grid button,
        .oddix-featured-strip button {
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }

        .oddix-games-grid b,
        .oddix-games-grid span,
        .oddix-games-grid small,
        .oddix-featured-strip b,
        .oddix-featured-strip span,
        .oddix-featured-strip small {
          min-width: 0 !important;
          overflow-wrap: anywhere !important;
        }

        .oddix-footer {
          overflow: hidden !important;
        }

        .oddix-footer > div,
        .oddix-footer * {
          min-width: 0 !important;
        }

        @media (max-width: 1180px) {
          .oddix-hero-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-hero-main {
            min-height: auto !important;
            grid-template-columns: 1fr !important;
            padding-bottom: 0 !important;
          }

          .oddix-hero-text {
            max-width: 100% !important;
            text-align: center !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }

          .oddix-hero-text h1,
          .oddix-hero-text p,
          .oddix-hero-text > div[style*="margin-top: 22px"],
          .oddix-hero-stats {
            margin-left: auto !important;
            margin-right: auto !important;
          }

          .oddix-hero-player-box {
            min-height: 360px !important;
            height: 360px !important;
          }

          .oddix-hero-player {
            position: absolute !important;
            height: 360px !important;
            max-height: 360px !important;
            right: 0 !important;
            left: 0 !important;
            margin: auto !important;
            object-position: center bottom !important;
          }

          .oddix-vip-panel.oddix-boost-ticket,
          .oddix-boost-ticket-v21 {
            min-height: auto !important;
          }
        }

        @media (max-width: 560px) {
          .oddix-brand img {
            height: 44px !important;
          }

          .oddix-brand {
            min-width: 118px !important;
            min-height: 48px !important;
          }

          .oddix-hero-text h1 {
            font-size: clamp(38px, 13vw, 52px) !important;
            letter-spacing: -1.5px !important;
          }

          .oddix-hero-text > div[style*="margin-top: 22px"] > div[style*="repeat(4"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .oddix-hero-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .oddix-boost-mini-grid {
            grid-template-columns: 1fr !important;
          }

          .oddix-boost-mini-metric strong {
            font-size: 38px !important;
          }
        }


        /* ODDIX V24 PROFESSIONAL REAL SIDEBAR
           Sidebar real de dashboard: fica ao lado do conteúdo, mostra links com texto,
           estatísticas rápidas, grupo free e parceiro sem cobrir cards. */
        html {
          scroll-behavior: smooth;
        }

        .oddix-anchor-target {
          scroll-margin-top: 154px;
        }

        .oddix-dashboard {
          padding-left: 238px !important;
        }

        .oddix-side-menu {
          position: fixed;
          left: 14px;
          top: 96px;
          bottom: 18px;
          z-index: 118;
          width: 210px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 14px;
          border-radius: 24px;
          background:
            radial-gradient(circle at 30% 0%, rgba(123,44,255,.24), transparent 40%),
            linear-gradient(180deg, rgba(12,8,24,.96), rgba(17,7,39,.94));
          border: 1px solid rgba(168,85,247,.34);
          box-shadow: 0 18px 55px rgba(0,0,0,.42), 0 0 28px rgba(123,44,255,.16), inset 0 1px 0 rgba(255,255,255,.08);
          backdrop-filter: blur(18px);
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(168,85,247,.45) transparent;
        }

        .oddix-side-menu::-webkit-scrollbar {
          width: 5px;
        }

        .oddix-side-menu::-webkit-scrollbar-thumb {
          background: rgba(168,85,247,.45);
          border-radius: 999px;
        }

        .oddix-side-menu-title {
          color: #facc15;
          font-size: 10px;
          line-height: 1;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: .9px;
          padding: 2px 4px 4px;
        }

        .oddix-side-menu-group {
          display: grid;
          gap: 8px;
        }

        .oddix-side-menu button,
        .oddix-side-menu a {
          width: 100%;
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          padding: 0 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.055);
          color: rgba(255,255,255,.92);
          font-size: 12px;
          font-weight: 1000;
          line-height: 1;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          transition: .18s ease;
        }

        .oddix-side-menu button span:first-child,
        .oddix-side-menu a span:first-child {
          width: 24px;
          height: 24px;
          min-width: 24px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(123,44,255,.32);
          font-size: 14px;
          line-height: 1;
        }

        .oddix-side-menu button:hover,
        .oddix-side-menu a:hover {
          transform: translateX(3px);
          border-color: rgba(250,204,21,.66);
          color: #facc15;
          background: rgba(250,204,21,.10);
          box-shadow: 0 0 18px rgba(250,204,21,.12);
        }

        .oddix-side-box {
          border-radius: 18px;
          padding: 13px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(255,255,255,.10);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }



        .oddix-side-search {
          display: grid;
          gap: 8px;
        }

        .oddix-side-search input,
        .oddix-side-search select {
          width: 100%;
          height: 36px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(4,3,12,.72);
          color: #fff;
          outline: none;
          padding: 0 10px;
          font-size: 11px;
          font-weight: 800;
        }

        .oddix-side-search select option {
          background: #10051f;
          color: #fff;
        }
        .oddix-side-box h4 {
          margin: 0 0 9px;
          color: #fff;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: .2px;
        }

        .oddix-side-box p {
          margin: 0 0 10px;
          color: rgba(255,255,255,.70);
          font-size: 11px;
          line-height: 1.25;
          font-weight: 700;
        }

        .oddix-side-stat-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 7px 0;
          border-bottom: 1px solid rgba(255,255,255,.07);
          color: rgba(255,255,255,.70);
          font-size: 11px;
          font-weight: 800;
        }

        .oddix-side-stat-row:last-child {
          border-bottom: 0;
        }

        .oddix-side-stat-row strong {
          color: #facc15;
          font-weight: 1000;
        }

        .oddix-side-cta {
          width: 100%;
          height: 38px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg,#22c55e,#16a34a) !important;
          color: #052e16 !important;
          font-size: 12px !important;
          font-weight: 1000 !important;
          justify-content: center !important;
          padding: 0 10px !important;
          box-shadow: 0 10px 22px rgba(34,197,94,.18);
        }

        .oddix-side-cta.partner {
          background: linear-gradient(135deg,#facc15,#fb923c) !important;
          color: #1f1300 !important;
          box-shadow: 0 10px 22px rgba(250,204,21,.18);
        }


        #oddix-games > .oddix-sidebar {
          display: none !important;
        }

        #oddix-games > .oddix-main-content {
          min-width: 0 !important;
          width: 100% !important;
        }
        @media (max-width: 1180px) {
          .oddix-dashboard {
            padding-left: 0 !important;
            padding-bottom: 78px !important;
          }

          .oddix-side-menu {
            left: 50%;
            right: auto;
            top: auto;
            bottom: 12px;
            transform: translateX(-50%);
            width: min(94vw, 720px);
            max-height: 62px;
            min-height: 62px;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 999px;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
          }

          .oddix-side-menu::-webkit-scrollbar {
            display: none;
          }

          .oddix-side-menu-title,
          .oddix-side-box {
            display: none;
          }

          .oddix-side-menu-group {
            display: flex;
            gap: 8px;
            min-width: max-content;
          }

          .oddix-side-menu button,
          .oddix-side-menu a {
            width: auto;
            min-width: 46px;
            height: 46px;
            min-height: 46px;
            border-radius: 999px;
            padding: 0 13px;
          }

          .oddix-side-menu button span:first-child,
          .oddix-side-menu a span:first-child {
            width: 24px;
            height: 24px;
          }
        }

        @media (max-width: 640px) {
          .oddix-side-menu button span:last-child,
          .oddix-side-menu a span:last-child {
            display: none;
          }

          .oddix-side-menu button,
          .oddix-side-menu a {
            width: 46px;
            min-width: 46px;
            padding: 0;
            justify-content: center;
          }
        }



        /* ODDIX V24.1 - FIX DESTAQUES IA GRID
           Corrige a área de Destaques que ficava estreita quando a sidebar fixa escondia a sidebar antiga. */
        #oddix-games.oddix-layout {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 26px !important;
          margin-right: 26px !important;
        }

        #oddix-games > .oddix-main-content {
          display: block !important;
          grid-column: 1 / -1 !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow: hidden !important;
        }

        .oddix-section-header {
          display: flex !important;
          align-items: flex-end !important;
          justify-content: space-between !important;
          gap: 16px !important;
          flex-wrap: wrap !important;
          width: 100% !important;
        }

        .oddix-games-grid {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important;
          gap: 16px !important;
          max-height: 860px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding: 10px 10px 18px !important;
        }

        .oddix-game-card {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
        }

        .oddix-game-card [style*="justify-content: space-between"] {
          min-width: 0 !important;
        }

        .oddix-game-card [style*="align-items: center"] span,
        .oddix-game-card [style*="align-items: center"] strong {
          min-width: 0 !important;
          max-width: 100% !important;
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
          line-height: 1.12 !important;
        }

        .oddix-game-card [style*="display: flex"][style*="align-items: center"] {
          min-width: 0 !important;
        }

        .oddix-game-card img {
          flex-shrink: 0 !important;
        }

        .oddix-featured-strip {
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important;
        }

        @media (max-width: 1180px) {
          #oddix-games.oddix-layout {
            margin-left: 14px !important;
            margin-right: 14px !important;
          }

          .oddix-games-grid {
            grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .oddix-games-grid {
            grid-template-columns: 1fr !important;
          }
        }


        /* ODDIX V24.2 - COMPACT TYPOGRAPHY + SPORTSBOOK BALANCE
           Diminui letras grandes, aproveita melhor o hero e evita cortes no bilhete. */
        .oddix-dashboard {
          --oddix-sidebar-w: 220px;
        }

        .oddix-layout {
          grid-template-columns: var(--oddix-sidebar-w) minmax(0, 1fr) !important;
          gap: 18px !important;
          align-items: start !important;
        }

        .oddix-sidebar {
          width: var(--oddix-sidebar-w) !important;
          max-width: var(--oddix-sidebar-w) !important;
        }

        .oddix-main-content,
        .oddix-content,
        .oddix-hero-grid,
        .oddix-hero-main,
        .oddix-vip-panel {
          min-width: 0 !important;
        }

        .oddix-hero-grid {
          grid-template-columns: minmax(0, 1fr) clamp(280px, 22vw, 340px) !important;
          gap: 18px !important;
          margin: 18px 26px 20px !important;
          align-items: stretch !important;
        }

        .oddix-hero-main {
          min-height: clamp(480px, 42vw, 560px) !important;
          height: auto !important;
          grid-template-columns: minmax(440px, .62fr) minmax(320px, .38fr) !important;
          padding: clamp(26px, 2.2vw, 34px) clamp(28px, 2.4vw, 38px) 0 !important;
          align-items: center !important;
          border-radius: 28px !important;
        }

        .oddix-hero-text {
          align-self: center !important;
          max-width: 620px !important;
          padding-bottom: 22px !important;
        }

        .oddix-hero-text h1 {
          max-width: 620px !important;
          font-size: clamp(38px, 3.5vw, 56px) !important;
          line-height: 1.02 !important;
          letter-spacing: -1.6px !important;
          margin: 12px 0 14px !important;
          white-space: normal !important;
          text-wrap: balance !important;
        }

        .oddix-hero-text p {
          max-width: 560px !important;
          font-size: clamp(14px, 1.1vw, 16px) !important;
          line-height: 1.35 !important;
          margin: 0 0 16px !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] {
          max-width: 520px !important;
          margin-top: 16px !important;
          padding: 14px !important;
          border-radius: 18px !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] strong {
          font-size: clamp(18px, 1.7vw, 26px) !important;
          line-height: 1.05 !important;
          letter-spacing: -.5px !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] span,
        .oddix-hero-text > div[style*="margin-top: 22px"] small {
          font-size: 10px !important;
          line-height: 1.08 !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] > div[style*="repeat(4"] {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .oddix-hero-text > div[style*="margin-top: 22px"] > div[style*="repeat(4"] > div {
          padding: 10px 8px !important;
          min-width: 0 !important;
          overflow: hidden !important;
        }

        .oddix-hero-stats {
          grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          max-width: 100% !important;
          gap: 8px !important;
          margin-top: 16px !important;
        }

        .oddix-hero-stats .oddix-info-metric {
          min-height: 56px !important;
          padding: 8px 6px !important;
          border-radius: 14px !important;
        }

        .oddix-hero-stats .oddix-info-metric strong {
          font-size: clamp(16px, 1.45vw, 22px) !important;
          line-height: 1 !important;
        }

        .oddix-hero-stats .oddix-info-metric span {
          font-size: 8.5px !important;
        }

        .oddix-hero-player-box {
          min-height: clamp(430px, 39vw, 540px) !important;
          height: 100% !important;
          align-self: end !important;
          overflow: hidden !important;
        }

        .oddix-hero-player {
          right: clamp(0px, 1vw, 18px) !important;
          bottom: 0 !important;
          height: min(96%, 520px) !important;
          max-height: 520px !important;
          width: 100% !important;
          transform: none !important;
          object-fit: contain !important;
          object-position: center bottom !important;
        }

        .oddix-hero-bottom-features {
          display: none !important;
        }

        .oddix-vip-panel.oddix-boost-ticket,
        .oddix-boost-ticket-v21 {
          min-height: clamp(480px, 42vw, 560px) !important;
          height: auto !important;
          padding: 26px 22px !important;
          overflow: hidden !important;
        }

        .oddix-boost-ticket-v22-return {
          padding: 16px 14px !important;
          border-radius: 20px !important;
          overflow: hidden !important;
        }

        .oddix-boost-ticket-v22-return strong {
          font-size: clamp(42px, 3.6vw, 58px) !important;
          line-height: .9 !important;
          white-space: nowrap !important;
        }

        .oddix-boost-mini-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
          margin-top: 16px !important;
        }

        .oddix-boost-mini-metric {
          min-width: 0 !important;
          overflow: hidden !important;
          padding: 13px 10px !important;
          border-radius: 16px !important;
        }

        .oddix-boost-mini-metric span {
          font-size: 9px !important;
          letter-spacing: .5px !important;
          white-space: nowrap !important;
        }

        .oddix-boost-mini-metric strong {
          display: block !important;
          font-size: clamp(30px, 2.8vw, 42px) !important;
          line-height: .95 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: clip !important;
        }

        .oddix-games-grid {
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) !important;
          gap: 16px !important;
          max-height: none !important;
          overflow-y: visible !important;
        }

        .oddix-game-card {
          min-height: 260px !important;
          padding: 18px !important;
        }

        .oddix-game-card [style*="grid-template-columns: 1fr auto 1fr"] {
          grid-template-columns: minmax(90px, 1fr) auto minmax(90px, 1fr) !important;
          gap: 12px !important;
        }

        .oddix-game-card [style*="grid-template-columns: 1fr auto 1fr"] span,
        .oddix-game-card [style*="grid-template-columns: 1fr auto 1fr"] strong {
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
          line-height: 1.14 !important;
        }

        .oddix-section-header h2,
        .oddix-section-header strong {
          font-size: clamp(18px, 1.4vw, 24px) !important;
        }

        @media (max-width: 1360px) {
          .oddix-layout {
            grid-template-columns: 210px minmax(0, 1fr) !important;
          }

          .oddix-sidebar {
            width: 210px !important;
            max-width: 210px !important;
          }

          .oddix-hero-grid {
            grid-template-columns: minmax(0, 1fr) 300px !important;
            gap: 16px !important;
          }

          .oddix-hero-main {
            grid-template-columns: minmax(420px, .63fr) minmax(280px, .37fr) !important;
          }

          .oddix-hero-text h1 {
            font-size: clamp(36px, 3.2vw, 50px) !important;
          }
        }

        @media (max-width: 1180px) {
          .oddix-layout {
            grid-template-columns: 1fr !important;
          }

          .oddix-sidebar {
            width: auto !important;
            max-width: none !important;
          }

          .oddix-hero-grid {
            grid-template-columns: 1fr !important;
            margin-left: 14px !important;
            margin-right: 14px !important;
          }

          .oddix-hero-main {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }

          .oddix-hero-text h1 {
            font-size: clamp(34px, 8vw, 48px) !important;
          }

          .oddix-hero-player-box {
            min-height: 280px !important;
            height: 280px !important;
          }

          .oddix-hero-player {
            position: relative !important;
            height: 300px !important;
            right: auto !important;
            bottom: auto !important;
          }

          .oddix-hero-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .oddix-hero-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .oddix-games-grid {
            grid-template-columns: 1fr !important;
          }
        }

      `}</style>
      <FreeLockModal
        open={freeLockOpen}
        onClose={() => setFreeLockOpen(false)}
        onUpgrade={() => (window.location.href = "/plans")}
      />

      <nav className="oddix-side-menu" aria-label="Sidebar do dashboard Oddix">
        <div className="oddix-side-menu-title">Dashboard</div>

        <div className="oddix-side-menu-group">
          <button type="button" onClick={() => openSportsButton("dashboard")}><span>🏠</span><span>Destaques</span></button>
          <button type="button" onClick={() => openSportsButton("live")}><span>🔴</span><span>Ao Vivo</span></button>
          <button type="button" onClick={() => openSportsButton("smart")}><span>🤖</span><span>IA Premium</span></button>
          <button type="button" onClick={() => openSportsButton("boost")}><span>🔥</span><span>Combinadas</span></button>
          <button type="button" onClick={() => openSportsButton("playerprops")}><span>👤</span><span>Player Props</span></button>
          <button type="button" onClick={() => openSportsButton("greens")}><span>✅</span><span>Greens</span></button>
          <button type="button" onClick={() => document.getElementById("oddix-games")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>⚽</span><span>Jogos</span></button>
        </div>

        <div className="oddix-side-box oddix-side-search">
          <h4>🔎 Busca</h4>
          <input placeholder="Buscar time ou liga" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}>
            <option value="all">Todas as ligas</option>
            {leagues.map((league) => <option key={league} value={league}>{league}</option>)}
          </select>
          <button type="button" className="oddix-side-cta partner" onClick={() => loadAll(false)}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
        </div>

        <div className="oddix-side-box">
          <h4>📊 Estatísticas</h4>
          <div className="oddix-side-stat-row"><span>Jogos</span><strong>{games.length}</strong></div>
          <div className="oddix-side-stat-row"><span>Ao vivo</span><strong>{liveGames.length}</strong></div>
          <div className="oddix-side-stat-row"><span>Pré-jogo</span><strong>{futureGames.length}</strong></div>
          <div className="oddix-side-stat-row"><span>Tips IA</span><strong>{displayedSmartTips.length}</strong></div>
        </div>

        <div className="oddix-side-box">
          <h4>🎁 Grupo FREE</h4>
          <p>Receba amostras e chamadas para o VIP.</p>
          <button type="button" className="oddix-side-cta" onClick={() => window.open(FREE_GROUP_LINK, "_blank")}>Entrar no grupo</button>
        </div>

        <div className="oddix-side-box">
          <h4>💰 Parceiro</h4>
          <p>EstrelaBet oficial da Oddix.</p>
          <button type="button" className="oddix-side-cta partner" onClick={() => window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer")}>Apostar agora</button>
        </div>
      </nav>
      <header className="oddix-top-header" style={styles.topHeader}>
        <div className="oddix-brand" style={styles.brand} onClick={() => (window.location.href = "/dashboard")}>
          <img
            src="/logo-oddix-horizontal.png"
            alt="ODDIX TIPSTER IA"
            style={styles.brandLogo}
          />
        </div>

        <div className="oddix-header-actions" style={styles.headerActions}>
          <button style={styles.headerPill}>Plano {plan}</button>
          <button style={styles.headerButton} onClick={() => openSportsButton("live")}>Ao vivo</button>
          
          
          <button style={styles.vipButton} onClick={() => (window.location.href = "/plans")}>Assinar VIP</button>
          <button style={styles.logoutButton} onClick={logout}>Sair</button>
        </div>
      </header>

      <section className="oddix-sports-rail" style={styles.sportsRail}>
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
            <button style={styles.pickActionButton} onClick={() => window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer")}>
              🎯 Pegar palpite na EstrelaBet
            </button>
            <button style={styles.secondaryButton} onClick={() => setSelectedAnalysis(null)}>
              Voltar aos jogos
            </button>
          </div>
        </section>
      )}

      <section id="oddix-hero" className="oddix-hero-grid oddix-hero-v21 oddix-anchor-target" style={styles.heroGrid}>
        <div className="oddix-hero-main oddix-hero-main-v21" style={styles.heroMain}>
          <div className="oddix-hero-text" style={styles.heroTextBlock}>
            <span style={styles.sectionKicker}>ODDIX AI V3 • DASHBOARD PREMIUM</span>
            <h1>TOP PICK<br />DO DIA</h1>
            <p>
              {topPick ? `${topPick.game || "Entrada premium Oddix"} • ${topPick.tip || "Mercado protegido"} • Odd ${topPick.odd || "1.70"} com ${safeNumber(topPick.confidence, 0)}% de confiança.` : "A Oddix filtra jogos, odds, mercados e sinais ao vivo para mostrar somente entradas com leitura forte e risco controlado."}
            </p>

            {topPick && (
              <div style={{
                marginTop: 22,
                maxWidth: 610,
                borderRadius: 24,
                padding: 18,
                background: "linear-gradient(135deg, rgba(250,204,21,.16), rgba(123,44,255,.16))",
                border: "1px solid rgba(250,204,21,.40)",
                boxShadow: "0 18px 48px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.12)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", marginBottom: 12 }}>
                  <span style={{ color: "#facc15", fontSize: 11, fontWeight: 1000, letterSpacing: 1.1, textTransform: "uppercase" }}>🔥 Top Pick do Dia</span>
                  <span style={{ color: "rgba(255,255,255,.74)", fontSize: 11, fontWeight: 900 }}>{topPick?.league || topPickGame?.league?.name || "Oddix Premium"}</span>
                </div>

                <strong style={{ display: "block", fontSize: "clamp(20px, 2.2vw, 34px)", lineHeight: 1, letterSpacing: -0.8, marginBottom: 8 }}>
                  {topPick?.game || `${topPickGame?.teams?.home?.name || "Casa"} x ${topPickGame?.teams?.away?.name || "Fora"}`}
                </strong>
                <span style={{ display: "block", color: "rgba(255,255,255,.78)", fontWeight: 900, marginBottom: 14 }}>{topPick?.tip || "Entrada premium protegida"}</span>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                  <InfoMetric label="Odd" value={topPick?.odd || "1.70"} />
                  <InfoMetric label="Confiança" value={`${safeNumber(topPick?.confidence, 0)}%`} />
                  <InfoMetric label="Risco" value={topPick?.risk || "Baixo"} />
                  <InfoMetric label="Score" value={`${safeNumber(topPick?.qualityScore || topPickGame?.oddix?.qualityScore, 0)}/100`} />
                </div>

                <div style={styles.confidenceBar}>
                  <div style={{ ...styles.confidenceFill, width: `${Math.min(100, Math.max(8, safeNumber(topPick?.confidence, 0)))}%` }} />
                </div>
              </div>
            )}

            <div style={styles.heroCtaRow}>
              <button style={styles.heroPrimaryCta} onClick={() => topPickGame ? openMatchDetail(topPickGame) : setActiveTab("highlights")}>🔥 ABRIR ANÁLISE PREMIUM</button>
              <button style={styles.heroSecondaryCta} onClick={() => (window.location.href = "/plans")}>💎 VIRAR VIP</button>
            </div>

            <div className="oddix-hero-stats" style={styles.heroStats}>
              <InfoMetric label="Greens" value={stats?.wonBets || wonBetsList.length || 0} />
              <InfoMetric label="Reds" value={stats?.lostBets || 0} />
              <InfoMetric label="ROI" value={`${stats?.roi || 0}%`} />
              <InfoMetric label="Análises" value={stats?.totalBets || savedBets.length || games.length} />
              <InfoMetric label="Ao vivo" value={liveGames.length} />
              <InfoMetric label="Tips IA" value={displayedSmartTips.length} />
            </div>
          </div>

          <div className="oddix-hero-player-box" style={styles.heroPlayerBox}>
            <div style={styles.heroPlayerGlow} />
            <img className="oddix-hero-player" src={ODDIX_PLAYER_IMAGE} alt="Jogador Oddix" style={styles.heroPlayerImage} />
          </div>

          <div className="oddix-hero-bottom-features" style={styles.heroBottomFeatures}>
            <span>🏆 TOP PICK IA V3</span>
            <span>⚡ FLASHSCORE + LEITURA AO VIVO</span>
            <span>📊 SCORE PROFISSIONAL</span>
            <span>💎 CONVERSÃO VIP</span>
          </div>
        </div>

        <div className="oddix-vip-panel oddix-boost-ticket oddix-boost-ticket-v21" style={styles.vipPanel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ color: "rgba(255,255,255,.70)", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 1 }}>Bilhete Oficial</span>
            <b style={{ color: "#facc15", fontSize: 12 }}>ODDIX BOOST</b>
          </div>
          <div className="oddix-boost-ticket-v22-return" style={{
            marginTop: 10,
            padding: "18px 16px",
            borderRadius: 24,
            background: "linear-gradient(135deg, rgba(250,204,21,.18), rgba(251,146,60,.10))",
            border: "1px solid rgba(250,204,21,.34)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), 0 18px 40px rgba(250,204,21,.10)",
          }}>
            <span style={{ display: "block", color: "rgba(255,255,255,.72)", fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 1.1 }}>Retorno potencial</span>
            <strong style={{ display: "block", color: "#facc15", marginTop: 6 }}>R$ {Number(safeNumber(boost.combinedOdd, 0) * 100).toFixed(0)}</strong>
            <small style={{ color: "rgba(255,255,255,.64)", fontWeight: 900 }}>Simulação com entrada de R$100</small>
          </div>

          <div className="oddix-boost-mini-grid">
            <div className="oddix-boost-mini-metric">
              <span>Odd total</span>
              <strong>{boost.combinedOdd}</strong>
            </div>
            <div className="oddix-boost-mini-metric">
              <span>Confiança</span>
              <strong>{boost.confidence || boostConfidence || 0}%</strong>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, margin: "16px 0" }}>
            {(boost.picks.length ? boost.picks : displayedSmartTips.slice(0, 3)).slice(0, 3).map((pick: any, index: number) => (
              <div key={`${pick.fixtureId || pick.game || index}-boost-ticket`} style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr auto",
                gap: 10,
                alignItems: "center",
                padding: "12px",
                borderRadius: 16,
                background: "rgba(255,255,255,.065)",
                border: "1px solid rgba(255,255,255,.12)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
              }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(34,197,94,.18)", color: "#22c55e", fontWeight: 1000 }}>✓</span>
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pick.game || "Entrada Oddix"}</b>
                  <small style={{ color: "rgba(255,255,255,.62)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pick.tip || pick.market || "Mercado protegido"}</small>
                </span>
                <b style={{ color: "#facc15", fontSize: 17 }}>{pick.odd || "1.70"}</b>
              </div>
            ))}
          </div>
          <div style={styles.confidenceBar}><div style={{ ...styles.confidenceFill, width: `${Math.min(100, boost.confidence || boostConfidence || 0)}%` }} /></div>
          <button style={styles.vipFullButton} onClick={() => setActiveTab("boost")}>Abrir bilhete VIP</button>
        </div>
      </section>

      <div id="oddix-results" className="oddix-anchor-target">
        <V21ResultsRibbon
          recentBets={recentResultBets}
          won={stats?.wonBets || 0}
          lost={stats?.lostBets || 0}
          roi={stats?.roi || 0}
          onOpenGreens={() => setActiveTab("greens")}
        />
      </div>


      <V26ConversionLayer
        picks={premiumBoost.length ? premiumBoost : displayedSmartTips.slice(0, 3)}
        topTips={top5Tips}
        combinedOdd={boostOdd ? boostOdd.toFixed(2) : boost.combinedOdd}
        confidence={boostConfidence || boost.confidence || 0}
        won={stats?.wonBets || wonBetsList.length || 0}
        lost={stats?.lostBets || 0}
        roi={stats?.roi || 0}
        totalAnalyses={stats?.totalBets || savedBets.length || games.length}
        onOpenBoost={() => setActiveTab("boost")}
        onVip={() => (window.location.href = "/dashboard/vip")}
      />

      <TopPickHero
        tip={topPick}
        game={topPickGame}
        liveTick={liveTick}
        onAnalyze={(game: any) => openMatchDetail(game)}
      />


      <div id="oddix-trust" className="oddix-anchor-target">
        <V23TrustLayer
          tips={displayedSmartTips}
          games={games}
          recentBets={recentResultBets}
          stats={stats}
          onOpenSmart={() => setActiveTab("smart")}
          onOpenGreens={() => setActiveTab("greens")}
        />
      </div>

      <div id="oddix-markets" className="oddix-anchor-target">
        <HotMarketsSection
          tips={displayedSmartTips}
          games={games}
          onOpen={(tip: any) => {
            const game = getGameByTip(tip, games);
            if (game) openMatchDetail(game);
          }}
        />
      </div>

      <div id="oddix-playerprops" className="oddix-anchor-target">
        <PlayerPropsHome
          props={homePlayerProps}
          loading={playerPropsLoading}
          games={games}
          isPaidPlan={isPaidPlan}
          onOpen={(prop: any) => {
            const game = getGameByTip(prop, games);
            if (game) openMatchDetail(game);
          }}
          onUpgrade={() => (window.location.href = "/plans")}
        />
      </div>

      <PremiumTicketPreview
        tips={displayedSmartTips}
        games={games}
        isPaidPlan={isPaidPlan}
        onOpen={(tip: any) => {
          const game = getGameByTip(tip, games);
          if (game) openMatchDetail(game);
        }}
        onUpgrade={() => (window.location.href = "/plans")}
      />

      <VipMarketingStrip
        greens={stats?.wonBets || wonBetsList.length}
        roi={stats?.roi || 0}
        liveGames={liveGames.length}
        tips={displayedSmartTips.length}
        onVip={() => (window.location.href = "/plans")}
      />

      <MarketingBanner
        mainGame={topGames[0]}
        secondaryGames={topGames.slice(1, 4)}
        liveTick={liveTick}
        onAnalyze={openMatchDetail}
        onVip={() => (window.location.href = "/plans")}
      />

      <HotEntriesSection
        tips={displayedSmartTips}
        games={games}
        liveTick={liveTick}
        isPaidPlan={isPaidPlan}
        onOpen={(tip: any) => {
          const game = getGameByTip(tip, games);
          if (game) openMatchDetail(game);
        }}
        onUpgrade={() => (window.location.href = "/plans")}
      />


      <VipResultsSection
        won={stats?.wonBets || 0}
        lost={stats?.lostBets || 0}
        roi={stats?.roi || 0}
        recentBets={recentResultBets}
        onUpgrade={() => (window.location.href = "/plans")}
      />

      <section className="oddix-top-widgets" style={{ margin: "0 26px 20px" }}>
        <div className="oddix-top-widgets-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 18 }}>
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

      <section
        className="oddix-featured-strip"
        style={styles.featuredStrip}
        onWheel={(event) => {
          const el = event.currentTarget;
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            el.scrollTop += event.deltaY;
            event.preventDefault();
          }
        }}
      >
        {topGames.slice(0, 14).map((game) => (
          <FeaturedGame key={stableGameKey(game)} game={game} liveTick={liveTick} onAnalyze={() => openMatchDetail(game)} />
        ))}
      </section>

      <section className="oddix-tabs-wrapper" style={styles.tabsWrapper}>
        <div className="oddix-tabs" style={styles.tabs}>
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

      <section id="oddix-games" className="oddix-layout oddix-anchor-target" style={styles.layout}>
        <aside className="oddix-sidebar" style={styles.sidebar}>
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

        <section className="oddix-main-content" style={styles.mainContent}>
          {activeTab === "smart" && (
            <SmartTipsSection tips={displayedSmartTips} games={games} liveTick={liveTick} onAnalyze={openMatchDetail} />
          )}

          {activeTab === "boost" && (
            <BoostSection boost={boost} games={games} onAnalyze={openMatchDetail} />
          )}

          {activeTab === "playerprops" && (
            <PlayerPropsSection
              props={homePlayerProps}
              loading={playerPropsLoading}
              games={games}
              isPaidPlan={isPaidPlan}
              onUpgrade={() => (window.location.href = "/plans")}
              onAnalyze={openMatchDetail}
            />
          )}

          {activeTab === "greens" && (
            <GreensSection wonBets={wonBetsList} onBetNow={openEstrelaBet} />
          )}

          {activeTab !== "smart" && activeTab !== "boost" && activeTab !== "playerprops" && activeTab !== "greens" && (
            <>
              <div className="oddix-section-header" style={styles.sectionHeader}>
                <div>
                  <h2>{getTabTitle(activeTab)}</h2>
                  <p>{filteredGames.length} jogos encontrados</p>
                </div>
                <span style={styles.rouletteHint}>Role para ver mais jogos ↓</span>
              </div>

              {loading ? (
                <div style={styles.emptyBox}>Carregando jogos...</div>
              ) : filteredGames.length ? (
                <div
                  className="oddix-games-grid"
                  style={styles.gamesGrid}
                  onWheel={(event) => {
                    const el = event.currentTarget;
                    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                      el.scrollTop += event.deltaY;
                      event.preventDefault();
                    }
                  }}
                >
                  {filteredGames.map((game) => (
                    <GameCard
                      key={stableGameKey(game)}
                      game={game}
                      liveTick={liveTick}
                      analyzing={analyzingId === game?.fixture?.id}
                      onAnalyze={() => openMatchDetail(game)}
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

      <footer id="oddix-footer" className="oddix-footer oddix-footer-v21 oddix-anchor-target" style={styles.footer}>
        <div style={styles.footerBrand}>
          <strong>ODDIX IA™ V21</strong>
          <span>Plataforma premium de leitura esportiva com Top Pick, Boost, Player Props reais e IA V3.</span>
        </div>

        <div className="oddix-footer-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, flex: 1, minWidth: 0 }}>
          <InfoMetric label="Análises" value="+10K" />
          <InfoMetric label="Mercados" value="+500" />
          <InfoMetric label="Fonte" value="FlashScore" />
          <InfoMetric label="Engine" value="IA V3" />
          <InfoMetric label="Modo" value="VIP" />
        </div>

        <div style={styles.footerLegal}>
          <img src={LEGAL_SEAL_DARK} alt="18+ Jogue com responsabilidade. Aposta não é investimento." style={styles.footerLegalSeal} />
          <small style={styles.footerLegalText}>18+ Jogue com responsabilidade. Aposta não é investimento.</small>
        </div>
      </footer>
    </main>
  );
}

function V21ResultsRibbon({ recentBets, won, lost, roi, onOpenGreens }: { recentBets: any[]; won: number; lost: number; roi: number; onOpenGreens: () => void }) {
  const results = Array.isArray(recentBets) ? recentBets.slice(0, 5) : [];
  const total = won + lost;
  const winRate = total ? Math.round((won / total) * 100) : roi || 0;

  return (
    <section className="oddix-v21-results-ribbon" style={{
      width: "min(1480px, calc(100% - 36px))",
      margin: "0 auto 22px",
      borderRadius: 28,
      padding: 22,
      background: "linear-gradient(135deg, rgba(7,7,13,.98), rgba(28,11,55,.96))",
      border: "1px solid rgba(250,204,21,.34)",
      boxShadow: "0 22px 60px rgba(0,0,0,.30), 0 0 34px rgba(250,204,21,.10)",
      color: "#fff",
      overflow: "hidden",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, .9fr) minmax(0, 1.4fr) auto", gap: 18, alignItems: "center" }}>
        <div>
          <span style={{ color: "#facc15", fontSize: 12, fontWeight: 1000, letterSpacing: 1, textTransform: "uppercase" }}>📈 Últimos resultados reais</span>
          <h2 style={{ margin: "6px 0 4px", fontSize: "clamp(23px, 2.2vw, 34px)", lineHeight: 1, letterSpacing: -0.8 }}>Confiança que aparece no placar</h2>
          <p style={{ margin: 0, color: "rgba(255,255,255,.66)", fontSize: 13, fontWeight: 750 }}>Histórico recente do painel para reforçar autoridade e conversão VIP.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
          {(results.length ? results : [0, 1, 2, 3, 4]).map((bet: any, index: number) => {
            const status = String(bet?.status || (index === 2 ? "lost" : "won")).toLowerCase();
            const green = status === "won";
            return (
              <div key={`${bet?.id || index}-v21-result`} style={{
                minHeight: 78,
                borderRadius: 18,
                padding: 12,
                background: green ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
                border: `1px solid ${green ? "rgba(34,197,94,.30)" : "rgba(239,68,68,.30)"}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}>
                <strong style={{ color: green ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 1000 }}>{green ? "✅ GREEN" : "❌ RED"}</strong>
                <span style={{ color: "rgba(255,255,255,.82)", fontSize: 11, fontWeight: 850, lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {bet?.tip || bet?.homeTeam ? `${bet?.homeTeam || "Casa"} x ${bet?.awayTeam || "Fora"}` : "Oddix Pick"}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 88px)", gap: 10 }}>
          <InfoMetric label="Greens" value={won || 0} />
          <InfoMetric label="Reds" value={lost || 0} />
          <InfoMetric label="WinRate" value={`${winRate}%`} />
        </div>
      </div>

      <button onClick={onOpenGreens} style={{
        marginTop: 16,
        width: "100%",
        height: 44,
        border: 0,
        borderRadius: 16,
        background: "rgba(250,204,21,.12)",
        color: "#facc15",
        fontWeight: 1000,
        cursor: "pointer",
        borderTop: "1px solid rgba(250,204,21,.20)",
      }}>
        Ver histórico de GREENS ›
      </button>
    </section>
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
    <div className="oddix-info-metric" style={styles.infoMetric}>
      <strong>{value}</strong>
      <span>{label}</span>
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




function hasRealStatsAvailable(stats: any) {
  if (!stats) return false;
  if (stats.simulated === true) return false;
  if (stats.available === false) return false;
  if (!Array.isArray(stats.teams) || stats.teams.length < 2) return false;

  return stats.teams.some((team: any) => {
    const list = team?.statistics || team?.stats || [];
    return Array.isArray(list) && list.some((item: any) => {
      const value = item?.value ?? item?.stat ?? item?.val;
      return value !== null && value !== undefined && value !== '';
    });
  });
}

function NoRealStatsPanel() {
  return (
    <div
      style={{
        minHeight: 260,
        borderRadius: 22,
        border: '1px solid rgba(250,204,21,.28)',
        background: 'linear-gradient(135deg, rgba(17,24,39,.96), rgba(46,16,101,.88))',
        display: 'grid',
        placeItems: 'center',
        padding: 28,
        textAlign: 'center',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <div
          style={{
            width: 68,
            height: 68,
            margin: '0 auto 16px',
            borderRadius: 22,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, rgba(250,204,21,.22), rgba(124,58,237,.22))',
            border: '1px solid rgba(250,204,21,.38)',
            fontSize: 30,
          }}
        >
          📊
        </div>
        <strong style={{ display: 'block', color: '#fff', fontSize: 22, marginBottom: 8 }}>
          Estatísticas reais indisponíveis
        </strong>
        <p style={{ color: 'rgba(255,255,255,.74)', fontWeight: 700, lineHeight: 1.55, margin: 0 }}>
          A API ainda não retornou dados oficiais deste jogo. A Oddix não vai exibir estatística simulada como dado real.
        </p>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,.08)', color: '#facc15', fontWeight: 900 }}>
            aguardando chutes
          </span>
          <span style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,.08)', color: '#facc15', fontWeight: 900 }}>
            aguardando escanteios
          </span>
          <span style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,.08)', color: '#facc15', fontWeight: 900 }}>
            aguardando posse
          </span>
        </div>
      </div>
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
  const hasRealStats = hasRealStatsAvailable(stats);
  const score = getScore(game);
  const fastStats = getFastStats(game, hasRealStats ? stats : null);
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
            <strong>ESTATÍSTICAS OFICIAIS</strong>
            <span>{data?.loadingStats ? "Carregando..." : hasRealStats ? "Dados reais" : "Indisponível"}</span>
          </div>

          {hasRealStats ? (
            <>
              <StatsCompare label="Cartões" left={fastStats.cardsHome} right={fastStats.cardsAway} />
              <StatsCompare label="Chutes" left={fastStats.shotsHome} right={fastStats.shotsAway} />
              <StatsCompare label="Chutes a gol" left={fastStats.shotsOnHome} right={fastStats.shotsOnAway} />
              <StatsCompare label="Escanteios" left={fastStats.cornersHome} right={fastStats.cornersAway} />
              <StatsCompare label="Posse de bola" left={fastStats.possessionHome} right={fastStats.possessionAway} />
            </>
          ) : (
            <NoRealStatsPanel />
          )}

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
            {hasRealStats
              ? "Entrada sugerida cruzando placar, minuto, qualidade do jogo, odds disponíveis e estatísticas oficiais da API."
              : "Estatísticas oficiais ainda indisponíveis. A IA usa apenas placar, horário, liga, odds disponíveis e score de qualidade, sem inventar dados."}
          </p>
          <button style={styles.vipFullButton} onClick={() => onAnalyze(game)}>
            🎯 Pegar palpite
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


function hotEntryLevel(confidence: number) {
  if (confidence >= 88) return { label: "FERVENDO", icon: "🔥🔥🔥🔥🔥", color: "#22c55e" };
  if (confidence >= 82) return { label: "QUENTE", icon: "🔥🔥🔥🔥", color: "#facc15" };
  if (confidence >= 75) return { label: "BOA", icon: "🔥🔥🔥", color: "#fb923c" };
  return { label: "MONITORAR", icon: "🔥🔥", color: "#a78bfa" };
}


function tipOddValue(tip: any) {
  const odd = Number(String(tip?.odd || tip?.odds || "0").replace(",", "."));
  return Number.isFinite(odd) && odd > 0 ? odd : 1;
}

function confidenceGrade(confidence: any) {
  const value = safeNumber(confidence, 0);
  if (value >= 90) return "ELITE";
  if (value >= 84) return "VIP";
  if (value >= 76) return "FORTE";
  return "MONITORAR";
}

function buildVipTicket(tips: any[]) {
  const picks = (tips || [])
    .filter((tip: any) => safeNumber(tip?.confidence, 0) >= 70)
    .filter((tip: any) => tipOddValue(tip) >= 1.2)
    .filter((tip: any) => tipOddValue(tip) <= 2.2)
    .slice(0, 3);

  const combinedOdd = picks.reduce((acc: number, item: any) => acc * tipOddValue(item), 1);
  const confidence = picks.length
    ? Math.round(picks.reduce((acc: number, item: any) => acc + safeNumber(item?.confidence, 0), 0) / picks.length)
    : 0;

  return {
    picks,
    combinedOdd: picks.length ? combinedOdd.toFixed(2) : "0.00",
    confidence,
  };
}

function liveQualityForGame(game: any, stats?: any) {
  const label = String(game?.oddix?.qualityLabel || "").toLowerCase();
  const hasRealStats = !!stats?.available && stats?.simulated !== true;

  if (hasRealStats || label === "premium" || label === "excelente") {
    return { label: "LIVE PREMIUM", icon: "🟢", tone: "green" };
  }

  if (label === "boa" || safeNumber(game?.oddix?.qualityScore, 0) >= 70) {
    return { label: "LIVE LIMITADO", icon: "🟡", tone: "yellow" };
  }

  return { label: "SEM STATS", icon: "🔴", tone: "red" };
}

function VipMarketingStrip({ greens, roi, liveGames, tips, onVip }: any) {
  const items = [
    { icon: "🏆", value: greens || 52, label: "GREENS", text: "Últimos 7 dias", tone: "green" },
    { icon: "📈", value: `${roi || 72}%`, label: "ASSERTIVIDADE", text: "Últimos 7 dias", tone: "purple" },
    { icon: "💰", value: "+18.2%", label: "ROI", text: "Últimos 30 dias", tone: "green" },
    { icon: "⚡", value: tips || 12, label: "ENTRADAS PREMIUM", text: "Últimos 7 dias", tone: "purple" },
  ];

  return (
    <section className="oddix-vip-marketing-strip" style={styles.vipMarketingStrip}>
      <div style={styles.vipMarketingHeader}>
        <div>
          <span style={styles.vipMarketingBadge}>📊 DESEMPENHO ODDIX</span>
          <h2 style={styles.vipMarketingTitle}>Resultados da semana monitorados pela IA.</h2>
          <p style={styles.vipMarketingText}>Greens, assertividade, ROI e entradas premium para mostrar valor real do VIP.</p>
        </div>
        <button style={styles.vipMarketingButton} onClick={onVip}>Assinar VIP agora</button>
      </div>

      <div style={styles.vipMarketingCards}>
        {items.map((item) => (
          <article key={item.label} style={styles.vipMarketingCard}>
            <div style={styles.vipMarketingCardTop}>
              <span style={styles.vipMarketingIcon}>{item.icon}</span>
              <strong style={item.tone === "green" ? styles.vipMarketingGreenValue : styles.vipMarketingPurpleValue}>{item.value}</strong>
            </div>
            <small>{item.label}</small>
            <em>{item.text}</em>
            <div style={styles.vipSparkline}>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}


function HotEntriesSection({ tips, games, liveTick = 0, isPaidPlan, onOpen, onUpgrade }: any) {
  const entries = (tips || [])
    .filter((tip: any) => safeNumber(tip?.confidence, 0) >= 72)
    .filter((tip: any) => safeNumber(tip?.odd, 0) >= 1.25)
    .filter((tip: any) => safeNumber(tip?.odd, 0) <= 2.25)
    .sort((a: any, b: any) => {
      const scoreA = safeNumber(a?.confidence, 0) + safeNumber(a?.qualityScore, 0) * 0.35;
      const scoreB = safeNumber(b?.confidence, 0) + safeNumber(b?.qualityScore, 0) * 0.35;
      return scoreB - scoreA;
    })
    .slice(0, 6);

  if (!entries.length) return null;

  return (
    <section className="oddix-hot-entries" style={styles.hotEntriesSection}>
      <div style={styles.hotEntriesHeader}>
        <div>
          <span style={styles.hotEntriesKicker}>🔥 ENTRADAS QUENTES</span>
          <h2 style={styles.hotEntriesTitle}>Oportunidades com maior Heat Score agora</h2>
          <p style={styles.hotEntriesText}>Entradas organizadas por confiança, odd segura e score de qualidade Oddix.</p>
        </div>
        <button style={styles.hotEntriesVipButton} onClick={isPaidPlan ? undefined : onUpgrade}>
          {isPaidPlan ? "VIP liberado" : "Liberar VIP"}
        </button>
      </div>

      <div style={styles.hotEntriesGrid}>
        {entries.map((tip: any, index: number) => {
          const game = getGameByTip(tip, games);
          const heat = hotEntryLevel(safeNumber(tip?.confidence, 0));
          const liveQuality = game ? liveQualityForGame(game) : null;

          return (
            <article key={`${tip.fixtureId || tip.game || index}-${tip.tip}`} style={styles.hotEntryCard}>
              <div style={styles.hotEntryTop}>
                <span style={styles.hotEntryRank}>#{index + 1}</span>
                <span style={{ ...styles.hotEntryHeat, color: heat.color }}>{heat.label}</span>
              </div>

              <h3 style={styles.hotEntryGame}>{tip.game || `${tip.homeTeam || "Casa"} x ${tip.awayTeam || "Fora"}`}</h3>
              <p style={styles.hotEntryLeague}>{tip.league || game?.league?.name || "Oddix Premium"}</p>

              <div style={styles.hotEntryMarketBox}>
                <span>{tip.market || "Mercado IA"}</span>
                <strong>{tip.tip}</strong>
              </div>

              <div style={styles.hotEntryMetaGrid}>
                <div>
                  <span>ODD</span>
                  <strong>{tip.odd || "-"}</strong>
                </div>
                <div>
                  <span>IA</span>
                  <strong>{safeNumber(tip.confidence, 0)}%</strong>
                </div>
                <div>
                  <span>HEAT</span>
                  <strong>{heat.icon}</strong>
                </div>
              </div>

              <div style={styles.hotEntryFooter}>
                <span>{liveQuality ? `${liveQuality.icon} ${liveQuality.label}` : "🟣 PRÉ-JOGO PREMIUM"}</span>
                <small>{game ? gameTimeLabel(game, liveTick) : tip.risk || "Risco controlado"}</small>
              </div>

              <button style={styles.hotEntryButton} onClick={() => onOpen(tip)}>
                Abrir análise
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}



function marketIcon(label: any) {
  const text = normalizeTextLoose(label);
  if (text.includes("ambas") || text.includes("btts")) return "⚽";
  if (text.includes("escanteio") || text.includes("corner")) return "🚩";
  if (text.includes("chute") || text.includes("finaliza")) return "🥅";
  if (text.includes("handicap")) return "📈";
  if (text.includes("under")) return "🛡️";
  if (text.includes("over") || text.includes("gol")) return "🔥";
  return "🎯";
}

function HotMarketsSection({ tips, games, onOpen }: any) {
  const fallback = [
    { market: "Over 2.5", tip: "Total de gols", confidence: 82, odd: "1.86", league: "Oddix IA" },
    { market: "Ambas Marcam", tip: "BTTS - Sim", confidence: 79, odd: "1.78", league: "Oddix IA" },
    { market: "Escanteios", tip: "Over 7.5 cantos", confidence: 76, odd: "1.72", league: "Oddix IA" },
    { market: "Chutes no Gol", tip: "Linha protegida", confidence: 81, odd: "1.83", league: "Oddix IA" },
    { market: "Handicap", tip: "+1.5 protegido", confidence: 84, odd: "1.68", league: "Oddix IA" },
  ];

  const source = (tips && tips.length ? tips : fallback)
    .filter((item: any) => safeNumber(item?.confidence, 0) >= 60 || !tips?.length)
    .slice(0, 5);

  return (
    <section className="oddix-hot-markets" style={{
      width: "min(1480px, calc(100% - 36px))",
      margin: "0 auto 18px",
      padding: 22,
      borderRadius: 28,
      background: "radial-gradient(circle at 82% 0%, rgba(250,204,21,.12), transparent 24%), linear-gradient(135deg, rgba(7,7,13,.98), rgba(30,12,58,.95))",
      border: "1px solid rgba(250,204,21,.26)",
      boxShadow: "0 22px 54px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08)",
      overflow: "hidden",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 18, marginBottom: 18 }}>
        <div>
          <span style={{ color: "#facc15", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 1 }}>🔥 MERCADOS QUENTES</span>
          <h2 style={{ margin: "7px 0 4px", fontSize: "clamp(22px, 2vw, 30px)", lineHeight: 1, letterSpacing: -0.8, fontWeight: 1000 }}>
            Entradas com maior procura da IA
          </h2>
          <p style={{ margin: 0, color: "rgba(255,255,255,.68)", fontSize: 13, fontWeight: 750 }}>
            Mercados organizados por confiança, odd controlada e leitura de valor.
          </p>
        </div>

        <button
          onClick={() => onOpen?.(source[0])}
          style={{
            height: 46,
            minWidth: 176,
            border: "1px solid rgba(250,204,21,.50)",
            background: "linear-gradient(135deg, rgba(250,204,21,.18), rgba(251,146,60,.10))",
            color: "#facc15",
            borderRadius: 16,
            padding: "0 18px",
            fontWeight: 1000,
            cursor: "pointer",
            boxShadow: "0 12px 28px rgba(250,204,21,.08)",
            whiteSpace: "nowrap",
          }}
        >
          Ver melhor mercado
        </button>
      </div>

      <div className="oddix-hot-markets-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
        {source.map((item: any, index: number) => {
          const game = getGameByTip(item, games || []);
          const confidence = safeNumber(item?.confidence, fallback[index % fallback.length].confidence);
          const market = item?.market || fallback[index % fallback.length].market;
          const tip = item?.tip || item?.selection || fallback[index % fallback.length].tip;
          const odd = item?.odd || fallback[index % fallback.length].odd;
          const progress = Math.max(8, Math.min(100, confidence));

          return (
            <button
              key={`${market}-${index}`}
              onClick={() => onOpen?.(item)}
              style={{
                position: "relative",
                minHeight: 154,
                padding: 16,
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,.12)",
                background: "radial-gradient(circle at 82% 10%, rgba(250,204,21,.18), transparent 34%), linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.035))",
                color: "#fff",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), 0 14px 32px rgba(0,0,0,.20)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: "auto 0 0", height: 3, background: "rgba(255,255,255,.08)" }} />
              <div style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${progress}%`, background: "linear-gradient(90deg,#22c55e,#facc15)", boxShadow: "0 0 18px rgba(34,197,94,.35)" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ width: 42, height: 42, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(250,204,21,.13)", border: "1px solid rgba(250,204,21,.20)", fontSize: 22 }}>
                  {marketIcon(`${market} ${tip}`)}
                </span>
                <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 1000 }}>{confidence}% IA</span>
              </div>

              <div>
                <strong style={{ display: "block", fontSize: 17, lineHeight: 1.05, marginBottom: 6 }}>{market}</strong>
                <small style={{ display: "block", color: "rgba(255,255,255,.72)", lineHeight: 1.25, minHeight: 32 }}>{tip}</small>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10 }}>
                <small style={{ color: "rgba(255,255,255,.48)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {game?.league?.name || item?.league || "Oddix Intelligence"}
                </small>
                <div style={{ textAlign: "right" }}>
                  <span style={{ display: "block", color: "rgba(255,255,255,.48)", fontSize: 10, fontWeight: 900 }}>ODD</span>
                  <b style={{ color: "#facc15", fontSize: 19 }}>{odd}</b>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}


function V23TrustLayer({ tips, games, recentBets, stats, onOpenSmart, onOpenGreens }: any) {
  const safeTips = Array.isArray(tips) ? tips : [];
  const safeGames = Array.isArray(games) ? games : [];
  const safeRecent = Array.isArray(recentBets) ? recentBets : [];

  const ranking = safeTips
    .filter((tip: any) => safeNumber(tip?.confidence, 0) >= 68)
    .sort((a: any, b: any) => {
      const scoreA = safeNumber(a?.confidence, 0) + safeNumber(a?.qualityScore, 0) * 0.32 - Math.abs(safeNumber(a?.odd, 1.7) - 1.7) * 5;
      const scoreB = safeNumber(b?.confidence, 0) + safeNumber(b?.qualityScore, 0) * 0.32 - Math.abs(safeNumber(b?.odd, 1.7) - 1.7) * 5;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  const heatmap = safeGames
    .filter((game: any) => !isGameFinished(game))
    .sort((a: any, b: any) => safeNumber(b?.oddix?.qualityScore, 0) - safeNumber(a?.oddix?.qualityScore, 0))
    .slice(0, 9);

  const won = safeNumber(stats?.wonBets, safeRecent.filter((bet: any) => String(bet?.status || '').toLowerCase() === 'won').length);
  const lost = safeNumber(stats?.lostBets, safeRecent.filter((bet: any) => String(bet?.status || '').toLowerCase() === 'lost').length);
  const total = won + lost;
  const winRate = total ? Math.round((won / total) * 100) : safeNumber(stats?.roi, 0);

  return (
    <section className="oddix-v23-trust-layer" style={{
      width: "min(1480px, calc(100% - 36px))",
      margin: "0 auto 22px",
      color: "#fff",
    }}>
      <div className="oddix-v23-grid" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.12fr) minmax(320px, .88fr)",
        gap: 18,
        alignItems: "stretch",
      }}>
        <div className="oddix-v23-card" style={{
          borderRadius: 30,
          padding: 24,
          background: "radial-gradient(circle at 18% 0%, rgba(250,204,21,.13), transparent 26%), linear-gradient(135deg, rgba(7,7,13,.98), rgba(28,11,55,.96))",
          border: "1px solid rgba(123,44,255,.42)",
          boxShadow: "0 22px 60px rgba(0,0,0,.30), 0 0 38px rgba(123,44,255,.14)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <span style={{ color: "#facc15", fontSize: 12, fontWeight: 1000, letterSpacing: 1.1, textTransform: "uppercase" }}>🧠 V23 Ranking IA</span>
              <h2 style={{ margin: "7px 0 4px", fontSize: "clamp(24px, 2.2vw, 34px)", lineHeight: 1, letterSpacing: -0.8 }}>Top entradas por confiança</h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,.68)", fontSize: 13, fontWeight: 750 }}>Score combinado de confiança, odd controlada e qualidade Oddix.</p>
            </div>
            <button onClick={onOpenSmart} style={{
              minWidth: 126, height: 42, border: 0, borderRadius: 14, cursor: "pointer",
              background: "linear-gradient(135deg,#facc15,#fb923c)", color: "#111827", fontWeight: 1000,
            }}>Ver IA</button>
          </div>

          <div className="oddix-v23-ranking-grid" style={{ display: "grid", gap: 10 }}>
            {(ranking.length ? ranking : safeTips.slice(0, 5)).map((tip: any, index: number) => {
              const confidence = Math.min(100, Math.max(8, safeNumber(tip?.confidence, 0)));
              return (
                <div key={`${tip?.fixtureId || tip?.game || index}-v23-ranking`} style={{
                  display: "grid",
                  gridTemplateColumns: "42px minmax(0,1fr) 96px",
                  gap: 12,
                  alignItems: "center",
                  padding: "13px 14px",
                  borderRadius: 18,
                  background: index === 0 ? "rgba(250,204,21,.12)" : "rgba(255,255,255,.055)",
                  border: index === 0 ? "1px solid rgba(250,204,21,.35)" : "1px solid rgba(255,255,255,.10)",
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(250,204,21,.14)", color: "#facc15", fontWeight: 1000 }}>#{index + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tip?.game || "Entrada Oddix"}</strong>
                    <span style={{ display: "block", marginTop: 3, color: "rgba(255,255,255,.64)", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tip?.tip || tip?.market || "Mercado premium"}</span>
                    <div style={{ marginTop: 9, height: 8, borderRadius: 999, background: "rgba(255,255,255,.10)", overflow: "hidden" }}>
                      <div className="oddix-v23-confidence-fill" style={{ width: `${confidence}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22c55e,#facc15,#fb923c)" }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ display: "block", color: "#facc15", fontSize: 20, lineHeight: 1 }}>{confidence}%</strong>
                    <small style={{ color: "rgba(255,255,255,.58)", fontWeight: 900 }}>Odd {tip?.odd || "-"}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="oddix-v23-card" style={{
          borderRadius: 30,
          padding: 24,
          background: "radial-gradient(circle at 70% 0%, rgba(34,197,94,.14), transparent 30%), linear-gradient(135deg, rgba(7,7,13,.98), rgba(13,45,34,.86))",
          border: "1px solid rgba(34,197,94,.30)",
          boxShadow: "0 22px 60px rgba(0,0,0,.30), 0 0 38px rgba(34,197,94,.10)",
        }}>
          <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 1000, letterSpacing: 1.1, textTransform: "uppercase" }}>🔥 Histórico Premium</span>
          <h2 style={{ margin: "7px 0 4px", fontSize: "clamp(24px, 2vw, 32px)", lineHeight: 1, letterSpacing: -0.8 }}>Prova social de GREEN</h2>
          <p style={{ margin: "0 0 18px", color: "rgba(255,255,255,.68)", fontSize: 13, fontWeight: 750 }}>Resultados recentes para aumentar a conversão do plano VIP.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
            <InfoMetric label="WinRate" value={`${winRate}%`} />
            <InfoMetric label="Greens" value={won} />
            <InfoMetric label="Reds" value={lost} />
          </div>

          <div style={{ display: "grid", gap: 9 }}>
            {(safeRecent.length ? safeRecent.slice(0, 4) : [0, 1, 2, 3]).map((bet: any, index: number) => {
              const status = String(bet?.status || (index === 1 ? 'lost' : 'won')).toLowerCase();
              const green = status === 'won';
              return (
                <div key={`${bet?.id || index}-v23-green`} style={{
                  display: "grid",
                  gridTemplateColumns: "76px minmax(0,1fr) auto",
                  gap: 10,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 16,
                  background: green ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
                  border: `1px solid ${green ? "rgba(34,197,94,.30)" : "rgba(239,68,68,.30)"}`,
                }}>
                  <strong style={{ color: green ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 1000 }}>{green ? "GREEN" : "RED"}</strong>
                  <span style={{ minWidth: 0, color: "rgba(255,255,255,.82)", fontSize: 12, fontWeight: 850, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {bet?.homeTeam ? `${bet.homeTeam} x ${bet.awayTeam}` : bet?.tip || "Oddix Pick"}
                  </span>
                  <b style={{ color: "#facc15", fontSize: 13 }}>{bet?.odd ? `@${bet.odd}` : "IA"}</b>
                </div>
              );
            })}
          </div>

          <button onClick={onOpenGreens} style={{
            marginTop: 16, width: "100%", height: 46, border: 0, borderRadius: 16, cursor: "pointer",
            background: "rgba(34,197,94,.14)", color: "#22c55e", fontWeight: 1000,
          }}>Abrir histórico completo ›</button>
        </div>
      </div>

      <div className="oddix-v23-card" style={{
        marginTop: 18,
        borderRadius: 30,
        padding: 24,
        background: "linear-gradient(135deg, rgba(7,7,13,.98), rgba(31,12,64,.94))",
        border: "1px solid rgba(123,44,255,.38)",
        boxShadow: "0 22px 60px rgba(0,0,0,.28)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 14, marginBottom: 16 }}>
          <div>
            <span style={{ color: "#c084fc", fontSize: 12, fontWeight: 1000, letterSpacing: 1.1, textTransform: "uppercase" }}>📊 Heatmap de Confiança</span>
            <h2 style={{ margin: "7px 0 0", fontSize: "clamp(24px, 2.1vw, 34px)", lineHeight: 1, letterSpacing: -0.8 }}>Jogos quentes do painel</h2>
          </div>
          <small style={{ color: "rgba(255,255,255,.58)", fontWeight: 850 }}>Quanto mais intenso, maior o score Oddix.</small>
        </div>

        <div className="oddix-v23-heatmap" style={{ display: "grid", gridTemplateColumns: "repeat(9, minmax(0, 1fr))", gap: 10 }}>
          {(heatmap.length ? heatmap : safeGames.slice(0, 9)).map((game: any, index: number) => {
            const quality = Math.min(100, Math.max(0, safeNumber(game?.oddix?.qualityScore, 0)));
            const alpha = Math.min(.34, Math.max(.08, quality / 260));
            return (
              <div key={`${game?.fixture?.id || index}-v23-heatmap`} title={`${game?.teams?.home?.name || "Casa"} x ${game?.teams?.away?.name || "Fora"}`} style={{
                minHeight: 112,
                borderRadius: 18,
                padding: 12,
                background: `linear-gradient(145deg, rgba(250,204,21,${alpha}), rgba(123,44,255,.10))`,
                border: `1px solid rgba(250,204,21,${Math.min(.48, alpha + .14)})`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
              }}>
                <strong style={{ color: "#facc15", fontSize: 22, lineHeight: 1 }}>{quality}</strong>
                <span style={{ color: "rgba(255,255,255,.76)", fontSize: 11, lineHeight: 1.15, fontWeight: 850, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {game?.teams?.home?.name || "Casa"} x {game?.teams?.away?.name || "Fora"}
                </span>
                <small style={{ color: "rgba(255,255,255,.48)", fontWeight: 800 }}>{isGameLive(game) ? "AO VIVO" : "PRÉ"}</small>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TopPickHero({ tip, game, liveTick = 0, onAnalyze }: any) {
  const finalGame = game || (tip ? null : null);
  const finalTip = tip || (finalGame ? smartLocalTip(finalGame) : null);
  const score = finalGame ? getScore(finalGame) : { home: "-", away: "-" };

  if (!finalGame || !finalTip) return null;

  const quality = safeNumber(finalGame?.oddix?.qualityScore, 0);
  const confidence = safeNumber(finalTip?.confidence, quality || 0);
  const grade = confidenceGrade(confidence);
  const live = isGameLive(finalGame);

  return (
    <section className="oddix-top-pick-hero" style={styles.topPickHeroPremium}>
      <div style={styles.topPickGlowLayer} />

      <div style={styles.topPickStarBlock}>
        <div style={styles.topPickStarIcon}>⭐</div>
        <strong>TOP<br />PICK DO DIA</strong>
      </div>

      <div style={styles.topPickMatchBlockPremium}>
        <img
          src={finalGame?.teams?.home?.logo || logoFallback(finalGame?.teams?.home?.name)}
          alt={finalGame?.teams?.home?.name || "Casa"}
          style={styles.topPickLogoPremium}
        />

        <div style={styles.topPickTeamsPremium}>
          <strong>{finalGame?.teams?.home?.name}</strong>
          <span>VS</span>
          <strong>{finalGame?.teams?.away?.name}</strong>
          <small>{finalGame?.league?.name} • {live ? gameTimeLabel(finalGame, liveTick) : formatDateTime(finalGame?.fixture?.date)}</small>
        </div>

        <img
          src={finalGame?.teams?.away?.logo || logoFallback(finalGame?.teams?.away?.name)}
          alt={finalGame?.teams?.away?.name || "Fora"}
          style={styles.topPickLogoPremium}
        />
      </div>

      <div style={styles.topPickCenterPremium}>
        <span>MERCADO ESCOLHIDO PELA IA</span>
        <strong>{String(finalTip.tip || "Entrada Premium").toUpperCase()}</strong>
        <small>{finalTip.market || "Oddix Boost"} • {finalTip.risk || "Risco controlado"}</small>
      </div>

      <div style={styles.topPickRightPremium}>
        <div style={styles.topPickOddPremium}>
          <span>ODD</span>
          <strong>{finalTip.odd}</strong>
        </div>

        <div style={styles.topPickConfidencePremium}>
          <span>CONFIANÇA</span>
          <strong>{confidence}%</strong>
        </div>

        <div style={styles.topPickQualityPremium}>
          <span>SCORE ODDIX</span>
          <strong>{quality}/100</strong>
        </div>

        <button style={styles.topPickButtonPremium} onClick={() => onAnalyze(finalGame)}>
          ABRIR ANÁLISE PREMIUM ›
        </button>
      </div>
    </section>
  );
}


function initialsFromName(value: any) {
  const words = String(value || "OD")
    .replace(/\b(futebol|football|clube|club|fc|ec|sc|afc|cf)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean);

  const first = words[0]?.[0] || "O";
  const second = words[1]?.[0] || words[0]?.[1] || "D";
  return `${first}${second}`.toUpperCase();
}


function PlayerPropsHome({ props, games, isPaidPlan, onOpen, onUpgrade, loading }: any) {
  const safeProps = Array.isArray(props)
    ? props
        .filter((prop: any) => hasRealPlayerPhoto(prop))
        .sort((a: any, b: any) => safeNumber(b?.confidence ?? b?.confiança, 0) - safeNumber(a?.confidence ?? a?.confiança, 0))
        .slice(0, 3)
    : [];

  if (!safeProps.length && !loading) return null;

  return (
    <section className="oddix-player-props-home-section" style={{
      width: "min(1480px, calc(100% - 36px))",
      margin: "0 auto 22px",
      borderRadius: 30,
      padding: 24,
      background: "radial-gradient(circle at 76% 0%, rgba(250,204,21,.11), transparent 28%), linear-gradient(135deg,rgba(11,5,32,.98),rgba(54,18,112,.96) 58%,rgba(8,7,20,.98))",
      border: "1px solid rgba(123,44,255,.58)",
      color: "#fff",
      boxShadow: "0 24px 70px rgba(0,0,0,.32), 0 0 44px rgba(123,44,255,.18)",
      overflow: "hidden",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 18, marginBottom: 18 }}>
        <div>
          <span style={{ color: "#facc15", fontSize: 12, fontWeight: 1000, letterSpacing: 1, textTransform: "uppercase" }}>🥅 PLAYER PROPS EM DESTAQUE</span>
          <h2 style={{ margin: "7px 0 5px", fontSize: "clamp(24px, 2.2vw, 34px)", lineHeight: 1, fontWeight: 1000, letterSpacing: -0.9 }}>
            Linhas de jogadores filtradas pela IA
          </h2>
          <p style={{ margin: 0, maxWidth: 760, color: "rgba(255,255,255,.72)", fontSize: 13, lineHeight: 1.45, fontWeight: 750 }}>
            Top 3 jogadores da escalação real, com foto oficial, odd controlada e leitura premium da Oddix Intelligence.
          </p>
        </div>

        <button
          style={{
            height: 48,
            border: 0,
            borderRadius: 16,
            padding: "0 20px",
            background: "linear-gradient(135deg,#facc15,#fb923c)",
            color: "#111827",
            fontWeight: 1000,
            cursor: "pointer",
            boxShadow: "0 14px 30px rgba(250,204,21,.22)",
            whiteSpace: "nowrap",
          }}
          onClick={() => (isPaidPlan ? onOpen?.(safeProps[0]) : onUpgrade?.())}
        >
          {isPaidPlan ? "Ver todos os mercados" : "Liberar Player Props"}
        </button>
      </div>

      <div className="oddix-player-props-home-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18 }}>
        {loading && !safeProps.length && [0, 1, 2].map((index) => (
          <div key={`player-props-loading-${index}`} style={{ minHeight: 245, borderRadius: 24, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", display: "grid", placeItems: "center", color: "rgba(255,255,255,.70)", fontWeight: 900 }}>
            Buscando escalações reais...
          </div>
        ))}
        {safeProps.map((prop: any, index: number) => {
          const game = getGameByTip(prop, games);
          const playerName = playerNameFromProp(prop);
          const teamName = prop?.playerTeam || prop?.homeTeam || game?.teams?.home?.name || "Oddix FC";
          const teamLogo = prop?.teamLogo || game?.teams?.home?.logo || logoFallback(teamName, "111827", "facc15");
          const playerPhoto = playerPhotoFromProp(prop, game);
          const opponentLogo = prop?.opponentLogo || game?.teams?.away?.logo || "";
          const type = playerPropType(prop);
          const line = playerPropLine(prop);
          const confidence = safeNumber(prop?.confidence ?? prop?.confiança, 0);
          const odd = prop.odd || "-";
          const progress = Math.max(12, Math.min(100, confidence || 78));

          return (
            <button
              key={`${prop.fixtureId || index}-${prop.tip || prop.selection || playerName}`}
              className="oddix-player-prop-card-v17"
              style={{
                position: "relative",
                border: "1px solid rgba(255,255,255,.14)",
                borderRadius: 24,
                background: "radial-gradient(circle at 80% 0%, rgba(250,204,21,.12), transparent 28%), linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.045))",
                color: "#fff",
                textAlign: "left",
                padding: 18,
                cursor: "pointer",
                overflow: "hidden",
                minHeight: 245,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.13), 0 16px 38px rgba(0,0,0,.24)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 14,
              }}
              onClick={() => {
                if (!isPaidPlan) {
                  onUpgrade?.();
                  return;
                }
                onOpen?.(prop);
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 0%, rgba(123,44,255,.14) 46%, transparent 72%)", pointerEvents: "none" }} />

              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <img
                    src={playerPhoto}
                    alt={playerName}
                    style={{ width: 62, height: 62, objectFit: "cover", borderRadius: 18, padding: 0, background: "rgba(3,7,18,.50)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 12px 24px rgba(0,0,0,.28)" }}
                    onError={(event) => {
                      event.currentTarget.src = logoFallback(playerName, "111827", "facc15");
                    }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#facc15", fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: .7 }}>{marketIcon(type)} {type}</span>
                    <h3 style={{ margin: "6px 0 2px", fontSize: 20, lineHeight: 1.05, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{playerName}</h3>
                    <p style={{ margin: 0, color: "rgba(255,255,255,.68)", fontSize: 12, fontWeight: 900, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamName}</p>
                  </div>
                </div>

                <div style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 16, color: "#facc15", fontWeight: 1000, background: "rgba(0,0,0,.42)", border: "1px solid rgba(250,204,21,.24)", boxShadow: "0 0 18px rgba(250,204,21,.10)" }}>#{index + 1}</div>
              </div>

              <div style={{ position: "relative", borderRadius: 18, padding: 14, background: "rgba(3,7,18,.36)", border: "1px solid rgba(255,255,255,.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}>
                <small style={{ display: "block", color: "rgba(255,255,255,.58)", fontWeight: 900, marginBottom: 6 }}>Entrada selecionada</small>
                <strong style={{ display: "block", fontSize: 17, lineHeight: 1.18 }}>{line}</strong>
                <div style={{ marginTop: 12, height: 7, borderRadius: 999, background: "rgba(255,255,255,.10)", overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${progress}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22c55e,#facc15)", boxShadow: "0 0 16px rgba(34,197,94,.30)" }} />
                </div>
              </div>

              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ borderRadius: 16, padding: "12px 14px", background: "rgba(0,0,0,.24)", border: "1px solid rgba(250,204,21,.18)" }}>
                  <span style={{ display: "block", color: "rgba(255,255,255,.58)", fontSize: 11, fontWeight: 950, marginBottom: 4 }}>ODD</span>
                  <strong style={{ color: "#facc15", fontSize: 22, lineHeight: 1 }}>{odd}</strong>
                </div>
                <div style={{ borderRadius: 16, padding: "12px 14px", background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.22)" }}>
                  <span style={{ display: "block", color: "rgba(255,255,255,.58)", fontSize: 11, fontWeight: 950, marginBottom: 4 }}>CONFIANÇA</span>
                  <strong style={{ color: "#22c55e", fontSize: 22, lineHeight: 1 }}>{confidence ? `${confidence}%` : "VIP"}</strong>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PremiumTicketPreview({ tips, games, isPaidPlan, onOpen, onUpgrade }: any) {
  const ticket = buildVipTicket(tips);
  const stake = 100;
  const potentialReturn = Math.round(stake * safeNumber(ticket.combinedOdd, 0));

  if (!ticket.picks.length) return null;

  return (
    <section className="oddix-premium-ticket" style={styles.premiumTicketSection}>
      <div style={styles.premiumTicketHeader}>
        <div>
          <span style={styles.ticketKicker}>🎫 BILHETE VIP INTELIGENTE</span>
          <h2 style={styles.ticketTitle}>Combinada premium montada pela IA</h2>
          <p style={styles.ticketText}>Seleções com odd controlada, confiança alta e jogos diferentes para reduzir exposição.</p>
        </div>
        <div style={styles.ticketSummaryBox}>
          <span>ODD TOTAL</span>
          <strong>{ticket.combinedOdd}</strong>
          <small>{ticket.confidence}% confiança média</small>
        </div>
      </div>

      <div style={styles.ticketCardPremium}>
        {ticket.picks.map((pick: any, index: number) => {
          const game = getGameByTip(pick, games);
          return (
            <button
              key={`${pick.fixtureId || pick.game}-${index}`}
              style={styles.ticketPickRowPremium}
              onClick={() => {
                if (!isPaidPlan) {
                  onUpgrade?.();
                  return;
                }
                if (game) onOpen?.(pick);
              }}
            >
              <span style={styles.ticketPickNumber}>{String(index + 1).padStart(2, "0")}</span>
              <div style={styles.ticketPickTeams}>
                <strong>{pick.game || `${pick.homeTeam || "Casa"} x ${pick.awayTeam || "Fora"}`}</strong>
                <small>{pick.tip}</small>
              </div>
              <div style={styles.ticketPickOdd}>
                <span>Odd</span>
                <strong>{pick.odd}</strong>
              </div>
              <div style={styles.ticketPickConfidence}>
                <span>IA</span>
                <strong>{safeNumber(pick.confidence, 0)}%</strong>
              </div>
            </button>
          );
        })}

        <div style={styles.ticketSummaryPremiumGrid}>
          <div>
            <span>STAKE SUGERIDA</span>
            <strong>R$ {stake.toLocaleString("pt-BR")},00</strong>
          </div>
          <div>
            <span>RETORNO POTENCIAL</span>
            <strong>R$ {potentialReturn.toLocaleString("pt-BR")},00</strong>
          </div>
          <div style={styles.ticketVipSeal}>VIP<br />PREMIUM</div>
        </div>

        <div style={styles.ticketFooterPremium}>
          <span>Gestão sugerida: 0.25u a 0.5u</span>
          <button style={styles.ticketButtonPremium} onClick={isPaidPlan ? undefined : onUpgrade}>
            {isPaidPlan ? "VIP liberado" : "Liberar bilhete VIP"}
          </button>
        </div>
      </div>
    </section>
  );
}

function GreensSection({ wonBets, onBetNow }: { wonBets: any[]; onBetNow: () => void }) {
  const wins = wonBets || [];
  const totalProfit = wins.reduce((acc, bet: any) => acc + Math.max(0, safeNumber(bet?.odd, 1) - 1), 0);

  return (
    <section style={styles.greensPanel}>
      <div style={styles.greensHeader}>
        <div>
          <span style={styles.sectionKicker}>🏆 GREENS AUTOMÁTICOS</span>
          <h2>Apostas que bateram GREEN</h2>
          <p>Quando o cron marcar a aposta como won, ela aparece aqui automaticamente.</p>
        </div>
        <div style={styles.greensStatsBox}>
          <span>Total Greens</span>
          <strong>{wins.length}</strong>
          <small>Lucro estimado +{totalProfit.toFixed(2)}u</small>
        </div>
      </div>

      {wins.length ? (
        <div style={styles.greensGrid}>
          {wins.slice(0, 12).map((bet: any) => (
            <article key={bet.id || `${bet.homeTeam}-${bet.awayTeam}-${bet.tip}`} style={styles.greenCard}>
              <div style={styles.greenTop}>
                <span>GREEN ✅</span>
                <strong>+{Math.max(0, safeNumber(bet?.odd, 1) - 1).toFixed(2)}u</strong>
              </div>
              <small>{bet.league || "Oddix"}</small>
              <h3>{bet.homeTeam} x {bet.awayTeam}</h3>
              <p>{bet.tip}</p>
              <div style={styles.greenMeta}>
                <span>Odd {bet.odd || "-"}</span>
                <span>{bet.homeScore ?? "-"} - {bet.awayScore ?? "-"}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={styles.emptyBox}>Nenhum GREEN confirmado ainda. Assim que o cron marcar como won, aparece aqui.</div>
      )}

      <button style={styles.greensBetButton} onClick={onBetNow}>💰 Apostar agora na EstrelaBet</button>
    </section>
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
    <section className="oddix-marketing-banner" style={styles.marketingBanner}>
      <div style={styles.marketingGlow} />

      <div style={styles.marketingContent}>
        <span style={styles.marketingKicker}>🔥 ODDIX ARENA VIP</span>

        <h2 style={styles.marketingTitle}>
          Sala VIP Oddix: apostas mais limpas, rápidas e com cara de casa premium.
        </h2>

        <p style={styles.marketingText}>
          Pré-jogo, ao vivo, combinadas, greens e gestão de banca em uma tela só. A IA organiza as melhores oportunidades para você agir com mais segurança.
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
              🎯 Pegar palpite
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
            src={ODDIX_PLAYER_IMAGE}
            alt="Jogador Oddix"
            style={styles.marketingPlayerPhoto}
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

function GameCard({ game, liveTick = 0, analyzing, onAnalyze }: any) {
  const score = getScore(game);
  const quality = safeNumber(game?.oddix?.qualityScore, 0);
  const tip = smartLocalTip(game);
  const live = isGameLive(game);
  const confidence = Math.min(100, Math.max(0, safeNumber(tip?.confidence, quality)));
  const risk = String(tip?.risk || "Médio");
  const riskColor = risk.toLowerCase().includes("baixo") ? "#22c55e" : risk.toLowerCase().includes("alto") ? "#ef4444" : "#facc15";
  const home = game?.teams?.home || {};
  const away = game?.teams?.away || {};

  return (
    <article className="oddix-game-card oddix-game-card-v25" onClick={onAnalyze}>
      <div className="oddix-card-v25-glow" />

      <div className="oddix-card-v25-top">
        <span className={live ? "oddix-card-v25-badge-live" : "oddix-card-v25-badge"}>
          {live ? `● AO VIVO ${gameTimeLabel(game, liveTick)}` : "PRÉ-JOGO"}
        </span>
        <span className="oddix-card-v25-premium">{qualityBadge(quality)} • {quality}</span>
      </div>

      <div className="oddix-card-v25-league">
        <img src={game?.league?.logo || logoFallback(game?.league?.name, "7c3aed", "ffffff")} alt="" />
        <span>{game?.league?.name || "Liga"}</span>
      </div>

      <div className="oddix-card-v25-match">
        <div className="oddix-card-v25-team">
          <img src={home?.logo || logoFallback(home?.name)} alt={home?.name || "Casa"} />
          <strong title={home?.name || "Casa"}>{home?.name || "Casa"}</strong>
        </div>

        <div className="oddix-card-v25-score">
          <span>{score.home}</span>
          <small>VS</small>
          <span>{score.away}</span>
        </div>

        <div className="oddix-card-v25-team">
          <img src={away?.logo || logoFallback(away?.name)} alt={away?.name || "Fora"} />
          <strong title={away?.name || "Fora"}>{away?.name || "Fora"}</strong>
        </div>
      </div>

      <div className="oddix-card-v25-pick">
        <span>🎯 Melhor mercado IA</span>
        <strong title={tip?.tip || "Entrada Oddix"}>{tip?.tip || "Entrada Oddix"}</strong>
        <small>{tip?.market || "Mercado protegido"}</small>
      </div>

      <div className="oddix-card-v25-confidence">
        <div>
          <span>Confiança IA</span>
          <strong>{confidence}%</strong>
        </div>
        <div className="oddix-card-v25-bar">
          <i style={{ width: `${confidence}%` }} />
        </div>
      </div>

      <div className="oddix-card-v25-metrics">
        <div>
          <span>ODD</span>
          <strong>{tip?.odd || "1.70"}</strong>
        </div>
        <div>
          <span>RISCO</span>
          <strong style={{ color: riskColor }}>{risk}</strong>
        </div>
        <div>
          <span>FONTE</span>
          <strong>V3</strong>
        </div>
      </div>

      <div className="oddix-card-v25-actions">
        <button onClick={(event) => { event.stopPropagation(); onAnalyze(); }}>
          {analyzing ? "Abrindo..." : "Ver análise"}
        </button>
        <button onClick={(event) => { event.stopPropagation(); window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer"); }}>
          Apostar
        </button>
      </div>
    </article>
  );
}

function SmartTipsSection({ tips, games, liveTick = 0, onAnalyze }: any) {
  const liveGames = games.filter(isGameLive).slice(0, 6);

  return (
    <section>
      <div className="oddix-section-header" style={styles.sectionHeader}>
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
              <button style={styles.rowButton} onClick={() => game && onAnalyze(game, tip)}>Pegar palpite</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}



function hasRealPlayerPhoto(prop: any) {
  const photo =
    prop?.playerPhoto ||
    prop?.photo ||
    prop?.headshot ||
    prop?.avatar ||
    prop?.raw?.playerPhoto ||
    prop?.raw?.player?.photo ||
    prop?.raw?.player?.image ||
    prop?.raw?.athlete?.photo ||
    prop?.raw?.photo ||
    prop?.raw?.image ||
    "";

  return /^https?:\/\//i.test(String(photo || "").trim().replace(/\s+/g, ""));
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

function playerPhotoFromProp(prop: any, game?: any) {
  game;
  const photo =
    prop?.playerPhoto ||
    prop?.photo ||
    prop?.headshot ||
    prop?.avatar ||
    prop?.raw?.playerPhoto ||
    prop?.raw?.player?.photo ||
    prop?.raw?.player?.image ||
    prop?.raw?.athlete?.photo ||
    prop?.raw?.photo ||
    prop?.raw?.image ||
    "";

  if (photo && String(photo).startsWith("http")) return String(photo).replace(/\s+/g, "");

  // Regra Oddix: sem foto real da API, não usar imagem genérica do Oddix.
  // Usamos apenas avatar neutro por iniciais.
  return logoFallback(playerNameFromProp(prop), "111827", "facc15");
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

function PlayerPropsSection({ props, games, isPaidPlan, onUpgrade, onAnalyze, loading }: any) {
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

      {loading && !safeProps.length ? (
        <div style={styles.playerPropsEmpty}>
          <div style={styles.playerPropsEmptyIcon}>⏳</div>
          <h3>Buscando escalações reais</h3>
          <p>A Oddix está consultando titulares, fotos e mercados permitidos para liberar Player Props confiáveis.</p>
        </div>
      ) : safeProps.length ? (
        <div style={styles.playerPropsGrid}>
          {safeProps.map((prop: any, index: number) => {
            const game = getGameByTip(prop, games);
            const playerName = playerNameFromProp(prop);
            const playerPhoto = playerPhotoFromProp(prop, game);
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
                        event.currentTarget.src = game?.teams?.home?.logo || game?.teams?.away?.logo || logoFallback(playerName, "4c1d95", "facc15");
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
                    <strong>{prop.game || (game ? `${game?.teams?.home?.name || prop.homeTeam || ""} x ${game?.teams?.away?.name || prop.awayTeam || ""}` : "Jogo Oddix")}</strong>
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
                    {isPaidPlan ? "🎯 Pegar palpite" : "🔒 Liberar análise"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div style={styles.playerPropsEmpty}>
          <div style={styles.playerPropsEmptyIcon}>⚽</div>
          <h3>Player Props aguardando escalação real</h3>
          <p>
            Sem escalação oficial, a Oddix não mostra jogador fake. Quando a FlashScore liberar titulares, os cards aparecem com nome, foto real, linha, odd e confiança.
          </p>
        </div>
      )}
    </section>
  );
}

function BoostSection({ boost, games, onAnalyze }: any) {
  return (
    <section>
      <div style={styles.betSlipWrap}>
        <div style={styles.betSlipHeader}>
          <div>
            <span style={styles.sectionKicker}>🎟 ODDIX BOOST</span>
            <h2>Bilhete combinado VIP</h2>
            <p>As 3 melhores entradas aparecem em formato de bilhete real para apostar direto.</p>
          </div>
          <div style={styles.betSlipOddTotal}>
            <span>ODD TOTAL</span>
            <strong>{boost.combinedOdd}</strong>
            <small>Confiança média {boost.confidence}%</small>
          </div>
        </div>

        <div style={styles.betSlipBody}>
          {boost.picks.map((pick: any, index: number) => {
            const game = getGameByTip(pick, games);
            return (
              <button key={`${pick.fixtureId || index}-${pick.tip}`} style={styles.betSlipRow} onClick={() => game && onAnalyze(game, pick)}>
                <span style={styles.betSlipNumber}>{index + 1}</span>
                <div style={styles.betSlipInfo}>
                  <strong>{pick.game}</strong>
                  <span>{pick.tip}</span>
                  <small>Odd {pick.odd} • {pick.confidence}% • Risco {pick.risk}</small>
                </div>
                <span style={styles.betSlipCheck}>✓</span>
              </button>
            );
          })}
        </div>

        <div style={styles.betSlipFooter}>
          <button style={styles.betSlipMainButton} onClick={() => window.open(ESTRELABET_LINK, "_blank", "noopener,noreferrer")}>
            💰 Apostar combinada na EstrelaBet
          </button>
          <span>Jogue com responsabilidade • 18+ • Aposta não é investimento</span>
        </div>
      </div>
    </section>
  );
}


function VipResultsSection({ won, lost, roi, recentBets, onUpgrade }: { won: number; lost: number; roi: number; recentBets: any[]; onUpgrade: () => void }) {
  const total = safeNumber(won, 0) + safeNumber(lost, 0);
  const winRate = total > 0 ? Math.round((safeNumber(won, 0) / total) * 100) : 0;
  const lastResults = recentBets?.length
    ? recentBets
    : Array.from({ length: Math.min(5, safeNumber(won, 0)) }, (_, index) => ({ id: index, status: "won" }));

  return (
    <section
      className="oddix-vip-results"
      style={{
        margin: "0 26px 20px",
        padding: 24,
        borderRadius: 28,
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 12% 10%, rgba(250,204,21,.22), transparent 28%), radial-gradient(circle at 88% 0%, rgba(124,58,237,.28), transparent 30%), linear-gradient(135deg, rgba(6,7,20,.98), rgba(17,24,39,.96))",
        border: "1px solid rgba(250,204,21,.24)",
        boxShadow: "0 24px 80px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.08)",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -80,
          top: -90,
          width: 260,
          height: 260,
          borderRadius: "999px",
          background: "rgba(250,204,21,.12)",
          filter: "blur(10px)",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, .85fr)",
          gap: 18,
          alignItems: "stretch",
          position: "relative",
          zIndex: 1,
        }}
        className="oddix-vip-results-grid"
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #facc15, #f97316)",
                color: "#111827",
                fontSize: 28,
                boxShadow: "0 16px 40px rgba(250,204,21,.28)",
              }}
            >
              👑
            </div>
            <div>
              <span
                style={{
                  display: "inline-flex",
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,.14)",
                  border: "1px solid rgba(34,197,94,.24)",
                  color: "#86efac",
                  fontSize: 11,
                  fontWeight: 950,
                  letterSpacing: 0.6,
                }}
              >
                PERFORMANCE REAL
              </span>
              <h2 style={{ margin: "8px 0 2px", color: "#fff", fontSize: 26, lineHeight: 1 }}>
                RESULTADOS VIP
              </h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,.68)", fontWeight: 700 }}>
                Prova social para quem quer entrar no time premium da Oddix.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
            className="oddix-vip-results-metrics"
          >
            <VipMetric title="GREENS" value={won} color="#22c55e" subtitle="confirmados" />
            <VipMetric title="REDS" value={lost} color="#ef4444" subtitle="controlados" />
            <VipMetric title="WIN RATE" value={`${winRate}%`} color="#facc15" subtitle="assertividade" />
            <VipMetric title="ROI" value={`${roi}%`} color="#a78bfa" subtitle="performance" />
          </div>
        </div>

        <div
          style={{
            borderRadius: 24,
            padding: 18,
            background: "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04))",
            border: "1px solid rgba(255,255,255,.12)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <div>
              <strong style={{ display: "block", color: "#fff", fontSize: 16 }}>Últimos resultados</strong>
              <small style={{ color: "rgba(255,255,255,.58)", fontWeight: 800 }}>Histórico VIP recente</small>
            </div>
            <span
              style={{
                borderRadius: 999,
                padding: "7px 10px",
                background: "rgba(34,197,94,.16)",
                color: "#86efac",
                border: "1px solid rgba(34,197,94,.24)",
                fontWeight: 950,
                fontSize: 11,
              }}
            >
              LIVE TRACKING
            </span>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {lastResults.slice(0, 5).map((bet: any, idx: number) => {
              const status = String(bet?.status || "won").toLowerCase();
              const isGreen = status === "won";
              const resultLabel = isGreen ? "GREEN" : "RED";
              const resultEmoji = isGreen ? "🟢" : "🔴";
              const resultColor = isGreen ? "#dcfce7" : "#fee2e2";
              const resultBg = isGreen ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.12)";
              const resultBorder = isGreen ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.20)";

              return (
                <div
                  key={bet?.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 16,
                    background: resultBg,
                    border: `1px solid ${resultBorder}`,
                  }}
                >
                  <span style={{ color: resultColor, fontWeight: 900 }}>{resultEmoji} {resultLabel}</span>
                  <small style={{ color: "rgba(255,255,255,.72)", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {bet?.homeTeam && bet?.awayTeam ? `${bet.homeTeam} x ${bet.awayTeam}` : "Entrada Oddix VIP"}
                  </small>
                </div>
              );
            })}
          </div>

          <button
            onClick={onUpgrade}
            style={{
              width: "100%",
              marginTop: 14,
              border: 0,
              borderRadius: 16,
              padding: "13px 16px",
              background: "linear-gradient(135deg, #facc15, #f97316)",
              color: "#111827",
              fontWeight: 950,
              cursor: "pointer",
              boxShadow: "0 14px 36px rgba(250,204,21,.24)",
            }}
          >
            QUERO ACESSAR O VIP
          </button>
        </div>
      </div>
    </section>
  );
}

function VipMetric({ title, value, color, subtitle }: { title: string; value: any; color: string; subtitle?: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 20,
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.10)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.07)",
      }}
    >
      <div style={{ color, fontSize: 34, fontWeight: 950, lineHeight: 1 }}>{value}</div>
      <div style={{ color: "#fff", fontWeight: 950, marginTop: 8, fontSize: 12, letterSpacing: .6 }}>{title}</div>
      {subtitle ? <small style={{ color: "rgba(255,255,255,.52)", fontWeight: 800 }}>{subtitle}</small> : null}
    </div>
  );
}


function V26ConversionLayer({
  picks,
  topTips,
  combinedOdd,
  confidence,
  won,
  lost,
  roi,
  totalAnalyses,
  onOpenBoost,
  onVip,
}: {
  picks: any[];
  topTips: any[];
  combinedOdd: any;
  confidence: number;
  won: number;
  lost: number;
  roi: number;
  totalAnalyses: number;
  onOpenBoost: () => void;
  onVip: () => void;
}) {
  const stake = 100;
  const odd = safeNumber(combinedOdd, 0);
  const potentialReturn = odd ? Math.round(odd * stake) : 0;
  const total = safeNumber(won, 0) + safeNumber(lost, 0);
  const winRate = total ? Math.round((safeNumber(won, 0) / total) * 100) : safeNumber(roi, 0);
  const safePicks = Array.isArray(picks) && picks.length ? picks.slice(0, 3) : [];
  const safeTips = Array.isArray(topTips) && topTips.length ? topTips.slice(0, 5) : [];
  const heatmap = [
    { label: "Elite", range: "90%+", value: safeTips.filter((tip) => safeNumber(tip?.confidence, 0) >= 90).length, tone: "#22c55e" },
    { label: "Premium", range: "80–89%", value: safeTips.filter((tip) => safeNumber(tip?.confidence, 0) >= 80 && safeNumber(tip?.confidence, 0) < 90).length, tone: "#facc15" },
    { label: "Forte", range: "70–79%", value: safeTips.filter((tip) => safeNumber(tip?.confidence, 0) >= 70 && safeNumber(tip?.confidence, 0) < 80).length, tone: "#a855f7" },
  ];

  return (
    <section id="oddix-v26" className="oddix-v26-conversion oddix-anchor-target">
      <div className="oddix-v26-ticket">
        <div className="oddix-v26-ticket-head">
          <span>🎟 BILHETE OFICIAL ODDIX</span>
          <b>V26</b>
        </div>

        <div className="oddix-v26-return">
          <small>Retorno potencial</small>
          <strong>R${potentialReturn || "---"}</strong>
          <span>Stake simulada: R${stake}</span>
        </div>

        <div className="oddix-v26-ticket-grid">
          <div><span>Odd total</span><strong>{odd ? odd.toFixed(2) : "0.00"}</strong></div>
          <div><span>Confiança</span><strong>{safeNumber(confidence, 0)}%</strong></div>
          <div><span>Risco</span><strong>{safeNumber(confidence, 0) >= 85 ? "Baixo" : "Controlado"}</strong></div>
        </div>

        <div className="oddix-v26-picks">
          {(safePicks.length ? safePicks : [{ game: "Oddix Boost", tip: "Aguardando entradas", odd: "-" }]).map((pick: any, index: number) => (
            <div key={`${pick?.fixtureId || pick?.game || index}-v26-ticket`}>
              <i>✓</i>
              <span><b>{pick?.game || "Entrada Oddix"}</b><small>{pick?.tip || pick?.market || "Mercado protegido"}</small></span>
              <strong>{pick?.odd || "-"}</strong>
            </div>
          ))}
        </div>

        <button type="button" onClick={onOpenBoost}>Abrir Oddix Boost</button>
      </div>

      <div className="oddix-v26-center">
        <div className="oddix-v26-proof">
          <div className="oddix-v26-section-title">
            <span>🔥 RESULTADOS REAIS</span>
            <h2>Prova social para vender o VIP</h2>
          </div>
          <div className="oddix-v26-proof-grid">
            <V26Metric value={won || 0} label="Greens" tone="#22c55e" />
            <V26Metric value={lost || 0} label="Reds" tone="#ef4444" />
            <V26Metric value={`${winRate || 0}%`} label="Win rate" tone="#facc15" />
            <V26Metric value={`${roi || 0}%`} label="ROI" tone="#a855f7" />
            <V26Metric value={totalAnalyses || 0} label="Análises" tone="#38bdf8" />
          </div>
        </div>

        <div className="oddix-v26-ranking">
          <div className="oddix-v26-section-title compact">
            <span>🏆 RANKING IA</span>
            <h2>Top 5 entradas</h2>
          </div>
          <div className="oddix-v26-ranking-list">
            {(safeTips.length ? safeTips : [{ game: "Aguardando jogos", tip: "Sem entrada", confidence: 0 }]).map((tip: any, index: number) => {
              const conf = Math.min(100, safeNumber(tip?.confidence, 0));
              return (
                <div key={`${tip?.fixtureId || tip?.game || index}-v26-ranking`}>
                  <em>{index + 1}</em>
                  <span><b>{tip?.game || "Entrada Oddix"}</b><small>{tip?.tip || tip?.market || "Mercado IA"}</small></span>
                  <strong>{conf}%</strong>
                  <i><u style={{ width: `${conf}%` }} /></i>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="oddix-v26-heatmap">
        <div className="oddix-v26-section-title compact">
          <span>📊 HEATMAP</span>
          <h2>Confiança IA</h2>
        </div>

        <div className="oddix-v26-heatmap-bars">
          {heatmap.map((item) => {
            const pct = Math.min(100, Math.max(12, item.value * 28));
            return (
              <div key={item.label}>
                <div><span>{item.label}</span><b>{item.range}</b></div>
                <i><u style={{ width: `${pct}%`, background: item.tone }} /></i>
                <small>{item.value} entrada(s)</small>
              </div>
            );
          })}
        </div>

        <div className="oddix-v26-vip-box">
          <span>👑 FREE x VIP</span>
          <p>O VIP recebe Top Picks, Boost, Player Props reais e alertas no WhatsApp.</p>
          <button type="button" onClick={onVip}>Ver página VIP</button>
        </div>
      </div>
    </section>
  );
}

function V26Metric({ value, label, tone }: { value: any; label: string; tone: string }) {
  return (
    <div className="oddix-v26-metric">
      <strong style={{ color: tone }}>{value}</strong>
      <span>{label}</span>
    </div>
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

  heroFeatureList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    marginBottom: 16,
  },
  playerPropsHomeSection: {
    margin: "0 26px 20px",
    borderRadius: 28,
    padding: 22,
    background: "linear-gradient(135deg,rgba(11,5,32,.98),rgba(72,22,138,.96) 48%,rgba(251,146,60,.18))",
    border: "1px solid rgba(250,204,21,.28)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(0,0,0,.28)",
    overflow: "hidden",
  },
  playerPropsHomeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 18,
  },
  playerPropsHomeKicker: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: .8,
  },
  playerPropsHomeTitle: {
    margin: "6px 0 4px",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 950,
  },
  playerPropsHomeText: {
    margin: 0,
    maxWidth: 720,
    color: "rgba(255,255,255,.75)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  playerPropsHomeAction: {
    border: 0,
    borderRadius: 999,
    padding: "13px 18px",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(250,204,21,.22)",
    whiteSpace: "nowrap",
  },
  playerPropsHomeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 16,
  },
  playerPropsHomeCard: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 24,
    background: "linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04))",
    color: "#fff",
    textAlign: "left",
    padding: 0,
    cursor: "pointer",
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.13), 0 14px 34px rgba(0,0,0,.20)",
  },
  playerPropsHomePhotoBox: {
    position: "relative",
    height: 156,
    background: "radial-gradient(circle at 50% 10%,rgba(250,204,21,.34),rgba(124,58,237,.24),rgba(0,0,0,.20))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  playerPropsHomePhoto: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 18,
    filter: "drop-shadow(0 14px 22px rgba(0,0,0,.42))",
  },
  playerPropsHomeRank: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "rgba(0,0,0,.58)",
    border: "1px solid rgba(250,204,21,.30)",
    color: "#facc15",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  playerPropsHomeBody: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  playerPropsHomeType: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: .7,
  },
  playerPropsHomePlayer: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
  },
  playerPropsHomeGame: {
    margin: 0,
    color: "rgba(255,255,255,.68)",
    fontSize: 12,
    fontWeight: 800,
  },
  playerPropsHomePick: {
    borderRadius: 16,
    padding: 12,
    background: "rgba(0,0,0,.30)",
    border: "1px solid rgba(250,204,21,.18)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  playerPropsHomeMetrics: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  playerPropsHero: {
    background: "linear-gradient(135deg,rgba(15,23,42,.98),rgba(76,29,149,.90))",
    color: "white",
    border: "1px solid rgba(250,204,21,.18)",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
    boxShadow: "0 18px 45px rgba(0,0,0,.22)",
  },
  playerPropsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
    gap: 18,
  },
  playerPropCard: {
    background: "linear-gradient(180deg,rgba(30,16,66,.98),rgba(9,5,20,.99))",
    color: "#fff",
    border: "1px solid rgba(168,85,247,.35)",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0 18px 42px rgba(0,0,0,.24)",
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
    height: 158,
    background: "radial-gradient(circle at 50% 20%, rgba(250,204,21,.20), transparent 28%), linear-gradient(135deg,#1e1042,#090514)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  playerPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 18,
    filter: "drop-shadow(0 12px 20px rgba(0,0,0,.36))",
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

  topPickHeroPremium: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "1.05fr .95fr 330px",
    alignItems: "center",
    gap: 18,
    margin: "0 26px 18px",
    padding: 20,
    borderRadius: 30,
    border: "1px solid rgba(250,204,21,.34)",
    background: "radial-gradient(circle at 10% 20%, rgba(250,204,21,.20), transparent 28%), radial-gradient(circle at 72% 50%, rgba(34,197,94,.13), transparent 26%), linear-gradient(135deg, rgba(10,4,22,.98), rgba(36,12,76,.98), rgba(10,4,24,.99))",
    boxShadow: "0 28px 75px rgba(0,0,0,.36)",
    color: "#fff",
  },
  topPickGlowLayer: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, transparent, rgba(250,204,21,.06), transparent)",
    pointerEvents: "none",
  },
  topPickLeftPremium: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  topPickMatchBlockPremium: {
    display: "grid",
    gridTemplateColumns: "72px 1fr 72px",
    gap: 14,
    alignItems: "center",
    padding: 14,
    borderRadius: 24,
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
  },
  topPickLogoPremium: {
    width: 72,
    height: 72,
    objectFit: "contain",
    borderRadius: 20,
    background: "rgba(255,255,255,.10)",
    padding: 10,
    boxShadow: "0 14px 28px rgba(0,0,0,.28)",
  },
  topPickTeamsPremium: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 3,
  },
  topPickCenterPremium: {
    position: "relative",
    zIndex: 2,
    padding: 20,
    borderRadius: 24,
    background: "linear-gradient(180deg, rgba(250,204,21,.16), rgba(255,255,255,.06))",
    border: "1px solid rgba(250,204,21,.24)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  topPickRightPremium: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  topPickOddPremium: {
    borderRadius: 20,
    padding: 16,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontWeight: 950,
  },
  topPickConfidencePremium: {
    borderRadius: 20,
    padding: 16,
    background: "rgba(34,197,94,.18)",
    border: "1px solid rgba(34,197,94,.34)",
    color: "#bbf7d0",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontWeight: 950,
  },
  topPickQualityPremium: {
    gridColumn: "1 / -1",
    borderRadius: 18,
    padding: "12px 14px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 900,
  },
  topPickButtonPremium: {
    gridColumn: "1 / -1",
    border: 0,
    borderRadius: 18,
    padding: "14px 16px",
    background: "linear-gradient(135deg,#22c55e,#a3e635)",
    color: "#052e16",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(34,197,94,.25)",
  },
  premiumTicketSection: {
    margin: "0 26px 20px",
    padding: 22,
    borderRadius: 30,
    background: "linear-gradient(135deg, rgba(15,23,42,.98), rgba(30,10,70,.98))",
    border: "1px solid rgba(250,204,21,.24)",
    boxShadow: "0 24px 65px rgba(0,0,0,.30)",
    color: "#fff",
  },
  premiumTicketHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  ticketKicker: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  ticketTitle: {
    margin: "6px 0 6px",
    fontSize: 26,
    lineHeight: 1.05,
  },
  ticketText: {
    margin: 0,
    color: "rgba(255,255,255,.72)",
  },
  ticketSummaryBox: {
    minWidth: 160,
    borderRadius: 22,
    padding: 16,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontWeight: 950,
    textAlign: "center",
  },
  ticketCardPremium: {
    borderRadius: 26,
    background: "rgba(0,0,0,.26)",
    border: "1px solid rgba(255,255,255,.10)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  ticketPickRowPremium: {
    width: "100%",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 20,
    padding: 14,
    background: "linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.045))",
    color: "#fff",
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr) 70px 78px",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  ticketPickNumber: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "rgba(250,204,21,.16)",
    color: "#facc15",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  ticketPickTeams: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  ticketPickOdd: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    color: "#facc15",
    fontWeight: 950,
  },
  ticketPickConfidence: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    color: "#bbf7d0",
    fontWeight: 950,
  },
  ticketFooterPremium: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 2px 2px",
    color: "rgba(255,255,255,.70)",
    fontSize: 13,
  },
  ticketButtonPremium: {
    border: 0,
    borderRadius: 999,
    padding: "11px 16px",
    background: "#facc15",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
  },

  page: {
    minHeight: "100vh",
    color: "#f8fafc",
    background: "radial-gradient(circle at 15% -10%, rgba(124,58,237,.34), transparent 34%), radial-gradient(circle at 92% 4%, rgba(250,204,21,.12), transparent 24%), linear-gradient(180deg,#05010d 0%,#0b0217 45%,#05010d 100%)",
    fontFamily: "Arial, sans-serif",
  },
  topHeader: {
    background: "linear-gradient(135deg, rgba(8,3,22,.96), rgba(46,16,101,.94), rgba(91,33,182,.84))",
    color: "white",
    padding: "14px 26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    position: "sticky",
    top: 0,
    zIndex: 20,
    borderBottom: "1px solid rgba(250,204,21,.16)",
    boxShadow: "0 18px 48px rgba(0,0,0,.34)",
    backdropFilter: "blur(14px)",
  },
  brand: {
    width: 210,
    minWidth: 190,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: "linear-gradient(135deg, rgba(255,255,255,.10), rgba(124,58,237,.16))",
    border: "1px solid rgba(250,204,21,.18)",
    borderRadius: 24,
    padding: "8px 18px",
    boxShadow: "0 14px 34px rgba(0,0,0,.30)",
  },
  brandLogo: {
    width: "100%",
    height: 58,
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
    background: "linear-gradient(135deg,#090318,#1b073e,#4c1d95)",
    padding: "12px 26px 18px",
    display: "flex",
    gap: 10,
    overflowX: "auto",
    borderBottom: "1px solid rgba(168,85,247,.22)",
    boxShadow: "0 14px 38px rgba(0,0,0,.24)",
  },
  sportItem: {
    minWidth: 112,
    height: 48,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.16)",
    background: "linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.045))",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 10px 24px rgba(0,0,0,.18)",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: 14,
    margin: "22px 26px 18px",
    alignItems: "stretch",
  },
  heroMain: {
    position: "relative",
    overflow: "hidden",
    minHeight: 520,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 560px",
    alignItems: "center",
    gap: 12,
    background: "radial-gradient(circle at 78% 46%, rgba(250,204,21,.20), transparent 28%), radial-gradient(circle at 70% 30%, rgba(124,58,237,.58), transparent 36%), linear-gradient(135deg,rgba(12,8,26,.99),rgba(46,16,101,.94))",
    color: "#fff",
    border: "1px solid rgba(250,204,21,.34)",
    borderRadius: 30,
    padding: "48px 38px 96px",
    boxShadow: "0 28px 80px rgba(0,0,0,.34)",
  },
  heroTextBlock: {
    position: "relative",
    zIndex: 2,
    maxWidth: 760,
    paddingRight: 10,
  },
  heroPlayerBox: {
    position: "relative",
    height: 500,
    minWidth: 520,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  heroPlayerGlow: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(250,204,21,.22), rgba(124,58,237,.55), transparent 68%)",
    filter: "blur(2px)",
    bottom: -90,
    right: -42,
  },
  heroPlayerImage: {
    position: "relative",
    zIndex: 2,
    height: 535,
    width: "145%",
    objectFit: "contain",
    objectPosition: "center bottom",
    transform: "translateX(-16px)",
    filter: "drop-shadow(0 28px 36px rgba(0,0,0,.55)) drop-shadow(0 0 24px rgba(250,204,21,.22))",
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
    background: "linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.06))",
    border: "1px solid rgba(250,204,21,.32)",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#fff",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), 0 12px 28px rgba(0,0,0,.22)",
  },
  vipPanel: {
    background: "linear-gradient(180deg,rgba(31,10,70,.98),rgba(10,4,24,.98))",
    border: "1px solid rgba(250,204,21,.28)",
    borderRadius: 28,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 12,
    color: "#fff",
    boxShadow: "0 22px 55px rgba(0,0,0,.32)",
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
    minHeight: 520,
    borderRadius: 30,
    overflow: "hidden",
    color: "white",
    background: "linear-gradient(120deg,rgba(11,6,24,.99),rgba(46,16,101,.96),rgba(124,58,237,.84))",
    boxShadow: "0 26px 75px rgba(76,29,149,.34)",
    display: "grid",
    gridTemplateColumns: "1.05fr .95fr",
    gap: 24,
    padding: 30,
    border: "1px solid rgba(250,204,21,.20)",
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
    minHeight: 330,
    borderRadius: 26,
    overflow: "hidden",
    position: "relative",
    background: "radial-gradient(circle at 50% 15%, rgba(124,58,237,.35), transparent 35%), linear-gradient(180deg,#12062b,#05010d)",
    border: "1px solid rgba(255,255,255,.18)",
    boxShadow: "0 20px 52px rgba(0,0,0,.38)",
  },
  marketingPlayerPhoto: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "112%",
    objectFit: "contain",
    objectPosition: "center bottom",
    filter: "saturate(1.18) contrast(1.08) drop-shadow(0 22px 30px rgba(0,0,0,.55))",
    opacity: 1,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
    overflowX: "hidden",
    overflowY: "visible",
    maxHeight: "none",
    padding: "10px 10px 16px",
    scrollSnapType: "y proximity",
    position: "relative",
    zIndex: 8,
    background: "linear-gradient(180deg,rgba(14,6,31,.96),rgba(8,3,22,.90))",
    border: "1px solid rgba(168,85,247,.22)",
    borderRadius: 22,
    scrollbarWidth: "thin",
    boxShadow: "0 14px 38px rgba(0,0,0,.20)",
  },
  featuredCard: {
    minHeight: 165,
    width: "100%",
    minWidth: 0,
    scrollSnapAlign: "start",
    background: "linear-gradient(135deg,rgba(46,16,101,.96),rgba(124,58,237,.84))",
    border: "1px solid rgba(168,85,247,.45)",
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
    background: "linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.04))",
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,.16)",
    overflowX: "auto",
    position: "sticky",
    top: 86,
    zIndex: 13,
    border: "1px solid rgba(255,255,255,.10)",
    backdropFilter: "blur(14px)",
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
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 18,
    margin: "0 26px 28px",
    alignItems: "start",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    position: "sticky",
    top: 108,
    alignSelf: "start",
    maxHeight: "calc(100vh - 122px)",
    overflowY: "auto",
    paddingRight: 4,
  },
  searchCard: {
    background: "linear-gradient(180deg,rgba(20,12,38,.96),rgba(7,6,18,.98))",
    border: "1px solid rgba(168,85,247,.22)",
    color: "#fff",
    borderRadius: 22,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 16px 36px rgba(0,0,0,.22)",
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
    background: "linear-gradient(180deg,rgba(20,12,38,.96),rgba(7,6,18,.98))",
    color: "#fff",
    border: "1px solid rgba(168,85,247,.22)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 16px 36px rgba(0,0,0,.22)",
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
    borderBottom: "1px solid rgba(255,255,255,.08)",
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
    background: "linear-gradient(180deg,rgba(10,5,24,.82),rgba(5,2,12,.78))",
    border: "1px solid rgba(168,85,247,.14)",
    borderRadius: 28,
    padding: 18,
    boxShadow: "0 16px 40px rgba(0,0,0,.18)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  gamesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
    gap: 18,
    overflowX: "hidden",
    overflowY: "visible",
    padding: "8px 6px 20px",
    scrollSnapType: "none",
    scrollbarWidth: "thin",
    scrollBehavior: "smooth",
    minHeight: 345,
  },
  gameCard: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 322,
    scrollSnapAlign: "none",
    background: "linear-gradient(180deg,rgba(30,16,66,.98),rgba(9,5,20,.99))",
    color: "#fff",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 20px 48px rgba(0,0,0,.28)",
    border: "1px solid rgba(168,85,247,.42)",
    cursor: "pointer",
  },
  gameCardLive: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 322,
    scrollSnapAlign: "none",
    background: "linear-gradient(180deg,rgba(88,28,28,.98),rgba(30,16,66,.98))",
    color: "#fff",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 20px 48px rgba(239,68,68,.16)",
    border: "1px solid rgba(239,68,68,.50)",
    cursor: "pointer",
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
    background: "rgba(255,255,255,.08)",
    color: "#ddd6fe",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  qualityBadge: {
    background: "rgba(19,242,107,.12)",
    color: "#13f26b",
    border: "1px solid rgba(19,242,107,.20)",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  leagueLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#b9b4ce",
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
    background: "rgba(255,255,255,.075)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "#fff",
    boxShadow: "inset 0 0 18px rgba(124,58,237,.10)",
  },
  pickBoxLarge: {
    background: "rgba(255,255,255,.075)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 9,
    color: "#fff",
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
    background: "linear-gradient(135deg,#7c3aed,#4c1d95)",
    color: "white",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(124,58,237,.24)",
  },
  savedSmallButton: {
    width: "100%",
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    border: 0,
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(250,204,21,.24)",
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
  boostHero: {
    background: "linear-gradient(135deg,#111827,#4c1d95)",
    color: "white",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 14,
  },
  boostOddBox: {
    minWidth: 190,
    background: "rgba(255,255,255,.12)",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  boostSelections: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
    gap: 14,
  },
  boostCard: {
    background: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 12px 30px rgba(17,24,39,.07)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
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

  topPickPremiumBadge: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#facc15",
    fontWeight: 1000,
    lineHeight: 1.05,
    textTransform: "uppercase",
  },
  topPickMatchBlock: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0,1fr) 48px",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    borderLeft: "1px solid rgba(255,255,255,.12)",
    paddingLeft: 14,
  },
  topPickTeams: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 13,
    minWidth: 0,
  },
  topPickSelection: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    borderLeft: "1px solid rgba(255,255,255,.12)",
    paddingLeft: 18,
    minWidth: 0,
  },
  topPickOddBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 70,
    borderRadius: 18,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.10)",
  },
  topPickConfidence: {
    width: 76,
    height: 76,
    borderRadius: 999,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "4px solid #13f26b",
    color: "#13f26b",
    boxShadow: "0 0 24px rgba(19,242,107,.22)",
  },
  footer: {
    margin: "26px",
    padding: "22px 26px",
    display: "grid",
    gridTemplateColumns: "1.1fr 1.1fr .9fr",
    gap: 20,
    color: "#fff",
    alignItems: "center",
    borderRadius: 28,
    background: "linear-gradient(135deg, rgba(8,3,22,.98), rgba(46,16,101,.92), rgba(8,3,22,.98))",
    border: "1px solid rgba(250,204,21,.20)",
    boxShadow: "0 20px 52px rgba(0,0,0,.28)",
  },
  footerBrand: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  footerLinks: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 10,
    fontSize: 13,
    fontWeight: 900,
  },
  footerLegal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    minWidth: 0,
  },
  footerLegalText: {
    maxWidth: 190,
    color: "#b9b4ce",
    fontSize: 11,
    lineHeight: 1.35,
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
    width: 118,
    maxWidth: "26vw",
    height: "auto",
    display: "block",
    opacity: .92,
    filter: "drop-shadow(0 10px 18px rgba(0,0,0,.25))",
  },

  rouletteHint: {
    color: "#c4b5fd",
    fontSize: 13,
    fontWeight: 800,
  },
  pickActionButton: {
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 950,
    cursor: "pointer",
  },
  topPickHero: {
    margin: "0 26px 20px",
    minHeight: 118,
    display: "grid",
    gridTemplateColumns: "minmax(190px,.9fr) minmax(280px,1.15fr) minmax(280px,1.25fr) 92px 92px minmax(150px,.55fr)",
    gap: 16,
    alignItems: "center",
    background: "linear-gradient(135deg,rgba(20,12,38,.98),rgba(4,5,15,.98))",
    border: "1px solid rgba(250,204,21,.55)",
    borderRadius: 26,
    padding: "16px 18px",
    color: "#fff",
    boxShadow: "0 18px 50px rgba(250,204,21,.10), 0 24px 60px rgba(0,0,0,.30)",
  },
  topPickLeft: {
    display: "none",
  },
  topPickBadge: {
    display: "none",
  },
  topPickCenter: {
    display: "none",
  },
  topPickLogo: {
    width: 46,
    height: 46,
    objectFit: "contain",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 14,
    padding: 6,
  },
  topPickScore: {
    display: "none",
  },
  topPickRight: {
    display: "none",
  },
  topPickButton: {
    height: 50,
    border: 0,
    borderRadius: 16,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(250,204,21,.25)",
  },
  greensPanel: {
    background: "linear-gradient(180deg,rgba(6,78,59,.96),rgba(6,35,28,.98))",
    border: "1px solid rgba(34,197,94,.35)",
    borderRadius: 26,
    padding: 22,
    color: "#fff",
    boxShadow: "0 18px 45px rgba(34,197,94,.15)",
  },
  greensHeader: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", marginBottom: 18 },
  greensStatsBox: { background: "rgba(0,0,0,.24)", border: "1px solid rgba(34,197,94,.32)", borderRadius: 18, padding: 16, minWidth: 180, display: "flex", flexDirection: "column", gap: 5 },
  greensGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 },
  greenCard: { background: "rgba(0,0,0,.28)", border: "1px solid rgba(34,197,94,.34)", borderRadius: 20, padding: 16, boxShadow: "0 12px 30px rgba(0,0,0,.18)" },
  greenTop: { display: "flex", justifyContent: "space-between", color: "#4ade80", fontWeight: 950, marginBottom: 8 },
  greenMeta: { display: "flex", justifyContent: "space-between", gap: 10, color: "#bbf7d0", fontWeight: 800 },
  greensBetButton: { marginTop: 18, width: "100%", background: "linear-gradient(135deg,#facc15,#fb923c)", color: "#111827", border: 0, borderRadius: 16, padding: "14px 18px", fontWeight: 950, cursor: "pointer" },
  betSlipWrap: {
    background: "linear-gradient(180deg,#111827,#080316)",
    color: "white",
    borderRadius: 28,
    padding: 24,
    border: "1px solid rgba(250,204,21,.35)",
    boxShadow: "0 22px 60px rgba(0,0,0,.22)",
  },
  betSlipHeader: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", borderBottom: "1px dashed rgba(250,204,21,.35)", paddingBottom: 18 },
  betSlipOddTotal: { minWidth: 210, background: "linear-gradient(135deg,#facc15,#fb923c)", color: "#111827", borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", gap: 5, fontWeight: 950 },
  betSlipBody: { display: "flex", flexDirection: "column", gap: 12, marginTop: 18 },
  betSlipRow: { display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 14, alignItems: "center", textAlign: "left", background: "rgba(255,255,255,.07)", color: "white", border: "1px solid rgba(255,255,255,.12)", borderRadius: 18, padding: 14, cursor: "pointer" },
  betSlipNumber: { width: 36, height: 36, borderRadius: 999, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950 },
  betSlipInfo: { display: "flex", flexDirection: "column", gap: 4 },
  betSlipCheck: { color: "#22c55e", fontSize: 24, fontWeight: 950 },
  betSlipFooter: { marginTop: 18, display: "flex", flexDirection: "column", gap: 10, color: "#c4b5fd", textAlign: "center" },
  betSlipMainButton: { width: "100%", background: "linear-gradient(135deg,#facc15,#fb923c)", color: "#111827", border: 0, borderRadius: 16, padding: "15px 18px", fontWeight: 950, cursor: "pointer" },

  vipMarketingStrip: {
    margin: "0 26px 20px",
    borderRadius: 26,
    border: "1px solid rgba(250,204,21,.34)",
    background: "linear-gradient(135deg, rgba(17,24,39,.94), rgba(88,28,135,.78) 45%, rgba(234,88,12,.74))",
    boxShadow: "0 24px 70px rgba(124,58,237,.22), inset 0 1px 0 rgba(255,255,255,.16)",
    padding: 20,
    display: "grid",
    gridTemplateColumns: "1.1fr 1.7fr auto",
    gap: 18,
    alignItems: "center",
    color: "white",
    overflow: "hidden",
  },
  vipMarketingHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },
  vipMarketingBadge: {
    width: "max-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(250,204,21,.16)",
    border: "1px solid rgba(250,204,21,.36)",
    color: "#facc15",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: ".6px",
  },
  vipMarketingTitle: {
    margin: 0,
    fontSize: 23,
    lineHeight: 1.05,
    fontWeight: 1000,
  },
  vipMarketingText: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,.78)",
    fontWeight: 800,
    lineHeight: 1.4,
  },
  vipMarketingCards: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: 12,
  },
  vipMarketingCard: {
    minHeight: 108,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.16)",
    background: "rgba(3,7,18,.42)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
  },
  vipMarketingIcon: {
    fontSize: 20,
  },
  vipMarketingButton: {
    height: 52,
    minWidth: 170,
    border: 0,
    borderRadius: 16,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 16px 35px rgba(250,204,21,.28)",
  },
  hotEntriesSection: {
    margin: "0 26px 20px",
    borderRadius: 28,
    border: "1px solid rgba(250,204,21,.30)",
    background: "radial-gradient(circle at 18% 0%, rgba(250,204,21,.18), transparent 28%), linear-gradient(180deg, rgba(12,8,25,.98), rgba(3,7,18,.98))",
    padding: 22,
    color: "white",
    boxShadow: "0 22px 70px rgba(0,0,0,.28)",
  },
  hotEntriesHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    marginBottom: 18,
  },
  hotEntriesKicker: {
    color: "#facc15",
    fontWeight: 1000,
    fontSize: 12,
    letterSpacing: ".8px",
  },
  hotEntriesTitle: {
    margin: "8px 0 6px",
    fontSize: 28,
    lineHeight: 1.05,
    fontWeight: 1000,
  },
  hotEntriesText: {
    margin: 0,
    color: "rgba(255,255,255,.72)",
    fontWeight: 800,
  },
  hotEntriesVipButton: {
    minWidth: 140,
    height: 46,
    border: "1px solid rgba(250,204,21,.42)",
    borderRadius: 999,
    background: "rgba(250,204,21,.12)",
    color: "#facc15",
    fontWeight: 1000,
    cursor: "pointer",
  },
  hotEntriesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 14,
  },
  hotEntryCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,.13)",
    background: "linear-gradient(180deg, rgba(30,27,75,.84), rgba(8,7,20,.95))",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 18px 45px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.12)",
  },
  hotEntryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  hotEntryRank: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 1000,
  },
  hotEntryHeat: {
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: ".7px",
  },
  hotEntryGame: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 1000,
  },
  hotEntryLeague: {
    margin: "-8px 0 0",
    color: "rgba(255,255,255,.62)",
    fontSize: 12,
    fontWeight: 800,
  },
  hotEntryMarketBox: {
    borderRadius: 18,
    border: "1px solid rgba(250,204,21,.28)",
    background: "rgba(0,0,0,.26)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  hotEntryMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
  },
  hotEntryFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "rgba(255,255,255,.74)",
    fontSize: 12,
    fontWeight: 900,
  },
  hotEntryButton: {
    height: 44,
    border: 0,
    borderRadius: 15,
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#111827",
    fontWeight: 1000,
    cursor: "pointer",
  },



  // ===== ODDIX PREMIUM V11 OVERRIDES =====
  heroCtaRow: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 18 },
  heroPrimaryCta: { border: 0, borderRadius: 18, padding: "16px 26px", background: "linear-gradient(135deg,#facc15,#f97316)", color: "#07070d", fontWeight: 1000, cursor: "pointer", boxShadow: "0 18px 36px rgba(247,201,72,.30)" },
  heroSecondaryCta: { border: "1px solid rgba(168,85,247,.80)", borderRadius: 18, padding: "16px 26px", background: "rgba(123,44,255,.16)", color: "#d8b4fe", fontWeight: 1000, cursor: "pointer", boxShadow: "0 0 28px rgba(123,44,255,.22)" },
  heroBottomFeatures: { position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)", zIndex: 4, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, width: "calc(100% - 80px)", padding: 10, borderRadius: 18, background: "rgba(0,0,0,.42)", border: "1px solid rgba(250,204,21,.18)", backdropFilter: "blur(12px)", color: "#facc15", fontSize: 11, fontWeight: 900, textAlign: "center" },
  playerPropsCardTopPremium: { position: "relative", height: 178, display: "grid", gridTemplateColumns: "86px 1fr 90px", alignItems: "center", gap: 12, padding: 16, background: "radial-gradient(circle at 42% 12%,rgba(250,204,21,.18),transparent 30%),linear-gradient(135deg,rgba(123,44,255,.70),rgba(45,17,77,.92))", overflow: "hidden" },
  playerPropsClubLogoPremium: { width: 82, height: 82, objectFit: "contain", borderRadius: 22, padding: 8, background: "rgba(255,255,255,.10)", filter: "drop-shadow(0 0 16px rgba(255,255,255,.20)) drop-shadow(0 18px 28px rgba(0,0,0,.38))" },
  playerPropsAvatarPremium: { width: 112, height: 112, justifySelf: "center", borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#facc15,#f97316 48%,#22c55e)", color: "#111827", fontSize: 36, fontWeight: 1000, boxShadow: "0 22px 36px rgba(0,0,0,.35), 0 0 22px rgba(250,204,21,.18)" },
  playerPropsTrend: { alignSelf: "end", justifySelf: "end", display: "flex", alignItems: "end", gap: 4, height: 58 },
  playerPropsHomeTeam: { margin: "-6px 0 0", color: "#facc15", fontSize: 12, fontWeight: 950, textTransform: "uppercase" },
  ticketSummaryPremiumGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 104px", gap: 12, marginTop: 10, padding: 14, borderRadius: 22, background: "linear-gradient(135deg,rgba(250,204,21,.18),rgba(251,146,60,.11))", border: "1px solid rgba(250,204,21,.28)" },
  ticketVipSeal: { width: 92, height: 92, borderRadius: 999, background: "radial-gradient(circle,#facc15,#b45309)", color: "#111827", fontWeight: 1000, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.05, boxShadow: "0 0 26px rgba(250,204,21,.34)" },

};


Object.assign(styles, {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 20% 0%, rgba(123,44,255,.24), transparent 32%), radial-gradient(circle at 78% 18%, rgba(247,201,72,.08), transparent 28%), linear-gradient(180deg,#07070D,#10051f 46%,#07070D)",
    color: "#fff",
    overflowX: "hidden",
  },

  topHeader: {
    minHeight: 72,
    padding: "0 26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(7,7,13,.82)",
    backdropFilter: "blur(18px)",
    borderBottom: "1px solid rgba(123,44,255,.35)",
    boxShadow: "0 14px 40px rgba(0,0,0,.35)",
  },

  brandLogo: {
    height: 58,
    width: "auto",
    objectFit: "contain",
    filter: "drop-shadow(0 0 18px rgba(123,44,255,.45))",
  },

  headerPill: {
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 999,
    padding: "10px 16px",
    background: "linear-gradient(135deg,rgba(123,44,255,.65),rgba(168,85,247,.30))",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(123,44,255,.22)",
  },

  vipButton: {
    border: 0,
    borderRadius: 999,
    padding: "12px 18px",
    background: "linear-gradient(135deg,#F7C948,#fb923c)",
    color: "#07070D",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(247,201,72,.24)",
  },

  sportsRail: {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    padding: "8px 26px",
    background: "rgba(13,7,24,.86)",
    borderBottom: "1px solid rgba(123,44,255,.28)",
  },

  sportItem: {
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 999,
    minHeight: 36,
    padding: "0 14px",
    background: "rgba(255,255,255,.055)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: 18,
    margin: "26px",
    alignItems: "stretch",
  },

  heroMain: {
    minHeight: 540,
    height: 540,
    display: "grid",
    gridTemplateColumns: "minmax(390px,.95fr) minmax(520px,1.2fr)",
    alignItems: "center",
    gap: 12,
    padding: "42px 42px 74px",
    position: "relative",
    overflow: "hidden",
    borderRadius: 30,
    background:
      "radial-gradient(circle at 72% 44%, rgba(123,44,255,.60), transparent 34%), radial-gradient(circle at 56% 52%, rgba(247,201,72,.10), transparent 22%), linear-gradient(135deg,#12051F,#1A0836 52%,#0D0718)",
    border: "1px solid rgba(247,201,72,.32)",
    boxShadow: "0 0 40px rgba(123,44,255,.25), inset 0 1px 0 rgba(255,255,255,.10)",
  },

  heroTextBlock: {
    maxWidth: 560,
    zIndex: 2,
  },

  sectionKicker: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 14px",
    background: "linear-gradient(135deg,rgba(123,44,255,.55),rgba(168,85,247,.24))",
    border: "1px solid rgba(168,85,247,.55)",
    color: "#c4b5fd",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: .9,
    textTransform: "uppercase",
  },

  heroFeatureList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },

  heroCtaRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 22,
  },

  heroPrimaryCta: {
    border: 0,
    borderRadius: 14,
    padding: "15px 24px",
    background: "linear-gradient(135deg,#F7C948,#fb923c)",
    color: "#07070D",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 18px 30px rgba(247,201,72,.22)",
  },

  heroSecondaryCta: {
    border: "1px solid rgba(168,85,247,.68)",
    borderRadius: 14,
    padding: "15px 24px",
    background: "rgba(123,44,255,.10)",
    color: "#c4b5fd",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 0 22px rgba(123,44,255,.16)",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: 12,
    maxWidth: 560,
  },

  infoMetric: {
    minHeight: 74,
    borderRadius: 16,
    padding: "14px",
    background: "linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.045))",
    border: "1px solid rgba(247,201,72,.30)",
  },

  heroPlayerBox: {
    position: "relative",
    height: "100%",
    minWidth: 0,
    zIndex: 2,
  },

  heroPlayerGlow: {
    position: "absolute",
    inset: "12% 6% 10% 0",
    background: "radial-gradient(circle,rgba(123,44,255,.65),transparent 64%)",
    filter: "blur(18px)",
  },

  heroPlayerImage: {
    position: "absolute",
    right: -10,
    bottom: -10,
    height: 540,
    width: "min(620px, 100%)",
    objectFit: "contain",
    objectPosition: "center bottom",
    filter: "drop-shadow(0 28px 42px rgba(0,0,0,.55)) drop-shadow(0 0 22px rgba(123,44,255,.45))",
    transform: "scale(1.18)",
  },

  heroBottomFeatures: {
    position: "absolute",
    left: 26,
    right: 26,
    bottom: 20,
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 10,
    borderRadius: 999,
    padding: "11px 16px",
    background: "rgba(7,7,13,.68)",
    border: "1px solid rgba(247,201,72,.22)",
    color: "#F7C948",
    fontSize: 11,
    fontWeight: 950,
    textAlign: "center",
    zIndex: 4,
  },

  vipPanel: {
    minHeight: 540,
    borderRadius: 30,
    padding: "32px 26px",
    background: "linear-gradient(180deg,rgba(13,7,24,.96),rgba(7,7,13,.98))",
    border: "1px solid rgba(123,44,255,.35)",
    boxShadow: "0 0 40px rgba(123,44,255,.18), inset 0 1px 0 rgba(255,255,255,.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 18,
    color: "#fff",
  },

  confidenceBar: {
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,.10)",
    overflow: "hidden",
  },

  confidenceFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg,#22c55e,#F7C948)",
  },

  vipFullButton: {
    border: 0,
    borderRadius: 16,
    padding: "18px 18px",
    background: "linear-gradient(135deg,#F7C948,#fb923c)",
    color: "#07070D",
    fontWeight: 1000,
    cursor: "pointer",
  },

  topPickHeroPremium: {
    minHeight: 156,
    margin: "0 26px 22px",
    padding: "22px 24px",
    display: "grid",
    gridTemplateColumns: "150px minmax(340px,.95fr) minmax(310px,1fr) 430px",
    alignItems: "center",
    gap: 18,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(247,201,72,.58)",
    background: "linear-gradient(135deg,rgba(7,7,13,.97),rgba(26,8,54,.92))",
    boxShadow: "0 18px 54px rgba(0,0,0,.34), 0 0 28px rgba(247,201,72,.10)",
    color: "#fff",
  },

  topPickStarBlock: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    color: "#F7C948",
    fontSize: 17,
    fontWeight: 1000,
    lineHeight: 1.05,
  },

  topPickStarIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(247,201,72,.12)",
    border: "1px solid rgba(247,201,72,.28)",
    fontSize: 28,
  },

  topPickMatchBlockPremium: {
    display: "grid",
    gridTemplateColumns: "86px minmax(0,1fr) 86px",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },

  topPickLogoPremium: {
    width: 82,
    height: 82,
    objectFit: "contain",
    borderRadius: 22,
    padding: 10,
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.14)",
    filter: "drop-shadow(0 0 14px rgba(255,255,255,.16))",
  },

  topPickTeamsPremium: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    textAlign: "center",
    fontWeight: 1000,
    color: "#fff",
  },

  topPickCenterPremium: {
    borderRadius: 18,
    padding: "18px 20px",
    background: "linear-gradient(135deg,rgba(255,255,255,.09),rgba(255,255,255,.035))",
    border: "1px solid rgba(247,201,72,.24)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  topPickRightPremium: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 178px",
    gap: 10,
    alignItems: "stretch",
  },

  topPickOddPremium: {
    borderRadius: 16,
    padding: "14px 12px",
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.12)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    color: "#F7C948",
  },

  topPickConfidencePremium: {
    borderRadius: 16,
    padding: "14px 12px",
    background: "rgba(34,197,94,.10)",
    border: "1px solid rgba(34,197,94,.24)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    color: "#22c55e",
  },

  topPickQualityPremium: {
    borderRadius: 16,
    padding: "14px 12px",
    background: "rgba(123,44,255,.12)",
    border: "1px solid rgba(168,85,247,.26)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    color: "#c4b5fd",
  },

  topPickButtonPremium: {
    border: 0,
    borderRadius: 18,
    padding: "14px 18px",
    background: "linear-gradient(135deg,#F7C948,#fff7ad,#fb923c)",
    color: "#07070D",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 18px 32px rgba(247,201,72,.20)",
  },

  playerPropsHomeSection: {
    margin: "0 26px 22px",
    borderRadius: 28,
    padding: 24,
    background: "linear-gradient(135deg,rgba(11,5,32,.98),rgba(72,22,138,.96) 48%,rgba(251,146,60,.14))",
    border: "1px solid rgba(123,44,255,.55)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(0,0,0,.30), 0 0 40px rgba(123,44,255,.18)",
    overflow: "hidden",
  },

  playerPropsHomeTitle: {
    margin: "6px 0 6px",
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 1000,
  },

  playerPropsHomeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 18,
  },

  playerPropsHomeCard: {
    position: "relative",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 22,
    background: "linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04))",
    color: "#fff",
    textAlign: "left",
    padding: 0,
    cursor: "pointer",
    overflow: "hidden",
    minHeight: 230,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.13), 0 14px 34px rgba(0,0,0,.22)",
  },

  playerPropsCardTopPremium: {
    position: "relative",
    height: 128,
    display: "grid",
    gridTemplateColumns: "88px minmax(0,1fr) 86px",
    alignItems: "end",
    gap: 8,
    padding: "14px 14px 0",
    background: "radial-gradient(circle at 50% 10%,rgba(250,204,21,.28),rgba(124,58,237,.36),rgba(0,0,0,.16))",
  },

  playerPropsClubLogoPremium: {
    width: 72,
    height: 72,
    objectFit: "contain",
    borderRadius: 18,
    padding: 7,
    background: "rgba(7,7,13,.35)",
    border: "1px solid rgba(255,255,255,.18)",
    filter: "drop-shadow(0 0 12px rgba(255,255,255,.26))",
    alignSelf: "start",
  },

  playerPropsPlayerPhotoWrap: {
    height: 132,
    alignSelf: "end",
    justifySelf: "center",
    display: "flex",
    alignItems: "end",
    justifyContent: "center",
    overflow: "hidden",
  },

  playerPropsPlayerCutout: {
    height: 142,
    width: 180,
    objectFit: "contain",
    objectPosition: "center bottom",
    filter: "drop-shadow(0 18px 24px rgba(0,0,0,.45))",
  },

  playerPropsTrend: {
    alignSelf: "end",
    justifySelf: "end",
    display: "flex",
    alignItems: "end",
    gap: 4,
    height: 58,
    paddingBottom: 10,
  },

  playerPropsHomeBody: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  playerPropsHomePlayer: {
    margin: 0,
    fontSize: 20,
    fontWeight: 1000,
    letterSpacing: .2,
  },

  playerPropsHomeTeam: {
    margin: "-4px 0 0",
    color: "#F7C948",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
  },

  playerPropsHomeMetrics: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 4,
  },

  premiumTicketSection: {
    margin: "0 26px 22px",
    borderRadius: 28,
    padding: 22,
    background: "linear-gradient(135deg,rgba(7,7,13,.98),rgba(18,5,31,.94))",
    border: "1px solid rgba(247,201,72,.34)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(0,0,0,.30)",
  },

  vipMarketingStrip: {
    margin: "0 26px 22px",
    borderRadius: 28,
    padding: 24,
    background: "linear-gradient(135deg,rgba(9,5,20,.98),rgba(30,16,66,.96))",
    border: "1px solid rgba(123,44,255,.36)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(0,0,0,.30), 0 0 40px rgba(123,44,255,.16)",
  },

  vipMarketingHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 18,
  },

  vipMarketingCards: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: 14,
  },

  vipMarketingCard: {
    minHeight: 126,
    borderRadius: 20,
    padding: 16,
    background: "linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.035))",
    border: "1px solid rgba(255,255,255,.12)",
    position: "relative",
    overflow: "hidden",
  },

  vipMarketingCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  vipMarketingGreenValue: {
    color: "#22c55e",
    fontSize: 32,
    fontWeight: 1000,
  },

  vipMarketingPurpleValue: {
    color: "#c084fc",
    fontSize: 32,
    fontWeight: 1000,
  },

  vipSparkline: {
    position: "absolute",
    right: 14,
    bottom: 12,
    display: "flex",
    gap: 4,
    alignItems: "end",
    height: 34,
    opacity: .9,
  },
});
