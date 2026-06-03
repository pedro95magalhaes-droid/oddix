import { Injectable } from '@nestjs/common';
import axios from 'axios';

type ProviderResult<T> = {
  ok: boolean;
  data: T;
  error: any | null;
};

@Injectable()
export class FlashScoreService {
  private readonly baseURL = process.env.FLASHSCORE_API_BASE_URL || 'https://flashscore4.p.rapidapi.com';
  private readonly memoryCache = new Map<string, { expiresAt: number; data: any }>();

  isEnabled() {
    return String(process.env.FLASHSCORE_ENABLED || 'false').toLowerCase() === 'true';
  }

  hasKey() {
    return !!this.getKey();
  }

  getBaseUrl() {
    return this.baseURL;
  }

  private getKey() {
    return process.env.FLASHSCORE_KEY || process.env.FLASHSCORE_API_KEY || process.env.RAPIDAPI_KEY || '';
  }

  private getHost() {
    return process.env.FLASHSCORE_HOST || process.env.FLASHSCORE_API_HOST || 'flashscore4.p.rapidapi.com';
  }

  private getTimezone() {
    return process.env.FLASHSCORE_TIMEZONE || 'America/Sao_Paulo';
  }

  private timeoutMs() {
    return Number(process.env.FLASHSCORE_TIMEOUT_MS || 12000);
  }

  private stableNumericId(value: any) {
    const raw = String(value || '0');
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    }

