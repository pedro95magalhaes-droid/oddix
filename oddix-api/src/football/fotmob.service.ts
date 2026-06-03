import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FotmobService {
  private readonly logger = new Logger(FotmobService.name);

  private enabled() {
    return String(process.env.FOTMOB_ENABLED || 'false').toLowerCase() === 'true';
  }

  private baseUrl() {
    return process.env.FOTMOB_BASE_URL || 'https://fotmob-api.p.rapidapi.com';
  }

  private host() {
    return process.env.FOTMOB_API_HOST || process.env.FOTMOB_RAPIDAPI_HOST || 'fotmob-api.p.rapidapi.com';
  }

  private apiKey() {
    return process.env.FOTMOB_API_KEY || process.env.FOTMOB_RAPIDAPI_KEY || '';
  }

  private headers() {
    return {
      'x-rapidapi-key': this.apiKey(),
      'x-rapidapi-host': this.host(),
      'Content-Type': 'application/json',
      'User-Agent': 'Oddix/1.0',
    };
  }

  private async request(path: string, params: Record<string, any> = {}) {
    if (!this.enabled()) {
      throw new Error('FotMob desativada. Defina FOTMOB_ENABLED=true no .env');
    }

    if (!this.apiKey()) {
      throw new Error('FOTMOB_API_KEY/FOTMOB_RAPIDAPI_KEY não configurada.');
    }

    const url = `${this.baseUrl()}${path}`;

    const response = await axios.get(url, {
      params,
      headers: this.headers(),
      timeout: 20000,
    });

    return response.data;
  }

  async getMatchesByDate(date: string) {
    try {
      return await this.request('/api/v1/matches/by-date', {
        date,
        timezone: process.env.FOTMOB_TIMEZONE || 'America/Sao_Paulo',
      });
    } catch (error: any) {
      this.logger.warn(`FotMob by-date falhou: ${error?.response?.data?.message || error?.message}`);
      throw error;
    }
  }

  async getLiveMatches() {
    try {
      return await this.request('/api/v1/matches/live', {
        timezone: process.env.FOTMOB_TIMEZONE || 'America/Sao_Paulo',
      });
    } catch (error: any) {
      this.logger.warn(`FotMob live falhou: ${error?.response?.data?.message || error?.message}`);
      throw error;
    }
  }

  async getMatch(id: string | number) {
    return this.getMatchDetails(id);
  }

  async getMatchDetails(id: string | number) {
    try {
      return await this.request(`/api/v1/matches/${id}`);
    } catch (error: any) {
      this.logger.warn(`FotMob match details falhou (${id}): ${error?.response?.data?.message || error?.message}`);
      throw error;
    }
  }

  async getMatchScore(id: string | number) {
    try {
      return await this.request(`/api/v1/matches/${id}/score`);
    } catch (error: any) {
      this.logger.warn(`FotMob score falhou (${id}): ${error?.response?.data?.message || error?.message}`);
      throw error;
    }
  }

  async getMomentum(id: string | number) {
    try {
      return await this.request(`/api/v1/matches/${id}/momentum`);
    } catch (error: any) {
      this.logger.warn(`FotMob momentum falhou (${id}): ${error?.response?.data?.message || error?.message}`);
      throw error;
    }
  }

  async getMatchMomentum(id: string | number) {
    return this.getMomentum(id);
  }

  async getShotmap(id: string | number) {
    try {
      return await this.request(`/api/v1/matches/${id}/shotmap`);
    } catch (error: any) {
      this.logger.warn(`FotMob shotmap falhou (${id}): ${error?.response?.data?.message || error?.message}`);
      throw error;
    }
  }

  async getMatchShotmap(id: string | number) {
    return this.getShotmap(id);
  }

  async getLineups(id: string | number) {
    try {
      return await this.request(`/api/v1/matches/${id}/lineups`);
    } catch (error: any) {
      this.logger.warn(`FotMob lineups falhou (${id}): ${error?.response?.data?.message || error?.message}`);
      throw error;
    }
  }

  async getMatchLineups(id: string | number) {
    return this.getLineups(id);
  }

  async getStatistics(id: string | number) {
    try {
      const [details, momentum, shotmap, lineups] = await Promise.allSettled([
        this.getMatchDetails(id),
        this.getMomentum(id),
        this.getShotmap(id),
        this.getLineups(id),
      ]);

      return {
        available: true,
        source: 'fotmob',
        fixtureId: String(id),
        details: details.status === 'fulfilled' ? details.value : null,
        momentum: momentum.status === 'fulfilled' ? momentum.value : null,
        shotmap: shotmap.status === 'fulfilled' ? shotmap.value : null,
        lineups: lineups.status === 'fulfilled' ? lineups.value : null,
        raw: {
          details: details.status === 'fulfilled' ? details.value : null,
          momentum: momentum.status === 'fulfilled' ? momentum.value : null,
          shotmap: shotmap.status === 'fulfilled' ? shotmap.value : null,
          lineups: lineups.status === 'fulfilled' ? lineups.value : null,
        },
      };
    } catch (error: any) {
      this.logger.warn(`FotMob statistics falhou (${id}): ${error?.response?.data?.message || error?.message}`);
      return {
        available: false,
        source: 'fotmob',
        fixtureId: String(id),
        message: error?.response?.data?.message || error?.message || 'Sem estatísticas FotMob.',
        raw: null,
      };
    }
  }

  normalizeMatch(raw: any) {
    const item = raw?.match || raw;
    const home = item?.home || item?.homeTeam || item?.teams?.home || {};
    const away = item?.away || item?.awayTeam || item?.teams?.away || {};
    const league = item?.league || item?.tournament || item?.competition || {};
    const status = item?.status || item?.statusData || {};

    return {
      provider: 'fotmob',
      fixture: {
        id: item?.id || item?.matchId || item?.fixtureId,
        externalId: String(item?.id || item?.matchId || item?.fixtureId || ''),
        date: item?.date || item?.startTime || item?.status?.utcTime || item?.utcTime,
        timestamp: item?.timeTS || item?.timestamp || null,
        timezone: 'UTC',
        status: {
          long: status?.long || status?.status || status?.reason?.long || item?.statusStr || '',
          short: status?.short || status?.statusShort || item?.statusStr || '',
          elapsed: status?.elapsed || status?.liveTime?.short || 0,
          extra: status?.extra || null,
        },
      },
      league: {
        id: league?.id || league?.primaryId || 0,
        name: league?.name || league?.localizedName || 'Liga',
        country: league?.ccode || league?.country || league?.countryName || '',
        logo: league?.logo || '',
      },
      teams: {
        home: {
          id: home?.id || home?.teamId || 0,
          name: home?.name || home?.shortName || 'Casa',
          logo: home?.logo || home?.imageUrl || (home?.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${home.id}_small.png` : ''),
          winner: home?.winner ?? false,
          redCards: home?.redCards || 0,
        },
        away: {
          id: away?.id || away?.teamId || 0,
          name: away?.name || away?.shortName || 'Fora',
          logo: away?.logo || away?.imageUrl || (away?.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${away.id}_small.png` : ''),
          winner: away?.winner ?? false,
          redCards: away?.redCards || 0,
        },
      },
      goals: {
        home: item?.homeScore ?? item?.score?.home ?? item?.scores?.home ?? 0,
        away: item?.awayScore ?? item?.score?.away ?? item?.scores?.away ?? 0,
      },
      score: {
        fulltime: {
          home: item?.homeScore ?? item?.score?.home ?? item?.scores?.home ?? 0,
          away: item?.awayScore ?? item?.score?.away ?? item?.scores?.away ?? 0,
        },
      },
    };
  }

  normalizeMatches(payload: any) {
    const list =
      payload?.matches ||
      payload?.data?.matches ||
      payload?.fixtures ||
      payload?.data ||
      payload?.events ||
      [];

    if (!Array.isArray(list)) return [];

    return list.map((item) => this.normalizeMatch(item));
  }
}
