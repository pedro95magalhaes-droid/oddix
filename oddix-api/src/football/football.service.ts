import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../prisma/prisma.service";
import { AllScoresService } from "./allscores.service";
import { FlashScoreService } from "./flashscore.service";
import { SportScoreService } from "./sportscore.service";
import { SportScore6Service } from "./sportscore6.service";
import { SoccerFootballInfoService } from "./soccer-football-info.service";
import {
  getOddixFixtureDate,
  getOddixFixtureQualityLabel,
  getOddixFixtureQualityScore,
  isOddixDashboardFixtureAllowed,
  isOddixFinishedFixture,
  isOddixLeagueAllowed,
  isOddixPriorityLeague,
} from "./league-filter";

type GetFixturesOptions = {
  forceRefresh?: boolean;
  allowEmptyFallback?: boolean;
  lookaheadDays?: number;
};

@Injectable()
export class FootballService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly soccerFootballInfoService: SoccerFootballInfoService,
    private readonly sportScoreService: SportScoreService,
    private readonly sportScore6Service: SportScore6Service,
    private readonly allScoresService: AllScoresService,
    private readonly flashScoreService: FlashScoreService,
  ) {}

  private apiFootballURL = "https://v3.football.api-sports.io";
  private sportmonksURL = "https://api.sportmonks.com/v3/football";
  private footballDataURL = "https://api.football-data.org/v4";
  private sportsDbURL = "https://www.thesportsdb.com/api/v1/json";
  private apiFootballBlockedUntil: Date | null = null;
  private cacheCleanupRunning = false;
  private lastCacheCleanupAt = 0;

  private getApiFootballKey() {
    return process.env.API_FOOTBALL_KEY || "";
  }

  private getSportmonksKey() {
    return process.env.SPORTMONKS_API_KEY || "";
  }

  private getFootballDataKey() {
    return process.env.FOOTBALL_DATA_KEY || "";
  }

  private getSportsDbKey() {
    return process.env.THESPORTSDB_KEY || "123";
  }

  private liveCacheSeconds() {
    return Number(process.env.FOOTBALL_LIVE_CACHE_SECONDS || 45);
  }

  private fixturesCacheMinutes() {
    return Number(process.env.FOOTBALL_FIXTURES_CACHE_MINUTES || 180);
  }

  private minFixturesBeforeCacheHit() {
    return Math.max(
      0,
      Number(process.env.ODDIX_DASHBOARD_MIN_FIXTURES_BEFORE_CACHE_HIT || 4),
    );
  }

  private hideFinishedAfterHours() {
    return Number(process.env.ODDIX_DASHBOARD_HIDE_FINISHED_AFTER_HOURS || 2);
  }

  private dashboardLookaheadDays(input?: number | string | null) {
    const raw = input ?? process.env.ODDIX_DASHBOARD_LOOKAHEAD_DAYS ?? 1;
    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) return 1;

    return Math.max(1, Math.min(14, Math.floor(parsed)));
  }

  private filterAllowedLeagues(fixtures: any[]) {
    return (fixtures || [])
      .map((item: any) => this.standardizeFixture(item))
      .filter((item: any) => this.isOddixFixtureAllowedForDashboard(item));
  }

  private filterDashboardFixtures(fixtures: any[]) {
    const showFinished = process.env.ODDIX_DASHBOARD_SHOW_FINISHED === "true";

    return (fixtures || [])
      .map((item: any) => this.standardizeFixture(item))
      .filter((item: any) => this.isOddixFixtureAllowedForDashboard(item))
      .filter((item: any) => {
        if (!showFinished && isOddixFinishedFixture(item)) return false;
        return isOddixDashboardFixtureAllowed(
          item,
          this.hideFinishedAfterHours(),
        );
      });
  }

  private apiFootballCooldownMinutes() {
    return Number(process.env.API_FOOTBALL_COOLDOWN_MINUTES || 30);
  }

  private isApiFootballBlocked() {
    if (process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === "true") return true;
    if (!this.apiFootballBlockedUntil) return false;
    return this.apiFootballBlockedUntil.getTime() > Date.now();
  }

  private blockApiFootballTemporarily() {
    this.apiFootballBlockedUntil = new Date(
      Date.now() + this.apiFootballCooldownMinutes() * 60 * 1000,
    );
  }

  private shouldUseApiFootballFallback() {
    return process.env.API_FOOTBALL_ENABLE_FALLBACK === "true";
  }

  private withCacheStamp(item: any) {
    return {
      ...item,
      __oddixCachedAt: new Date().toISOString(),
    };
  }

  private stripRawProviderData<T = any>(input: T): T {
    if (Array.isArray(input)) {
      return input.map((item) => this.stripRawProviderData(item)) as T;
    }

    if (!input || typeof input !== "object") {
      return input;
    }

    const rawKeysToRemove = new Set([
      "soccerFootballInfoRaw",
      "flashScoreRaw",
      "sportScoreRaw",
      "sportScore6Raw",
      "allScoresRaw",
      "apiFootballRaw",
      "broadageRaw",
      "sportsDbRaw",
      "footballDataRaw",
      "sportmonksRaw",
      "rawData",
      "rawResponse",
    ]);

    const output: any = Array.isArray(input) ? [] : {};

    for (const [key, value] of Object.entries(input as any)) {
      if (rawKeysToRemove.has(key)) continue;

      // Segurança extra para providers que mudam o nome do campo bruto.
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.endsWith("raw") || normalizedKey.includes("raw_"))
        continue;

      output[key] = value;
    }

    return output as T;
  }

  private enrichFixtureForOddix(item: any) {
    const cleanItem: any = this.standardizeFixture(
      this.stripRawProviderData(item),
    );
    const isWorldCup = this.isOddixWorldCupFixture(cleanItem);
    const qualityScore = isWorldCup ? 100 : getOddixFixtureQualityScore(cleanItem);

    return {
      ...cleanItem,
      oddix: {
        ...(cleanItem?.oddix || {}),
        leagueAllowed: isWorldCup || isOddixLeagueAllowed(cleanItem),
        priorityLeague: isWorldCup || isOddixPriorityLeague(cleanItem),
        qualityScore,
        qualityLabel: isWorldCup ? "premium" : getOddixFixtureQualityLabel(cleanItem),
      },
    };
  }

  private compactFixtures(fixtures: any[]) {
    return (fixtures || [])
      .map((item) => this.enrichFixtureForOddix(item))
      .sort((a: any, b: any) => {
        const dateA = this.getFixtureTimestamp(a) || 0;
        const dateB = this.getFixtureTimestamp(b) || 0;
        if (dateA !== dateB) return dateA - dateB;
        return (
          Number(b?.oddix?.qualityScore || 0) -
          Number(a?.oddix?.qualityScore || 0)
        );
      });
  }

  private publicDashboardFixtures(fixtures: any[]) {
    return this.compactFixtures(fixtures).filter((item: any) => {
      if (this.isOddixWorldCupFixture(item)) return true;

      return (
        item?.oddix?.leagueAllowed === true &&
        Number(item?.oddix?.qualityScore || 0) > 0
      );
    });
  }

  private getCacheAgeSeconds(item: any) {
    const rawDate =
      item?.__oddixCachedAt ||
      item?.updatedAt ||
      item?.createdAt ||
      item?.cachedAt ||
      null;

    if (!rawDate) return Number.POSITIVE_INFINITY;

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;

    return Math.floor((Date.now() - date.getTime()) / 1000);
  }

  private isCacheFresh(item: any, maxAgeSeconds: number) {
    return this.getCacheAgeSeconds(item) <= maxAgeSeconds;
  }

  private now() {
    return new Date();
  }

  private minutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60 * 1000);
  }

  private hoursAgo(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  private brazilDateKey(date: Date = new Date()) {
    const safeDate =
      date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(safeDate);

    const year =
      parts.find((part) => part.type === "year")?.value ||
      String(safeDate.getUTCFullYear());

    const month =
      parts.find((part) => part.type === "month")?.value ||
      String(safeDate.getUTCMonth() + 1).padStart(2, "0");

    const day =
      parts.find((part) => part.type === "day")?.value ||
      String(safeDate.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  private normalizeDateKey(date?: string | null) {
    const raw = String(date || "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parsed = new Date(`${raw}T12:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) return raw;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split("/");
      const converted = `${year}-${month}-${day}`;
      const parsed = new Date(`${converted}T12:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) return converted;
    }

    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return this.brazilDateKey(parsed);
      }
    }

    return this.brazilDateKey();
  }

  private brazilDayRangeUtc(dateKey?: string | null) {
    const safeDateKey = this.normalizeDateKey(dateKey);

    let start = new Date(`${safeDateKey}T03:00:00.000Z`);

    if (Number.isNaN(start.getTime())) {
      const fallback = this.brazilDateKey();
      start = new Date(`${fallback}T03:00:00.000Z`);
    }

    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

    if (Number.isNaN(end.getTime())) {
      const fallbackStart = new Date(`${this.brazilDateKey()}T03:00:00.000Z`);
      return {
        start: fallbackStart,
        end: new Date(fallbackStart.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    }

    return { start, end };
  }

  private isApiFootballLimitError(error: any) {
    const msg = JSON.stringify(
      error?.response?.data || error?.message || "",
    ).toLowerCase();

    return (
      msg.includes("limit") ||
      msg.includes("quota") ||
      msg.includes("too many") ||
      msg.includes("rate") ||
      msg.includes("requests")
    );
  }

  private mapApiFootballFixture(item: any) {
    const fixture = item.fixture || {};
    const league = item.league || {};
    const teams = item.teams || {};
    const goals = item.goals || {};
    const score = item.score || {};
    const status = fixture.status || {};

    return {
      provider: "api-football",
      fixture: {
        id: Number(fixture.id || 0),
        date: fixture.date || new Date().toISOString(),
        timestamp: fixture.timestamp ?? null,
        timezone: fixture.timezone || "UTC",
        status: {
          long: status.long || "Unknown",
          short: status.short || "UNK",
          elapsed: status.elapsed ?? null,
          extra: status.extra ?? null,
        },
      },
      league: {
        id: Number(league.id || 0),
        name: league.name || "Liga não informada",
        country: league.country || "",
        logo: league.logo || "",
      },
      teams: {
        home: {
          id: Number(teams.home?.id || 0),
          name: teams.home?.name || "",
          logo: teams.home?.logo || "",
          winner: teams.home?.winner ?? null,
        },
        away: {
          id: Number(teams.away?.id || 0),
          name: teams.away?.name || "",
          logo: teams.away?.logo || "",
          winner: teams.away?.winner ?? null,
        },
      },
      goals: {
        home: goals.home ?? score.fulltime?.home ?? null,
        away: goals.away ?? score.fulltime?.away ?? null,
      },
      score: {
        fulltime: {
          home: score.fulltime?.home ?? goals.home ?? null,
          away: score.fulltime?.away ?? goals.away ?? null,
        },
      },
    };
  }

  private mapFootballDataMatch(match: any) {
    const homeScore =
      match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? null;
    const awayScore =
      match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? null;

    const statusMap: Record<string, { long: string; short: string }> = {
      SCHEDULED: { long: "Not Started", short: "NS" },
      TIMED: { long: "Not Started", short: "NS" },
      IN_PLAY: { long: "In Play", short: "LIVE" },
      PAUSED: { long: "Halftime", short: "HT" },
      FINISHED: { long: "Match Finished", short: "FT" },
      POSTPONED: { long: "Postponed", short: "PST" },
      SUSPENDED: { long: "Suspended", short: "SUSP" },
      CANCELED: { long: "Canceled", short: "CANC" },
    };

    const status = statusMap[match.status] || {
      long: match.status || "Unknown",
      short: match.status || "UNK",
    };

    return {
      provider: "football-data",
      fixture: {
        id: Number(match.id),
        date: match.utcDate,
        timezone: "UTC",
        status: { long: status.long, short: status.short, elapsed: null },
      },
      league: {
        id: Number(match.competition?.id || 0),
        name: match.competition?.name || "Liga não informada",
        country: match.area?.name || "",
        logo: match.competition?.emblem || "",
      },
      teams: {
        home: {
          id: Number(match.homeTeam?.id || 0),
          name: match.homeTeam?.name || "",
          logo: match.homeTeam?.crest || "",
          winner: match.score?.winner === "HOME_TEAM",
        },
        away: {
          id: Number(match.awayTeam?.id || 0),
          name: match.awayTeam?.name || "",
          logo: match.awayTeam?.crest || "",
          winner: match.score?.winner === "AWAY_TEAM",
        },
      },
      goals: { home: homeScore, away: awayScore },
      score: { fulltime: { home: homeScore, away: awayScore } },
    };
  }

  private mapSportsDbEvent(event: any) {
    const homeScore =
      event.intHomeScore !== null && event.intHomeScore !== undefined
        ? Number(event.intHomeScore)
        : null;

    const awayScore =
      event.intAwayScore !== null && event.intAwayScore !== undefined
        ? Number(event.intAwayScore)
        : null;

    const finished = homeScore !== null && awayScore !== null;

    return {
      provider: "thesportsdb",
      fixture: {
        id: Number(event.idEvent),
        date: `${event.dateEvent}T${event.strTime || "00:00:00"}`,
        timezone: "UTC",
        status: {
          long: finished ? "Match Finished" : "Not Started",
          short: finished ? "FT" : "NS",
          elapsed: null,
        },
      },
      league: {
        id: Number(event.idLeague || 0),
        name: event.strLeague || "Liga não informada",
        country: event.strCountry || "",
        logo: event.strLeagueBadge || "",
      },
      teams: {
        home: {
          id: Number(event.idHomeTeam || 0),
          name: event.strHomeTeam || "",
          logo: event.strHomeTeamBadge || "",
          winner: finished ? homeScore > awayScore : null,
        },
        away: {
          id: Number(event.idAwayTeam || 0),
          name: event.strAwayTeam || "",
          logo: event.strAwayTeamBadge || "",
          winner: finished ? awayScore > homeScore : null,
        },
      },
      goals: { home: homeScore, away: awayScore },
      score: { fulltime: { home: homeScore, away: awayScore } },
    };
  }

  private mapSportmonksFixture(item: any) {
    const participants = item.participants || [];
    const home =
      participants.find(
        (t: any) =>
          t?.meta?.location === "home" || t?.pivot?.location === "home",
      ) || participants[0];

    const away =
      participants.find(
        (t: any) =>
          t?.meta?.location === "away" || t?.pivot?.location === "away",
      ) || participants[1];

    const scores = item.scores || [];

    const getScore = (location: "home" | "away") => {
      const found =
        scores.find((s: any) => s?.score?.participant === location) ||
        scores.find((s: any) => s?.participant?.meta?.location === location);

      return found?.score?.goals ?? null;
    };

    const state = item.state || {};

    return {
      provider: "sportmonks",
      fixture: {
        id: Number(item.id),
        date: item.starting_at,
        timezone: "UTC",
        status: {
          long: state.name || state.short_name || "Not Started",
          short: state.short_name || "NS",
          elapsed: item.periods?.[0]?.minutes || null,
        },
      },
      league: {
        id: Number(item.league_id || 0),
        name: item.league?.name || "Liga não informada",
        country: item.league?.country?.name || "",
        logo: item.league?.image_path || "",
      },
      teams: {
        home: {
          id: Number(home?.id || 0),
          name: home?.name || "",
          logo: home?.image_path || "",
          winner: null,
        },
        away: {
          id: Number(away?.id || 0),
          name: away?.name || "",
          logo: away?.image_path || "",
          winner: null,
        },
      },
      goals: { home: getScore("home"), away: getScore("away") },
      score: { fulltime: { home: getScore("home"), away: getScore("away") } },
    };
  }

  private isFinishedStatus(short?: string, long?: string) {
    const s = String(short || "").toUpperCase();
    const l = String(long || "").toLowerCase();

    return (
      ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"].includes(s) ||
      l.includes("finished") ||
      l.includes("final") ||
      l.includes("after extra time") ||
      l.includes("after penalties") ||
      l.includes("walkover") ||
      l.includes("cancelled") ||
      l.includes("canceled") ||
      l.includes("abandoned") ||
      l.includes("postponed")
    );
  }

  private isLiveStatus(short?: string, long?: string) {
    const s = String(short || "").toUpperCase();
    const l = String(long || "").toLowerCase();

    return (
      [
        "LIVE",
        "IN_PLAY",
        "1H",
        "2H",
        "HT",
        "ET",
        "BT",
        "P",
        "PEN_LIVE",
      ].includes(s) ||
      l.includes("live") ||
      l.includes("in play") ||
      l.includes("1st half") ||
      l.includes("2nd half") ||
      l.includes("halftime") ||
      l.includes("half-time")
    );
  }

  private shouldTreatAsLive(item: any) {
    const short = String(item?.fixture?.status?.short || "").toUpperCase();
    const long = String(item?.fixture?.status?.long || "");
    const elapsed = Number(item?.fixture?.status?.elapsed || 0);
    const extra = Number(item?.fixture?.status?.extra || 0);
    const fixtureDate = item?.fixture?.date;

    if (this.isFinishedStatus(short, long)) return false;
    if (!this.isLiveStatus(short, long)) return false;

    // Nunca tratar 90+ como ao vivo. Algumas APIs mandam LIVE/IN_PLAY com elapsed 90, 93, 94 etc.
    if (elapsed >= 90) return false;
    if (elapsed >= 85 && extra > 0) return false;

    // Evita jogo fantasma/travado no cache: se começou há 115min ou mais, não é novo live.
    if (fixtureDate) {
      const start = new Date(fixtureDate).getTime();
      if (!Number.isNaN(start)) {
        const minutesSinceStart = Math.floor((Date.now() - start) / 1000 / 60);
        if (minutesSinceStart >= 115) return false;
      }
    }

    return true;
  }

  private normalizeLiveStatus(item: any) {
    if (!item?.fixture?.status) return item;

    const short = String(item.fixture.status.short || "").toUpperCase();
    const long = String(item.fixture.status.long || "");

    if (short === "IN_PLAY") {
      item.fixture.status.short = "LIVE";
      item.fixture.status.long = "In Play";
    }

    if (
      this.isLiveStatus(short, long) &&
      !["LIVE", "HT", "1H", "2H"].includes(short)
    ) {
      item.fixture.status.short = "LIVE";
    }

    return item;
  }

  private shouldCacheFixture(item: any) {
    if (!item) return false;
    if (!this.isOddixFixtureAllowedForDashboard(item)) return false;

    // Por padrão, jogo encerrado/adiado/cancelado não fica no cache do Dashboard.
    // Se um dia precisar manter finalizados por auditoria, use ODDIX_CACHE_FINISHED_FIXTURES=true.
    const allowFinishedCache =
      process.env.ODDIX_CACHE_FINISHED_FIXTURES === "true";
    if (!allowFinishedCache && isOddixFinishedFixture(item)) return false;

    const rawDate = getOddixFixtureDate(item);
    if (!rawDate) return false;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return false;

    // Evita cache de jogo antigo travado como NS/LIVE por erro de provider.
    const maxPastHours = Number(process.env.ODDIX_CACHE_MAX_PAST_HOURS || 24);
    const ageHours = (Date.now() - parsed.getTime()) / 1000 / 60 / 60;
    if (ageHours > maxPastHours) return false;

    return true;
  }

  private async saveFixturesCache(fixtures: any[]) {
    fixtures = (fixtures || []).filter((item: any) =>
      this.shouldCacheFixture(item),
    );
    if (!fixtures?.length) return;

    await Promise.all(
      fixtures.map((item: any) => {
        const fixtureId = String(item?.fixture?.id || "");
        if (!fixtureId) return null;

        const cleanItem = this.stripRawProviderData(item);
        const stampedRaw = this.withCacheStamp(cleanItem);

        return this.prisma.cachedFixture.upsert({
          where: { fixtureId },
          update: {
            provider: item.provider || "unknown",
            date:
              item.fixture?.date &&
              !Number.isNaN(new Date(item.fixture.date).getTime())
                ? new Date(item.fixture.date)
                : null,
            league: item.league?.name || null,
            country: item.league?.country || null,
            homeTeam: item.teams?.home?.name || "",
            awayTeam: item.teams?.away?.name || "",
            homeLogo: item.teams?.home?.logo || null,
            awayLogo: item.teams?.away?.logo || null,
            leagueLogo: item.league?.logo || null,
            homeScore: item.goals?.home ?? null,
            awayScore: item.goals?.away ?? null,
            statusShort: item.fixture?.status?.short || null,
            statusLong: item.fixture?.status?.long || null,
            elapsed: item.fixture?.status?.elapsed ?? null,
            raw: stampedRaw,
          },
          create: {
            fixtureId,
            provider: item.provider || "unknown",
            date:
              item.fixture?.date &&
              !Number.isNaN(new Date(item.fixture.date).getTime())
                ? new Date(item.fixture.date)
                : null,
            league: item.league?.name || null,
            country: item.league?.country || null,
            homeTeam: item.teams?.home?.name || "",
            awayTeam: item.teams?.away?.name || "",
            homeLogo: item.teams?.home?.logo || null,
            awayLogo: item.teams?.away?.logo || null,
            leagueLogo: item.league?.logo || null,
            homeScore: item.goals?.home ?? null,
            awayScore: item.goals?.away ?? null,
            statusShort: item.fixture?.status?.short || null,
            statusLong: item.fixture?.status?.long || null,
            elapsed: item.fixture?.status?.elapsed ?? null,
            raw: stampedRaw,
          },
        });
      }),
    );
  }

  private async getFixturesFromCache(date?: string) {
    const safeDate = this.normalizeDateKey(date);
    const { start, end } = this.brazilDayRangeUtc(safeDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [];
    }

    /**
     * Importante: cache por data precisa respeitar SOMENTE o dia solicitado.
     * O frontend já busca hoje/amanhã em chamadas separadas.
     * Antes, quando a data era hoje, o cache também trazia dias futuros e fazia
     * aparecer jogo de amanhã dentro da aba de hoje.
     */
    const cached = await this.prisma.cachedFixture.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return this.filterAllowedLeagues(
      cached.map((item) => this.stripRawProviderData(item.raw)),
    );
  }

  private async getFreshFixturesFromCache(
    date?: string,
    maxAgeMinutes = this.fixturesCacheMinutes(),
  ) {
    const cached = await this.getFixturesFromCache(date);

    if (!cached.length) return [];

    const maxAgeSeconds = maxAgeMinutes * 60;

    const fresh = cached.filter((item: any) => {
      const isFinished = this.isFinishedStatus(
        item?.fixture?.status?.short,
        item?.fixture?.status?.long,
      );

      if (isFinished) return false;

      return this.isCacheFresh(item, maxAgeSeconds);
    });

    if (fresh.length) return this.mergeUniqueFixtures([fresh]);

    return [];
  }

  private async getFixtureFromCacheById(fixtureId: string) {
    const cached = await this.prisma.cachedFixture.findUnique({
      where: { fixtureId: String(fixtureId) },
    });

    return cached?.raw ? this.stripRawProviderData(cached.raw) : null;
  }

  private shouldDeleteCachedFixture(record: any) {
    const raw = record?.raw || {};

    const fixtureLike = {
      ...raw,
      league: raw?.league ||
        raw?.liga || {
          name: record?.league || "",
          country: record?.country || "",
        },
      fixture: raw?.fixture ||
        raw?.jogo || {
          date: record?.date || null,
          status: {
            short: record?.statusShort || "",
            long: record?.statusLong || "",
          },
        },
    };

    if (!this.isOddixFixtureAllowedForDashboard(fixtureLike)) return true;
    if (isOddixFinishedFixture(fixtureLike)) return true;

    const rawDate = getOddixFixtureDate(fixtureLike) || record?.date;
    if (!rawDate) return true;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return true;

    const maxPastHours = Number(process.env.ODDIX_CACHE_MAX_PAST_HOURS || 24);
    const ageHours = (Date.now() - parsed.getTime()) / 1000 / 60 / 60;

    return ageHours > maxPastHours;
  }

  async cleanupDashboardCache(force = false) {
    const now = Date.now();
    const intervalMs =
      Number(process.env.ODDIX_CACHE_CLEANUP_INTERVAL_SECONDS || 60) * 1000;

    if (
      !force &&
      this.lastCacheCleanupAt &&
      now - this.lastCacheCleanupAt < intervalMs
    ) {
      return {
        success: true,
        skipped: true,
        reason: "Limpeza recente. Aguardando intervalo.",
        checked: 0,
        deleted: 0,
      };
    }

    if (this.cacheCleanupRunning) {
      return {
        success: true,
        skipped: true,
        reason: "Limpeza já em execução.",
        checked: 0,
        deleted: 0,
      };
    }

    this.cacheCleanupRunning = true;

    try {
      const cached = await this.prisma.cachedFixture.findMany({
        select: {
          fixtureId: true,
          provider: true,
          date: true,
          league: true,
          country: true,
          statusShort: true,
          statusLong: true,
          raw: true,
        },
      });

      const idsToDelete = cached
        .filter((record: any) => this.shouldDeleteCachedFixture(record))
        .map((record: any) => String(record.fixtureId))
        .filter(Boolean);

      let deleted = 0;

      if (idsToDelete.length > 0) {
        const result = await this.prisma.cachedFixture.deleteMany({
          where: {
            fixtureId: { in: idsToDelete },
          },
        });

        deleted = result.count || 0;
      }

      this.lastCacheCleanupAt = now;

      return {
        success: true,
        skipped: false,
        checked: cached.length,
        deleted,
        message:
          "Cache do Dashboard limpo. Jogos encerrados, antigos e ligas ruins foram removidos.",
      };
    } finally {
      this.cacheCleanupRunning = false;
    }
  }

  async clearAllFixturesCache() {
    const result = await this.prisma.cachedFixture.deleteMany({});

    return {
      success: true,
      deleted: result.count || 0,
      message: "Cache de jogos limpo totalmente.",
    };
  }

  async getFixturesFromSportScore6(date?: string) {
    try {
      return await this.sportScore6Service.getFixtures(date);
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na SportScore6",
      };
    }
  }

  async getLiveFixturesFromSportScore6() {
    try {
      return await this.sportScore6Service.getLiveFixtures();
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na SportScore6 Live",
      };
    }
  }

  async getFixtureBySlugFromSportScore6(slug: string) {
    try {
      return await this.sportScore6Service.getFixtureBySlug(slug);
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro na SportScore6 por slug",
      };
    }
  }

  async getStatisticsFromSportScore6(fixtureId: string) {
    try {
      const cached: any = await this.getFixtureFromCacheById(fixtureId);
      const slug =
        cached?.fixture?.externalId ||
        cached?.sportScore6Raw?.slug ||
        cached?.sportScore6Raw?.urlSlug ||
        null;

      if (!slug) {
        return {
          ok: false,
          data: null,
          error:
            "SportScore6 precisa do slug salvo no cache para buscar estatísticas",
        };
      }

      return await this.sportScore6Service.getStatistics(slug);
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro nas estatísticas SportScore6",
      };
    }
  }

  async getFixturesFromSoccerFootballInfo(date?: string) {
    try {
      const response = await this.soccerFootballInfoService.getLiveMatches();
      const data = this.soccerFootballInfoService.normalizeMatches(response);

      return { ok: true, data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na Soccer Football Info",
      };
    }
  }

  async getLiveFixturesFromSoccerFootballInfo() {
    try {
      const response = await this.soccerFootballInfoService.getLiveMatches();
      const data = this.soccerFootballInfoService.normalizeMatches(response);

      return { ok: true, data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na Soccer Football Info Live",
      };
    }
  }

  async getFixtureByIdFromSoccerFootballInfo(fixtureId: string) {
    try {
      const response = await this.soccerFootballInfoService.getMatchDetails(
        fixtureId,
      );
      const data = this.soccerFootballInfoService.normalizeMatch(response);

      return { ok: true, data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro na Soccer Football Info por ID",
      };
    }
  }

  async getStatisticsFromSoccerFootballInfo(fixtureId: string) {
    try {
      const stats = await this.soccerFootballInfoService.getStatistics(
        fixtureId,
      );

      return {
        ok: !!stats?.available,
        data: stats?.available ? stats : null,
        error: stats?.available
          ? null
          : stats?.message || "Sem estatísticas Soccer Football Info",
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro nas estatísticas Soccer Football Info",
      };
    }
  }

  async getFixturesFromSportScore(date: string) {
    try {
      return await this.sportScoreService.getFixtures(date);
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na SportScore",
      };
    }
  }

  async getLiveFixturesFromSportScore() {
    try {
      return await this.sportScoreService.getLiveFixtures();
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na SportScore Live",
      };
    }
  }

  async getFixtureByIdFromSportScore(fixtureId: string) {
    try {
      return await this.sportScoreService.getFixtureById(fixtureId);
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro na SportScore por ID",
      };
    }
  }

  async getStatisticsFromSportScore(fixtureId: string) {
    try {
      return await this.sportScoreService.getStatistics(fixtureId);
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro nas estatísticas SportScore",
      };
    }
  }

  async getFixturesFromApiFootball(date: string) {
    if (this.isApiFootballBlocked()) {
      return {
        ok: false,
        data: [],
        error: "API-Football em cooldown temporário por limite/erro",
      };
    }

    const apiKey = this.getApiFootballKey();
    if (!apiKey)
      return { ok: false, data: [], error: "API_FOOTBALL_KEY não encontrada" };

    try {
      const response = await axios.get(`${this.apiFootballURL}/fixtures`, {
        timeout: 12000,
        headers: { "x-apisports-key": apiKey },
        params: {
          date,
          timezone: "America/Sao_Paulo",
        },
      });

      return {
        ok: true,
        data: (response.data?.response || []).map((item: any) =>
          this.mapApiFootballFixture(item),
        ),
        error: null,
      };
    } catch (error: any) {
      if (this.isApiFootballLimitError(error)) {
        this.blockApiFootballTemporarily();
      }

      return {
        ok: false,
        data: [],
        error:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Erro na API-Football",
      };
    }
  }

  async getLiveFixturesFromApiFootball() {
    if (this.isApiFootballBlocked()) {
      return {
        ok: false,
        data: [],
        error: "API-Football em cooldown temporário por limite/erro",
      };
    }

    const apiKey = this.getApiFootballKey();
    if (!apiKey)
      return { ok: false, data: [], error: "API_FOOTBALL_KEY não encontrada" };

    try {
      const response = await axios.get(`${this.apiFootballURL}/fixtures`, {
        timeout: 12000,
        headers: { "x-apisports-key": apiKey },
        params: {
          live: "all",
          timezone: "America/Sao_Paulo",
        },
      });

      return {
        ok: true,
        data: (response.data?.response || []).map((item: any) =>
          this.mapApiFootballFixture(item),
        ),
        error: null,
      };
    } catch (error: any) {
      if (this.isApiFootballLimitError(error)) {
        this.blockApiFootballTemporarily();
      }

      return {
        ok: false,
        data: [],
        error:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Erro na API-Football Live",
      };
    }
  }

  async getFixturesFromAllScores(date: string) {
    try {
      return await this.allScoresService.getFixtures(date);
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na AllScores",
      };
    }
  }

  async getLiveFixturesFromAllScores(date?: string) {
    try {
      return await this.allScoresService.getLiveFixtures(date);
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na AllScores Live",
      };
    }
  }

  async getFixturesFromFlashScore(date: string) {
    try {
      return await this.flashScoreService.getFixtures(date);
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na FlashScore",
      };
    }
  }

  async getLiveFixturesFromFlashScore() {
    try {
      return await this.flashScoreService.getLiveFixtures();
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na FlashScore Live",
      };
    }
  }

  async getFixtureByIdFromAllScores(fixtureId: string) {
    try {
      return await this.allScoresService.getGameDetails(fixtureId);
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro na AllScores por ID",
      };
    }
  }

  async getFixturesFromSportmonks(date: string) {
    const apiKey = this.getSportmonksKey();
    if (!apiKey)
      return {
        ok: false,
        data: [],
        error: "SPORTMONKS_API_KEY não encontrada",
      };

    try {
      const response = await axios.get(
        `${this.sportmonksURL}/fixtures/date/${date}`,
        {
          timeout: 10000,
          params: {
            api_token: apiKey,
            include: "participants;league;league.country;scores;state;periods",
          },
        },
      );

      return {
        ok: true,
        data: (response.data?.data || []).map((item: any) =>
          this.mapSportmonksFixture(item),
        ),
        error: null,
      };
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Erro na Sportmonks",
      };
    }
  }

  async getFixturesFromFootballData(date: string) {
    const apiKey = this.getFootballDataKey();
    if (!apiKey)
      return { ok: false, data: [], error: "FOOTBALL_DATA_KEY não encontrada" };

    try {
      const response = await axios.get(`${this.footballDataURL}/matches`, {
        timeout: 10000,
        headers: { "X-Auth-Token": apiKey },
        params: { dateFrom: date, dateTo: date },
      });

      return {
        ok: true,
        data: (response.data?.matches || []).map((match: any) =>
          this.mapFootballDataMatch(match),
        ),
        error: null,
      };
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Erro na football-data.org",
      };
    }
  }

  async getFixturesFromSportsDb(date: string) {
    const key = this.getSportsDbKey();

    try {
      const response = await axios.get(
        `${this.sportsDbURL}/${key}/eventsday.php`,
        {
          timeout: 10000,
          params: { d: date, s: "Soccer" },
        },
      );

      return {
        ok: true,
        data: (response.data?.events || []).map((event: any) =>
          this.mapSportsDbEvent(event),
        ),
        error: null,
      };
    } catch (error: any) {
      return {
        ok: false,
        data: [],
        error: error?.message || "Erro na TheSportsDB",
      };
    }
  }

  private normalizeName(name: string) {
    let value = String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Normaliza diferenças comuns entre FlashScore e AllScores.
    value = value
      .replace(/&/g, " and ")
      .replace(/\bii\b/g, " 2 ")
      .replace(/\biii\b/g, " 3 ")
      .replace(/\biv\b/g, " 4 ")
      .replace(/\bsub\s*20\b/g, " u20 ")
      .replace(/\bsub\s*21\b/g, " u21 ")
      .replace(/\bsub\s*23\b/g, " u23 ")
      .replace(/\bfc\b/g, " ")
      .replace(/\bsc\b/g, " ")
      .replace(/\bec\b/g, " ")
      .replace(/\bac\b/g, " ")
      .replace(/\bafc\b/g, " ")
      .replace(/\bcf\b/g, " ")
      .replace(/\bclub\b/g, " ")
      .replace(/\bclube\b/g, " ")
      .replace(/\bcity\b/g, " ")
      .replace(/\blegion\b/g, " ")
      .replace(/\bunited\b/g, " ")
      .replace(/\bde\b/g, " ")
      .replace(/\bdo\b/g, " ")
      .replace(/\bda\b/g, " ")
      .replace(/\bthe\b/g, " ")
      .replace(/\bwomen\b/g, " fem ")
      .replace(/\bfeminino\b/g, " fem ")
      .replace(/\bf\b/g, " fem ")
      .replace(/\bu-?(\d{2})\b/g, " u$1 ")
      .replace(/\s+/g, " ")
      .trim();

    return value.replace(/[^a-z0-9]/g, "");
  }

  private getFixtureObject(item: any) {
    return item?.fixture || item?.jogo || item?.partida || {};
  }

  private getLeagueObject(item: any) {
    return item?.league || item?.liga || item?.competition || {};
  }

  private getTeamsObject(item: any) {
    return item?.teams || item?.times || item?.equipes || {};
  }

  private getHomeTeam(item: any) {
    const teams = this.getTeamsObject(item);
    return teams?.home || teams?.casa || teams?.mandante || {};
  }

  private getAwayTeam(item: any) {
    const teams = this.getTeamsObject(item);
    return teams?.away || teams?.fora || teams?.visitante || {};
  }

  private getTeamName(team: any) {
    return String(team?.name || team?.nome || team?.teamName || "").trim();
  }

  private getTeamLogo(team: any) {
    return String(
      team?.logo || team?.logotipo || team?.image || team?.imageUrl || "",
    ).trim();
  }

  private normalizeTextLoose(value: any) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isOddixWorldCupFixture(item: any) {
    const cleanItem = this.standardizeFixture(item);
    const league = this.getLeagueObject(cleanItem);
    const home = this.getHomeTeam(cleanItem);
    const away = this.getAwayTeam(cleanItem);

    const text = this.normalizeTextLoose(
      `${league?.name || league?.nome || ""} ${league?.country || league?.pais || league?.país || ""} ${this.getTeamName(home)} ${this.getTeamName(away)}`,
    );

    return (
      /\bfifa\b/.test(text) ||
      /\bfifa\s+world\s+cup\b/.test(text) ||
      /\bfifa\s+world\s+copa\b/.test(text) ||
      /\bworld\s+cup\b/.test(text) ||
      /\bworld\s+copa\b/.test(text) ||
      /\bcopa\s+do\s+mundo\b/.test(text) ||
      /\bcopa\s+mundial\b/.test(text) ||
      /\bcampeonato\s+do\s+mundo\b/.test(text) ||
      /\bcampeonato\s+mundial\b/.test(text) ||
      /\bworld\s+championship\b/.test(text)
    );
  }

  private isExtraDashboardLeagueAllowed(item: any) {
    const league = this.getLeagueObject(item);
    const home = this.getHomeTeam(item);
    const away = this.getAwayTeam(item);

    const text = this.normalizeTextLoose(
      `${league?.name || league?.nome || ""} ${league?.country || league?.pais || league?.país || ""} ${this.getTeamName(home)} ${this.getTeamName(away)}`,
    );

    const isFifaOrSelection =
      text.includes("fifa") ||
      text.includes("world cup") ||
      text.includes("world copa") ||
      text.includes("copa do mundo") ||
      text.includes("copa mundial") ||
      text.includes("campeonato do mundo") ||
      text.includes("campeonato mundial") ||
      text.includes("world championship") ||
      text.includes("selecoes") ||
      text.includes("selecao") ||
      text.includes("national team") ||
      text.includes("international");

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
      "reserves",
      "reserve",
      "esoccer",
      "simulated",
      "simulado",
    ];

    if (blocked.some((word) => text.includes(word))) return false;

    const isFriendly =
      text.includes("friendly") ||
      text.includes("amistoso") ||
      text.includes("friendlies");
    if (isFriendly && !isFifaOrSelection) return false;

    return true;
  }

  private isOddixFixtureAllowedForDashboard(item: any) {
    const cleanItem = this.standardizeFixture(item);

    if (!cleanItem) return false;
    if (!this.isExtraDashboardLeagueAllowed(cleanItem)) return false;

    const league = this.getLeagueObject(cleanItem);
    const home = this.getHomeTeam(cleanItem);
    const away = this.getAwayTeam(cleanItem);
    const text = this.normalizeTextLoose(
      `${league?.name || league?.nome || ""} ${league?.country || league?.pais || league?.país || ""} ${this.getTeamName(home)} ${this.getTeamName(away)}`,
    );

    const alwaysAllowedPatterns = [
      /\bfifa\b|\bfifa world cup\b|\bfifa world copa\b|\bworld cup\b|\bworld copa\b|\bcopa do mundo\b|\bcopa mundial\b|\bcampeonato do mundo\b|\bcampeonato mundial\b|\bworld championship\b|\bclub world cup\b|\bmundial de clubes\b/,
      /\blibertadores\b/,
      /\bsudamericana\b|\bsul americana\b/,
      /\bchampions league\b/,
      /\beuropa league\b/,
      /\bconference league\b/,
      /\bcopa do brasil\b/,
      /\bbrasileirao\b/,
      /\bbrasil serie a\b|\bbrazil serie a\b|\bbrasil serie b\b|\bbrazil serie b\b/,
      /\bengland\b.*\bpremier league\b|\bpremier league\b.*\bengland\b|\binglaterra\b.*\bpremier league\b|\bpremier league\b.*\binglaterra\b|\bepl\b/,
      /\bspain\b.*\bla liga\b|\bla liga\b.*\bspain\b|\bespanha\b.*\bla liga\b|\bla liga\b.*\bespanha\b|\blaliga\b.*\bspain\b|\bspain\b.*\blaliga\b/,
      /\bgermany\b.*\bbundesliga\b|\bbundesliga\b.*\bgermany\b|\balemanha\b.*\bbundesliga\b|\bbundesliga\b.*\balemanha\b/,
      /\bitaly\b.*\bserie a\b|\bserie a\b.*\bitaly\b|\bitalia\b.*\bserie a\b|\bserie a\b.*\bitalia\b|\bit[aá]lia\b.*\bserie a\b|\bserie a\b.*\bit[aá]lia\b/,
      /\bligue 1\b.*\bfrance\b|\bfrance\b.*\bligue 1\b|\bfranca\b.*\bligue 1\b|\bfrança\b.*\bligue 1\b/,
    ];

    if (alwaysAllowedPatterns.some((pattern) => pattern.test(text))) return true;
    if (isOddixLeagueAllowed(cleanItem)) return true;

    const quality = getOddixFixtureQualityScore(cleanItem);
    const qualityThreshold = Number(
      process.env.ODDIX_DASHBOARD_ALLOW_QUALITY_SCORE || 80,
    );

    return quality >= qualityThreshold;
  }

  private standardizeFixture(item: any) {
    if (!item) return item;

    const fixture = this.getFixtureObject(item);
    const league = this.getLeagueObject(item);
    const home = this.getHomeTeam(item);
    const away = this.getAwayTeam(item);
    const goals = item?.goals || item?.gols || {};
    const score = item?.score || item?.placar || {};
    const status = fixture?.status || {};
    const odds = item?.odds || item?.chances || {};

    const preMatchOdds = item?.preMatchStats?.odds || item?.prematchStats?.odds || {};

    const directOdds = [
      { name: "1", odd: odds?.["1"] ?? odds?.home ?? odds?.casa ?? odds?.mandante ?? preMatchOdds?.home },
      { name: "X", odd: odds?.X ?? odds?.x ?? odds?.draw ?? odds?.empate ?? preMatchOdds?.draw },
      { name: "2", odd: odds?.["2"] ?? odds?.away ?? odds?.fora ?? odds?.visitante ?? preMatchOdds?.away },
    ].filter((option: any) => Number(option.odd) > 1);

    const listedOdds = Array.isArray(odds?.options)
      ? odds.options
      : Array.isArray(odds?.opções)
        ? odds.opções
        : Array.isArray(odds?.outcomes)
          ? odds.outcomes
          : Array.isArray(odds?.markets)
            ? odds.markets
            : [];

    const options = listedOdds.length ? listedOdds : directOdds;

    const normalizeOutcomeName = (value: any) => {
      const raw = String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (["1", "home", "casa", "mandante", "homewin", "vitoriacasa"].includes(raw)) return "1";
      if (["x", "draw", "empate", "tie"].includes(raw)) return "X";
      if (["2", "away", "fora", "visitante", "awaywin", "vitoriafora"].includes(raw)) return "2";
      return String(value || "").trim();
    };

    const normalizedOddsOptions = options
      .map((option: any) => ({
        name: normalizeOutcomeName(option?.name || option?.nome || option?.selection || option?.selectionName || option?.label || option?.outcome || option?.title || ""),
        odd: Number(
          String(option?.odd ?? option?.odds ?? option?.ímpar ?? option?.impar ?? option?.value ?? option?.price ?? option?.decimal ?? option?.rate?.decimal ?? option?.rate ?? 0)
            .replace(",", ".")
            .replace(/[^0-9.\-]/g, ""),
        ),
      }))
      .filter(
        (option: any) =>
          ["1", "X", "2"].includes(option.name) && Number.isFinite(option.odd) && option.odd > 1,
      )
      .filter((option: any, index: number, arr: any[]) => arr.findIndex((x) => x.name === option.name) === index)
      .sort((a: any, b: any) => ({ "1": 1, X: 2, "2": 3 } as any)[a.name] - ({ "1": 1, X: 2, "2": 3 } as any)[b.name]);

    const homeGoals = Number(
      goals?.home ??
        goals?.casa ??
        score?.fulltime?.home ??
        score?.fulltime?.casa ??
        score?.["tempo integral"]?.home ??
        score?.["tempo integral"]?.casa ??
        0,
    );
    const awayGoals = Number(
      goals?.away ??
        goals?.fora ??
        score?.fulltime?.away ??
        score?.fulltime?.fora ??
        score?.["tempo integral"]?.away ??
        score?.["tempo integral"]?.fora ??
        0,
    );

    const short = String(
      status?.short || status?.curto || status?.statusShort || "",
    ).toUpperCase();
    const normalizedShort =
      short === "UNK" || short === "UNKNOWN" || short === "" ? "NS" : short;
    const long = String(
      status?.long || status?.longo || status?.name || status?.nome || "",
    ).trim();

    return {
      provider: item?.provider || item?.provedor || "unknown",
      fixture: {
        id: fixture?.id,
        externalId: fixture?.externalId || fixture?.external_id || "",
        date: fixture?.date || fixture?.data || null,
        timestamp:
          fixture?.timestamp ||
          fixture?.carimboDeDataHora ||
          fixture?.["carimbo de data/hora"] ||
          null,
        timezone:
          fixture?.timezone ||
          fixture?.fuso ||
          fixture?.["fuso horário"] ||
          "America/Sao_Paulo",
        status: {
          long: long || (normalizedShort === "NS" ? "Not Started" : ""),
          short: normalizedShort,
          elapsed: status?.elapsed ?? status?.decorrido ?? null,
          extra: status?.extra ?? null,
        },
      },
      league: {
        id: league?.id || 0,
        name: league?.name || league?.nome || "Liga",
        country: league?.country || league?.pais || league?.país || "",
        logo: league?.logo || league?.logotipo || "",
      },
      teams: {
        home: {
          id: home?.id || 0,
          externalId: home?.externalId || home?.external_id || "",
          name: this.getTeamName(home) || "Casa",
          logo: this.getTeamLogo(home),
          winner: home?.winner ?? home?.vencedor ?? null,
        },
        away: {
          id: away?.id || 0,
          externalId: away?.externalId || away?.external_id || "",
          name: this.getTeamName(away) || "Fora",
          logo: this.getTeamLogo(away),
          winner: away?.winner ?? away?.vencedor ?? null,
        },
      },
      goals: {
        home: Number.isFinite(homeGoals) ? homeGoals : 0,
        away: Number.isFinite(awayGoals) ? awayGoals : 0,
      },
      score: {
        fulltime: {
          home: Number.isFinite(homeGoals) ? homeGoals : 0,
          away: Number.isFinite(awayGoals) ? awayGoals : 0,
        },
      },
      odds: normalizedOddsOptions.length
        ? {
            source: odds?.source || odds?.fonte || "flashscore",
            bookmaker:
              odds?.bookmaker || odds?.["casa de apostas"] || "FlashScore",
            market: odds?.market || odds?.mercado || "1X2",
            options: normalizedOddsOptions,
          }
        : undefined,
      __oddixCachedAt: item?.__oddixCachedAt,
      oddix: item?.oddix || {},
    };
  }

  private getFixtureDateValue(item: any) {
    const fixture = this.getFixtureObject(item);
    return fixture?.date || fixture?.data || fixture?.utcDate || null;
  }

  private getFixtureTimestamp(item: any) {
    const fixture = this.getFixtureObject(item);
    const timestamp = Number(
      fixture?.timestamp ||
        fixture?.carimboDeDataHora ||
        fixture?.["carimbo de data/hora"] ||
        fixture?.["carimbo de datahora"] ||
        0,
    );

    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;

    const rawDate = this.getFixtureDateValue(item);
    if (!rawDate) return 0;

    const parsed = new Date(rawDate).getTime();
    if (Number.isNaN(parsed)) return 0;

    return Math.floor(parsed / 1000);
  }

  private fixtureKey(item: any) {
    const timestamp = this.getFixtureTimestamp(item);
    const date = timestamp
      ? this.brazilDateKey(new Date(timestamp * 1000))
      : String(this.getFixtureDateValue(item) || "").slice(0, 10);

    // Agrupa jogos no mesmo horário aproximado para deduplicar APIs diferentes.
    const timeBucket = timestamp ? Math.floor(timestamp / (15 * 60)) : 0;

    const home = this.normalizeName(this.getTeamName(this.getHomeTeam(item)));
    const away = this.normalizeName(this.getTeamName(this.getAwayTeam(item)));

    if (!date || !home || !away) return "";

    return `${date}-${timeBucket}-${home}-${away}`;
  }

  private fixtureLooseKey(item: any) {
    const timestamp = this.getFixtureTimestamp(item);
    const date = timestamp
      ? this.brazilDateKey(new Date(timestamp * 1000))
      : String(this.getFixtureDateValue(item) || "").slice(0, 10);

    const home = this.normalizeName(this.getTeamName(this.getHomeTeam(item)));
    const away = this.normalizeName(this.getTeamName(this.getAwayTeam(item)));

    if (!date || !home || !away) return "";

    // Chave sem horário para casos onde uma API manda UTC e outra manda -03:00.
    return `${date}-${home}-${away}`;
  }

  private fixtureQualityScore(item: any) {
    const provider = String(
      item?.provider || item?.provedor || "",
    ).toLowerCase();
    const fixture = this.getFixtureObject(item);
    const league = this.getLeagueObject(item);
    const home = this.getHomeTeam(item);
    const away = this.getAwayTeam(item);

    let score = 0;

    if (provider.includes("flashscore")) score += 85;
    if (provider.includes("soccer-football-info")) score += 75;
    if (provider.includes("sportscore6")) score += 65;
    if (provider.includes("sports-betting")) score += 45;
    if (provider.includes("allscores")) score += 30;
    if (provider.includes("api-football")) score += 25;

    if (item?.odds) score += 20;
    if (home?.logo) score += 8;
    if (away?.logo) score += 8;
    if (league?.logo) score += 4;
    if (fixture?.externalId) score += 6;
    if (fixture?.status?.elapsed || fixture?.status?.["tempo decorrido"])
      score += 4;

    score += Math.round(getOddixFixtureQualityScore(item) / 5);

    return score;
  }

  private shouldReplaceFixture(current: any, incoming: any) {
    return (
      this.fixtureQualityScore(incoming) > this.fixtureQualityScore(current)
    );
  }

  private mergeUniqueFixtures(groups: any[][]) {
    const map = new Map<string, any>();
    const looseToKey = new Map<string, string>();

    for (const group of groups) {
      for (const item of group || []) {
        const key = this.fixtureKey(item);
        const looseKey = this.fixtureLooseKey(item);
        if (!key && !looseKey) continue;

        const finalKey =
          (looseKey && looseToKey.get(looseKey)) || key || looseKey;
        if (looseKey && !looseToKey.has(looseKey))
          looseToKey.set(looseKey, finalKey);

        const current = map.get(finalKey);
        if (!current || this.shouldReplaceFixture(current, item)) {
          map.set(finalKey, item);
        }
      }
    }

    return Array.from(map.values()).sort((a: any, b: any) => {
      const da =
        this.getFixtureTimestamp(a) ||
        new Date(this.getFixtureDateValue(a) || 0).getTime() / 1000;
      const db =
        this.getFixtureTimestamp(b) ||
        new Date(this.getFixtureDateValue(b) || 0).getTime() / 1000;
      return da - db;
    });
  }

  private addDays(date: string, days: number) {
    const safeDate = this.normalizeDateKey(date);
    const d = new Date(`${safeDate}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private fixtureBelongsToBrazilDate(item: any, targetDate: string) {
    const rawDate = this.getFixtureDateValue(item);
    if (!rawDate) return false;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return false;

    return this.brazilDateKey(parsed) === targetDate;
  }

  private filterFixturesByBrazilDate(fixtures: any[], targetDate: string) {
    const safeTargetDate = this.normalizeDateKey(targetDate);

    return (fixtures || []).filter((item: any) =>
      this.fixtureBelongsToBrazilDate(item, safeTargetDate),
    );
  }

  private filterFixturesByBrazilDates(fixtures: any[], targetDates: string[]) {
    const safeTargetDates = new Set(
      (targetDates || []).map((date) => this.normalizeDateKey(date)),
    );

    return (fixtures || []).filter((item: any) => {
      const rawDate = this.getFixtureDateValue(item);
      if (!rawDate) return false;

      const parsed = new Date(rawDate);
      if (Number.isNaN(parsed.getTime())) return false;

      return safeTargetDates.has(this.brazilDateKey(parsed));
    });
  }

  private shouldFallbackNextWhenEmpty() {
    return (
      String(
        process.env.ODDIX_DASHBOARD_FALLBACK_NEXT_WHEN_EMPTY || "true",
      ).toLowerCase() !== "false"
    );
  }

  private emptyFallbackNextDays() {
    return Math.max(
      0,
      Number(process.env.ODDIX_DASHBOARD_EMPTY_FALLBACK_DAYS || 2),
    );
  }

  private fixtureStartsInFuture(
    item: any,
    minMinutes = -30,
    maxMinutes = 24 * 60,
  ) {
    const rawDate = this.getFixtureDateValue(item);
    if (!rawDate) return false;

    const parsed = new Date(rawDate).getTime();
    if (Number.isNaN(parsed)) return false;

    const diffMinutes = Math.floor((parsed - Date.now()) / 1000 / 60);
    return diffMinutes >= minMinutes && diffMinutes <= maxMinutes;
  }


  private shouldEnrichPreMatchStats() {
    return String(process.env.ODDIX_PREMATCH_STATS_ENABLED || "true").toLowerCase() !== "false";
  }

  private preMatchEnrichLimit() {
    return Math.max(0, Number(process.env.ODDIX_PREMATCH_ENRICH_LIMIT || 40));
  }

  private shouldEnrichFixtureWithPreMatchStats(item: any) {
    if (!this.shouldEnrichPreMatchStats()) return false;
    if (!item) return false;
    if (item?.preMatchStats?.available === true) return false;

    const cleanItem = this.standardizeFixture(item);
    const provider = String(cleanItem?.provider || "").toLowerCase();
    const statusShort = String(cleanItem?.fixture?.status?.short || "").toUpperCase();

    if (!provider.includes("flashscore")) return false;
    if (!["NS", "TBD", "PST"].includes(statusShort)) return false;

    return !!this.getFlashScoreExternalId(cleanItem);
  }

  private getFlashScoreExternalId(item: any) {
    return String(
      item?.fixture?.externalId ||
        item?.fixture?.external_id ||
        item?.fixture?.match_id ||
        item?.fixture?.matchId ||
        item?.fixture?.eventId ||
        item?.externalId ||
        item?.external_id ||
        item?.matchId ||
        item?.match_id ||
        item?.eventId ||
        item?.flashScoreRaw?.match_id ||
        item?.flashScoreRaw?.id ||
        item?.flashScoreRaw?.eventId ||
        item?.flashScoreRaw?.matchId ||
        "",
    ).trim();
  }

  private readAny(obj: any, paths: string[], fallback: any = undefined) {
    for (const path of paths) {
      const parts = path.split(".");
      let current = obj;
      for (const part of parts) current = current?.[part];
      if (current !== undefined && current !== null && current !== "") return current;
    }
    return fallback;
  }

  private normalizeNumber(value: any, fallback: any = null) {
    const parsed = Number(
      String(value ?? "")
        .replace("%", "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, ""),
    );
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private collectObjectsDeep(input: any, maxDepth = 5, depth = 0): any[] {
    if (!input || depth > maxDepth) return [];
    if (Array.isArray(input)) {
      return input.flatMap((item) => this.collectObjectsDeep(item, maxDepth, depth + 1));
    }
    if (typeof input !== "object") return [];

    const current = [input];
    for (const value of Object.values(input)) {
      current.push(...this.collectObjectsDeep(value, maxDepth, depth + 1));
    }
    return current;
  }

  private extractScoreFromHistoryRow(row: any) {
    const home = this.normalizeNumber(
      this.readAny(row, [
        "home.score",
        "homeScore",
        "home_score",
        "scores.home",
        "score.home",
        "homeTeam.score",
        "home_team.score",
        "home.goals",
        "home_goals",
      ]),
      null,
    );

    const away = this.normalizeNumber(
      this.readAny(row, [
        "away.score",
        "awayScore",
        "away_score",
        "scores.away",
        "score.away",
        "awayTeam.score",
        "away_team.score",
        "away.goals",
        "away_goals",
      ]),
      null,
    );

    if (home !== null && away !== null) return { home, away };

    const scoreText = String(
      this.readAny(row, ["score", "result", "ft", "fulltime", "full_time", "finalScore"], ""),
    );
    const match = scoreText.match(/(\d+)\s*[-:x]\s*(\d+)/i);
    if (match) return { home: Number(match[1]), away: Number(match[2]) };

    return null;
  }

  private summarizeFlashScoreH2H(h2hData: any) {
    const objects = this.collectObjectsDeep(h2hData, 6);
    const scoreRows = objects
      .map((row) => this.extractScoreFromHistoryRow(row))
      .filter(Boolean)
      .slice(0, 10) as { home: number; away: number }[];

    const lastFive = scoreRows.slice(0, 5);
    const totalMatches = lastFive.length;
    const over25 = lastFive.filter((score) => score.home + score.away >= 3).length;
    const btts = lastFive.filter((score) => score.home > 0 && score.away > 0).length;
    const avgGoals = totalMatches
      ? Number((lastFive.reduce((acc, score) => acc + score.home + score.away, 0) / totalMatches).toFixed(2))
      : null;

    return {
      available: totalMatches > 0,
      totalMatches,
      over25,
      btts,
      avgGoals,
      over25Rate: totalMatches ? Math.round((over25 / totalMatches) * 100) : null,
      bttsRate: totalMatches ? Math.round((btts / totalMatches) * 100) : null,
    };
  }

  private summarizeFlashScoreOdds(oddsData: any) {
    const odds: any = { home: null, draw: null, away: null };

    const assignDirect = (node: any) => {
      if (!node || typeof node !== "object") return;
      odds.home = odds.home || this.normalizeNumber(node?.["1"] ?? node?.home ?? node?.casa ?? node?.mandante, null);
      odds.draw = odds.draw || this.normalizeNumber(node?.X ?? node?.x ?? node?.draw ?? node?.empate, null);
      odds.away = odds.away || this.normalizeNumber(node?.["2"] ?? node?.away ?? node?.fora ?? node?.visitante, null);
    };

    assignDirect(oddsData);
    assignDirect(oddsData?.odds);
    assignDirect(oddsData?.data);
    assignDirect(oddsData?.response);

    const objects = this.collectObjectsDeep(oddsData, 7);

    for (const row of objects) {
      assignDirect(row);

      const name = this.normalizeTextLoose(
        this.readAny(row, ["name", "label", "title", "outcome", "selection", "selectionName", "marketName"], ""),
      );
      const odd = this.normalizeNumber(
        this.readAny(row, ["odd", "odds", "value", "price", "decimal", "rate.decimal", "rate", "current.decimal"], null),
        null,
      );
      if (!odd || odd <= 1) continue;

      if (!odds.home && ["1", "home", "casa", "mandante", "homewin"].includes(name)) odds.home = odd;
      if (!odds.draw && ["x", "draw", "empate", "tie"].includes(name)) odds.draw = odd;
      if (!odds.away && ["2", "away", "fora", "visitante", "awaywin"].includes(name)) odds.away = odd;
    }

    return {
      available: !!(odds.home || odds.draw || odds.away),
      ...odds,
    };
  }

  private buildPreMatchStatsFromFlashScore(
    item: any,
    h2hResponse: any,
    oddsResponse: any,
  ) {
    const h2h = h2hResponse?.ok && h2hResponse?.data
      ? this.summarizeFlashScoreH2H(h2hResponse.data)
      : { available: false, totalMatches: 0, over25: 0, btts: 0, avgGoals: null, over25Rate: null, bttsRate: null };

    const odds = oddsResponse?.ok && oddsResponse?.data
      ? this.summarizeFlashScoreOdds(oddsResponse.data)
      : { available: false, home: null, draw: null, away: null };

    const h2hGoalsForFallback = Number(h2h.avgGoals || 0);
    const over25Rate = Number(h2h.over25Rate || 0);
    const bttsRate = Number(h2h.bttsRate || 0);

    return {
      available: h2h.available || odds.available,
      source: "flashscore",
      home: {
        form: null,
        goalsFor: h2hGoalsForFallback ? Number((h2hGoalsForFallback / 2).toFixed(2)) : null,
        goalsAgainst: h2hGoalsForFallback ? Number((h2hGoalsForFallback / 2).toFixed(2)) : null,
        btts: bttsRate || null,
        over25: over25Rate || null,
      },
      away: {
        form: null,
        goalsFor: h2hGoalsForFallback ? Number((h2hGoalsForFallback / 2).toFixed(2)) : null,
        goalsAgainst: h2hGoalsForFallback ? Number((h2hGoalsForFallback / 2).toFixed(2)) : null,
        btts: bttsRate || null,
        over25: over25Rate || null,
      },
      h2h,
      odds,
      message: h2h.available || odds.available
        ? "Pré-jogo enriquecido com H2H/odds da FlashScore."
        : "Pré-jogo sem H2H/odds disponíveis na FlashScore.",
    };
  }

  private async enrichFixtureWithPreMatchStats(item: any) {
    const cleanItem: any = this.standardizeFixture(item);
    if (!this.shouldEnrichFixtureWithPreMatchStats(cleanItem)) return cleanItem;

    const matchId = this.getFlashScoreExternalId(cleanItem);

    try {
      const [h2h, odds] = await Promise.allSettled([
        this.flashScoreService.getH2H(matchId),
        this.flashScoreService.getOdds(matchId),
      ]);

      const h2hResponse = h2h.status === "fulfilled" ? h2h.value : { ok: false, data: null };
      const oddsResponse = odds.status === "fulfilled" ? odds.value : { ok: false, data: null };
      const preMatchStats = this.buildPreMatchStatsFromFlashScore(
        cleanItem,
        h2hResponse,
        oddsResponse,
      );

      const hasCurrentOdds = Array.isArray(cleanItem?.odds?.options) && cleanItem.odds.options.length > 0;
      const preMatchOddsOptions = [
        { name: "1", odd: preMatchStats?.odds?.home },
        { name: "X", odd: preMatchStats?.odds?.draw },
        { name: "2", odd: preMatchStats?.odds?.away },
      ]
        .map((option: any) => ({ name: option.name, odd: Number(option.odd) }))
        .filter((option: any) => ["1", "X", "2"].includes(option.name) && Number.isFinite(option.odd) && option.odd > 1);

      const enriched = {
        ...cleanItem,
        odds: hasCurrentOdds
          ? cleanItem.odds
          : preMatchOddsOptions.length
            ? {
                source: "flashscore-odds-endpoint",
                bookmaker: "FlashScore",
                market: "1X2",
                options: preMatchOddsOptions,
              }
            : undefined,
        preMatchStats,
      };

      return this.standardizeFixture(enriched);
    } catch {
      return cleanItem;
    }
  }

  private async enrichFixturesWithPreMatchStats(fixtures: any[]) {
    if (!this.shouldEnrichPreMatchStats()) return fixtures || [];

    const limit = this.preMatchEnrichLimit();
    if (limit <= 0) return fixtures || [];

    let used = 0;
    const output: any[] = [];

    for (const item of fixtures || []) {
      if (used < limit && this.shouldEnrichFixtureWithPreMatchStats(item)) {
        output.push(await this.enrichFixtureWithPreMatchStats(item));
        used += 1;
      } else {
        output.push(item);
      }
    }

    return output;
  }

  private async getFallbackNextFixtures(requestedDate: string, forceRefresh = false) {
    const fallbackDays = this.emptyFallbackNextDays();

    if (fallbackDays <= 0) return [];

    const fallbackDates = Array.from({ length: fallbackDays }, (_, index) =>
      this.addDays(requestedDate, index + 1),
    );

    const providerGroups: any[][] = [];

    if (!forceRefresh) {
      for (const currentDate of fallbackDates) {
        const freshCache = await this.getFreshFixturesFromCache(
          currentDate,
          this.fixturesCacheMinutes(),
        );

        if (freshCache.length > 0) providerGroups.push(freshCache);
      }
    }

    for (const currentDate of fallbackDates) {
      const flashScore = await this.getFixturesFromFlashScore(currentDate);
      if (flashScore.ok && flashScore.data.length > 0) {
        providerGroups.push(flashScore.data);
      }
    }

    /**
     * SportScore6 retorna uma agenda global, então buscamos uma vez e filtramos
     * pelos próximos dias desejados logo abaixo.
     */
    const sportScore6 = await this.getFixturesFromSportScore6(
      fallbackDates[0] || requestedDate,
    );
    if (sportScore6.ok && sportScore6.data.length > 0) {
      providerGroups.push(sportScore6.data);
    }

    for (const currentDate of fallbackDates) {
      const soccerFootballInfo =
        await this.getFixturesFromSoccerFootballInfo(currentDate);
      if (soccerFootballInfo.ok && soccerFootballInfo.data.length > 0) {
        providerGroups.push(soccerFootballInfo.data);
      }

      const sportScore = await this.getFixturesFromSportScore(currentDate);
      if (sportScore.ok && sportScore.data.length > 0) {
        providerGroups.push(sportScore.data);
      }

      const allScores = await this.getFixturesFromAllScores(currentDate);
      if (allScores.ok && allScores.data.length > 0) {
        providerGroups.push(allScores.data);
      }

      const sportsDb = await this.getFixturesFromSportsDb(currentDate);
      if (sportsDb.ok && sportsDb.data.length > 0) {
        providerGroups.push(sportsDb.data);
      }

      if (this.shouldUseApiFootballFallback()) {
        const apiFootball = await this.getFixturesFromApiFootball(currentDate);
        if (apiFootball.ok && apiFootball.data.length > 0) {
          providerGroups.push(apiFootball.data);
        }
      }

      const sportmonks = await this.getFixturesFromSportmonks(currentDate);
      if (sportmonks.ok && sportmonks.data.length > 0) {
        providerGroups.push(sportmonks.data);
      }

      const footballData = await this.getFixturesFromFootballData(currentDate);
      if (footballData.ok && footballData.data.length > 0) {
        providerGroups.push(footballData.data);
      }
    }


    /**
     * Prioridade absoluta no fallback: se os próximos dias tiverem Copa do Mundo,
     * ela deve aparecer antes de qualquer Série B ou outra liga premium nacional.
     */
    const fallbackWorldCupMerged = this.filterFixturesByBrazilDates(
      this.mergeUniqueFixtures(providerGroups).map((item: any) =>
        this.enrichFixtureForOddix(item),
      ),
      fallbackDates,
    )
      .filter((item: any) => this.isOddixWorldCupFixture(item))
      .filter((item: any) =>
        this.fixtureStartsInFuture(
          item,
          -30,
          fallbackDays * 24 * 60 + 180,
        ),
      );

    if (fallbackWorldCupMerged.length > 0) {
      const finalWorldCup = this.publicDashboardFixtures(fallbackWorldCupMerged);

      if (finalWorldCup.length > 0) {
        await this.saveFixturesCache(finalWorldCup);
        return finalWorldCup;
      }
    }

    const merged = this.filterFixturesByBrazilDates(
      this.filterDashboardFixtures(this.mergeUniqueFixtures(providerGroups)),
      fallbackDates,
    ).filter((item: any) => {
      // Fallback do dashboard é só para preencher próximos jogos; não traz jogo antigo.
      return this.fixtureStartsInFuture(
        item,
        -30,
        fallbackDays * 24 * 60 + 180,
      );
    });

    if (!merged.length) return [];

    const enriched = await this.enrichFixturesWithPreMatchStats(merged);
    const finalFixtures = this.publicDashboardFixtures(enriched);

    if (finalFixtures.length > 0) {
      await this.saveFixturesCache(finalFixtures);
    }

    return finalFixtures;
  }

  async getFixtures(date?: string, options: GetFixturesOptions | boolean = {}) {
    await this.cleanupDashboardCache(false);

    const forceRefresh =
      typeof options === "boolean" ? options : options.forceRefresh === true;
    const allowEmptyFallback =
      typeof options === "boolean" ? true : options.allowEmptyFallback !== false;

    date = this.normalizeDateKey(date);

    /**
     * Oddix Center Control:
     * por padrão a rota continua podendo buscar só a data solicitada, mas agora
     * aceita uma janela segura via ?days=7. Assim o dashboard pode trazer mais
     * jogos premium sem fazer várias chamadas e sem voltar a liberar ligas ruins.
     */
    const requestedDate = date;
    const lookaheadDays = this.dashboardLookaheadDays(
      typeof options === "boolean" ? 1 : options.lookaheadDays,
    );
    const searchDates = Array.from({ length: lookaheadDays }, (_, index) =>
      this.addDays(requestedDate, index),
    );

    const freshGroups: any[][] = [];

    for (const currentDate of searchDates) {
      const freshCache = await this.getFreshFixturesFromCache(
        currentDate,
        this.fixturesCacheMinutes(),
      );
      if (freshCache.length > 0) freshGroups.push(freshCache);
    }

    const freshMerged = this.filterFixturesByBrazilDates(
      this.filterDashboardFixtures(this.mergeUniqueFixtures(freshGroups)),
      searchDates,
    );

    if (!forceRefresh && freshMerged.length > 0) {
      const enrichedFresh = await this.enrichFixturesWithPreMatchStats(freshMerged);
      const finalFresh = this.publicDashboardFixtures(enrichedFresh);

      /**
       * Correção Oddix Dashboard:
       * Antes qualquer cache fresco, até 1 jogo, encerrava a função aqui.
       * Isso impedia a chamada da API principal e fazia o dashboard parecer travado.
       * Agora o cache só é retorno final quando tiver uma quantidade mínima saudável.
       */
      if (finalFresh.length >= this.minFixturesBeforeCacheHit()) {
        return finalFresh;
      }
    }

    const providerGroups: any[][] = [];

    /**
     * Mesmo quando o cache tem poucos jogos, preservamos esses registros e seguimos
     * chamando os providers. No final, tudo é deduplicado e o dashboard recebe a
     * união limpa entre cache + APIs reais.
     */
    if (!forceRefresh && freshMerged.length > 0) providerGroups.push(freshMerged);

    for (const currentDate of searchDates) {
      const flashScore = await this.getFixturesFromFlashScore(currentDate);
      if (flashScore.ok && flashScore.data.length > 0)
        providerGroups.push(flashScore.data);
    }

    /**
     * SportScore6 não aceita data nesse endpoint; ela retorna a lista global/agenda.
     * Chamamos apenas uma vez para não gastar requisições duplicadas.
     */
    const sportScore6 = await this.getFixturesFromSportScore6(date);
    if (sportScore6.ok && sportScore6.data.length > 0) {
      providerGroups.push(sportScore6.data);
    }

    for (const currentDate of searchDates) {
      const soccerFootballInfo = await this.getFixturesFromSoccerFootballInfo(currentDate);
      if (soccerFootballInfo.ok && soccerFootballInfo.data.length > 0) providerGroups.push(soccerFootballInfo.data);

      const sportScore = await this.getFixturesFromSportScore(currentDate);
      if (sportScore.ok && sportScore.data.length > 0)
        providerGroups.push(sportScore.data);

      const allScores = await this.getFixturesFromAllScores(currentDate);
      if (allScores.ok && allScores.data.length > 0)
        providerGroups.push(allScores.data);

      const sportsDb = await this.getFixturesFromSportsDb(currentDate);
      if (sportsDb.ok && sportsDb.data.length > 0)
        providerGroups.push(sportsDb.data);

      if (this.shouldUseApiFootballFallback()) {
        const apiFootball = await this.getFixturesFromApiFootball(currentDate);
        if (apiFootball.ok && apiFootball.data.length > 0)
          providerGroups.push(apiFootball.data);
      }

      const sportmonks = await this.getFixturesFromSportmonks(currentDate);
      if (sportmonks.ok && sportmonks.data.length > 0)
        providerGroups.push(sportmonks.data);

      const footballData = await this.getFixturesFromFootballData(currentDate);
      if (footballData.ok && footballData.data.length > 0)
        providerGroups.push(footballData.data);
    }


    /**
     * Blindagem final Oddix:
     * alguns providers (principalmente SportScore6) retornam Copa do Mundo como
     * "FIFA World Copa". O debug já mostra esses jogos como premium, mas o fluxo
     * final não pode cair no fallback se houver Copa do Mundo na data solicitada.
     * Aqui retornamos diretamente os jogos de Copa do Mundo da data antes de
     * qualquer fallback para Série B ou próximos dias.
     */
    const directWorldCupMerged = this.filterFixturesByBrazilDates(
      this.mergeUniqueFixtures(providerGroups).map((item: any) =>
        this.enrichFixtureForOddix(item),
      ),
      searchDates,
    ).filter((item: any) => this.isOddixWorldCupFixture(item));

    /**
     * Em busca de data única, Copa do Mundo continua tendo prioridade absoluta.
     * Em janela com ?days=7, não retornamos só Copa; deixamos o fluxo seguir para
     * juntar Copa + demais jogos premium da semana.
     */
    if (lookaheadDays === 1 && directWorldCupMerged.length > 0) {
      const finalWorldCup = this.publicDashboardFixtures(directWorldCupMerged);

      if (finalWorldCup.length > 0) {
        await this.saveFixturesCache(finalWorldCup);
        return finalWorldCup;
      }
    }

    const providerMerged = this.filterFixturesByBrazilDates(
      this.filterDashboardFixtures(this.mergeUniqueFixtures(providerGroups)),
      searchDates,
    );

    if (providerMerged.length > 0) {
      const enrichedProvider = await this.enrichFixturesWithPreMatchStats(providerMerged);
      const finalProvider = this.publicDashboardFixtures(enrichedProvider);

      if (finalProvider.length > 0) {
        await this.saveFixturesCache(finalProvider);
        return finalProvider;
      }
    }

    const staleGroups: any[][] = [];

    for (const currentDate of searchDates) {
      const staleCache = await this.getFixturesFromCache(currentDate);
      if (staleCache.length > 0) staleGroups.push(staleCache);
    }

    const staleMerged = this.filterFixturesByBrazilDates(
      this.filterDashboardFixtures(this.mergeUniqueFixtures(staleGroups)),
      searchDates,
    );
    const enrichedStale = await this.enrichFixturesWithPreMatchStats(staleMerged);
    const finalStale = this.publicDashboardFixtures(enrichedStale);

    if (finalStale.length > 0) return finalStale;

    /**
     * Se o dia selecionado não tiver nenhum jogo elegível, o dashboard não deve
     * ficar com [] quando já existe próximo jogo premium em 24/48h.
     * Isso mantém a data exata quando há jogos, mas evita uma tela vazia.
     * Use ODDIX_DASHBOARD_FALLBACK_NEXT_WHEN_EMPTY=false para desativar.
     */
    if (allowEmptyFallback && this.shouldFallbackNextWhenEmpty()) {
      const fallbackNextFixtures = await this.getFallbackNextFixtures(
        requestedDate,
        forceRefresh,
      );

      if (fallbackNextFixtures.length > 0) return fallbackNextFixtures;
    }

    return [];
  }

  private async getLiveFixturesFromCache(onlyFresh = true) {
    const { start, end } = this.brazilDayRangeUtc(this.brazilDateKey());

    const cached = await this.prisma.cachedFixture.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });

    return cached
      .map((item) => this.stripRawProviderData(item.raw))
      .filter((item: any) => this.isOddixFixtureAllowedForDashboard(item))
      .filter((item: any) => this.shouldTreatAsLive(item))
      .filter((item: any) =>
        onlyFresh ? this.isCacheFresh(item, this.liveCacheSeconds()) : true,
      )
      .map((item: any) => this.normalizeLiveStatus(item));
  }

  async getLiveFixtures() {
    await this.cleanupDashboardCache(false);

    const freshCacheLive = await this.getLiveFixturesFromCache(true);

    if (freshCacheLive.length > 0) {
      const finalFreshLive = this.publicDashboardFixtures(
        this.mergeUniqueFixtures([freshCacheLive]),
      );

      if (finalFreshLive.length > 0) {
        return finalFreshLive;
      }
    }

    const groups: any[][] = [];
    const today = this.brazilDateKey();

    const flashScore = await this.getLiveFixturesFromFlashScore();

    if (flashScore.ok && flashScore.data.length > 0) {
      const live = flashScore.data
        .filter((game: any) => this.isOddixFixtureAllowedForDashboard(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const soccerFootballInfo = await this.getLiveFixturesFromSoccerFootballInfo();

    if (soccerFootballInfo.ok && soccerFootballInfo.data.length > 0) {
      const live = soccerFootballInfo.data
        .filter((game: any) => this.isOddixFixtureAllowedForDashboard(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    /**
     * IMPORTANTE:
     * Aqui o Oddix NÃO deve usar fallback em cascata para live.
     * O correto é SOMAR os providers disponíveis e depois deduplicar.
     *
     * Exemplo:
     * FlashScore Live = 5 jogos
     * AllScores Live = 6 jogos
     * Resultado final = união limpa dos dois, sem duplicados.
     */

    const sportScore6 = await this.getLiveFixturesFromSportScore6();

    if (sportScore6.ok && sportScore6.data.length > 0) {
      const live = sportScore6.data
        .filter((game: any) => this.isOddixFixtureAllowedForDashboard(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const sportScore = await this.getLiveFixturesFromSportScore();

    if (sportScore.ok && sportScore.data.length > 0) {
      const live = sportScore.data
        .filter((game: any) => this.isOddixFixtureAllowedForDashboard(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const allScores = await this.getLiveFixturesFromAllScores(today);

    if (allScores.ok && allScores.data.length > 0) {
      const live = allScores.data
        .filter((game: any) => this.isOddixFixtureAllowedForDashboard(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    if (this.shouldUseApiFootballFallback()) {
      const apiFootball = await this.getLiveFixturesFromApiFootball();

      if (apiFootball.ok && apiFootball.data.length > 0) {
        const live = apiFootball.data
          .filter((game: any) => this.isOddixFixtureAllowedForDashboard(game))
          .filter((game: any) => this.shouldTreatAsLive(game))
          .map((item: any) => this.normalizeLiveStatus(item));

        if (live.length > 0) groups.push(live);
      }
    }

    const sportmonksKey = this.getSportmonksKey();

    if (sportmonksKey) {
      try {
        const response = await axios.get(
          `${this.sportmonksURL}/livescores/inplay`,
          {
            timeout: 10000,
            params: {
              api_token: sportmonksKey,
              include:
                "participants;league;league.country;scores;state;periods",
            },
          },
        );

        const liveFixtures = (response.data?.data || [])
          .map((item: any) => this.mapSportmonksFixture(item))
          .filter((item: any) => this.isOddixFixtureAllowedForDashboard(item))
          .filter((item: any) => this.shouldTreatAsLive(item))
          .map((item: any) => this.normalizeLiveStatus(item));

        if (liveFixtures.length > 0) groups.push(liveFixtures);
      } catch {}
    }

    const footballData = await this.getFixturesFromFootballData(today);

    if (footballData.ok && footballData.data.length > 0) {
      const live = footballData.data
        .filter((game: any) => this.isOddixFixtureAllowedForDashboard(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const mergedLive = this.publicDashboardFixtures(this.mergeUniqueFixtures(groups));

    if (mergedLive.length > 0) {
      await this.saveFixturesCache(mergedLive);
      return mergedLive;
    }

    // Não usar cache velho como live. Cache antigo é a maior causa de palpite em jogo já finalizado.
    return [];
  }

  async getFixtureByIdFromApiFootball(fixtureId: string) {
    if (this.isApiFootballBlocked()) {
      return {
        ok: false,
        data: null,
        error: "API-Football em cooldown temporário por limite/erro",
      };
    }

    const apiKey = this.getApiFootballKey();
    if (!apiKey)
      return {
        ok: false,
        data: null,
        error: "API_FOOTBALL_KEY não encontrada",
      };

    try {
      const response = await axios.get(`${this.apiFootballURL}/fixtures`, {
        timeout: 12000,
        headers: { "x-apisports-key": apiKey },
        params: {
          id: fixtureId,
          timezone: "America/Sao_Paulo",
        },
      });

      const item = response.data?.response?.[0];
      return {
        ok: !!item,
        data: item ? this.mapApiFootballFixture(item) : null,
        error: item ? null : "Fixture não encontrado na API-Football",
      };
    } catch (error: any) {
      if (this.isApiFootballLimitError(error)) {
        this.blockApiFootballTemporarily();
      }

      return {
        ok: false,
        data: null,
        error:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Erro na API-Football por ID",
      };
    }
  }

  private mapApiFootballStatistics(fixtureId: string, items: any[]) {
    const teams = (items || []).map((item: any) => ({
      team: item.team || { id: 0, name: "", logo: "" },
      statistics: (item.statistics || []).map((stat: any) => ({
        type: stat.type,
        value: stat.value,
      })),
    }));

    return {
      available: teams.length > 0,
      simulated: false,
      fixtureId,
      source: "api-football",
      message:
        teams.length > 0
          ? "Estatísticas reais da API-Football."
          : "Sem estatísticas reais disponíveis.",
      teams,
    };
  }

  async getStatisticsFromApiFootball(fixtureId: string) {
    const apiKey = this.getApiFootballKey();
    if (!apiKey)
      return {
        ok: false,
        data: null,
        error: "API_FOOTBALL_KEY não encontrada",
      };

    try {
      const response = await axios.get(
        `${this.apiFootballURL}/fixtures/statistics`,
        {
          timeout: 12000,
          headers: { "x-apisports-key": apiKey },
          params: { fixture: fixtureId },
        },
      );

      const stats = this.mapApiFootballStatistics(
        fixtureId,
        response.data?.response || [],
      );

      return {
        ok: stats.available,
        data: stats,
        error: stats.available
          ? null
          : "Sem estatísticas reais na API-Football",
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Erro ao buscar estatísticas na API-Football",
      };
    }
  }

  async getFixtureById(fixtureId: string) {
    /**
     * IMPORTANTE PARA GREEN/RED:
     * FlashScore agora é a fonte principal do Oddix.
     * Para providers sem endpoint de detalhe por ID neste serviço, usamos cache fresco
     * e caímos para SportScore6/Soccer Football Info/SportScore/API-Football quando necessário.
     */
    const cachedSoccerFootballInfo: any = await this.getFixtureFromCacheById(fixtureId);

    if (
      cachedSoccerFootballInfo?.provider === "flashscore" &&
      this.isCacheFresh(cachedSoccerFootballInfo, this.liveCacheSeconds() * 4)
    ) {
      return await this.enrichFixtureWithPreMatchStats(cachedSoccerFootballInfo);
    }

    if (String(cachedSoccerFootballInfo?.provider || "") === "soccer-football-info") {
      const soccerFootballInfo = await this.getFixtureByIdFromSoccerFootballInfo(fixtureId);

      if (soccerFootballInfo.ok && soccerFootballInfo.data) {
        await this.saveFixturesCache([soccerFootballInfo.data]);
        return await this.enrichFixtureWithPreMatchStats(soccerFootballInfo.data);
      }
    }

    if (
      !cachedSoccerFootballInfo ||
      String(cachedSoccerFootballInfo?.provider || "") !== "sportscore6"
    ) {
      const soccerFootballInfo = await this.getFixtureByIdFromSoccerFootballInfo(fixtureId);

      if (soccerFootballInfo.ok && soccerFootballInfo.data) {
        await this.saveFixturesCache([soccerFootballInfo.data]);
        return await this.enrichFixtureWithPreMatchStats(soccerFootballInfo.data);
      }
    }

    const cachedSportScore6: any = cachedSoccerFootballInfo;

    if (
      cachedSportScore6?.provider === "sportscore6" &&
      cachedSportScore6?.fixture?.externalId
    ) {
      const sportScore6 = await this.getFixtureBySlugFromSportScore6(
        String(cachedSportScore6.fixture.externalId),
      );

      if (sportScore6.ok && sportScore6.data) {
        await this.saveFixturesCache([sportScore6.data]);
        return await this.enrichFixtureWithPreMatchStats(sportScore6.data);
      }
    }

    const sportScore = await this.getFixtureByIdFromSportScore(fixtureId);

    if (sportScore.ok && sportScore.data) {
      await this.saveFixturesCache([sportScore.data]);
      return await this.enrichFixtureWithPreMatchStats(sportScore.data);
    }

    const allScores = await this.getFixtureByIdFromAllScores(fixtureId);

    if (allScores.ok && allScores.data) {
      await this.saveFixturesCache([allScores.data]);
      return await this.enrichFixtureWithPreMatchStats(allScores.data);
    }

    if (this.shouldUseApiFootballFallback()) {
      const apiFootball = await this.getFixtureByIdFromApiFootball(fixtureId);

      if (apiFootball.ok && apiFootball.data) {
        await this.saveFixturesCache([apiFootball.data]);
        return await this.enrichFixtureWithPreMatchStats(apiFootball.data);
      }
    }

    const sportmonksKey = this.getSportmonksKey();

    if (sportmonksKey) {
      try {
        const response = await axios.get(
          `${this.sportmonksURL}/fixtures/${fixtureId}`,
          {
            timeout: 10000,
            params: {
              api_token: sportmonksKey,
              include:
                "participants;league;league.country;scores;state;periods",
            },
          },
        );

        const data = response.data?.data;

        if (data) {
          const fixture = this.mapSportmonksFixture(data);
          await this.saveFixturesCache([fixture]);
          return await this.enrichFixtureWithPreMatchStats(fixture);
        }
      } catch {}
    }

    const cached = await this.getFixtureFromCacheById(fixtureId);
    return cached ? await this.enrichFixtureWithPreMatchStats(cached) : null;
  }


  async findFixtureByTeamsAndDate(
    homeTeam: string,
    awayTeam: string,
    gameDate?: Date | string | null,
  ) {
    const targetDate = gameDate ? new Date(gameDate) : new Date();
    const safeTargetDate =
      targetDate instanceof Date && !Number.isNaN(targetDate.getTime())
        ? targetDate
        : new Date();

    const targetDateKey = this.brazilDateKey(safeTargetDate);
    const searchDates = [
      this.addDays(targetDateKey, -1),
      targetDateKey,
      this.addDays(targetDateKey, 1),
    ];

    const targetHome = this.normalizeName(homeTeam || "");
    const targetAway = this.normalizeName(awayTeam || "");

    if (!targetHome || !targetAway) return null;

    const isNameMatch = (expected: string, actual: string) => {
      if (!expected || !actual) return false;
      if (expected === actual) return true;
      if (expected.length >= 5 && actual.includes(expected)) return true;
      if (actual.length >= 5 && expected.includes(actual)) return true;

      const expectedChunks = expected.match(/[a-z0-9]{3,}/g) || [];
      const actualChunks = actual.match(/[a-z0-9]{3,}/g) || [];
      if (!expectedChunks.length || !actualChunks.length) return false;

      const hits = expectedChunks.filter((chunk) => actualChunks.some((item) => item.includes(chunk) || chunk.includes(item))).length;
      return hits >= Math.max(1, Math.ceil(expectedChunks.length * 0.55));
    };

    const scoreCandidate = (raw: any) => {
      const item = this.standardizeFixture(raw);
      if (!item) return -1;

      const home = this.normalizeName(this.getTeamName(this.getHomeTeam(item)));
      const away = this.normalizeName(this.getTeamName(this.getAwayTeam(item)));
      const direct = isNameMatch(targetHome, home) && isNameMatch(targetAway, away);
      const swapped = isNameMatch(targetHome, away) && isNameMatch(targetAway, home);
      if (!direct && !swapped) return -1;

      const rawDate = this.getFixtureDateValue(item);
      const fixtureTime = rawDate ? new Date(rawDate).getTime() : 0;
      const targetTime = safeTargetDate.getTime();
      const diffHours = fixtureTime && !Number.isNaN(fixtureTime)
        ? Math.abs(fixtureTime - targetTime) / 1000 / 60 / 60
        : 999;

      // Aposta pode ter sido salva no live com horário ligeiramente diferente do provider.
      if (diffHours > 30) return -1;

      const statusShort = String(item?.fixture?.status?.short || "").toUpperCase();
      const statusLong = String(item?.fixture?.status?.long || "");
      const finished = this.isFinishedStatus(statusShort, statusLong) ? 100 : 0;
      const scoreKnown =
        item?.goals?.home !== null &&
        item?.goals?.home !== undefined &&
        item?.goals?.away !== null &&
        item?.goals?.away !== undefined
          ? 35
          : 0;
      const providerScore = this.fixtureQualityScore(item);
      const dateScore = Math.max(0, 30 - diffHours);
      const orientationScore = direct ? 20 : 8;

      return finished + scoreKnown + providerScore + dateScore + orientationScore;
    };

    const providerGroups: any[][] = [];

    for (const date of searchDates) {
      const cached = await this.getFixturesFromCache(date);
      if (cached.length > 0) providerGroups.push(cached);

      const flashScore = await this.getFixturesFromFlashScore(date);
      if (flashScore.ok && flashScore.data.length > 0) providerGroups.push(flashScore.data);

      const soccerFootballInfo = await this.getFixturesFromSoccerFootballInfo(date);
      if (soccerFootballInfo.ok && soccerFootballInfo.data.length > 0) providerGroups.push(soccerFootballInfo.data);

      const sportScore = await this.getFixturesFromSportScore(date);
      if (sportScore.ok && sportScore.data.length > 0) providerGroups.push(sportScore.data);

      const allScores = await this.getFixturesFromAllScores(date);
      if (allScores.ok && allScores.data.length > 0) providerGroups.push(allScores.data);

      const sportsDb = await this.getFixturesFromSportsDb(date);
      if (sportsDb.ok && sportsDb.data.length > 0) providerGroups.push(sportsDb.data);

      if (this.getApiFootballKey() && !this.isApiFootballBlocked()) {
        const apiFootball = await this.getFixturesFromApiFootball(date);
        if (apiFootball.ok && apiFootball.data.length > 0) providerGroups.push(apiFootball.data);
      }

      const sportmonks = await this.getFixturesFromSportmonks(date);
      if (sportmonks.ok && sportmonks.data.length > 0) providerGroups.push(sportmonks.data);

      const footballData = await this.getFixturesFromFootballData(date);
      if (footballData.ok && footballData.data.length > 0) providerGroups.push(footballData.data);
    }

    const sportScore6 = await this.getFixturesFromSportScore6(targetDateKey);
    if (sportScore6.ok && sportScore6.data.length > 0) providerGroups.push(sportScore6.data);

    const candidates = this.mergeUniqueFixtures(providerGroups)
      .map((item: any) => this.standardizeFixture(item))
      .map((item: any) => ({ item, score: scoreCandidate(item) }))
      .filter((entry: any) => entry.score >= 0)
      .sort((a: any, b: any) => b.score - a.score);

    const best = candidates[0]?.item || null;

    if (best) {
      await this.saveFixturesCache([best]);
      return this.enrichFixtureForOddix(best);
    }

    return null;
  }

  async getLeagues() {
    const apiKey = this.getSportmonksKey();
    if (!apiKey) return [];

    try {
      const response = await axios.get(`${this.sportmonksURL}/leagues`, {
        timeout: 10000,
        params: { api_token: apiKey, include: "country" },
      });

      return response.data?.data || [];
    } catch {
      return [];
    }
  }

  private numberFromSeed(seed: number, min: number, max: number) {
    const x = Math.sin(seed) * 10000;
    const value = x - Math.floor(x);
    return Math.round(min + value * (max - min));
  }

  private generateFallbackStatistics(fixtureId: string) {
    const seed = Number(String(fixtureId).replace(/\D/g, "").slice(-7)) || 1234;
    const homeShots = this.numberFromSeed(seed + 1, 6, 18);
    const awayShots = this.numberFromSeed(seed + 2, 5, 16);
    const homePossession = this.numberFromSeed(seed + 5, 42, 61);
    const awayPossession = 100 - homePossession;

    return {
      available: true,
      simulated: true,
      fixtureId,
      message: "Estatísticas provisórias.",
      teams: [
        {
          team: { id: 0, name: "Casa", logo: "" },
          statistics: [
            { type: "Ball Possession", value: `${homePossession}%` },
            { type: "Total Shots", value: homeShots },
            {
              type: "Shots on Goal",
              value: this.numberFromSeed(
                seed + 3,
                2,
                Math.max(3, Math.round(homeShots * 0.55)),
              ),
            },
            {
              type: "Corner Kicks",
              value: this.numberFromSeed(seed + 6, 2, 8),
            },
            {
              type: "Yellow Cards",
              value: this.numberFromSeed(seed + 8, 0, 4),
            },
            { type: "Fouls", value: this.numberFromSeed(seed + 10, 7, 18) },
            { type: "Offsides", value: this.numberFromSeed(seed + 12, 0, 4) },
          ],
        },
        {
          team: { id: 0, name: "Fora", logo: "" },
          statistics: [
            { type: "Ball Possession", value: `${awayPossession}%` },
            { type: "Total Shots", value: awayShots },
            {
              type: "Shots on Goal",
              value: this.numberFromSeed(
                seed + 4,
                1,
                Math.max(2, Math.round(awayShots * 0.55)),
              ),
            },
            {
              type: "Corner Kicks",
              value: this.numberFromSeed(seed + 7, 1, 7),
            },
            {
              type: "Yellow Cards",
              value: this.numberFromSeed(seed + 9, 0, 4),
            },
            { type: "Fouls", value: this.numberFromSeed(seed + 11, 7, 18) },
            { type: "Offsides", value: this.numberFromSeed(seed + 13, 0, 4) },
          ],
        },
      ],
    };
  }


  async getFlashScoreRichContext(fixtureId: string, fixtureInput?: any) {
    const cachedRaw = await this.getFixtureFromCacheById(String(fixtureId));
    const cached: any = cachedRaw || null;
    const fixture: any = this.standardizeFixture(fixtureInput || cached || {});

    const externalId =
      fixture?.fixture?.externalId ||
      cached?.fixture?.externalId ||
      cached?.flashScoreRaw?.id ||
      fixture?.flashScoreRaw?.id ||
      fixture?.fixture?.id ||
      cached?.fixture?.id ||
      fixtureId;

    const provider = String(fixture?.provider || cached?.provider || '').toLowerCase();
    const canUseFlashScore = !!externalId && (provider === 'flashscore' || this.flashScoreService?.isEnabled?.());

    const empty = {
      ok: false,
      source: 'flashscore',
      fixture,
      fixtureId: String(fixtureId),
      flashScoreExternalId: externalId ? String(externalId) : null,
      statistics: null,
      odds: null,
      h2h: null,
      lineups: null,
      prematchStats: null,
      errors: [] as string[],
    };

    if (!canUseFlashScore) {
      return {
        ...empty,
        errors: ['Fixture sem externalId FlashScore ou FlashScore desativada.'],
      };
    }

    const errors: string[] = [];

    const [statsResult, h2hResult, oddsResult, lineupsResult] = await Promise.allSettled([
      this.flashScoreService.getStats(String(externalId)),
      this.flashScoreService.getH2H(String(externalId)),
      this.flashScoreService.getOdds(String(externalId)),
      this.flashScoreService.getLineups(String(externalId)),
    ]);

    const readSettled = (result: PromiseSettledResult<any>, label: string) => {
      if (result.status === 'rejected') {
        errors.push(`${label}: ${result.reason?.message || result.reason || 'erro desconhecido'}`);
        return null;
      }

      if (!result.value?.ok) {
        if (result.value?.error) errors.push(`${label}: ${result.value.error}`);
        return null;
      }

      return result.value?.data || null;
    };

    const rawStats = readSettled(statsResult, 'stats');
    const rawH2h = readSettled(h2hResult, 'h2h');
    const rawOdds = readSettled(oddsResult, 'odds');
    const rawLineups = readSettled(lineupsResult, 'lineups');

    const statistics = rawStats ? this.flashScoreService.mapStatsToOddix(String(fixtureId), rawStats) : null;
    const h2h = rawH2h ? this.summarizeFlashScoreH2H(rawH2h) : null;
    const odds = rawOdds ? this.summarizeFlashScoreOdds(rawOdds) : null;
    const prematchStats = this.buildPreMatchStatsFromFlashScore(fixture, { ok: !!rawH2h, data: rawH2h }, { ok: !!rawOdds, data: rawOdds });

    const mergedFixture = {
      ...fixture,
      provider: fixture?.provider || 'flashscore',
      fixture: {
        ...(fixture?.fixture || {}),
        id: fixture?.fixture?.id || Number(fixtureId) || fixtureId,
        externalId: String(externalId),
      },
      odds: odds?.available
        ? {
            source: 'flashscore',
            market: '1X2',
            options: [
              { name: '1', odd: odds.home },
              { name: 'X', odd: odds.draw },
              { name: '2', odd: odds.away },
            ].filter((item: any) => Number(item.odd) > 1),
          }
        : fixture?.odds || null,
      oddixRichContext: true,
    };

    return {
      ok: !!(statistics?.available || prematchStats?.available || odds?.available || h2h?.available || rawLineups),
      source: 'flashscore',
      fixture: mergedFixture,
      fixtureId: String(fixtureId),
      flashScoreExternalId: String(externalId),
      statistics,
      odds,
      h2h,
      lineups: rawLineups,
      prematchStats,
      raw: {
        stats: rawStats,
        h2h: rawH2h,
        odds: rawOdds,
        lineups: rawLineups,
      },
      errors,
    };
  }

  async getStatisticsFromFlashScore(fixtureId: string) {
    const cachedRaw = await this.getFixtureFromCacheById(fixtureId);
    const cached = cachedRaw as any;
    const provider = String(cached?.provider || cached?.provedor || '').toLowerCase();
    const externalId =
      cached?.fixture?.externalId ||
      cached?.fixture?.external_id ||
      cached?.fixture?.externalID ||
      cached?.fixture?.match_id ||
      cached?.fixture?.matchId ||
      cached?.flashScoreRaw?.match_id ||
      cached?.flashScoreRaw?.id ||
      cached?.flashScoreRaw?.eventId ||
      cached?.flashScoreRaw?.matchId ||
      null;

    if (!cached) {
      return {
        ok: false,
        data: null,
        error: `Fixture ${fixtureId} não encontrado no cache`,
      };
    }

    if (!provider.includes('flashscore')) {
      return {
        ok: false,
        data: null,
        error: `Fixture não é FlashScore. provider=${provider || 'unknown'}`,
      };
    }

    if (!externalId) {
      return {
        ok: false,
        data: null,
        error: `Fixture FlashScore sem externalId. fixtureId=${fixtureId}`,
      };
    }

    try {
      const response = await this.flashScoreService.getStats(String(externalId));

      if (!response.ok || !response.data) {
        return {
          ok: false,
          data: null,
          error:
            response.error ||
            `FlashScore não retornou stats para match_id=${externalId}`,
        };
      }

      const stats = this.flashScoreService.mapStatsToOddix(
        fixtureId,
        response.data,
      );

      return {
        ok: stats.available,
        data: {
          ...stats,
          fixtureId,
          flashScoreId: String(externalId),
        },
        error: stats.available
          ? null
          : `Sem estatísticas reais na FlashScore para match_id=${externalId}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || 'Erro ao buscar stats FlashScore',
      };
    }
  }

  private getFlashScoreMatchIdFromCachedFixture(cached: any) {
    return String(
      cached?.fixture?.externalId ||
        cached?.fixture?.external_id ||
        cached?.fixture?.externalID ||
        cached?.fixture?.match_id ||
        cached?.fixture?.matchId ||
        cached?.flashScoreRaw?.match_id ||
        cached?.flashScoreRaw?.id ||
        cached?.flashScoreRaw?.eventId ||
        cached?.flashScoreRaw?.matchId ||
        "",
    ).trim();
  }

  private lineupArrayFromAny(input: any): any[] {
    if (!input) return [];
    if (Array.isArray(input)) return input;

    const directArrays = [
      input?.lineups,
      input?.lineup,
      input?.data,
      input?.response,
      input?.result,
      input?.payload,
      input?.home,
      input?.away,
      input?.data?.lineups,
      input?.data?.lineup,
      input?.response?.lineups,
      input?.response?.lineup,
      input?.result?.lineups,
      input?.payload?.lineups,
    ];

    for (const candidate of directArrays) {
      if (Array.isArray(candidate)) return candidate;
    }

    return [];
  }

  private hasLineupPayload(payload: any) {
    if (!payload) return false;

    const arrays = this.lineupArrayFromAny(payload);
    if (arrays.length > 0) return true;

    const possibleGroups = [
      payload?.home?.startingXI,
      payload?.home?.substitutes,
      payload?.away?.startingXI,
      payload?.away?.substitutes,
      payload?.home?.players,
      payload?.away?.players,
      payload?.data?.home?.startingXI,
      payload?.data?.away?.startingXI,
      payload?.response?.home?.startingXI,
      payload?.response?.away?.startingXI,
    ];

    return possibleGroups.some((group) => Array.isArray(group) && group.length > 0);
  }

  private emptyLineups(fixtureId: string, errors: string[] = []) {
    return {
      available: false,
      simulated: false,
      fixtureId,
      source: "none",
      message: "Escalação oficial ainda não disponível para este jogo.",
      lineups: [],
      errors,
    };
  }

  async getLineupsFromFlashScore(fixtureId: string) {
    const cachedRaw = await this.getFixtureFromCacheById(fixtureId);
    const cached = cachedRaw as any;
    const provider = String(cached?.provider || cached?.provedor || "").toLowerCase();

    if (!cached) {
      return {
        ok: false,
        data: null,
        error: `Fixture ${fixtureId} não encontrado no cache`,
      };
    }

    if (!provider.includes("flashscore")) {
      return {
        ok: false,
        data: null,
        error: `Fixture não é FlashScore. provider=${provider || "unknown"}`,
      };
    }

    const matchId = this.getFlashScoreMatchIdFromCachedFixture(cached);

    if (!matchId) {
      return {
        ok: false,
        data: null,
        error: `Fixture FlashScore sem match_id/externalId. fixtureId=${fixtureId}`,
      };
    }

    try {
      const response = await this.flashScoreService.getLineups(matchId);

      if (!response.ok || !response.data) {
        return {
          ok: false,
          data: null,
          error:
            response.error ||
            `FlashScore não retornou escalação para match_id=${matchId}`,
        };
      }

      const payload = response.data;
      const available = this.hasLineupPayload(payload);

      return {
        ok: available,
        data: {
          available,
          simulated: false,
          fixtureId,
          flashScoreId: matchId,
          source: "flashscore",
          message: available
            ? "Escalação real da FlashScore."
            : "FlashScore respondeu, mas sem escalação disponível.",
          lineups: this.lineupArrayFromAny(payload),
          raw: payload,
        },
        error: available
          ? null
          : `Sem escalação real na FlashScore para match_id=${matchId}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro ao buscar escalação FlashScore",
      };
    }
  }

  async getLineupsFromSportScore6(fixtureId: string) {
    const cachedRaw = await this.getFixtureFromCacheById(fixtureId);
    const cached = cachedRaw as any;

    if (!cached) {
      return {
        ok: false,
        data: null,
        error: `Fixture ${fixtureId} não encontrado no cache`,
      };
    }

    const provider = String(cached?.provider || cached?.provedor || "").toLowerCase();
    if (!provider.includes("sportscore6")) {
      return {
        ok: false,
        data: null,
        error: `Fixture não é SportScore6. provider=${provider || "unknown"}`,
      };
    }

    const slug = String(
      cached?.fixture?.externalId ||
        cached?.sportScore6Raw?.slug ||
        cached?.sportScore6Raw?.urlSlug ||
        "",
    ).trim();

    const trackerId = String(
      cached?.fixture?.trackerId || cached?.sportScore6Raw?.tracker?.id || "",
    ).trim();

    try {
      if (slug) {
        const bySlug = await this.sportScore6Service.getFixtureBySlug(slug);
        const lineups = (bySlug.data as any)?.lineups || null;

        if (bySlug.ok && this.hasLineupPayload(lineups)) {
          return {
            ok: true,
            data: {
              available: true,
              simulated: false,
              fixtureId,
              source: "sportscore6",
              message: "Escalação real da SportScore6.",
              lineups: this.lineupArrayFromAny(lineups),
              raw: lineups,
            },
            error: null,
          };
        }
      }

      if (trackerId) {
        const tracker = await this.sportScore6Service.getTracker(trackerId);
        const payload = tracker.data;

        if (tracker.ok && this.hasLineupPayload(payload)) {
          return {
            ok: true,
            data: {
              available: true,
              simulated: false,
              fixtureId,
              source: "sportscore6-tracker",
              message: "Escalação real da SportScore6 Tracker.",
              lineups: this.lineupArrayFromAny(payload),
              raw: payload,
            },
            error: null,
          };
        }

        return {
          ok: false,
          data: null,
          error: tracker.error || "Tracker SportScore6 sem escalação",
        };
      }

      return {
        ok: false,
        data: null,
        error: "SportScore6 sem slug/trackerId para buscar escalação",
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "Erro ao buscar escalação SportScore6",
      };
    }
  }

  async getLineups(fixtureId: string) {
    const errors: string[] = [];

    const flashScore = await this.getLineupsFromFlashScore(fixtureId);
    if (flashScore.ok && flashScore.data?.available) {
      return flashScore.data;
    }
    if (flashScore.error) errors.push(`FlashScore: ${flashScore.error}`);

    const sportScore6 = await this.getLineupsFromSportScore6(fixtureId);
    if (sportScore6.ok && sportScore6.data?.available) {
      return sportScore6.data;
    }
    if (sportScore6.error) errors.push(`SportScore6: ${sportScore6.error}`);

    return this.emptyLineups(fixtureId, errors);
  }



  private cleanPlayerPhoto(value: any) {
    const raw = String(value || "").trim().replace(/\s+/g, "");
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) return null;
    return raw;
  }

  private readLineupPlayerField(player: any, keys: string[], fallback: any = null) {
    for (const key of keys) {
      const value = player?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
    return fallback;
  }

  private normalizePlayerName(value: any) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s+\./g, ".")
      .trim();
  }

  private normalizeLineupPlayer(
    player: any,
    side: "home" | "away",
    teamName: string,
    index: number,
  ) {
    const name = this.normalizePlayerName(
      this.readLineupPlayerField(
        player,
        [
          "name",
          "nome",
          "fieldName",
          "field_name",
          "nomeDoCampo",
          "nome_campo",
          "nome do campo",
          "playerName",
          "player_name",
        ],
        "",
      ),
    );

    if (!name) return null;

    const number = String(
      this.readLineupPlayerField(
        player,
        ["number", "número", "numero", "shirtNumber", "shirt_number"],
        "",
      ),
    ).trim() || null;

    const playerId = String(
      this.readLineupPlayerField(
        player,
        ["player_id", "id_jogador", "playerId", "id"],
        "",
      ),
    ).trim() || `${side}-${index}-${name}`;

    const photo = this.cleanPlayerPhoto(
      this.readLineupPlayerField(
        player,
        [
          "image_path",
          "caminho_imagem",
          "photo",
          "foto",
          "playerPhoto",
          "image",
          "avatar",
        ],
        null,
      ),
    );

    const playerUrl = String(
      this.readLineupPlayerField(
        player,
        ["player_url", "url_jogador", "playerUrl", "url do jogador", "url", "profileUrl"],
        "",
      ),
    ).trim() || null;

    const country = String(
      this.readLineupPlayerField(
        player,
        ["country_name", "nome_país", "nome_pais", "país", "pais", "country"],
        "",
      ),
    ).trim() || null;

    // Quando a API não envia posição, a Oddix estima pela ordem da escalação.
    // 0 = goleiro, 1-4 defesa, 5-7 meio, 8-10 ataque.
    let role = "Meia";
    if (index === 0) role = "Goleiro";
    else if (index <= 4) role = "Defensor";
    else if (index <= 7) role = "Meia";
    else role = "Atacante";

    return {
      id: playerId,
      name,
      fieldName: this.normalizePlayerName(
        player?.fieldName ||
          player?.nomeDoCampo ||
          player?.nome_campo ||
          player?.["nome do campo"] ||
          name,
      ),
      number,
      photo,
      playerUrl,
      country,
      side,
      teamName,
      role,
      lineupIndex: index,
    };
  }

  private getLineupTeamName(cached: any, side: "home" | "away") {
    return String(
      cached?.teams?.[side]?.name || (side === "home" ? "Casa" : "Fora"),
    ).trim();
  }

  private extractPredictedPlayersFromLineups(lineupResult: any, cached: any) {
    const rows = Array.isArray(lineupResult?.lineups) ? lineupResult.lineups : [];
    const players: any[] = [];

    for (const row of rows) {
      const sideRaw = String(row?.side || row?.lado || "").toLowerCase();
      const side: "home" | "away" =
        sideRaw.includes("away") || sideRaw.includes("fora") ? "away" : "home";
      const teamName = this.getLineupTeamName(cached, side);
      const predicted =
        row?.predictedLineups ||
        row?.escalaçõesPrevistas ||
        row?.escalacoesPrevistas ||
        row?.startingXI ||
        row?.startXI ||
        row?.escalações_iniciais ||
        row?.escalacoes_iniciais ||
        row?.players ||
        [];

      if (!Array.isArray(predicted)) continue;

      predicted.forEach((player: any, index: number) => {
        const normalized = this.normalizeLineupPlayer(player, side, teamName, index);
        if (normalized) players.push(normalized);
      });
    }

    return players;
  }

  private playerRoleScore(player: any) {
    const role = String(player?.role || "").toLowerCase();
    const index = Number(player?.lineupIndex || 0);
    const hasPhoto = !!player?.photo;

    let score = 0;
    if (role.includes("atacante")) score += 100;
    if (role.includes("meia")) score += 55;
    if (hasPhoto) score += 25;
    score += Math.max(0, index);

    return score;
  }

  private selectBestPlayerPropCandidates(players: any[]) {
    const withPhoto = (players || [])
      .filter((player: any) => player?.photo)
      .filter((player: any) => !["Goleiro", "Defensor"].includes(String(player?.role || "")))
      .sort((a: any, b: any) => this.playerRoleScore(b) - this.playerRoleScore(a));

    // Regra profissional Oddix: sem foto real, não exibe Player Props no dashboard.
    return withPhoto.slice(0, 3);
  }

  private buildPropForLineupPlayer(player: any, fixtureId: string, cached: any, index: number) {
    const quality = Number(cached?.oddix?.qualityScore || 84);
    const role = String(player?.role || "");
    const isAttacker = role === "Atacante";

    const marketRotation = ["Chutes no Gol", "Finalizações", "Participação em Gol"];
    const market = marketRotation[index % marketRotation.length];

    const tip =
      market === "Finalizações"
        ? `${player.name} Over 1.5 finalizações`
        : market === "Participação em Gol"
          ? `${player.name} 1+ participação em gol`
          : `${player.name} Over 0.5 chute no gol`;

    const odd =
      market === "Finalizações"
        ? isAttacker ? 1.76 : 1.88
        : market === "Participação em Gol"
          ? isAttacker ? 2.25 : 2.55
          : isAttacker ? 1.72 : 1.86;

    const confidence = Math.max(
      78,
      Math.min(
        90,
        Math.round(
          (quality || 82) -
            (market === "Participação em Gol" ? 4 : 0) +
            (isAttacker ? 3 : 1),
        ),
      ),
    );

    return {
      key: `lineup_player_prop_${fixtureId}_${player.id}_${index}`,
      category: "Player Props",
      market,
      marketName: market,
      player: player.name,
      playerName: player.name,
      playerId: player.id,
      playerPhoto: player.photo,
      photo: player.photo,
      playerUrl: player.playerUrl,
      playerNumber: player.number,
      playerRole: player.role,
      playerTeam: player.teamName,
      teamName: player.teamName,
      side: player.side,
      tip,
      selection: tip,
      odd: Number(odd.toFixed(2)),
      confidence,
      risk: confidence >= 84 ? "Baixo" : "Médio",
      source: "flashscore-lineups",
      bookmaker: "Oddix estimada com escalação real",
      oddsSource: "oddix-lineup-estimated",
      isRealLineup: true,
      isEstimated: false,
      fixtureId,
      game: `${cached?.teams?.home?.name || "Casa"} x ${cached?.teams?.away?.name || "Fora"}`,
      homeTeam: cached?.teams?.home?.name || "Casa",
      awayTeam: cached?.teams?.away?.name || "Fora",
      league: cached?.league?.name || "Liga",
      teamLogo: cached?.teams?.[player.side]?.logo || null,
      reason: `Player Prop gerada apenas porque existe escalação real. Jogador: ${player.name}, função provável: ${player.role}.`,
    };
  }

  async getPlayerProps(fixtureId: string) {
    const cachedRaw = await this.getFixtureFromCacheById(fixtureId);
    const cached = cachedRaw ? this.standardizeFixture(cachedRaw) : null;

    if (!cached) {
      return {
        available: false,
        simulated: false,
        fixtureId,
        source: "none",
        message: `Fixture ${fixtureId} não encontrado no cache.`,
        playerProps: [],
        players: [],
      };
    }

    const lineup: any = await this.getLineups(fixtureId);

    if (!lineup?.available) {
      return {
        available: false,
        simulated: false,
        fixtureId,
        source: "none",
        message: "Player Props indisponível: escalação oficial ainda não disponível.",
        playerProps: [],
        players: [],
        lineups: [],
        errors: lineup && "errors" in lineup ? lineup.errors : [],
      };
    }

    const allPlayers = this.extractPredictedPlayersFromLineups(lineup, cached)
      .filter((player: any) => !["Goleiro", "Defensor"].includes(String(player?.role || "")))
      .sort((a: any, b: any) => this.playerRoleScore(b) - this.playerRoleScore(a));

    const selected = this.selectBestPlayerPropCandidates(allPlayers);
    const playerProps = selected.map((player: any, index: number) =>
      this.buildPropForLineupPlayer(player, fixtureId, cached, index),
    );

    return {
      available: playerProps.length > 0,
      simulated: false,
      fixtureId,
      source: lineup.source || "flashscore-lineups",
      message: playerProps.length
        ? "Top 3 Player Props geradas com escalação real, atacantes priorizados e foto real obrigatória."
        : "Escalação encontrada, mas sem jogadores ofensivos com foto real para exibir Player Props.",
      game: `${cached?.teams?.home?.name || "Casa"} x ${cached?.teams?.away?.name || "Fora"}`,
      homeTeam: cached?.teams?.home?.name || "Casa",
      awayTeam: cached?.teams?.away?.name || "Fora",
      league: cached?.league?.name || "Liga",
      playerProps,
      players: allPlayers.map((player: any) => ({
        id: player.id,
        name: player.name,
        fieldName: player.fieldName,
        number: player.number,
        photo: player.photo,
        playerUrl: player.playerUrl,
        country: player.country,
        side: player.side,
        teamName: player.teamName,
        role: player.role,
        lineupIndex: player.lineupIndex,
      })),
      lineups: lineup.lineups || [],
    };
  }



  private shouldUseSoccerFootballInfoStatsForFixture(cached: any) {
    const provider = String(cached?.provider || cached?.provedor || "").toLowerCase();

    // SoccerFootballInfo usa IDs próprios. Quando o jogo vem da FlashScore/AllScores,
    // chamar SoccerFootballInfo com fixtureId de outro provider gera 400 e derruba a leitura.
    if (provider.includes("soccer-football-info")) return true;

    return String(process.env.ODDIX_STATISTICS_USE_SOCCER_INFO_ANY_ID || "false").toLowerCase() === "true";
  }

  private buildLiveContextStatisticsFromCachedFixture(fixtureId: string, cachedRaw: any, errors: string[] = []) {
    /**
     * V28 PROFISSIONAL:
     * Esta função existia como fallback de placar/minuto, mas o usuário decidiu:
     * "sem estatística real = sem palpite".
     *
     * Portanto, ela NÃO pode mais retornar available=true com apenas placar/minuto.
     * Placar ao vivo ajuda no dashboard, mas não é estatística profissional para entrada.
     */
    return null;
  }

  private emptyRealStatistics(fixtureId: string, reason: string) {
    return {
      available: false,
      simulated: false,
      fixtureId,
      source: "none",
      message: `Estatísticas reais indisponíveis. ${reason}`,
      teams: [],
    };
  }

  private isRealStatisticsPayload(stats: any) {
    if (!stats) return false;
    if (stats.simulated === true) return false;
    if (stats.available === false) return false;
    if (!Array.isArray(stats.teams) || stats.teams.length < 2) return false;

    return stats.teams.some((team: any) => {
      const rows = team?.statistics || team?.stats || [];
      return Array.isArray(rows) && rows.length > 0;
    });
  }

  async getStatistics(fixtureId: string) {
    const errors: string[] = [];
    const cachedRaw: any = await this.getFixtureFromCacheById(fixtureId);
    const cached = cachedRaw ? this.standardizeFixture(cachedRaw) : null;
    const provider = String(cached?.provider || "").toLowerCase();

    /**
     * Ordem oficial V27.1:
     * 1) FlashScore quando o fixture é FlashScore
     * 2) SportScore6 quando o fixture é SportScore6
     * 3) SportScore legado
     * 4) SoccerFootballInfo somente quando o ID pertence a ele
     * 5) API-Football último fallback, quando habilitado
     * 6) se nenhuma fonte real retornar estatísticas, retorna available=false
     *
     * Motivo: IDs da FlashScore/AllScores enviados para SoccerFootballInfo retornam 400.
     * Isso deixava a IA sem leitura e gerava NO_BET mesmo em jogos premium da Série B.
     */

    if (provider.includes("flashscore")) {
      const flashScore = await this.getStatisticsFromFlashScore(fixtureId);

      if (flashScore.ok && this.isRealStatisticsPayload(flashScore.data)) {
        return {
          ...flashScore.data,
          available: true,
          simulated: false,
          source: "flashscore",
          message: flashScore.data?.message || "Estatísticas reais da FlashScore.",
        };
      }

      if (flashScore.error) errors.push(`FlashScore: ${flashScore.error}`);
    }

    if (provider.includes("sportscore6")) {
      const sportScore6 = await this.getStatisticsFromSportScore6(fixtureId);

      if (sportScore6.ok && this.isRealStatisticsPayload(sportScore6.data)) {
        return {
          ...sportScore6.data,
          available: true,
          simulated: false,
          source: sportScore6.data?.source || "sportscore6",
          message: sportScore6.data?.message || "Estatísticas reais da SportScore6.",
        };
      }

      if (sportScore6.error) errors.push(`SportScore6: ${sportScore6.error}`);
    }

    const sportScore = await this.getStatisticsFromSportScore(fixtureId);

    if (sportScore.ok && this.isRealStatisticsPayload(sportScore.data)) {
      return {
        ...sportScore.data,
        available: true,
        simulated: false,
        source: sportScore.data?.source || "sportscore",
        message: sportScore.data?.message || "Estatísticas reais da SportScore.",
      };
    }

    if (sportScore.error) errors.push(`SportScore: ${sportScore.error}`);

    if (this.shouldUseSoccerFootballInfoStatsForFixture(cached)) {
      const soccerFootballInfo = await this.getStatisticsFromSoccerFootballInfo(fixtureId);

      if (soccerFootballInfo.ok && this.isRealStatisticsPayload(soccerFootballInfo.data)) {
        return {
          ...soccerFootballInfo.data,
          available: true,
          simulated: false,
          source: soccerFootballInfo.data?.source || "soccer-football-info",
          message: soccerFootballInfo.data?.message || "Estatísticas reais da Soccer Football Info.",
        };
      }

      if (soccerFootballInfo.error) errors.push(`Soccer Football Info: ${soccerFootballInfo.error}`);
    } else if (cached) {
      errors.push(`Soccer Football Info pulada: provider=${provider || "unknown"} usa ID incompatível`);
    }

    if (this.shouldUseApiFootballFallback()) {
      const apiFootball = await this.getStatisticsFromApiFootball(fixtureId);

      if (apiFootball.ok && this.isRealStatisticsPayload(apiFootball.data)) {
        return {
          ...apiFootball.data,
          available: true,
          simulated: false,
          source: "api-football",
          message: apiFootball.data?.message || "Estatísticas reais da API-Football.",
        };
      }

      if (apiFootball.error) errors.push(`API-Football: ${apiFootball.error}`);
    }

    // V28: sem estatística real não existe fallback por placar/minuto.
    // Isso mantém o padrão profissional: sem stats reais = NO_BET/sem envio.
    return this.emptyRealStatistics(
      fixtureId,
      errors.length ? errors.join(" | ") : "Nenhuma fonte retornou dados oficiais.",
    );
  }

  async debug(date?: string) {
    await this.cleanupDashboardCache(false);

    date = this.normalizeDateKey(date);

    const cache = await this.getFixturesFromCache(date);
    const flashScore = await this.getFixturesFromFlashScore(date);
    const flashScoreLive = await this.getLiveFixturesFromFlashScore();
    const sportScore6 = await this.getFixturesFromSportScore6(date);
    const sportScore6Live = await this.getLiveFixturesFromSportScore6();
    const soccerFootballInfo = await this.getFixturesFromSoccerFootballInfo(date);
    const soccerFootballInfoLive = await this.getLiveFixturesFromSoccerFootballInfo();
    const sportScore = await this.getFixturesFromSportScore(date);
    const sportScoreLive = await this.getLiveFixturesFromSportScore();
    const allScores = await this.getFixturesFromAllScores(date);
    const allScoresLive = await this.getLiveFixturesFromAllScores(date);
    const sportsDb = await this.getFixturesFromSportsDb(date);
    const sportmonks = await this.getFixturesFromSportmonks(date);
    const footballData = await this.getFixturesFromFootballData(date);

    let apiFootball = { ok: false, data: [], error: "Poupada no debug" } as any;
    let apiFootballLive = {
      ok: false,
      data: [],
      error: "Poupada no debug",
    } as any;

    if (process.env.API_FOOTBALL_DEBUG_FORCE === "true") {
      apiFootball = await this.getFixturesFromApiFootball(date);
      apiFootballLive = await this.getLiveFixturesFromApiFootball();
    }

    const live = await this.getLiveFixtures();

    return {
      date,
      soccerFootballInfoEnabled: this.soccerFootballInfoService.isEnabled(),
      soccerFootballInfoKeyExists: this.soccerFootballInfoService.hasKey(),
      soccerFootballInfoBaseUrl: this.soccerFootballInfoService.getBaseUrl(),
      sportScore6Enabled: this.sportScore6Service.isEnabled(),
      sportScore6KeyExists: this.sportScore6Service.hasKey(),
      sportScore6BaseUrl: this.sportScore6Service.getBaseUrl(),
      sportScoreEnabled: this.sportScoreService.isEnabled(),
      sportScoreKeyExists: this.sportScoreService.hasKey(),
      sportScoreBaseUrl: this.sportScoreService.getBaseUrl(),
      apiFootballKeyExists: !!this.getApiFootballKey(),
      apiFootballFallbackEnabled: this.shouldUseApiFootballFallback(),
      sportmonksKeyExists: !!this.getSportmonksKey(),
      footballDataKeyExists: !!this.getFootballDataKey(),
      sportsDbKeyExists: !!this.getSportsDbKey(),
      allScoresEnabled: this.allScoresService.isEnabled(),
      allScoresKeyExists: this.allScoresService.hasKey(),
      flashScoreEnabled: this.flashScoreService.isEnabled(),
      flashScoreKeyExists: this.flashScoreService.hasKey(),
      apiFootballDisabled:
        process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === "true",
      apiFootballBlockedUntil:
        this.apiFootballBlockedUntil?.toISOString() || null,
      liveCacheSeconds: this.liveCacheSeconds(),
      fixturesCacheMinutes: this.fixturesCacheMinutes(),
      note: "API-Football só é consultada se API_FOOTBALL_ENABLE_FALLBACK=true ou API_FOOTBALL_DEBUG_FORCE=true. Ordem: FlashScore > Soccer Football Info > SportScore6 > SportScore > AllScores > TheSportsDB/cache > API-Football opcional > Sportmonks > FootballData.",

      cache: {
        responseLength: cache.length,
        sample: this.compactFixtures(cache.slice(0, 2)),
      },

      soccerFootballInfo: {
        ok: soccerFootballInfo.ok,
        error: soccerFootballInfo.error,
        responseLength: this.filterAllowedLeagues(soccerFootballInfo.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(soccerFootballInfo.data).slice(0, 3),
        ),
      },

      soccerFootballInfoLive: {
        ok: soccerFootballInfoLive.ok,
        error: soccerFootballInfoLive.error,
        responseLength: this.filterAllowedLeagues(soccerFootballInfoLive.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(soccerFootballInfoLive.data).slice(0, 3),
        ),
      },

      sportScore6: {
        ok: sportScore6.ok,
        error: sportScore6.error,
        responseLength: this.filterAllowedLeagues(sportScore6.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(sportScore6.data).slice(0, 3),
        ),
      },

      sportScore6Live: {
        ok: sportScore6Live.ok,
        error: sportScore6Live.error,
        responseLength: this.filterAllowedLeagues(sportScore6Live.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(sportScore6Live.data).slice(0, 3),
        ),
      },

      sportScore: {
        ok: sportScore.ok,
        error: sportScore.error,
        responseLength: this.filterAllowedLeagues(sportScore.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(sportScore.data).slice(0, 3),
        ),
      },

      sportScoreLive: {
        ok: sportScoreLive.ok,
        error: sportScoreLive.error,
        responseLength: this.filterAllowedLeagues(sportScoreLive.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(sportScoreLive.data).slice(0, 3),
        ),
      },

      flashScore: {
        ok: flashScore.ok,
        error: flashScore.error,
        responseLength: this.filterAllowedLeagues(flashScore.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(flashScore.data).slice(0, 2),
        ),
      },

      flashScoreLive: {
        ok: flashScoreLive.ok,
        error: flashScoreLive.error,
        responseLength: this.filterAllowedLeagues(flashScoreLive.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(flashScoreLive.data).slice(0, 3),
        ),
      },

      allScores: {
        ok: allScores.ok,
        error: allScores.error,
        responseLength: this.filterAllowedLeagues(allScores.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(allScores.data).slice(0, 2),
        ),
      },

      allScoresLive: {
        ok: allScoresLive.ok,
        error: allScoresLive.error,
        responseLength: this.filterAllowedLeagues(allScoresLive.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(allScoresLive.data).slice(0, 3),
        ),
      },

      sportsDb: {
        ok: sportsDb.ok,
        error: sportsDb.error,
        responseLength: this.filterAllowedLeagues(sportsDb.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(sportsDb.data).slice(0, 2),
        ),
      },

      apiFootball: {
        ok: apiFootball.ok,
        error: apiFootball.error,
        responseLength: this.filterAllowedLeagues(apiFootball.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(apiFootball.data).slice(0, 2),
        ),
      },

      apiFootballLive: {
        ok: apiFootballLive.ok,
        error: apiFootballLive.error,
        responseLength: this.filterAllowedLeagues(apiFootballLive.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(apiFootballLive.data).slice(0, 3),
        ),
      },

      sportmonks: {
        ok: sportmonks.ok,
        error: sportmonks.error,
        responseLength: this.filterAllowedLeagues(sportmonks.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(sportmonks.data).slice(0, 2),
        ),
      },

      footballData: {
        ok: footballData.ok,
        error: footballData.error,
        responseLength: this.filterAllowedLeagues(footballData.data).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(footballData.data).slice(0, 2),
        ),
      },

      live: {
        responseLength: this.filterAllowedLeagues(live).length,
        sample: this.compactFixtures(
          this.filterAllowedLeagues(live).slice(0, 3),
        ),
      },
    };
  }
}