    return 1600000000 + (hash % 400000000);
  }

  private cacheSecondsForPath(path: string) {
    if (String(process.env.FLASHSCORE_DISABLE_CACHE || 'false').toLowerCase() === 'true') return 0;

    if (path.includes('/matches/live')) {
      return Number(process.env.FLASHSCORE_LIVE_CACHE_SECONDS || 120);
    }

    if (path.includes('/matches/list-by-date')) {
      return Number(process.env.FLASHSCORE_FIXTURES_CACHE_SECONDS || 1800);
    }

    if (path.includes('/matches/match/stats')) {
      return Number(process.env.FLASHSCORE_STATS_CACHE_SECONDS || 90);
    }

    if (path.includes('/matches/match/lineups')) {
      return Number(process.env.FLASHSCORE_LINEUPS_CACHE_SECONDS || 1800);
    }

    if (path.includes('/matches/h2h')) {
      return Number(process.env.FLASHSCORE_H2H_CACHE_SECONDS || 21600);
    }

    if (path.includes('/matches/odds')) {
      return Number(process.env.FLASHSCORE_ODDS_CACHE_SECONDS || 300);
    }

    return Number(process.env.FLASHSCORE_DEFAULT_CACHE_SECONDS || 300);
  }

  private cacheKey(path: string, params: Record<string, any>) {
    const sortedParams = Object.keys(params || {})
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    return `${path}:${JSON.stringify(sortedParams)}`;
  }

  private async request<T = any>(path: string, params: Record<string, any> = {}): Promise<ProviderResult<T | null>> {
    if (!this.isEnabled()) {
      return { ok: false, data: null, error: 'FlashScore desativada. Defina FLASHSCORE_ENABLED=true' };
    }

    const key = this.getKey();
    if (!key) {
      return { ok: false, data: null, error: 'FLASHSCORE_KEY não encontrada' };
    }

    const ttlSeconds = this.cacheSecondsForPath(path);
    const cacheKey = this.cacheKey(path, params);

    if (ttlSeconds > 0) {
      const cached = this.memoryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { ok: true, data: cached.data, error: null };
      }
    }

    try {
      const response = await axios.get(`${this.baseURL}${path}`, {
        timeout: this.timeoutMs(),
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': this.getHost(),
          'Content-Type': 'application/json',
        },
        params,
      });

      if (ttlSeconds > 0) {
        this.memoryCache.set(cacheKey, {
          expiresAt: Date.now() + ttlSeconds * 1000,
          data: response.data,
        });
      }

      return { ok: true, data: response.data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na FlashScore',
      };
    }
  }

  private read(obj: any, paths: string[], fallback: any = undefined) {
    for (const path of paths) {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) current = current?.[part];
      if (current !== undefined && current !== null && current !== '') return current;
    }
    return fallback;
  }

  private readArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.response)) return data.response;
    if (Array.isArray(data?.matches)) return data.matches;
    if (Array.isArray(data?.events)) return data.events;
    if (Array.isArray(data?.data?.matches)) return data.data.matches;
    if (Array.isArray(data?.data?.events)) return data.data.events;
    if (Array.isArray(data?.response?.matches)) return data.response.matches;
    if (Array.isArray(data?.response?.events)) return data.response.events;
    return [];
  }

  /**
   * FlashScore RapidAPI retorna normalmente assim:
   * [ { tournament_id, name, country_name, image_path, matches: [ ... ] } ]
   * Este método abre cada tournament.matches[] e transforma cada match em fixture.
   */
  private flattenMatches(data: any): any[] {
    const rows = this.readArray(data);
    const flattened: any[] = [];

    for (const row of rows) {
      const nestedMatches = Array.isArray(row?.matches) ? row.matches : null;

      if (nestedMatches?.length) {
        for (const match of nestedMatches) {
          flattened.push({
            ...match,
            league: {
              id: row?.tournament_id || row?.id || row?.league?.id || 0,
              name: row?.name || row?.league?.name || row?.competition?.name || 'Liga não informada',
              country: row?.country_name || row?.country?.name || row?.country || '',
              logo: row?.image_path || row?.league?.logo || row?.competition?.logo || '',
            },
            tournament: row,
          });
        }
      } else {
        flattened.push(row);
      }
    }

    return flattened;
  }

  private normalizeStatus(match: any) {
    const statusRaw = String(this.read(match, [
      'match_status.stage',
      'match_status.live_time',
      'status.short',
      'status.type',
      'status.name',
      'status',
      'stage',
      'shortStatusText',
      'statusText',
    ], '')).toLowerCase();

    const isStarted = this.read(match, ['match_status.is_started'], false) === true;
    const isInProgress = this.read(match, ['match_status.is_in_progress'], false) === true;
    const isFinished = this.read(match, ['match_status.is_finished'], false) === true;
    const isPostponed = this.read(match, ['match_status.is_postponed'], false) === true;
    const isCancelled = this.read(match, ['match_status.is_cancelled'], false) === true;

    const elapsedRaw = this.read(match, [
      'match_status.live_time',
      'time.minute',
      'minute',
      'gameTime',
      'elapsed',
      'status.elapsed',
    ], 0);

    const elapsed = Number(String(elapsedRaw || '').replace(/[^0-9]/g, ''));

    if (isFinished || statusRaw.includes('finished') || statusRaw.includes('ended') || statusRaw === 'ft' || statusRaw.includes('after')) {
      return { long: 'Match Finished', short: 'FT', elapsed: null, extra: null };
    }

    if (isPostponed || statusRaw.includes('postponed')) return { long: 'Postponed', short: 'PST', elapsed: null, extra: null };
    if (isCancelled || statusRaw.includes('cancel')) return { long: 'Canceled', short: 'CANC', elapsed: null, extra: null };

    if (statusRaw.includes('half time') || statusRaw.includes('halftime') || statusRaw === 'ht') {
      return { long: 'Halftime', short: 'HT', elapsed: 45, extra: null };
    }

    if (isStarted || isInProgress || statusRaw.includes('live') || statusRaw.includes('progress') || statusRaw.includes('1st') || statusRaw.includes('2nd') || elapsed > 0) {
      const short = elapsed > 45 || statusRaw.includes('2nd') ? '2H' : '1H';
      return {
        long: short === '2H' ? 'Second Half' : 'First Half',
        short,
        elapsed: elapsed > 0 ? elapsed : null,
        extra: null,
      };
    }

    if (
      statusRaw.includes('scheduled') ||
      statusRaw.includes('not started') ||
      statusRaw.includes('unknown') ||
      statusRaw === 'ns' ||
      statusRaw === 'unk' ||
      !statusRaw
    ) {
      return { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
    }

    return {
      long: statusRaw || 'Not Started',
      short: statusRaw ? statusRaw.toUpperCase().slice(0, 8) : 'NS',
      elapsed: elapsed > 0 ? elapsed : null,
      extra: null,
    };
  }

  private readTeam(match: any, side: 'home' | 'away') {
    const prefix = side;
    const isHome = side === 'home';
    const legacyTeam = isHome ? 'homeTeam' : 'awayTeam';
    const snakeTeam = isHome ? 'home_team' : 'away_team';

    const rawId = this.read(match, [
      `${snakeTeam}.team_id`,
      `${snakeTeam}.id`,
      `${prefix}.team_id`,
      `${prefix}.id`,
      `${legacyTeam}.team_id`,
      `${legacyTeam}.id`,
      `${prefix}Competitor.id`,
    ], 0);

    const name = String(this.read(match, [
      `${snakeTeam}.name`,
      `${prefix}.name`,
      `${legacyTeam}.name`,
      `${prefix}Competitor.name`,
      `${prefix}_name`,
    ], ''));

    const logo = String(this.read(match, [
      `${snakeTeam}.smaill_image_path`,
      `${snakeTeam}.small_image_path`,
      `${snakeTeam}.image_path`,
      `${snakeTeam}.logo`,
      `${prefix}.logo`,
      `${legacyTeam}.logo`,
      `${prefix}.image`,
      `${legacyTeam}.image`,
    ], ''));

    return {
      id: this.stableNumericId(rawId || name),
      externalId: String(rawId || ''),
      name,
      logo,
      winner: null,
    };
  }

  private readScore(match: any, side: 'home' | 'away') {
    const value = this.read(match, [
      `scores.${side}`,
      `score.${side}`,
      `${side}Score`,
      `${side}.score`,
      `${side}_team.score`,
      `${side}Team.score`,
      `${side}Competitor.score`,
    ], null);
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n < 100 ? n : null;
  }

  mapMatch(match: any) {
    const rawId = this.read(match, ['match_id', 'id', 'matchId', 'eventId', 'flashscoreId'], '');
    const fixtureId = this.stableNumericId(rawId);
    const status = this.normalizeStatus(match);
    const home = this.readTeam(match, 'home');
    const away = this.readTeam(match, 'away');
    const homeScore = this.readScore(match, 'home');
    const awayScore = this.readScore(match, 'away');

    const timestamp = Number(this.read(match, ['timestamp', 'time.timestamp'], 0));
    const dateRaw = this.read(match, [
      'startTime',
      'start_time',
      'startDate',
      'date',
      'eventTime',
      'time.startTime',
    ], null);

    const date = dateRaw || (timestamp > 0 ? new Date(timestamp * 1000).toISOString() : new Date().toISOString());

    const odds = this.read(match, ['odds'], null);

    return {
      provider: 'flashscore',
      fixture: {
        id: fixtureId,
        externalId: String(rawId || fixtureId),
        date,
        timestamp: timestamp || (date ? Math.floor(new Date(date).getTime() / 1000) : null),
        timezone: this.getTimezone(),
        status,
      },
      league: {
        id: this.stableNumericId(this.read(match, ['league.id', 'tournament_id', 'tournament.id', 'competition.id'], 0)),
        name: String(this.read(match, ['league.name', 'tournament.name', 'competition.name', 'competitionDisplayName'], 'Liga não informada')),
        country: String(this.read(match, ['league.country', 'league.country.name', 'country.name', 'country'], '')),
        logo: String(this.read(match, ['league.logo', 'tournament.logo', 'competition.logo'], '')),
      },
      teams: { home, away },
      goals: { home: homeScore, away: awayScore },
      score: { fulltime: { home: homeScore, away: awayScore } },
      odds: odds
        ? {
            source: 'flashscore',
            bookmaker: 'FlashScore',
            market: '1X2',
            options: [
              { name: '1', odd: Number(odds?.['1'] || 0) || null },
              { name: 'X', odd: Number(odds?.X || 0) || null },
              { name: '2', odd: Number(odds?.['2'] || 0) || null },
            ].filter((item) => item.odd),
          }
        : null,
      flashScoreRaw: match,
    };
  }

  async getLiveFixtures(): Promise<ProviderResult<any[]>> {
    const response = await this.request('/api/flashscore/v2/matches/live', {
      sport_id: 1,
      timezone: this.getTimezone(),
    });

    if (!response.ok || !response.data) return { ok: false, data: [], error: response.error };

    const matches = this.flattenMatches(response.data).map((match) => this.mapMatch(match));
    return { ok: true, data: matches, error: null };
  }

  async getFixtures(date: string): Promise<ProviderResult<any[]>> {
    const response = await this.request('/api/flashscore/v2/matches/list-by-date', {
      sport_id: 1,
      date,
      timezone: this.getTimezone(),
    });

    if (!response.ok || !response.data) return { ok: false, data: [], error: response.error };

    const matches = this.flattenMatches(response.data).map((match) => this.mapMatch(match));
    return { ok: true, data: matches, error: null };
  }

  async getStats(matchId: string): Promise<ProviderResult<any | null>> {
    const response = await this.request('/api/flashscore/v2/matches/match/stats', { match_id: matchId });
    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data, error: null };
  }

  async getLineups(matchId: string): Promise<ProviderResult<any | null>> {
    const response = await this.request('/api/flashscore/v2/matches/match/lineups', { match_id: matchId });
    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data, error: null };
  }

  async getH2H(matchId: string): Promise<ProviderResult<any | null>> {
    const response = await this.request('/api/flashscore/v2/matches/h2h', { match_id: matchId });
    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data, error: null };
  }

  async getOdds(matchId: string): Promise<ProviderResult<any | null>> {
    const response = await this.request('/api/flashscore/v2/matches/odds', { match_id: matchId, geo_ip_code: process.env.FLASHSCORE_GEO_IP_CODE || 'US' });
    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data, error: null };
  }

  private extractStatRows(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.statistics)) return data.statistics;
    if (Array.isArray(data?.stats)) return data.stats;
    if (Array.isArray(data?.data?.statistics)) return data.data.statistics;
    if (Array.isArray(data?.data?.stats)) return data.data.stats;
    if (Array.isArray(data?.response?.statistics)) return data.response.statistics;
    return [];
  }

  private statNumber(value: any): number | string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    const parsed = Number(String(value).replace('%', '').replace(',', '.').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : String(value);
  }

  private normalizeStatType(name: any) {
    const n = String(name || '').toLowerCase();
    if (n.includes('possession') || n.includes('posse')) return 'Ball Possession';
    if (n.includes('corner') || n.includes('escante')) return 'Corner Kicks';
    if (n.includes('shots on') || n.includes('on target') || n.includes('chutes no gol')) return 'Shots on Goal';
    if (n.includes('shot') || n.includes('chute') || n.includes('finaliza')) return 'Total Shots';
    if (n.includes('yellow') || n.includes('amarelo')) return 'Yellow Cards';
    if (n.includes('red') || n.includes('vermelho')) return 'Red Cards';
    if (n.includes('foul') || n.includes('falta')) return 'Fouls';
    if (n.includes('offside')) return 'Offsides';
    return String(name || 'Stat');
  }

  mapStatsToOddix(fixtureId: string, statsData: any) {
    const rows = this.extractStatRows(statsData);
    const homeStats: any[] = [];
    const awayStats: any[] = [];

    for (const row of rows) {
      const type = this.normalizeStatType(row?.name || row?.type || row?.title || row?.statName);
      const home = this.statNumber(row?.home ?? row?.homeValue ?? row?.homeTeam ?? row?.valueHome);
      const away = this.statNumber(row?.away ?? row?.awayValue ?? row?.awayTeam ?? row?.valueAway);

      if (home !== null) homeStats.push({ type, value: home });
      if (away !== null) awayStats.push({ type, value: away });
    }

    return {
      available: homeStats.length > 0 || awayStats.length > 0,
      simulated: false,
      fixtureId,
      source: 'flashscore',
      message: homeStats.length > 0 || awayStats.length > 0 ? 'Estatísticas reais da FlashScore.' : 'Sem estatísticas reais disponíveis na FlashScore.',
      teams: [
        { team: { id: 0, name: 'Casa', logo: '' }, statistics: homeStats },
        { team: { id: 0, name: 'Fora', logo: '' }, statistics: awayStats },
      ],
      raw: statsData,
    };
  }
}
