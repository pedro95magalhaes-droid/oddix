import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AllScoresService } from './allscores.service';
import { FlashScoreService } from './flashscore.service';
import { SportScoreService } from './sportscore.service';
import { SportScore6Service } from './sportscore6.service';
import {
  getOddixFixtureDate,
  isOddixDashboardFixtureAllowed,
  isOddixFinishedFixture,
  isOddixLeagueAllowed,
} from './league-filter';

@Injectable()
export class FootballService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sportScoreService: SportScoreService,
    private readonly sportScore6Service: SportScore6Service,
    private readonly allScoresService: AllScoresService,
    private readonly flashScoreService: FlashScoreService,
  ) {}

  private apiFootballURL = 'https://v3.football.api-sports.io';
  private sportmonksURL = 'https://api.sportmonks.com/v3/football';
  private footballDataURL = 'https://api.football-data.org/v4';
  private sportsDbURL = 'https://www.thesportsdb.com/api/v1/json';
  private apiFootballBlockedUntil: Date | null = null;
  private cacheCleanupRunning = false;
  private lastCacheCleanupAt = 0;

  private getApiFootballKey() {
    return process.env.API_FOOTBALL_KEY || '';
  }

  private getSportmonksKey() {
    return process.env.SPORTMONKS_API_KEY || '';
  }

  private getFootballDataKey() {
    return process.env.FOOTBALL_DATA_KEY || '';
  }

  private getSportsDbKey() {
    return process.env.THESPORTSDB_KEY || '123';
  }

  private liveCacheSeconds() {
    return Number(process.env.FOOTBALL_LIVE_CACHE_SECONDS || 120);
  }

  private fixturesCacheMinutes() {
    return Number(process.env.FOOTBALL_FIXTURES_CACHE_MINUTES || 30);
  }

  private hideFinishedAfterHours() {
    return Number(process.env.ODDIX_DASHBOARD_HIDE_FINISHED_AFTER_HOURS || 0);
  }

  private filterAllowedLeagues(fixtures: any[]) {
    return (fixtures || []).filter((item: any) => isOddixLeagueAllowed(item));
  }

  private filterDashboardFixtures(fixtures: any[]) {
    const showFinished = process.env.ODDIX_DASHBOARD_SHOW_FINISHED === 'true';

    return (fixtures || []).filter((item: any) => {
      if (!showFinished && isOddixFinishedFixture(item)) return false;
      return isOddixDashboardFixtureAllowed(item, this.hideFinishedAfterHours());
    });
  }

  private apiFootballCooldownMinutes() {
    return Number(process.env.API_FOOTBALL_COOLDOWN_MINUTES || 30);
  }

  private isApiFootballBlocked() {
    if (process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === 'true') return true;
    if (!this.apiFootballBlockedUntil) return false;
    return this.apiFootballBlockedUntil.getTime() > Date.now();
  }

  private blockApiFootballTemporarily() {
    this.apiFootballBlockedUntil = new Date(
      Date.now() + this.apiFootballCooldownMinutes() * 60 * 1000,
    );
  }

  private shouldUseApiFootballFallback() {
    return process.env.API_FOOTBALL_ENABLE_FALLBACK === 'true';
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

    if (!input || typeof input !== 'object') {
      return input;
    }

    const rawKeysToRemove = new Set([
      'flashScoreRaw',
      'sportScoreRaw',
      'sportScore6Raw',
      'allScoresRaw',
      'apiFootballRaw',
      'broadageRaw',
      'sportsDbRaw',
      'footballDataRaw',
      'sportmonksRaw',
      'rawData',
      'rawResponse',
    ]);

    const output: any = Array.isArray(input) ? [] : {};

    for (const [key, value] of Object.entries(input as any)) {
      if (rawKeysToRemove.has(key)) continue;

      // Segurança extra para providers que mudam o nome do campo bruto.
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.endsWith('raw') || normalizedKey.includes('raw_')) continue;

      output[key] = value;
    }

    return output as T;
  }

  private compactFixtures(fixtures: any[]) {
    return (fixtures || []).map((item) => this.stripRawProviderData(item));
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
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(safeDate);

    const year =
      parts.find((part) => part.type === 'year')?.value ||
      String(safeDate.getUTCFullYear());

    const month =
      parts.find((part) => part.type === 'month')?.value ||
      String(safeDate.getUTCMonth() + 1).padStart(2, '0');

    const day =
      parts.find((part) => part.type === 'day')?.value ||
      String(safeDate.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private normalizeDateKey(date?: string | null) {
    const raw = String(date || '').trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parsed = new Date(`${raw}T12:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) return raw;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('/');
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
    const msg = JSON.stringify(error?.response?.data || error?.message || '').toLowerCase();

    return (
      msg.includes('limit') ||
      msg.includes('quota') ||
      msg.includes('too many') ||
      msg.includes('rate') ||
      msg.includes('requests')
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
      provider: 'api-football',
      fixture: {
        id: Number(fixture.id || 0),
        date: fixture.date || new Date().toISOString(),
        timestamp: fixture.timestamp ?? null,
        timezone: fixture.timezone || 'UTC',
        status: {
          long: status.long || 'Unknown',
          short: status.short || 'UNK',
          elapsed: status.elapsed ?? null,
          extra: status.extra ?? null,
        },
      },
      league: {
        id: Number(league.id || 0),
        name: league.name || 'Liga não informada',
        country: league.country || '',
        logo: league.logo || '',
      },
      teams: {
        home: {
          id: Number(teams.home?.id || 0),
          name: teams.home?.name || '',
          logo: teams.home?.logo || '',
          winner: teams.home?.winner ?? null,
        },
        away: {
          id: Number(teams.away?.id || 0),
          name: teams.away?.name || '',
          logo: teams.away?.logo || '',
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
    const homeScore = match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? null;
    const awayScore = match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? null;

    const statusMap: Record<string, { long: string; short: string }> = {
      SCHEDULED: { long: 'Not Started', short: 'NS' },
      TIMED: { long: 'Not Started', short: 'NS' },
      IN_PLAY: { long: 'In Play', short: 'LIVE' },
      PAUSED: { long: 'Halftime', short: 'HT' },
      FINISHED: { long: 'Match Finished', short: 'FT' },
      POSTPONED: { long: 'Postponed', short: 'PST' },
      SUSPENDED: { long: 'Suspended', short: 'SUSP' },
      CANCELED: { long: 'Canceled', short: 'CANC' },
    };

    const status = statusMap[match.status] || {
      long: match.status || 'Unknown',
      short: match.status || 'UNK',
    };

    return {
      provider: 'football-data',
      fixture: {
        id: Number(match.id),
        date: match.utcDate,
        timezone: 'UTC',
        status: { long: status.long, short: status.short, elapsed: null },
      },
      league: {
        id: Number(match.competition?.id || 0),
        name: match.competition?.name || 'Liga não informada',
        country: match.area?.name || '',
        logo: match.competition?.emblem || '',
      },
      teams: {
        home: {
          id: Number(match.homeTeam?.id || 0),
          name: match.homeTeam?.name || '',
          logo: match.homeTeam?.crest || '',
          winner: match.score?.winner === 'HOME_TEAM',
        },
        away: {
          id: Number(match.awayTeam?.id || 0),
          name: match.awayTeam?.name || '',
          logo: match.awayTeam?.crest || '',
          winner: match.score?.winner === 'AWAY_TEAM',
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
      provider: 'thesportsdb',
      fixture: {
        id: Number(event.idEvent),
        date: `${event.dateEvent}T${event.strTime || '00:00:00'}`,
        timezone: 'UTC',
        status: {
          long: finished ? 'Match Finished' : 'Not Started',
          short: finished ? 'FT' : 'NS',
          elapsed: null,
        },
      },
      league: {
        id: Number(event.idLeague || 0),
        name: event.strLeague || 'Liga não informada',
        country: event.strCountry || '',
        logo: event.strLeagueBadge || '',
      },
      teams: {
        home: {
          id: Number(event.idHomeTeam || 0),
          name: event.strHomeTeam || '',
          logo: event.strHomeTeamBadge || '',
          winner: finished ? homeScore > awayScore : null,
        },
        away: {
          id: Number(event.idAwayTeam || 0),
          name: event.strAwayTeam || '',
          logo: event.strAwayTeamBadge || '',
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
        (t: any) => t?.meta?.location === 'home' || t?.pivot?.location === 'home',
      ) || participants[0];

    const away =
      participants.find(
        (t: any) => t?.meta?.location === 'away' || t?.pivot?.location === 'away',
      ) || participants[1];

    const scores = item.scores || [];

    const getScore = (location: 'home' | 'away') => {
      const found =
        scores.find((s: any) => s?.score?.participant === location) ||
        scores.find((s: any) => s?.participant?.meta?.location === location);

      return found?.score?.goals ?? null;
    };

    const state = item.state || {};

    return {
      provider: 'sportmonks',
      fixture: {
        id: Number(item.id),
        date: item.starting_at,
        timezone: 'UTC',
        status: {
          long: state.name || state.short_name || 'Not Started',
          short: state.short_name || 'NS',
          elapsed: item.periods?.[0]?.minutes || null,
        },
      },
      league: {
        id: Number(item.league_id || 0),
        name: item.league?.name || 'Liga não informada',
        country: item.league?.country?.name || '',
        logo: item.league?.image_path || '',
      },
      teams: {
        home: {
          id: Number(home?.id || 0),
          name: home?.name || '',
          logo: home?.image_path || '',
          winner: null,
        },
        away: {
          id: Number(away?.id || 0),
          name: away?.name || '',
          logo: away?.image_path || '',
          winner: null,
        },
      },
      goals: { home: getScore('home'), away: getScore('away') },
      score: { fulltime: { home: getScore('home'), away: getScore('away') } },
    };
  }

  private isFinishedStatus(short?: string, long?: string) {
    const s = String(short || '').toUpperCase();
    const l = String(long || '').toLowerCase();

    return (
      ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST'].includes(s) ||
      l.includes('finished') ||
      l.includes('final') ||
      l.includes('after extra time') ||
      l.includes('after penalties') ||
      l.includes('walkover') ||
      l.includes('cancelled') ||
      l.includes('canceled') ||
      l.includes('abandoned') ||
      l.includes('postponed')
    );
  }

  private isLiveStatus(short?: string, long?: string) {
    const s = String(short || '').toUpperCase();
    const l = String(long || '').toLowerCase();

    return (
      ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'PEN_LIVE'].includes(s) ||
      l.includes('live') ||
      l.includes('in play') ||
      l.includes('1st half') ||
      l.includes('2nd half') ||
      l.includes('halftime') ||
      l.includes('half-time')
    );
  }

  private shouldTreatAsLive(item: any) {
    const short = String(item?.fixture?.status?.short || '').toUpperCase();
    const long = String(item?.fixture?.status?.long || '');
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

    const short = String(item.fixture.status.short || '').toUpperCase();
    const long = String(item.fixture.status.long || '');

    if (short === 'IN_PLAY') {
      item.fixture.status.short = 'LIVE';
      item.fixture.status.long = 'In Play';
    }

    if (this.isLiveStatus(short, long) && !['LIVE', 'HT', '1H', '2H'].includes(short)) {
      item.fixture.status.short = 'LIVE';
    }

    return item;
  }

  private shouldCacheFixture(item: any) {
    if (!item) return false;
    if (!isOddixLeagueAllowed(item)) return false;

    // Por padrão, jogo encerrado/adiado/cancelado não fica no cache do Dashboard.
    // Se um dia precisar manter finalizados por auditoria, use ODDIX_CACHE_FINISHED_FIXTURES=true.
    const allowFinishedCache = process.env.ODDIX_CACHE_FINISHED_FIXTURES === 'true';
    if (!allowFinishedCache && isOddixFinishedFixture(item)) return false;

    const rawDate = getOddixFixtureDate(item);
    if (!rawDate) return false;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return false;

    // Evita cache de jogo antigo travado como NS/LIVE por erro de provider.
    const maxPastHours = Number(process.env.ODDIX_CACHE_MAX_PAST_HOURS || 8);
    const ageHours = (Date.now() - parsed.getTime()) / 1000 / 60 / 60;
    if (ageHours > maxPastHours) return false;

    return true;
  }

  private async saveFixturesCache(fixtures: any[]) {
    fixtures = (fixtures || []).filter((item: any) => this.shouldCacheFixture(item));
    if (!fixtures?.length) return;

    await Promise.all(
      fixtures.map((item: any) => {
        const fixtureId = String(item?.fixture?.id || '');
        if (!fixtureId) return null;

        const cleanItem = this.stripRawProviderData(item);
        const stampedRaw = this.withCacheStamp(cleanItem);

        return this.prisma.cachedFixture.upsert({
          where: { fixtureId },
          update: {
            provider: item.provider || 'unknown',
            date: item.fixture?.date && !Number.isNaN(new Date(item.fixture.date).getTime()) ? new Date(item.fixture.date) : null,
            league: item.league?.name || null,
            country: item.league?.country || null,
            homeTeam: item.teams?.home?.name || '',
            awayTeam: item.teams?.away?.name || '',
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
            provider: item.provider || 'unknown',
            date: item.fixture?.date && !Number.isNaN(new Date(item.fixture.date).getTime()) ? new Date(item.fixture.date) : null,
            league: item.league?.name || null,
            country: item.league?.country || null,
            homeTeam: item.teams?.home?.name || '',
            awayTeam: item.teams?.away?.name || '',
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

    const cached = await this.prisma.cachedFixture.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return this.filterAllowedLeagues(cached.map((item) => this.stripRawProviderData(item.raw)));
  }

  private async getFreshFixturesFromCache(date?: string, maxAgeMinutes = this.fixturesCacheMinutes()) {
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
      league: raw?.league || raw?.liga || {
        name: record?.league || '',
        country: record?.country || '',
      },
      fixture: raw?.fixture || raw?.jogo || {
        date: record?.date || null,
        status: {
          short: record?.statusShort || '',
          long: record?.statusLong || '',
        },
      },
    };

    if (!isOddixLeagueAllowed(fixtureLike)) return true;
    if (isOddixFinishedFixture(fixtureLike)) return true;

    const rawDate = getOddixFixtureDate(fixtureLike) || record?.date;
    if (!rawDate) return true;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return true;

    const maxPastHours = Number(process.env.ODDIX_CACHE_MAX_PAST_HOURS || 8);
    const ageHours = (Date.now() - parsed.getTime()) / 1000 / 60 / 60;

    return ageHours > maxPastHours;
  }

  async cleanupDashboardCache(force = false) {
    const now = Date.now();
    const intervalMs = Number(process.env.ODDIX_CACHE_CLEANUP_INTERVAL_SECONDS || 60) * 1000;

    if (!force && this.lastCacheCleanupAt && now - this.lastCacheCleanupAt < intervalMs) {
      return {
        success: true,
        skipped: true,
        reason: 'Limpeza recente. Aguardando intervalo.',
        checked: 0,
        deleted: 0,
      };
    }

    if (this.cacheCleanupRunning) {
      return {
        success: true,
        skipped: true,
        reason: 'Limpeza já em execução.',
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
        message: 'Cache do Dashboard limpo. Jogos encerrados, antigos e ligas ruins foram removidos.',
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
      message: 'Cache de jogos limpo totalmente.',
    };
  }


  async getFixturesFromSportScore6(date?: string) {
    try {
      return await this.sportScore6Service.getFixtures(date);
    } catch (error: any) {
      return { ok: false, data: [], error: error?.message || 'Erro na SportScore6' };
    }
  }

  async getLiveFixturesFromSportScore6() {
    try {
      return await this.sportScore6Service.getLiveFixtures();
    } catch (error: any) {
      return { ok: false, data: [], error: error?.message || 'Erro na SportScore6 Live' };
    }
  }

  async getFixtureBySlugFromSportScore6(slug: string) {
    try {
      return await this.sportScore6Service.getFixtureBySlug(slug);
    } catch (error: any) {
      return { ok: false, data: null, error: error?.message || 'Erro na SportScore6 por slug' };
    }
  }

  async getStatisticsFromSportScore6(fixtureId: string) {
    try {
      const cached: any = await this.getFixtureFromCacheById(fixtureId);
      const slug = cached?.fixture?.externalId || cached?.sportScore6Raw?.slug || cached?.sportScore6Raw?.urlSlug || null;

      if (!slug) {
        return { ok: false, data: null, error: 'SportScore6 precisa do slug salvo no cache para buscar estatísticas' };
      }

      return await this.sportScore6Service.getStatistics(slug);
    } catch (error: any) {
      return { ok: false, data: null, error: error?.message || 'Erro nas estatísticas SportScore6' };
    }
  }


  async getFixturesFromSportScore(date: string) {
    try {
      return await this.sportScoreService.getFixtures(date);
    } catch (error: any) {
      return { ok: false, data: [], error: error?.message || 'Erro na SportScore' };
    }
  }

  async getLiveFixturesFromSportScore() {
    try {
      return await this.sportScoreService.getLiveFixtures();
    } catch (error: any) {
      return { ok: false, data: [], error: error?.message || 'Erro na SportScore Live' };
    }
  }

  async getFixtureByIdFromSportScore(fixtureId: string) {
    try {
      return await this.sportScoreService.getFixtureById(fixtureId);
    } catch (error: any) {
      return { ok: false, data: null, error: error?.message || 'Erro na SportScore por ID' };
    }
  }

  async getStatisticsFromSportScore(fixtureId: string) {
    try {
      return await this.sportScoreService.getStatistics(fixtureId);
    } catch (error: any) {
      return { ok: false, data: null, error: error?.message || 'Erro nas estatísticas SportScore' };
    }
  }

  async getFixturesFromApiFootball(date: string) {
    if (this.isApiFootballBlocked()) {
      return { ok: false, data: [], error: 'API-Football em cooldown temporário por limite/erro' };
    }

    const apiKey = this.getApiFootballKey();
    if (!apiKey) return { ok: false, data: [], error: 'API_FOOTBALL_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.apiFootballURL}/fixtures`, {
        timeout: 12000,
        headers: { 'x-apisports-key': apiKey },
        params: {
          date,
          timezone: 'America/Sao_Paulo',
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
          'Erro na API-Football',
      };
    }
  }

  async getLiveFixturesFromApiFootball() {
    if (this.isApiFootballBlocked()) {
      return { ok: false, data: [], error: 'API-Football em cooldown temporário por limite/erro' };
    }

    const apiKey = this.getApiFootballKey();
    if (!apiKey) return { ok: false, data: [], error: 'API_FOOTBALL_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.apiFootballURL}/fixtures`, {
        timeout: 12000,
        headers: { 'x-apisports-key': apiKey },
        params: {
          live: 'all',
          timezone: 'America/Sao_Paulo',
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
          'Erro na API-Football Live',
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
        error: error?.message || 'Erro na AllScores',
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
        error: error?.message || 'Erro na AllScores Live',
      };
    }
  }


  async getFixturesFromFlashScore(date: string) {
    try {
      return await this.flashScoreService.getFixtures(date);
    } catch (error: any) {
      return { ok: false, data: [], error: error?.message || 'Erro na FlashScore' };
    }
  }

  async getLiveFixturesFromFlashScore() {
    try {
      return await this.flashScoreService.getLiveFixtures();
    } catch (error: any) {
      return { ok: false, data: [], error: error?.message || 'Erro na FlashScore Live' };
    }
  }

  async getFixtureByIdFromAllScores(fixtureId: string) {
    try {
      return await this.allScoresService.getGameDetails(fixtureId);
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || 'Erro na AllScores por ID',
      };
    }
  }

  async getFixturesFromSportmonks(date: string) {
    const apiKey = this.getSportmonksKey();
    if (!apiKey) return { ok: false, data: [], error: 'SPORTMONKS_API_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.sportmonksURL}/fixtures/date/${date}`, {
        timeout: 10000,
        params: {
          api_token: apiKey,
          include: 'participants;league;league.country;scores;state;periods',
        },
      });

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
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na Sportmonks',
      };
    }
  }

  async getFixturesFromFootballData(date: string) {
    const apiKey = this.getFootballDataKey();
    if (!apiKey) return { ok: false, data: [], error: 'FOOTBALL_DATA_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.footballDataURL}/matches`, {
        timeout: 10000,
        headers: { 'X-Auth-Token': apiKey },
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
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na football-data.org',
      };
    }
  }

  async getFixturesFromSportsDb(date: string) {
    const key = this.getSportsDbKey();

    try {
      const response = await axios.get(`${this.sportsDbURL}/${key}/eventsday.php`, {
        timeout: 10000,
        params: { d: date, s: 'Soccer' },
      });

      return {
        ok: true,
        data: (response.data?.events || []).map((event: any) =>
          this.mapSportsDbEvent(event),
        ),
        error: null,
      };
    } catch (error: any) {
      return { ok: false, data: [], error: error?.message || 'Erro na TheSportsDB' };
    }
  }

  private normalizeName(name: string) {
    let value = String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Normaliza diferenças comuns entre FlashScore e AllScores.
    value = value
      .replace(/&/g, ' and ')
      .replace(/\bii\b/g, ' 2 ')
      .replace(/\biii\b/g, ' 3 ')
      .replace(/\biv\b/g, ' 4 ')
      .replace(/\bsub\s*20\b/g, ' u20 ')
      .replace(/\bsub\s*21\b/g, ' u21 ')
      .replace(/\bsub\s*23\b/g, ' u23 ')
      .replace(/\bfc\b/g, ' ')
      .replace(/\bsc\b/g, ' ')
      .replace(/\bec\b/g, ' ')
      .replace(/\bac\b/g, ' ')
      .replace(/\bafc\b/g, ' ')
      .replace(/\bclub\b/g, ' ')
      .replace(/\bclube\b/g, ' ')
      .replace(/\bde\b/g, ' ')
      .replace(/\bdo\b/g, ' ')
      .replace(/\bda\b/g, ' ')
      .replace(/\bthe\b/g, ' ')
      .replace(/\bwomen\b/g, ' fem ')
      .replace(/\bfeminino\b/g, ' fem ')
      .replace(/\bf\b/g, ' fem ')
      .replace(/\bu-?(\d{2})\b/g, ' u$1 ')
      .replace(/\s+/g, ' ')
      .trim();

    return value.replace(/[^a-z0-9]/g, '');
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
    return String(team?.name || team?.nome || team?.teamName || '').trim();
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
        fixture?.['carimbo de data/hora'] ||
        fixture?.['carimbo de datahora'] ||
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
      : String(this.getFixtureDateValue(item) || '').slice(0, 10);

    // Agrupa jogos no mesmo horário aproximado para deduplicar APIs diferentes.
    const timeBucket = timestamp ? Math.floor(timestamp / (15 * 60)) : 0;

    const home = this.normalizeName(this.getTeamName(this.getHomeTeam(item)));
    const away = this.normalizeName(this.getTeamName(this.getAwayTeam(item)));

    if (!date || !home || !away) return '';

    return `${date}-${timeBucket}-${home}-${away}`;
  }

  private fixtureLooseKey(item: any) {
    const timestamp = this.getFixtureTimestamp(item);
    const date = timestamp
      ? this.brazilDateKey(new Date(timestamp * 1000))
      : String(this.getFixtureDateValue(item) || '').slice(0, 10);

    const home = this.normalizeName(this.getTeamName(this.getHomeTeam(item)));
    const away = this.normalizeName(this.getTeamName(this.getAwayTeam(item)));

    if (!date || !home || !away) return '';

    // Chave sem horário para casos onde uma API manda UTC e outra manda -03:00.
    return `${date}-${home}-${away}`;
  }

  private fixtureQualityScore(item: any) {
    const provider = String(item?.provider || item?.provedor || '').toLowerCase();
    const fixture = this.getFixtureObject(item);
    const league = this.getLeagueObject(item);
    const home = this.getHomeTeam(item);
    const away = this.getAwayTeam(item);

    let score = 0;

    if (provider.includes('sportscore6')) score += 65;
    if (provider.includes('flashscore')) score += 50;
    if (provider.includes('sports-betting')) score += 45;
    if (provider.includes('allscores')) score += 30;
    if (provider.includes('api-football')) score += 25;

    if (item?.odds) score += 20;
    if (home?.logo) score += 8;
    if (away?.logo) score += 8;
    if (league?.logo) score += 4;
    if (fixture?.externalId) score += 6;
    if (fixture?.status?.elapsed || fixture?.status?.['tempo decorrido']) score += 4;

    return score;
  }

  private shouldReplaceFixture(current: any, incoming: any) {
    return this.fixtureQualityScore(incoming) > this.fixtureQualityScore(current);
  }

  private mergeUniqueFixtures(groups: any[][]) {
    const map = new Map<string, any>();
    const looseToKey = new Map<string, string>();

    for (const group of groups) {
      for (const item of group || []) {
        const key = this.fixtureKey(item);
        const looseKey = this.fixtureLooseKey(item);
        if (!key && !looseKey) continue;

        const finalKey = (looseKey && looseToKey.get(looseKey)) || key || looseKey;
        if (looseKey && !looseToKey.has(looseKey)) looseToKey.set(looseKey, finalKey);

        const current = map.get(finalKey);
        if (!current || this.shouldReplaceFixture(current, item)) {
          map.set(finalKey, item);
        }
      }
    }

    return Array.from(map.values()).sort((a: any, b: any) => {
      const da = this.getFixtureTimestamp(a) || new Date(this.getFixtureDateValue(a) || 0).getTime() / 1000;
      const db = this.getFixtureTimestamp(b) || new Date(this.getFixtureDateValue(b) || 0).getTime() / 1000;
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
    const rawDate = item?.fixture?.date || item?.jogo?.data || item?.fixture?.data;
    if (!rawDate) return false;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return false;

    return this.brazilDateKey(parsed) === targetDate;
  }

  private fixtureStartsInFuture(item: any, minMinutes = -30, maxMinutes = 24 * 60) {
    const rawDate = item?.fixture?.date || item?.jogo?.data || item?.fixture?.data;
    if (!rawDate) return false;

    const parsed = new Date(rawDate).getTime();
    if (Number.isNaN(parsed)) return false;

    const diffMinutes = Math.floor((parsed - Date.now()) / 1000 / 60);
    return diffMinutes >= minMinutes && diffMinutes <= maxMinutes;
  }

  async getFixtures(date?: string) {
    await this.cleanupDashboardCache(false);

    date = this.normalizeDateKey(date);

    /**
     * O Dashboard/Pré-jogo precisa enxergar jogos futuros.
     * Antes o Oddix buscava ontem/hoje/amanhã, mas depois filtrava tudo de volta
     * para apenas a data base. Isso deixava poucos jogos na tela.
     *
     * Agora buscamos ontem + hoje + próximos N dias e deixamos
     * isOddixDashboardFixtureAllowed controlar o intervalo final.
     */
    const futureDays = Math.max(
      1,
      Number(process.env.ODDIX_DASHBOARD_MAX_FUTURE_DAYS || 7),
    );

    const searchDates = Array.from(
      new Set(
        Array.from({ length: futureDays + 2 }, (_, index) =>
          this.addDays(date, index - 1),
        ),
      ),
    );

    const freshGroups: any[][] = [];

    for (const currentDate of searchDates) {
      const freshCache = await this.getFreshFixturesFromCache(
        currentDate,
        this.fixturesCacheMinutes(),
      );
      if (freshCache.length > 0) freshGroups.push(freshCache);
    }

    const freshMerged = this.filterDashboardFixtures(
      this.mergeUniqueFixtures(freshGroups),
    );

    if (freshMerged.length > 0) {
      return this.compactFixtures(freshMerged);
    }

    const providerGroups: any[][] = [];

    /**
     * SportScore6 não aceita data nesse endpoint; ela retorna a lista global/agenda.
     * Chamamos apenas uma vez para não gastar requisições duplicadas.
     */
    const sportScore6 = await this.getFixturesFromSportScore6(date);
    if (sportScore6.ok && sportScore6.data.length > 0) {
      providerGroups.push(sportScore6.data);
    }

    for (const currentDate of searchDates) {
      const sportScore = await this.getFixturesFromSportScore(currentDate);
      if (sportScore.ok && sportScore.data.length > 0) providerGroups.push(sportScore.data);

      const flashScore = await this.getFixturesFromFlashScore(currentDate);
      if (flashScore.ok && flashScore.data.length > 0) providerGroups.push(flashScore.data);

      const allScores = await this.getFixturesFromAllScores(currentDate);
      if (allScores.ok && allScores.data.length > 0) providerGroups.push(allScores.data);

      const sportsDb = await this.getFixturesFromSportsDb(currentDate);
      if (sportsDb.ok && sportsDb.data.length > 0) providerGroups.push(sportsDb.data);

      if (this.shouldUseApiFootballFallback()) {
        const apiFootball = await this.getFixturesFromApiFootball(currentDate);
        if (apiFootball.ok && apiFootball.data.length > 0) providerGroups.push(apiFootball.data);
      }

      const sportmonks = await this.getFixturesFromSportmonks(currentDate);
      if (sportmonks.ok && sportmonks.data.length > 0) providerGroups.push(sportmonks.data);

      const footballData = await this.getFixturesFromFootballData(currentDate);
      if (footballData.ok && footballData.data.length > 0) providerGroups.push(footballData.data);
    }

    const providerMerged = this.filterDashboardFixtures(
      this.mergeUniqueFixtures(providerGroups),
    );

    if (providerMerged.length > 0) {
      await this.saveFixturesCache(providerMerged);
      return this.compactFixtures(providerMerged);
    }

    const staleGroups: any[][] = [];

    for (const currentDate of searchDates) {
      const staleCache = await this.getFixturesFromCache(currentDate);
      if (staleCache.length > 0) staleGroups.push(staleCache);
    }

    return this.compactFixtures(
      this.filterDashboardFixtures(this.mergeUniqueFixtures(staleGroups)),
    );
  }

  private async getLiveFixturesFromCache(onlyFresh = true) {
    const { start, end } = this.brazilDayRangeUtc(this.brazilDateKey());

    const cached = await this.prisma.cachedFixture.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    return cached
      .map((item) => this.stripRawProviderData(item.raw))
      .filter((item: any) => isOddixLeagueAllowed(item))
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
      return this.compactFixtures(this.mergeUniqueFixtures([freshCacheLive]));
    }

    const groups: any[][] = [];
    const today = this.brazilDateKey();

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
        .filter((game: any) => isOddixLeagueAllowed(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const sportScore = await this.getLiveFixturesFromSportScore();

    if (sportScore.ok && sportScore.data.length > 0) {
      const live = sportScore.data
        .filter((game: any) => isOddixLeagueAllowed(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const flashScore = await this.getLiveFixturesFromFlashScore();

    if (flashScore.ok && flashScore.data.length > 0) {
      const live = flashScore.data
        .filter((game: any) => isOddixLeagueAllowed(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const allScores = await this.getLiveFixturesFromAllScores(today);

    if (allScores.ok && allScores.data.length > 0) {
      const live = allScores.data
        .filter((game: any) => isOddixLeagueAllowed(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    if (this.shouldUseApiFootballFallback()) {
      const apiFootball = await this.getLiveFixturesFromApiFootball();

      if (apiFootball.ok && apiFootball.data.length > 0) {
        const live = apiFootball.data
          .filter((game: any) => isOddixLeagueAllowed(game))
          .filter((game: any) => this.shouldTreatAsLive(game))
          .map((item: any) => this.normalizeLiveStatus(item));

        if (live.length > 0) groups.push(live);
      }
    }

    const sportmonksKey = this.getSportmonksKey();

    if (sportmonksKey) {
      try {
        const response = await axios.get(`${this.sportmonksURL}/livescores/inplay`, {
          timeout: 10000,
          params: {
            api_token: sportmonksKey,
            include: 'participants;league;league.country;scores;state;periods',
          },
        });

        const liveFixtures = (response.data?.data || [])
          .map((item: any) => this.mapSportmonksFixture(item))
          .filter((item: any) => isOddixLeagueAllowed(item))
          .filter((item: any) => this.shouldTreatAsLive(item))
          .map((item: any) => this.normalizeLiveStatus(item));

        if (liveFixtures.length > 0) groups.push(liveFixtures);
      } catch {}
    }

    const footballData = await this.getFixturesFromFootballData(today);

    if (footballData.ok && footballData.data.length > 0) {
      const live = footballData.data
        .filter((game: any) => isOddixLeagueAllowed(game))
        .filter((game: any) => this.shouldTreatAsLive(game))
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const mergedLive = this.compactFixtures(this.mergeUniqueFixtures(groups));

    if (mergedLive.length > 0) {
      await this.saveFixturesCache(mergedLive);
      return mergedLive;
    }

    // Não usar cache velho como live. Cache antigo é a maior causa de palpite em jogo já finalizado.
    return [];
  }


  async getFixtureByIdFromApiFootball(fixtureId: string) {
    if (this.isApiFootballBlocked()) {
      return { ok: false, data: null, error: 'API-Football em cooldown temporário por limite/erro' };
    }

    const apiKey = this.getApiFootballKey();
    if (!apiKey) return { ok: false, data: null, error: 'API_FOOTBALL_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.apiFootballURL}/fixtures`, {
        timeout: 12000,
        headers: { 'x-apisports-key': apiKey },
        params: {
          id: fixtureId,
          timezone: 'America/Sao_Paulo',
        },
      });

      const item = response.data?.response?.[0];
      return {
        ok: !!item,
        data: item ? this.mapApiFootballFixture(item) : null,
        error: item ? null : 'Fixture não encontrado na API-Football',
      };
    } catch (error: any) {
      if (this.isApiFootballLimitError(error)) {
        this.blockApiFootballTemporarily();
      }

      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na API-Football por ID',
      };
    }
  }

  private mapApiFootballStatistics(fixtureId: string, items: any[]) {
    const teams = (items || []).map((item: any) => ({
      team: item.team || { id: 0, name: '', logo: '' },
      statistics: (item.statistics || []).map((stat: any) => ({
        type: stat.type,
        value: stat.value,
      })),
    }));

    return {
      available: teams.length > 0,
      simulated: false,
      fixtureId,
      source: 'api-football',
      message: teams.length > 0 ? 'Estatísticas reais da API-Football.' : 'Sem estatísticas reais disponíveis.',
      teams,
    };
  }

  async getStatisticsFromApiFootball(fixtureId: string) {
    const apiKey = this.getApiFootballKey();
    if (!apiKey) return { ok: false, data: null, error: 'API_FOOTBALL_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.apiFootballURL}/fixtures/statistics`, {
        timeout: 12000,
        headers: { 'x-apisports-key': apiKey },
        params: { fixture: fixtureId },
      });

      const stats = this.mapApiFootballStatistics(fixtureId, response.data?.response || []);

      return {
        ok: stats.available,
        data: stats,
        error: stats.available ? null : 'Sem estatísticas reais na API-Football',
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro ao buscar estatísticas na API-Football',
      };
    }
  }

  async getFixtureById(fixtureId: string) {
    /**
     * IMPORTANTE PARA GREEN/RED:
     * Para aposta aberta, não confiar primeiro em cache antigo.
     * SportScore é a fonte principal; API-Football só entra se API_FOOTBALL_ENABLE_FALLBACK=true.
     */
    const cachedSportScore6: any = await this.getFixtureFromCacheById(fixtureId);

    if (cachedSportScore6?.provider === 'sportscore6' && cachedSportScore6?.fixture?.externalId) {
      const sportScore6 = await this.getFixtureBySlugFromSportScore6(String(cachedSportScore6.fixture.externalId));

      if (sportScore6.ok && sportScore6.data) {
        await this.saveFixturesCache([sportScore6.data]);
        return sportScore6.data;
      }
    }

    const sportScore = await this.getFixtureByIdFromSportScore(fixtureId);

    if (sportScore.ok && sportScore.data) {
      await this.saveFixturesCache([sportScore.data]);
      return sportScore.data;
    }

    const allScores = await this.getFixtureByIdFromAllScores(fixtureId);

    if (allScores.ok && allScores.data) {
      await this.saveFixturesCache([allScores.data]);
      return allScores.data;
    }

    if (this.shouldUseApiFootballFallback()) {
      const apiFootball = await this.getFixtureByIdFromApiFootball(fixtureId);

      if (apiFootball.ok && apiFootball.data) {
        await this.saveFixturesCache([apiFootball.data]);
        return apiFootball.data;
      }
    }

    const sportmonksKey = this.getSportmonksKey();

    if (sportmonksKey) {
      try {
        const response = await axios.get(`${this.sportmonksURL}/fixtures/${fixtureId}`, {
          timeout: 10000,
          params: {
            api_token: sportmonksKey,
            include: 'participants;league;league.country;scores;state;periods',
          },
        });

        const data = response.data?.data;

        if (data) {
          const fixture = this.mapSportmonksFixture(data);
          await this.saveFixturesCache([fixture]);
          return fixture;
        }
      } catch {}
    }

    const cached = await this.getFixtureFromCacheById(fixtureId);
    return cached || null;
  }

  async getLeagues() {
    const apiKey = this.getSportmonksKey();
    if (!apiKey) return [];

    try {
      const response = await axios.get(`${this.sportmonksURL}/leagues`, {
        timeout: 10000,
        params: { api_token: apiKey, include: 'country' },
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
    const seed = Number(String(fixtureId).replace(/\D/g, '').slice(-7)) || 1234;
    const homeShots = this.numberFromSeed(seed + 1, 6, 18);
    const awayShots = this.numberFromSeed(seed + 2, 5, 16);
    const homePossession = this.numberFromSeed(seed + 5, 42, 61);
    const awayPossession = 100 - homePossession;

    return {
      available: true,
      simulated: true,
      fixtureId,
      message: 'Estatísticas provisórias.',
      teams: [
        {
          team: { id: 0, name: 'Casa', logo: '' },
          statistics: [
            { type: 'Ball Possession', value: `${homePossession}%` },
            { type: 'Total Shots', value: homeShots },
            {
              type: 'Shots on Goal',
              value: this.numberFromSeed(seed + 3, 2, Math.max(3, Math.round(homeShots * 0.55))),
            },
            { type: 'Corner Kicks', value: this.numberFromSeed(seed + 6, 2, 8) },
            { type: 'Yellow Cards', value: this.numberFromSeed(seed + 8, 0, 4) },
            { type: 'Fouls', value: this.numberFromSeed(seed + 10, 7, 18) },
            { type: 'Offsides', value: this.numberFromSeed(seed + 12, 0, 4) },
          ],
        },
        {
          team: { id: 0, name: 'Fora', logo: '' },
          statistics: [
            { type: 'Ball Possession', value: `${awayPossession}%` },
            { type: 'Total Shots', value: awayShots },
            {
              type: 'Shots on Goal',
              value: this.numberFromSeed(seed + 4, 1, Math.max(2, Math.round(awayShots * 0.55))),
            },
            { type: 'Corner Kicks', value: this.numberFromSeed(seed + 7, 1, 7) },
            { type: 'Yellow Cards', value: this.numberFromSeed(seed + 9, 0, 4) },
            { type: 'Fouls', value: this.numberFromSeed(seed + 11, 7, 18) },
            { type: 'Offsides', value: this.numberFromSeed(seed + 13, 0, 4) },
          ],
        },
      ],
    };
  }

  async getStatisticsFromFlashScore(fixtureId: string) {
    const cachedRaw = await this.getFixtureFromCacheById(fixtureId);
    const cached = cachedRaw as any;
    const externalId = cached?.fixture?.externalId || cached?.flashScoreRaw?.id || cached?.fixture?.id;

    if (!externalId || cached?.provider !== 'flashscore') {
      return { ok: false, data: null, error: 'Fixture não é FlashScore ou não possui externalId' };
    }

    try {
      const response = await this.flashScoreService.getStats(String(externalId));
      if (!response.ok || !response.data) return { ok: false, data: null, error: response.error || 'Sem stats FlashScore' };

      const stats = this.flashScoreService.mapStatsToOddix(fixtureId, response.data);
      return { ok: stats.available, data: stats, error: stats.available ? null : 'Sem estatísticas reais na FlashScore' };
    } catch (error: any) {
      return { ok: false, data: null, error: error?.message || 'Erro ao buscar stats FlashScore' };
    }
  }

  async getStatistics(fixtureId: string) {
    const sportScore6 = await this.getStatisticsFromSportScore6(fixtureId);

    if (sportScore6.ok && sportScore6.data) {
      return sportScore6.data;
    }

    const sportScore = await this.getStatisticsFromSportScore(fixtureId);

    if (sportScore.ok && sportScore.data) {
      return sportScore.data;
    }

    const flashScore = await this.getStatisticsFromFlashScore(fixtureId);

    if (flashScore.ok && flashScore.data) {
      return flashScore.data;
    }

    let apiFootball = { ok: false, data: null, error: 'API-Football poupada' } as any;

    if (this.shouldUseApiFootballFallback()) {
      apiFootball = await this.getStatisticsFromApiFootball(fixtureId);

      if (apiFootball.ok && apiFootball.data) {
        return apiFootball.data;
      }
    }

    const fallback = this.generateFallbackStatistics(fixtureId);

    return {
      ...fallback,
      simulated: true,
      source: 'oddix-fallback',
      message: `Estatísticas reais indisponíveis. Usando estimativa temporária. Motivo: ${sportScore.error || flashScore.error || apiFootball.error || 'sem dados reais'}`,
    };
  }

  async debug(date?: string) {
    await this.cleanupDashboardCache(false);

    date = this.normalizeDateKey(date);

    const cache = await this.getFixturesFromCache(date);
    const sportScore6 = await this.getFixturesFromSportScore6(date);
    const sportScore6Live = await this.getLiveFixturesFromSportScore6();
    const sportScore = await this.getFixturesFromSportScore(date);
    const sportScoreLive = await this.getLiveFixturesFromSportScore();
    const sportmonks = await this.getFixturesFromSportmonks(date);
    const footballData = await this.getFixturesFromFootballData(date);
    const sportsDb = await this.getFixturesFromSportsDb(date);
    const allScores = await this.getFixturesFromAllScores(date);
    const allScoresLive = await this.getLiveFixturesFromAllScores(date);
    const flashScore = await this.getFixturesFromFlashScore(date);
    const flashScoreLive = await this.getLiveFixturesFromFlashScore();

    let apiFootball = { ok: false, data: [], error: 'Poupada no debug' } as any;
    let apiFootballLive = { ok: false, data: [], error: 'Poupada no debug' } as any;

    if (process.env.API_FOOTBALL_DEBUG_FORCE === 'true') {
      apiFootball = await this.getFixturesFromApiFootball(date);
      apiFootballLive = await this.getLiveFixturesFromApiFootball();
    }

    const live = await this.getLiveFixtures();

    return {
      date,
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
      apiFootballDisabled: process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === 'true',
      apiFootballBlockedUntil: this.apiFootballBlockedUntil?.toISOString() || null,
      liveCacheSeconds: this.liveCacheSeconds(),
      fixturesCacheMinutes: this.fixturesCacheMinutes(),
      note: 'API-Football só é consultada se API_FOOTBALL_ENABLE_FALLBACK=true ou API_FOOTBALL_DEBUG_FORCE=true. Ordem: SportScore6 > SportScore > FlashScore > AllScores > TheSportsDB/cache > API-Football opcional > Sportmonks > FootballData.',

      cache: {
        responseLength: cache.length,
        sample: this.compactFixtures(cache.slice(0, 2)),
      },

      sportScore6: {
        ok: sportScore6.ok,
        error: sportScore6.error,
        responseLength: this.filterAllowedLeagues(sportScore6.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(sportScore6.data).slice(0, 3)),
      },

      sportScore6Live: {
        ok: sportScore6Live.ok,
        error: sportScore6Live.error,
        responseLength: this.filterAllowedLeagues(sportScore6Live.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(sportScore6Live.data).slice(0, 3)),
      },

      sportScore: {
        ok: sportScore.ok,
        error: sportScore.error,
        responseLength: this.filterAllowedLeagues(sportScore.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(sportScore.data).slice(0, 3)),
      },

      sportScoreLive: {
        ok: sportScoreLive.ok,
        error: sportScoreLive.error,
        responseLength: this.filterAllowedLeagues(sportScoreLive.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(sportScoreLive.data).slice(0, 3)),
      },

      flashScore: {
        ok: flashScore.ok,
        error: flashScore.error,
        responseLength: this.filterAllowedLeagues(flashScore.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(flashScore.data).slice(0, 2)),
      },

      flashScoreLive: {
        ok: flashScoreLive.ok,
        error: flashScoreLive.error,
        responseLength: this.filterAllowedLeagues(flashScoreLive.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(flashScoreLive.data).slice(0, 3)),
      },

      allScores: {
        ok: allScores.ok,
        error: allScores.error,
        responseLength: this.filterAllowedLeagues(allScores.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(allScores.data).slice(0, 2)),
      },

      allScoresLive: {
        ok: allScoresLive.ok,
        error: allScoresLive.error,
        responseLength: this.filterAllowedLeagues(allScoresLive.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(allScoresLive.data).slice(0, 3)),
      },

      sportsDb: {
        ok: sportsDb.ok,
        error: sportsDb.error,
        responseLength: this.filterAllowedLeagues(sportsDb.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(sportsDb.data).slice(0, 2)),
      },

      apiFootball: {
        ok: apiFootball.ok,
        error: apiFootball.error,
        responseLength: this.filterAllowedLeagues(apiFootball.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(apiFootball.data).slice(0, 2)),
      },

      apiFootballLive: {
        ok: apiFootballLive.ok,
        error: apiFootballLive.error,
        responseLength: this.filterAllowedLeagues(apiFootballLive.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(apiFootballLive.data).slice(0, 3)),
      },

      sportmonks: {
        ok: sportmonks.ok,
        error: sportmonks.error,
        responseLength: this.filterAllowedLeagues(sportmonks.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(sportmonks.data).slice(0, 2)),
      },

      footballData: {
        ok: footballData.ok,
        error: footballData.error,
        responseLength: this.filterAllowedLeagues(footballData.data).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(footballData.data).slice(0, 2)),
      },

      live: {
        responseLength: this.filterAllowedLeagues(live).length,
        sample: this.compactFixtures(this.filterAllowedLeagues(live).slice(0, 3)),
      },
    };
  }

}
