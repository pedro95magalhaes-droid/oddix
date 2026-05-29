import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FootballService {
  constructor(private readonly prisma: PrismaService) {}

  private apiFootballURL = 'https://v3.football.api-sports.io';
  private sportmonksURL = 'https://api.sportmonks.com/v3/football';
  private footballDataURL = 'https://api.football-data.org/v4';
  private sportsDbURL = 'https://www.thesportsdb.com/api/v1/json';

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

  private now() {
    return new Date();
  }

  private minutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60 * 1000);
  }

  private hoursAgo(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
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

    return ['FT', 'AET', 'PEN'].includes(s) || l.includes('finished');
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

  private async saveFixturesCache(fixtures: any[]) {
    if (!fixtures?.length) return;

    await Promise.all(
      fixtures.map((item: any) => {
        const fixtureId = String(item?.fixture?.id || '');
        if (!fixtureId) return null;

        return this.prisma.cachedFixture.upsert({
          where: { fixtureId },
          update: {
            provider: item.provider || 'unknown',
            date: item.fixture?.date ? new Date(item.fixture.date) : null,
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
            raw: item,
          },
          create: {
            fixtureId,
            provider: item.provider || 'unknown',
            date: item.fixture?.date ? new Date(item.fixture.date) : null,
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
            raw: item,
          },
        });
      }),
    );
  }

  private async getFixturesFromCache(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const cached = await this.prisma.cachedFixture.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    return cached.map((item) => item.raw);
  }

  private async getFreshFixturesFromCache(date: string, hours = 12) {
    const cached = await this.getFixturesFromCache(date);

    if (!cached.length) return [];

    const hasFinished = cached.some((item: any) =>
      this.isFinishedStatus(item?.fixture?.status?.short, item?.fixture?.status?.long),
    );

    if (hasFinished) return cached;

    const today = new Date().toISOString().slice(0, 10);

    if (date !== today) return cached;

    return cached;
  }

  private async getFixtureFromCacheById(fixtureId: string) {
    const cached = await this.prisma.cachedFixture.findUnique({
      where: { fixtureId: String(fixtureId) },
    });

    return cached?.raw || null;
  }

  async getFixturesFromApiFootball(date: string) {
    if (process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === 'true') {
      return { ok: false, data: [], error: 'API-Football desativada temporariamente por limite' };
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
        process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT = 'true';
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
    if (process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === 'true') {
      return { ok: false, data: [], error: 'API-Football desativada temporariamente por limite' };
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
        process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT = 'true';
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
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private fixtureKey(item: any) {
    const date = String(item?.fixture?.date || '').slice(0, 10);
    const home = this.normalizeName(item?.teams?.home?.name || '');
    const away = this.normalizeName(item?.teams?.away?.name || '');
    return `${date}-${home}-${away}`;
  }

  private mergeUniqueFixtures(groups: any[][]) {
    const map = new Map<string, any>();

    for (const group of groups) {
      for (const item of group || []) {
        const key = this.fixtureKey(item);
        if (!key || key.includes('--')) continue;

        if (!map.has(key)) {
          map.set(key, item);
        }
      }
    }

    return Array.from(map.values()).sort((a: any, b: any) => {
      const da = new Date(a?.fixture?.date || 0).getTime();
      const db = new Date(b?.fixture?.date || 0).getTime();
      return da - db;
    });
  }

  async getFixtures(date: string) {
    const apiFootball = await this.getFixturesFromApiFootball(date);

    if (apiFootball.ok && apiFootball.data.length > 0) {
      await this.saveFixturesCache(apiFootball.data);
      return this.mergeUniqueFixtures([apiFootball.data]);
    }

    const sportmonks = await this.getFixturesFromSportmonks(date);

    if (sportmonks.ok && sportmonks.data.length > 0) {
      await this.saveFixturesCache(sportmonks.data);
      return this.mergeUniqueFixtures([sportmonks.data]);
    }

    const footballData = await this.getFixturesFromFootballData(date);

    if (footballData.ok && footballData.data.length > 0) {
      await this.saveFixturesCache(footballData.data);
      return this.mergeUniqueFixtures([footballData.data]);
    }

    const sportsDb = await this.getFixturesFromSportsDb(date);

    if (sportsDb.ok && sportsDb.data.length > 0) {
      await this.saveFixturesCache(sportsDb.data);
      return this.mergeUniqueFixtures([sportsDb.data]);
    }

    const cache = await this.getFreshFixturesFromCache(date, 12);

    if (cache.length > 0) {
      return this.mergeUniqueFixtures([cache]);
    }

    return [];
  }

  private async getLiveFixturesFromCache() {
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);

    const cached = await this.prisma.cachedFixture.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    return cached
      .map((item) => item.raw)
      .filter((item: any) =>
        this.isLiveStatus(item?.fixture?.status?.short, item?.fixture?.status?.long),
      )
      .map((item: any) => this.normalizeLiveStatus(item));
  }

  async getLiveFixtures() {
    const groups: any[][] = [];
    const today = new Date().toISOString().slice(0, 10);

    const apiFootball = await this.getLiveFixturesFromApiFootball();

    if (apiFootball.ok && apiFootball.data.length > 0) {
      const live = apiFootball.data
        .filter((game: any) =>
          this.isLiveStatus(game?.fixture?.status?.short, game?.fixture?.status?.long),
        )
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
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
          .map((item: any) => this.normalizeLiveStatus(item));

        if (liveFixtures.length > 0) groups.push(liveFixtures);
      } catch {}
    }

    const footballData = await this.getFixturesFromFootballData(today);

    if (footballData.ok && footballData.data.length > 0) {
      const live = footballData.data
        .filter((game: any) =>
          this.isLiveStatus(game?.fixture?.status?.short, game?.fixture?.status?.long),
        )
        .map((item: any) => this.normalizeLiveStatus(item));

      if (live.length > 0) groups.push(live);
    }

    const mergedLive = this.mergeUniqueFixtures(groups);

    if (mergedLive.length > 0) {
      await this.saveFixturesCache(mergedLive);
      return mergedLive;
    }

    const cacheLive = await this.getLiveFixturesFromCache();

    if (cacheLive.length > 0) {
      return this.mergeUniqueFixtures([cacheLive]);
    }

    return [];
  }


  async getFixtureByIdFromApiFootball(fixtureId: string) {
    if (process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === 'true') {
      return { ok: false, data: null, error: 'API-Football desativada temporariamente por limite' };
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
        process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT = 'true';
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
    const apiFootball = await this.getFixtureByIdFromApiFootball(fixtureId);

    if (apiFootball.ok && apiFootball.data) {
      await this.saveFixturesCache([apiFootball.data]);
      return apiFootball.data;
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
    if (cached) return cached;

    return null;
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

  async getStatistics(fixtureId: string) {
    const apiFootball = await this.getStatisticsFromApiFootball(fixtureId);

    if (apiFootball.ok && apiFootball.data) {
      return apiFootball.data;
    }

    const fallback = this.generateFallbackStatistics(fixtureId);

    return {
      ...fallback,
      simulated: true,
      source: 'oddix-fallback',
      message: `Estatísticas reais indisponíveis. Usando estimativa temporária. Motivo: ${apiFootball.error || 'sem dados reais'}`,
    };
  }

  async debug(date: string) {
    const cache = await this.getFixturesFromCache(date);
    const sportmonks = await this.getFixturesFromSportmonks(date);
    const footballData = await this.getFixturesFromFootballData(date);
    const sportsDb = await this.getFixturesFromSportsDb(date);

    let apiFootball = { ok: false, data: [], error: 'Poupada no debug' } as any;
    let apiFootballLive = { ok: false, data: [], error: 'Poupada no debug' } as any;

    if (process.env.API_FOOTBALL_DEBUG_FORCE === 'true') {
      apiFootball = await this.getFixturesFromApiFootball(date);
      apiFootballLive = await this.getLiveFixturesFromApiFootball();
    }

    const live = await this.getLiveFixtures();

    return {
      date,
      apiFootballKeyExists: !!this.getApiFootballKey(),
      sportmonksKeyExists: !!this.getSportmonksKey(),
      footballDataKeyExists: !!this.getFootballDataKey(),
      sportsDbKeyExists: !!this.getSportsDbKey(),
      apiFootballDisabled: process.env.API_FOOTBALL_DISABLE_WHEN_LIMIT === 'true',
      note: 'API-Football só é consultada no debug se API_FOOTBALL_DEBUG_FORCE=true',

      cache: {
        responseLength: cache.length,
        sample: cache.slice(0, 2),
      },

      sportmonks: {
        ok: sportmonks.ok,
        error: sportmonks.error,
        responseLength: sportmonks.data.length,
        sample: sportmonks.data.slice(0, 2),
      },

      footballData: {
        ok: footballData.ok,
        error: footballData.error,
        responseLength: footballData.data.length,
        sample: footballData.data.slice(0, 2),
      },

      sportsDb: {
        ok: sportsDb.ok,
        error: sportsDb.error,
        responseLength: sportsDb.data.length,
        sample: sportsDb.data.slice(0, 2),
      },

      apiFootball: {
        ok: apiFootball.ok,
        error: apiFootball.error,
        responseLength: apiFootball.data.length,
        sample: apiFootball.data.slice(0, 2),
      },

      apiFootballLive: {
        ok: apiFootballLive.ok,
        error: apiFootballLive.error,
        responseLength: apiFootballLive.data.length,
        sample: apiFootballLive.data.slice(0, 3),
      },

      live: {
        responseLength: live.length,
        sample: live.slice(0, 3),
      },
    };
  }
}