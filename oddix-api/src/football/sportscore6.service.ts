import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SportScore6Service {
  private readonly defaultBaseUrl = 'https://sportscore6.p.rapidapi.com';
  private readonly defaultHost = 'sportscore6.p.rapidapi.com';

  isEnabled() {
    return process.env.SPORTSCORE6_ENABLED === 'true';
  }

  hasKey() {
    return !!this.getKey();
  }

  getBaseUrl() {
    return (process.env.SPORTSCORE6_BASE_URL || this.defaultBaseUrl).replace(/\/$/, '');
  }

  private getHost() {
    return process.env.SPORTSCORE6_HOST || this.defaultHost;
  }

  private getKey() {
    return process.env.SPORTSCORE6_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '';
  }

  private getTimeoutMs() {
    return Number(process.env.SPORTSCORE6_TIMEOUT_MS || 15000);
  }

  private getLimit() {
    return Number(process.env.SPORTSCORE6_LIMIT || 100);
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
      return {
        ok: false,
        data: null,
        error: 'SportScore6 desativada. Defina SPORTSCORE6_ENABLED=true no .env',
      };
    }

    if (!this.hasKey()) {
      return {
        ok: false,
        data: null,
        error: 'SPORTSCORE6_RAPIDAPI_KEY não encontrada no .env',
      };
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
        error:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          `Erro SportScore6 em ${path}`,
      };
    }
  }

  private extractRows(payload: any) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.matches)) return payload.matches;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  private extractSlugFromUrl(url: any) {
    const raw = String(url || '').trim();
    const match = raw.match(/\/match\/([^/]+)\/?$/i);
    return match?.[1] || '';
  }

  private makeNumericId(seed: string) {
    const input = String(seed || 'sportscore6').trim();
    let hash = 0;

    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }

    return Number(hash || 1);
  }

  private parseDate(value: any) {
    if (!value) return new Date().toISOString();

    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

    return new Date().toISOString();
  }

  private normalizeStatus(match: any) {
    const status = String(match?.status || '').toLowerCase();
    const statusText = String(match?.status_text || '').toLowerCase();
    const liveMinute = Number(match?.live_minute || 0);

    if (status === 'finished' || statusText.includes('finished') || statusText === 'ft') {
      return { long: 'Match Finished', short: 'FT', elapsed: null, extra: null };
    }

    if (status === 'live' || statusText.includes('1st half') || statusText.includes('2nd half')) {
      if (statusText.includes('1st half')) {
        return { long: 'In Play', short: '1H', elapsed: liveMinute || 20, extra: null };
      }

      if (statusText.includes('2nd half')) {
        return { long: 'In Play', short: '2H', elapsed: liveMinute || 60, extra: null };
      }

      if (statusText.includes('half')) {
        return { long: 'Halftime', short: 'HT', elapsed: 45, extra: null };
      }

      return { long: 'In Play', short: 'LIVE', elapsed: liveMinute || null, extra: null };
    }

    if (status === 'upcoming' || statusText.includes('not started')) {
      return { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
    }

    if (statusText.includes('postponed')) {
      return { long: 'Postponed', short: 'PST', elapsed: null, extra: null };
    }

    if (statusText.includes('delayed')) {
      return { long: 'Delayed', short: 'TBD', elapsed: null, extra: null };
    }

    if (statusText.includes('cancel')) {
      return { long: 'Canceled', short: 'CANC', elapsed: null, extra: null };
    }

    return {
      long: match?.status_text || match?.status || 'Unknown',
      short: String(match?.status || 'UNK').toUpperCase().slice(0, 8),
      elapsed: liveMinute || null,
      extra: null,
    };
  }

  private mapStatsToOddix(fixtureId: string, match: any) {
    const stats = Array.isArray(match?.stats) ? match.stats : [];

    const homeStats: any[] = [];
    const awayStats: any[] = [];

    for (const stat of stats) {
      const label = stat?.label || stat?.type || stat?.name;
      if (!label) continue;

      homeStats.push({ type: label, value: stat?.home ?? null });
      awayStats.push({ type: label, value: stat?.away ?? null });
    }

    const teams = [
      {
        team: {
          id: 0,
          name: match?.home || 'Casa',
          logo: match?.home_logo || '',
        },
        statistics: homeStats.filter(
          (item) => item.value !== null && item.value !== undefined,
        ),
      },
      {
        team: {
          id: 0,
          name: match?.away || 'Fora',
          logo: match?.away_logo || '',
        },
        statistics: awayStats.filter(
          (item) => item.value !== null && item.value !== undefined,
        ),
      },
    ].filter((team) => team.statistics.length > 0);

    return {
      available: teams.length > 0,
      simulated: false,
      fixtureId,
      source: 'sportscore6',
      message:
        teams.length > 0
          ? 'Estatísticas reais da SportScore6.'
          : 'Sem estatísticas reais disponíveis na SportScore6.',
      teams,
      raw: stats,
    };
  }

  private mapMatch(match: any) {
    const slug = this.extractSlugFromUrl(match?.url);
    const trackerId = match?.tracker?.id || '';
    const stableId = this.makeNumericId(
      trackerId || slug || `${match?.home}-${match?.away}-${match?.time}`,
    );

    const status = this.normalizeStatus(match);

    const homeScore =
      match?.home_score === null || match?.home_score === undefined
        ? null
        : Number(match.home_score);

    const awayScore =
      match?.away_score === null || match?.away_score === undefined
        ? null
        : Number(match.away_score);

    return {
      provider: 'sportscore6',
      fixture: {
        id: stableId,
        externalId: slug,
        trackerId,
        profileId: match?.tracker?.profile || '',
        date: this.parseDate(match?.time),
        timestamp: null,
        timezone: 'UTC',
        status,
      },
      league: {
        id: this.makeNumericId(match?.competition || 'sportscore6-league'),
        name: match?.competition || 'Liga não informada',
        country: '',
        logo: match?.competition_logo || '',
        slug: '',
      },
      teams: {
        home: {
          id: this.makeNumericId(match?.home || 'home'),
          name: match?.home || '',
          logo: match?.home_logo || '',
          winner: homeScore !== null && awayScore !== null ? homeScore > awayScore : null,
        },
        away: {
          id: this.makeNumericId(match?.away || 'away'),
          name: match?.away || '',
          logo: match?.away_logo || '',
          winner: homeScore !== null && awayScore !== null ? awayScore > homeScore : null,
        },
      },
      goals: {
        home: homeScore,
        away: awayScore,
      },
      score: {
        fulltime: {
          home: homeScore,
          away: awayScore,
        },
        halftime: {
          home: match?.home_ht_score ?? null,
          away: match?.away_ht_score ?? null,
        },
      },
      lineups: match?.lineups || null,
      incidents: Array.isArray(match?.incidents) ? match.incidents : [],
      statistics: this.mapStatsToOddix(String(stableId), match),
      sportScore6Raw: {
        ...match,
        slug,
        urlSlug: slug,
        stableId,
      },
    };
  }

  async getFixtures(date?: string) {
    const response = await this.request('/api/widget/matches/', {
      sport: 'football',
      limit: this.getLimit(),
    });

    if (!response.ok) {
      return { ok: false, data: [], error: response.error };
    }

    const data = this.extractRows(response.data).map((match: any) =>
      this.mapMatch(match),
    );

    return { ok: true, data, error: null };
  }

  async getLiveFixtures() {
    const response = await this.request('/api/widget/matches/', {
      sport: 'football',
      limit: this.getLimit(),
    });

    if (!response.ok) {
      return { ok: false, data: [], error: response.error };
    }

    const data = this.extractRows(response.data)
      .filter((match: any) => String(match?.status || '').toLowerCase() === 'live')
      .map((match: any) => this.mapMatch(match));

    return { ok: true, data, error: null };
  }

  async getFixtureBySlug(slug: string) {
    const safeSlug = String(slug || '').trim();

    if (!safeSlug) {
      return {
        ok: false,
        data: null,
        error: 'Slug da partida não informado para SportScore6',
      };
    }

    const response = await this.request('/api/widget/match/', {
      sport: 'football',
      slug: safeSlug,
    });

    if (!response.ok) {
      return { ok: false, data: null, error: response.error };
    }

    const match = response.data?.match || response.data?.data || response.data;

    if (!match || typeof match !== 'object') {
      return {
        ok: false,
        data: null,
        error: 'Partida não encontrada na SportScore6',
      };
    }

    return {
      ok: true,
      data: this.mapMatch(match),
      error: null,
    };
  }

  async getStatistics(slug: string) {
    const response = await this.getFixtureBySlug(slug);

    if (!response.ok || !response.data) {
      return {
        ok: false,
        data: null,
        error: response.error || 'Sem partida para estatísticas SportScore6',
      };
    }

    const fixture = response.data as any;
    const stats = fixture.statistics;

    return {
      ok: !!stats?.available,
      data: stats,
      error: stats?.available ? null : 'Sem estatísticas reais disponíveis na SportScore6',
    };
  }

  async getTracker(trackerId: string) {
    const safeId = String(trackerId || '').trim();

    if (!safeId) {
      return {
        ok: false,
        data: null,
        error: 'Tracker ID não informado para SportScore6',
      };
    }

    const response = await this.request('/api/widget/tracker/', {
      sport: 'football',
      id: safeId,
    });

    if (!response.ok) {
      return { ok: false, data: null, error: response.error };
    }

    return {
      ok: true,
      data: response.data,
      error: null,
    };
  }
}