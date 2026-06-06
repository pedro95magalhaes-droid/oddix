import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SoccerFootballInfoService {
  private readonly logger = new Logger(SoccerFootballInfoService.name);

  isEnabled() {
    return this.enabled();
  }

  hasKey() {
    return !!this.apiKey();
  }

  getBaseUrl() {
    return this.baseUrl();
  }

  private enabled() {
    return (
      String(
        process.env.SOCCER_FOOTBALL_INFO_ENABLED || 'false',
      ).toLowerCase() === 'true'
    );
  }

  private baseUrl() {
    return 'https://soccer-football-info.p.rapidapi.com';
  }

  private host() {
    return (
      process.env.SOCCER_FOOTBALL_INFO_HOST ||
      'soccer-football-info.p.rapidapi.com'
    );
  }

  private apiKey() {
    return process.env.SOCCER_FOOTBALL_INFO_KEY || '';
  }

  private headers() {
    return {
      'x-rapidapi-key': this.apiKey(),
      'x-rapidapi-host': this.host(),
      'Content-Type': 'application/json',
      'User-Agent': 'Oddix/2.0',
    };
  }

  private async request(path: string, params: Record<string, any> = {}) {
    if (!this.enabled()) {
      throw new Error(
        'Soccer Football Info desativada. Defina SOCCER_FOOTBALL_INFO_ENABLED=true',
      );
    }

    if (!this.apiKey()) {
      throw new Error(
        'SOCCER_FOOTBALL_INFO_KEY não configurada.',
      );
    }

    const url = `${this.baseUrl()}${path}`;

    const response = await axios.get(url, {
      params,
      headers: this.headers(),
      timeout: 20000,
    });

    return response.data;
  }

  async getLiveMatches() {
    try {
      return await this.request('/live/full/', {
        l: 'en_US',
        f: 'json',
        e: 'no',
      });
    } catch (error: any) {
      this.logger.warn(
        `Soccer Football Info live falhou: ${
          error?.response?.data?.message || error?.message
        }`,
      );

      throw error;
    }
  }

  async getMatchDetails(
    matchId: string,
    competitionId?: string,
    seasonId?: string,
  ) {
    try {
      return await this.request('/matches/by/full/', {
        m: matchId,
        p: 1,
        l: 'en_US',
        c: competitionId,
        s: seasonId,
      });
    } catch (error: any) {
      this.logger.warn(
        `Soccer Football Info details falhou (${matchId}): ${
          error?.response?.data?.message || error?.message
        }`,
      );

      throw error;
    }
  }

  async getStatistics(
    matchId: string,
    competitionId?: string,
    seasonId?: string,
  ) {
    try {
      const details = await this.getMatchDetails(
        matchId,
        competitionId,
        seasonId,
      );

      return {
        available: true,
        source: 'soccer-football-info',
        fixtureId: String(matchId),
        details,
        raw: details,
      };
    } catch (error: any) {
      return {
        available: false,
        source: 'soccer-football-info',
        fixtureId: String(matchId),
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Sem estatísticas Soccer Football Info',
        raw: null,
      };
    }
  }

  normalizeMatch(raw: any) {
    const home =
      raw?.homeTeam ||
      raw?.home ||
      raw?.teams?.home ||
      {};

    const away =
      raw?.awayTeam ||
      raw?.away ||
      raw?.teams?.away ||
      {};

    return {
      provider: 'soccer-football-info',

      fixture: {
        id: raw?.id || raw?.matchId,
        externalId: String(raw?.id || raw?.matchId || ''),
        date: raw?.date || raw?.startTime,
        timestamp: raw?.timestamp || null,

        status: {
          long: raw?.status || '',
          short: raw?.statusShort || '',
          elapsed: raw?.minute || 0,
          extra: null,
        },

        timezone: 'UTC',
      },

      league: {
        id: raw?.competitionId || 0,
        name: raw?.competitionName || 'Liga',
        country: raw?.country || '',
        logo: raw?.competitionLogo || '',
      },

      teams: {
        home: {
          id: home?.id || 0,
          name: home?.name || 'Casa',
          logo: home?.logo || '',
          winner: false,
        },

        away: {
          id: away?.id || 0,
          name: away?.name || 'Fora',
          logo: away?.logo || '',
          winner: false,
        },
      },

      goals: {
        home: raw?.homeScore || 0,
        away: raw?.awayScore || 0,
      },

      score: {
        fulltime: {
          home: raw?.homeScore || 0,
          away: raw?.awayScore || 0,
        },
      },
    };
  }

  normalizeMatches(payload: any) {
    const matches =
      payload?.matches ||
      payload?.events ||
      payload?.data ||
      [];

    if (!Array.isArray(matches)) {
      return [];
    }

    return matches.map((m) => this.normalizeMatch(m));
  }
}