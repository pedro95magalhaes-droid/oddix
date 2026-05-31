import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SportScoreService {
  private readonly defaultBaseUrl = 'https://sportscore1.p.rapidapi.com/api/v1';
  private readonly defaultHost = 'sportscore1.p.rapidapi.com';

  isEnabled() {
    return process.env.SPORTSCORE_ENABLED === 'true';
  }

  hasKey() {
    return !!this.getKey();
  }

  getBaseUrl() {
    return (process.env.SPORTSCORE_BASE_URL || this.defaultBaseUrl).replace(/\/$/, '');
  }

  private getHost() {
    return process.env.SPORTSCORE_HOST || this.defaultHost;
  }

  private getKey() {
    return process.env.SPORTSCORE_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '';
  }

  private getTimeoutMs() {
    return Number(process.env.SPORTSCORE_TIMEOUT_MS || 12000);
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-rapidapi-host': this.getHost(),
      'x-rapidapi-key': this.getKey(),
    };
  }

  private async request(path: string, params: Record<string, any> = {}) {
    if (!this.isEnabled()) {
      return { ok: false, data: null, error: 'SportScore desativada. Defina SPORTSCORE_ENABLED=true no .env' };
    }

    if (!this.hasKey()) {
      return { ok: false, data: null, error: 'SPORTSCORE_RAPIDAPI_KEY não encontrada no .env' };
    }

    try {
      const response = await axios.get(`${this.getBaseUrl()}${path}`, {
        timeout: this.getTimeoutMs(),
        headers: this.headers(),
        params,
      });

      return { ok: true, data: response.data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || `Erro SportScore em ${path}`,
      };
    }
  }

  private normalizeDate(date?: string) {
    const raw = String(date || '').trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = raw ? new Date(raw) : new Date();
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

    return new Date().toISOString().slice(0, 10);
  }

  private parseDate(value: any) {
    if (!value) return new Date().toISOString();

    const raw = String(value).trim();
    const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const withTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
    const parsed = new Date(withTimezone);

    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

    return new Date().toISOString();
  }

  private normalizeStatus(event: any) {
    const status = String(event?.status || '').toLowerCase();
    const more = String(event?.status_more || '').toLowerCase();

    if (status === 'finished' || more === 'ft' || more.includes('finished')) {
      return { long: 'Match Finished', short: 'FT', elapsed: null, extra: null };
    }

    if (status === 'inprogress' || status === 'in_progress' || status === 'live') {
      if (more.includes('1st')) return { long: 'In Play', short: '1H', elapsed: this.estimateElapsed(event), extra: null };
      if (more.includes('2nd')) return { long: 'In Play', short: '2H', elapsed: this.estimateElapsed(event), extra: null };
      if (more.includes('half')) return { long: 'Halftime', short: 'HT', elapsed: 45, extra: null };
      return { long: 'In Play', short: 'LIVE', elapsed: this.estimateElapsed(event), extra: null };
    }

    if (status === 'notstarted' || status === 'not_started' || status === 'scheduled') {
      return { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
    }

    if (status === 'postponed' || status === 'delayed') {
      return { long: 'Postponed', short: 'PST', elapsed: null, extra: null };
    }

    if (status === 'canceled' || status === 'cancelled') {
      return { long: 'Canceled', short: 'CANC', elapsed: null, extra: null };
    }

    if (status === 'suspended' || status === 'interrupted') {
      return { long: 'Suspended', short: 'SUSP', elapsed: null, extra: null };
    }

    return { long: event?.status_more || event?.status || 'Unknown', short: String(event?.status || 'UNK').toUpperCase().slice(0, 8), elapsed: null, extra: null };
  }

  private estimateElapsed(event: any) {
    const timeDetails = event?.time_details || {};

    if (typeof timeDetails.currentMinute === 'number') return timeDetails.currentMinute;
    if (typeof timeDetails.minute === 'number') return timeDetails.minute;

    const statusMore = String(event?.status_more || '').toLowerCase();
    if (statusMore.includes('2nd')) return 60;
    if (statusMore.includes('1st')) return 20;

    return null;
  }

  private getScore(score: any) {
    if (score?.current !== undefined && score?.current !== null) return Number(score.current);
    if (score?.display !== undefined && score?.display !== null) return Number(score.display);
    return null;
  }

  private mapMainOdds(mainOdds: any) {
    if (!mainOdds) return null;

    const home = Number(mainOdds?.outcome_1?.value || 0) || null;
    const draw = Number(mainOdds?.outcome_X?.value || 0) || null;
    const away = Number(mainOdds?.outcome_2?.value || 0) || null;

    if (!home && !draw && !away) return null;

    return {
      market: '1X2',
      bookmaker: 'SportScore',
      source: 'sportscore',
      options: [
        home ? { name: '1', odd: home } : null,
        draw ? { name: 'X', odd: draw } : null,
        away ? { name: '2', odd: away } : null,
      ].filter(Boolean),
    };
  }

  private mapEvent(event: any) {
    const homeScore = this.getScore(event?.home_score);
    const awayScore = this.getScore(event?.away_score);
    const status = this.normalizeStatus(event);
    const odds = this.mapMainOdds(event?.main_odds);

    return {
      provider: 'sportscore',
      fixture: {
        id: Number(event?.id || 0),
        externalId: String(event?.id || ''),
        date: this.parseDate(event?.start_at),
        timestamp: null,
        timezone: 'UTC',
        status,
      },
      league: {
        id: Number(event?.league?.id || event?.league_id || 0),
        name: event?.league?.name || event?.challenge?.name || 'Liga não informada',
        country: event?.section?.name || event?.home_team?.country || event?.away_team?.country || '',
        logo: event?.league?.logo || '',
        priority: event?.league?.priority ?? event?.challenge?.priority ?? event?.section?.priority ?? 0,
        slug: event?.league?.slug || event?.challenge?.slug || '',
      },
      teams: {
        home: {
          id: Number(event?.home_team?.id || event?.home_team_id || 0),
          name: event?.home_team?.name || '',
          logo: event?.home_team?.logo || '',
          winner: event?.winner_code === 1 ? true : event?.winner_code ? false : null,
          gender: event?.home_team?.gender || null,
        },
        away: {
          id: Number(event?.away_team?.id || event?.away_team_id || 0),
          name: event?.away_team?.name || '',
          logo: event?.away_team?.logo || '',
          winner: event?.winner_code === 2 ? true : event?.winner_code ? false : null,
          gender: event?.away_team?.gender || null,
        },
      },
      goals: { home: homeScore, away: awayScore },
      score: { fulltime: { home: homeScore, away: awayScore } },
      odds,
      sportScoreRaw: event,
    };
  }

  private extractRows(payload: any) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  async getFixtures(date?: string) {
    const safeDate = this.normalizeDate(date);

    const endpoints = [
      `/sports/1/events/date/${safeDate}`,
      `/events/date/${safeDate}`,
    ];

    const errors: any[] = [];

    for (const endpoint of endpoints) {
      const response = await this.request(endpoint, { page: 1 });
      if (!response.ok) {
        errors.push(response.error);
        continue;
      }

      const data = this.extractRows(response.data).map((event: any) => this.mapEvent(event));
      return { ok: true, data, error: null };
    }

    return { ok: false, data: [], error: errors[0] || 'SportScore não retornou jogos por data' };
  }

  async getLiveFixtures() {
    const endpoints = [
      '/sports/1/events/live',
      '/events/live',
    ];

    const errors: any[] = [];

    for (const endpoint of endpoints) {
      const response = await this.request(endpoint, { page: 1 });
      if (!response.ok) {
        errors.push(response.error);
        continue;
      }

      const data = this.extractRows(response.data).map((event: any) => this.mapEvent(event));
      return { ok: true, data, error: null };
    }

    return { ok: false, data: [], error: errors[0] || 'SportScore não retornou jogos ao vivo' };
  }

  async getFixtureById(fixtureId: string) {
    const response = await this.request(`/events/${fixtureId}`);
    if (!response.ok) return { ok: false, data: null, error: response.error };

    const raw = response.data?.data || response.data;
    if (!raw || typeof raw !== 'object') return { ok: false, data: null, error: 'Evento SportScore não encontrado' };

    return { ok: true, data: this.mapEvent(raw), error: null };
  }

  async getStatistics(fixtureId: string) {
    const response = await this.request(`/events/${fixtureId}/statistics`);
    if (!response.ok) return { ok: false, data: null, error: response.error };

    const payload = response.data?.data || response.data;
    const rows = Array.isArray(payload) ? payload : payload?.statistics || payload?.stats || [];

    const teams = Array.isArray(rows)
      ? rows.map((item: any) => ({
          team: item?.team || item?.participant || { id: item?.team_id || 0, name: item?.team_name || '', logo: '' },
          statistics: (item?.statistics || item?.stats || item?.values || [])
            .map((stat: any) => ({
              type: stat?.type || stat?.name || stat?.key || stat?.label,
              value: stat?.value ?? stat?.total ?? stat?.amount ?? stat?.percent ?? null,
            }))
            .filter((stat: any) => stat.type),
        })).filter((team: any) => team.statistics.length > 0)
      : [];

    return {
      ok: teams.length > 0,
      data: {
        available: teams.length > 0,
        simulated: false,
        fixtureId,
        source: 'sportscore',
        message: teams.length > 0 ? 'Estatísticas reais da SportScore.' : 'Sem estatísticas reais disponíveis na SportScore.',
        teams,
        raw: payload,
      },
      error: teams.length > 0 ? null : 'Sem estatísticas reais disponíveis na SportScore',
    };
  }

  async getMarkets(fixtureId: string) {
    const response = await this.request(`/events/${fixtureId}/markets`);
    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data?.data || response.data, error: null };
  }

  async getLeagues() {
    const response = await this.request('/sports/1/leagues', { page: 1 });
    if (!response.ok) return { ok: false, data: [], error: response.error };
    return { ok: true, data: this.extractRows(response.data), error: null };
  }
}
