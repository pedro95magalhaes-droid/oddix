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
  private readonly lastAttempts: Array<{ path: string; ok: boolean; error?: string; at: string }> = [];

  isEnabled() {
    const raw = process.env.FLASHSCORE_ENABLED;

    // V21.1: se existe chave configurada, a FlashScore fica ativa por padrão.
    // Antes o padrão era false e isso fazia o Oddix ignorar a API mesmo com FLASHSCORE_KEY no ambiente.
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return this.hasKey();
    }

    return !['false', '0', 'off', 'no', 'disabled'].includes(String(raw).toLowerCase().trim());
  }

  hasKey() {
    return !!this.getKey();
  }

  getBaseUrl() {
    return this.baseURL;
  }

  getDiagnostics() {
    return {
      enabled: this.isEnabled(),
      hasKey: this.hasKey(),
      keyEnv: this.getKeyEnvName(),
      baseURL: this.baseURL,
      host: this.getHost(),
      timezone: this.getTimezone(),
      geoIpCode: process.env.FLASHSCORE_GEO_IP_CODE || 'BR',
      livePaths: this.configuredPaths('FLASHSCORE_LIVE_PATHS', [
        process.env.FLASHSCORE_LIVE_PATH || '',
        '/api/flashscore/v2/matches/live',
        '/api/flashscore/v1/matches/live',
        '/api/flashscore/matches/live',
        '/matches/live',
        '/api/matches/live',
        '/football/live',
      ]),
      fixturesPaths: this.configuredPaths('FLASHSCORE_FIXTURES_PATHS', [
        process.env.FLASHSCORE_FIXTURES_PATH || '',
        '/api/flashscore/v2/matches/list-by-date',
        '/api/flashscore/v1/matches/list-by-date',
        '/api/flashscore/matches/list-by-date',
        '/matches/list-by-date',
        '/api/matches/list-by-date',
        '/football/matches/list-by-date',
      ]),
      lastAttempts: this.lastAttempts.slice(-12),
    };
  }

  private getKeyEnvName() {
    if (process.env.FLASHSCORE_KEY) return 'FLASHSCORE_KEY';
    if (process.env.FLASHSCORE_API_KEY) return 'FLASHSCORE_API_KEY';
    if (process.env.RAPIDAPI_KEY) return 'RAPIDAPI_KEY';
    return null;
  }

  private rememberAttempt(path: string, ok: boolean, error?: any) {
    this.lastAttempts.push({
      path,
      ok,
      error: error ? this.safeError(error) : undefined,
      at: new Date().toISOString(),
    });

    if (this.lastAttempts.length > 30) this.lastAttempts.splice(0, this.lastAttempts.length - 30);
  }

  private safeError(error: any) {
    if (!error) return 'erro desconhecido';
    if (typeof error === 'string') return error.slice(0, 220);
    try {
      return JSON.stringify(error).slice(0, 220);
    } catch {
      return String(error).slice(0, 220);
    }
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

  private configuredPaths(envName: string, fallback: string[]) {
    const raw = process.env[envName];
    const fromEnv = raw
      ? raw
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    return Array.from(new Set([...fromEnv, ...fallback].filter(Boolean)));
  }

  private hasMatchPayload(data: any) {
    return this.flattenMatches(data).length > 0;
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
      const error = 'FlashScore desativada ou sem chave. Configure FLASHSCORE_KEY/FLASHSCORE_API_KEY/RAPIDAPI_KEY';
      this.rememberAttempt(path, false, error);
      return { ok: false, data: null, error };
    }

    const key = this.getKey();
    if (!key) {
      const error = 'FLASHSCORE_KEY não encontrada';
      this.rememberAttempt(path, false, error);
      return { ok: false, data: null, error };
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

      this.rememberAttempt(path, true);
      return { ok: true, data: response.data, error: null };
    } catch (error: any) {
      const finalError = error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na FlashScore';
      this.rememberAttempt(path, false, finalError);
      return {
        ok: false,
        data: null,
        error: finalError,
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


  private normalizeOddValue(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 1 ? Number(value.toFixed(2)) : null;
    }

    if (typeof value === 'object') {
      const candidate =
        value?.odd ??
        value?.odds ??
        value?.value ??
        value?.price ??
        value?.decimal ??
        value?.rate?.decimal ??
        value?.current?.decimal ??
        value?.current ??
        value?.rate ??
        null;

      return this.normalizeOddValue(candidate);
    }

    const raw = String(value)
      .replace(',', '.')
      .replace(/[^0-9.\-]/g, '');

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 1 ? Number(parsed.toFixed(2)) : null;
  }

  private normalizeOutcomeName(value: any): string {
    const raw = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (['1', 'home', 'casa', 'mandante', 'homewin', 'vitoriacasa', 'time1'].includes(raw)) return '1';
    if (['x', 'draw', 'empate', 'tie'].includes(raw)) return 'X';
    if (['2', 'away', 'fora', 'visitante', 'awaywin', 'vitoriafora', 'time2'].includes(raw)) return '2';

    return '';
  }

  private pushOddOption(target: any[], name: '1' | 'X' | '2', oddValue: any) {
    const odd = this.normalizeOddValue(oddValue);
    if (!odd) return;
    if (target.some((item) => item.name === name)) return;
    target.push({ name, odd });
  }

  private extract1x2Options(input: any): Array<{ name: '1' | 'X' | '2'; odd: number }> {
    const options: Array<{ name: '1' | 'X' | '2'; odd: number }> = [];

    const visit = (node: any, depth = 0) => {
      if (!node || depth > 6 || options.length >= 3) return;

      if (Array.isArray(node)) {
        for (const item of node) visit(item, depth + 1);
        return;
      }

      if (typeof node !== 'object') return;

      this.pushOddOption(options, '1', node?.['1'] ?? node?.home ?? node?.casa ?? node?.mandante);
      this.pushOddOption(options, 'X', node?.X ?? node?.x ?? node?.draw ?? node?.empate);
      this.pushOddOption(options, '2', node?.['2'] ?? node?.away ?? node?.fora ?? node?.visitante);

      const candidateName = this.normalizeOutcomeName(
        node?.name ??
          node?.nome ??
          node?.label ??
          node?.title ??
          node?.outcome ??
          node?.selection ??
          node?.selectionName ??
          node?.marketName,
      );

      if (candidateName) {
        this.pushOddOption(
          options,
          candidateName as '1' | 'X' | '2',
          node?.odd ?? node?.odds ?? node?.value ?? node?.price ?? node?.decimal ?? node?.rate,
        );
      }

      const priorityKeys = [
        'options',
        'opções',
        'outcomes',
        'selections',
        'values',
        'markets',
        'market',
        'odds',
        'bookmakers',
        'data',
        'response',
        'result',
        'payload',
      ];

      for (const key of priorityKeys) visit(node?.[key], depth + 1);

      if (options.length < 3) {
        for (const value of Object.values(node)) visit(value, depth + 1);
      }
    };

    visit(input);

    const order: Record<string, number> = { '1': 1, X: 2, '2': 3 };
    return options.sort((a, b) => order[a.name] - order[b.name]);
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

    const oddsRaw = this.read(match, ['odds', 'market.odds', 'markets', 'bookmakers', 'prematchOdds', 'matchOdds'], null);
    const oddsOptions = this.extract1x2Options(oddsRaw);

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
      odds: oddsOptions.length
        ? {
            source: 'flashscore',
            bookmaker: 'FlashScore',
            market: '1X2',
            options: oddsOptions,
          }
        : null,
      flashScoreRaw: match,
    };
  }

  async getLiveFixtures(): Promise<ProviderResult<any[]>> {
    const params = {
      sport_id: 1,
      sport: 'football',
      timezone: this.getTimezone(),
    };

    const paths = this.configuredPaths('FLASHSCORE_LIVE_PATHS', [
      process.env.FLASHSCORE_LIVE_PATH || '',
      '/api/flashscore/v2/matches/live',
      '/api/flashscore/v1/matches/live',
      '/api/flashscore/matches/live',
      '/matches/live',
      '/api/matches/live',
      '/football/live',
    ]);

    const errors: string[] = [];
    let emptyOk = false;

    for (const path of paths) {
      const response = await this.request(path, params);

      if (!response.ok || !response.data) {
        errors.push(`${path}: ${String(response.error || 'sem resposta')}`);
        continue;
      }

      const matches = this.flattenMatches(response.data).map((match) => this.mapMatch(match));

      if (matches.length) {
        return { ok: true, data: matches, error: null };
      }

      emptyOk = true;
      errors.push(`${path}: sem jogos ao vivo retornados`);
    }

    return {
      ok: emptyOk,
      data: [],
      error: emptyOk ? null : errors.slice(0, 5).join(' | ') || 'FlashScore live sem dados',
    };
  }

  async getFixtures(date: string): Promise<ProviderResult<any[]>> {
    const paramVariants = [
      { sport_id: 1, date, timezone: this.getTimezone() },
      { sport: 'football', date, timezone: this.getTimezone() },
      { sport_id: 1, day: date, timezone: this.getTimezone() },
      { sport_id: 1, locale: 'pt_BR', date, timezone: this.getTimezone() },
    ];

    const paths = this.configuredPaths('FLASHSCORE_FIXTURES_PATHS', [
      process.env.FLASHSCORE_FIXTURES_PATH || '',
      '/api/flashscore/v2/matches/list-by-date',
      '/api/flashscore/v1/matches/list-by-date',
      '/api/flashscore/matches/list-by-date',
      '/matches/list-by-date',
      '/api/matches/list-by-date',
      '/football/matches/list-by-date',
    ]);

    const errors: string[] = [];
    let emptyOk = false;

    for (const path of paths) {
      for (const params of paramVariants) {
        const response = await this.request(path, params);

        if (!response.ok || !response.data) {
          errors.push(`${path}: ${String(response.error || 'sem resposta')}`);
          continue;
        }

        const matches = this.flattenMatches(response.data).map((match) => this.mapMatch(match));

        if (matches.length) {
          return { ok: true, data: matches, error: null };
        }

        emptyOk = true;
        errors.push(`${path}: sem jogos para ${date}`);
      }
    }

    return {
      ok: emptyOk,
      data: [],
      error: emptyOk ? null : errors.slice(0, 5).join(' | ') || 'FlashScore fixtures sem dados',
    };
  }

  async getStats(matchId: string): Promise<ProviderResult<any | null>> {
    const cleanMatchId = String(matchId || '').trim();

    if (!cleanMatchId) {
      return {
        ok: false,
        data: null,
        error: 'match_id FlashScore vazio',
      };
    }

    const attempts = [
      { match_id: cleanMatchId },
      { id: cleanMatchId },
      { event_id: cleanMatchId },
      { matchId: cleanMatchId },
    ];

    const errors: any[] = [];

    for (const params of attempts) {
      const response = await this.request(
        '/api/flashscore/v2/matches/match/stats',
        params,
      );

      if (!response.ok) {
        errors.push(response.error || `falha params=${JSON.stringify(params)}`);
        continue;
      }

      const mapped = this.mapStatsToOddix(cleanMatchId, response.data);

      if (mapped.available) {
        return { ok: true, data: response.data, error: null };
      }

      errors.push(`sem linhas de estatística params=${JSON.stringify(params)}`);
    }

    return {
      ok: false,
      data: null,
      error:
        errors.filter(Boolean).join(' | ') ||
        'FlashScore não retornou estatísticas reais',
    };
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
    const response = await this.request('/api/flashscore/v2/matches/odds', { match_id: matchId, geo_ip_code: process.env.FLASHSCORE_GEO_IP_CODE || 'BR' });
    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data, error: null };
  }

  private extractStatRows(data: any): any[] {
    const directArrays = [
      data,
      data?.statistics,
      data?.stats,
      data?.matchStats,
      data?.match_stats,
      data?.items,
      data?.rows,
      data?.data,
      data?.DATA,
      data?.response,
      data?.result,
      data?.payload,
      data?.data?.statistics,
      data?.data?.stats,
      data?.data?.matchStats,
      data?.data?.match_stats,
      data?.data?.items,
      data?.data?.rows,
      data?.DATA?.statistics,
      data?.DATA?.stats,
      data?.DATA?.matchStats,
      data?.DATA?.match_stats,
      data?.response?.statistics,
      data?.response?.stats,
      data?.response?.matchStats,
      data?.response?.match_stats,
      data?.result?.statistics,
      data?.result?.stats,
      data?.result?.matchStats,
      data?.payload?.statistics,
      data?.payload?.stats,
      data?.payload?.matchStats,
    ];

    for (const candidate of directArrays) {
      if (Array.isArray(candidate) && this.looksLikeStatRows(candidate)) {
        return candidate;
      }
    }

    const sectionSources = [
      data?.data?.groups,
      data?.DATA?.groups,
      data?.response?.groups,
      data?.groups,
      data?.data?.sections,
      data?.DATA?.sections,
      data?.response?.sections,
      data?.sections,
    ];

    for (const source of sectionSources) {
      if (!Array.isArray(source)) continue;

      const rows = source.flatMap((section: any) => {
        if (Array.isArray(section?.statistics)) return section.statistics;
        if (Array.isArray(section?.stats)) return section.stats;
        if (Array.isArray(section?.items)) return section.items;
        if (Array.isArray(section?.rows)) return section.rows;
        if (Array.isArray(section?.matchStats)) return section.matchStats;
        return [];
      });

      if (this.looksLikeStatRows(rows)) return rows;
    }

    const recursiveRows = this.findStatRowsDeep(data);
    return recursiveRows;
  }

  private looksLikeStatRows(rows: any[]): boolean {
    if (!Array.isArray(rows) || rows.length === 0) return false;

    return rows.some((row: any) => {
      if (!row || typeof row !== 'object') return false;

      const name = this.readStatName(row);
      const home = this.readHomeStatValue(row);
      const away = this.readAwayStatValue(row);

      return (
        (name && name !== 'Stat') &&
        (home !== undefined || away !== undefined)
      );
    });
  }

  private findStatRowsDeep(input: any, depth = 0): any[] {
    if (!input || depth > 5) return [];

    if (Array.isArray(input)) {
      if (this.looksLikeStatRows(input)) return input;

      for (const item of input) {
        const found = this.findStatRowsDeep(item, depth + 1);
        if (found.length) return found;
      }

      return [];
    }

    if (typeof input !== 'object') return [];

    const priorityKeys = [
      'statistics',
      'stats',
      'matchStats',
      'match_stats',
      'items',
      'rows',
      'groups',
      'sections',
      'data',
      'DATA',
      'response',
      'result',
      'payload',
    ];

    for (const key of priorityKeys) {
      const found = this.findStatRowsDeep(input?.[key], depth + 1);
      if (found.length) return found;
    }

    for (const value of Object.values(input)) {
      const found = this.findStatRowsDeep(value, depth + 1);
      if (found.length) return found;
    }

    return [];
  }

  private statNumber(value: any): number | string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    const parsed = Number(String(value).replace('%', '').replace(',', '.').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : String(value);
  }

  private normalizeStatType(name: any) {
    const n = String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (n.includes('possession') || n.includes('posse')) return 'Ball Possession';
    if (n.includes('corner') || n.includes('escante')) return 'Corner Kicks';
    if (n.includes('shots on') || n.includes('on target') || n.includes('target') || n.includes('chutes no gol')) return 'Shots on Goal';
    if (n.includes('shot') || n.includes('chute') || n.includes('finaliza') || n.includes('attempt')) return 'Total Shots';
    if (n.includes('yellow') || n.includes('amarelo')) return 'Yellow Cards';
    if (n.includes('red') || n.includes('vermelho')) return 'Red Cards';
    if (n.includes('foul') || n.includes('falta')) return 'Fouls';
    if (n.includes('offside') || n.includes('impedimento')) return 'Offsides';
    if (n.includes('attack') || n.includes('ataque')) return 'Attacks';
    if (n.includes('dangerous') || n.includes('perigoso')) return 'Dangerous Attacks';

    return String(name || 'Stat');
  }

  private readStatName(row: any) {
    return (
      row?.name ||
      row?.type ||
      row?.title ||
      row?.statName ||
      row?.stat_name ||
      row?.label ||
      row?.key ||
      row?.category ||
      row?.incidentType ||
      row?.text ||
      'Stat'
    );
  }

  private readHomeStatValue(row: any) {
    return (
      row?.home ??
      row?.homeValue ??
      row?.homeTeam ??
      row?.valueHome ??
      row?.home_value ??
      row?.homeStat ??
      row?.home_stat ??
      row?.values?.home ??
      row?.value?.home ??
      row?.home?.value ??
      row?.home?.stat ??
      row?.home?.display ??
      row?.participants?.home ??
      row?.competitors?.home ??
      row?.[0]
    );
  }

  private readAwayStatValue(row: any) {
    return (
      row?.away ??
      row?.awayValue ??
      row?.awayTeam ??
      row?.valueAway ??
      row?.away_value ??
      row?.awayStat ??
      row?.away_stat ??
      row?.values?.away ??
      row?.value?.away ??
      row?.away?.value ??
      row?.away?.stat ??
      row?.away?.display ??
      row?.participants?.away ??
      row?.competitors?.away ??
      row?.[1]
    );
  }

  mapStatsToOddix(fixtureId: string, statsData: any) {
    const rows = this.extractStatRows(statsData);
    const homeStats: any[] = [];
    const awayStats: any[] = [];

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;

      const type = this.normalizeStatType(this.readStatName(row));
      const home = this.statNumber(this.readHomeStatValue(row));
      const away = this.statNumber(this.readAwayStatValue(row));

      if (home !== null) homeStats.push({ type, value: home });
      if (away !== null) awayStats.push({ type, value: away });
    }

    const available = homeStats.length > 0 || awayStats.length > 0;

    return {
      available,
      simulated: false,
      fixtureId,
      source: 'flashscore',
      message: available
        ? 'Estatísticas reais da FlashScore.'
        : 'Sem estatísticas reais disponíveis na FlashScore.',
      teams: available
        ? [
            { team: { id: 0, name: 'Casa', logo: '' }, statistics: homeStats },
            { team: { id: 0, name: 'Fora', logo: '' }, statistics: awayStats },
          ]
        : [],
      raw: statsData,
    };
  }
}
