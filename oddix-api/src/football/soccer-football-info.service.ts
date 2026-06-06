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
      String(process.env.SOCCER_FOOTBALL_INFO_ENABLED || 'false').toLowerCase() ===
      'true'
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

  private normalizeName(value: any) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(fc|sc|ec|ac|afc|cf|club|clube|united|city)\b/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private namesMatch(a: string, b: string) {
    const x = this.normalizeName(a);
    const y = this.normalizeName(b);

    if (!x || !y) return false;
    if (x === y) return true;
    if (x.includes(y) || y.includes(x)) return true;

    const xParts = x.split(' ').filter(Boolean);
    const yParts = y.split(' ').filter(Boolean);

    const common = xParts.filter((p) => yParts.includes(p));
    return common.length >= Math.min(2, Math.min(xParts.length, yParts.length));
  }

  private async request(path: string, params: Record<string, any> = {}) {
    if (!this.enabled()) {
      throw new Error(
        'Soccer Football Info desativada. Defina SOCCER_FOOTBALL_INFO_ENABLED=true',
      );
    }

    if (!this.apiKey()) {
      throw new Error('SOCCER_FOOTBALL_INFO_KEY não configurada.');
    }

    const response = await axios.get(`${this.baseUrl()}${path}`, {
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
      const params: Record<string, any> = {
        m: matchId,
        p: 1,
        l: 'en_US',
      };

      if (competitionId) params.c = competitionId;
      if (seasonId) params.s = seasonId;

      return await this.request('/matches/by/full/', params);
    } catch (error: any) {
      this.logger.warn(
        `Soccer Football Info details falhou (${matchId}): ${
          error?.response?.data?.message || error?.message
        }`,
      );
      throw error;
    }
  }

  private extractList(payload: any): any[] {
    const possible =
      payload?.matches ||
      payload?.events ||
      payload?.data?.matches ||
      payload?.data?.events ||
      payload?.data ||
      payload?.response ||
      [];

    if (Array.isArray(possible)) return possible;

    if (possible && typeof possible === 'object') {
      return Object.values(possible).flat().filter(Boolean);
    }

    return [];
  }

  private getHomeName(raw: any) {
    return (
      raw?.homeTeam?.name ||
      raw?.home_team?.name ||
      raw?.home?.name ||
      raw?.teams?.home?.name ||
      raw?.homeTeam ||
      raw?.home ||
      ''
    );
  }

  private getAwayName(raw: any) {
    return (
      raw?.awayTeam?.name ||
      raw?.away_team?.name ||
      raw?.away?.name ||
      raw?.teams?.away?.name ||
      raw?.awayTeam ||
      raw?.away ||
      ''
    );
  }

  private getMatchId(raw: any) {
    return String(
      raw?.id ||
        raw?.matchId ||
        raw?.match_id ||
        raw?.mid ||
        raw?.fixtureId ||
        raw?.fixture_id ||
        '',
    );
  }

  private getCompetitionId(raw: any) {
    return String(
      raw?.competitionId ||
        raw?.competition_id ||
        raw?.competition?.id ||
        raw?.leagueId ||
        raw?.league_id ||
        raw?.league?.id ||
        '',
    );
  }

  private getSeasonId(raw: any) {
    return String(
      raw?.seasonId ||
        raw?.season_id ||
        raw?.season?.id ||
        raw?.tournamentSeasonId ||
        '',
    );
  }

  async findLiveMatchByTeams(homeTeam: string, awayTeam: string) {
    const payload = await this.getLiveMatches();
    const matches = this.extractList(payload);

    const found = matches.find((match: any) => {
      const home = this.getHomeName(match);
      const away = this.getAwayName(match);

      return (
        this.namesMatch(home, homeTeam) &&
        this.namesMatch(away, awayTeam)
      );
    });

    if (found) return found;

    return matches.find((match: any) => {
      const home = this.getHomeName(match);
      const away = this.getAwayName(match);

      return (
        this.namesMatch(home, awayTeam) &&
        this.namesMatch(away, homeTeam)
      );
    });
  }

  async getStatisticsByTeams(homeTeam: string, awayTeam: string) {
    try {
      const match = await this.findLiveMatchByTeams(homeTeam, awayTeam);

      if (!match) {
        return {
          available: false,
          simulated: false,
          source: 'soccer-football-info',
          message: 'Jogo não encontrado na Soccer Football Info por times.',
          teams: [],
          raw: null,
        };
      }

      const matchId = this.getMatchId(match);
      const competitionId = this.getCompetitionId(match);
      const seasonId = this.getSeasonId(match);

      if (!matchId) {
        return {
          available: false,
          simulated: false,
          source: 'soccer-football-info',
          message: 'Jogo encontrado, mas sem matchId válido.',
          teams: [],
          raw: match,
        };
      }

      const details = await this.getMatchDetails(matchId, competitionId, seasonId);
      const normalizedStats = this.normalizeStatistics(details, matchId);

      return {
        ...normalizedStats,
        match,
        details,
        raw: details,
      };
    } catch (error: any) {
      return {
        available: false,
        simulated: false,
        source: 'soccer-football-info',
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Erro ao buscar estatísticas por times na Soccer Football Info.',
        teams: [],
        raw: null,
      };
    }
  }

  async getStatistics(
    matchId: string,
    competitionId?: string,
    seasonId?: string,
  ) {
    try {
      const details = await this.getMatchDetails(matchId, competitionId, seasonId);
      return this.normalizeStatistics(details, matchId);
    } catch (error: any) {
      return {
        available: false,
        simulated: false,
        source: 'soccer-football-info',
        fixtureId: String(matchId),
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Sem estatísticas Soccer Football Info.',
        teams: [],
        raw: null,
      };
    }
  }

  private numeric(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;

    const parsed = Number(
      String(value)
        .replace('%', '')
        .replace(',', '.')
        .trim(),
    );

    return Number.isFinite(parsed) ? parsed : null;
  }

  private findValue(obj: any, keys: string[]) {
    if (!obj || typeof obj !== 'object') return null;

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const found = this.findValue(value, keys);
        if (found !== null && found !== undefined) return found;
      }
    }

    return null;
  }

  private normalizeStatistics(payload: any, fixtureId: string) {
    const homeName =
      this.getHomeName(payload) ||
      this.getHomeName(payload?.match) ||
      'Casa';

    const awayName =
      this.getAwayName(payload) ||
      this.getAwayName(payload?.match) ||
      'Fora';

    const homeStats =
      payload?.homeStats ||
      payload?.home_statistics ||
      payload?.statistics?.home ||
      payload?.stats?.home ||
      payload?.home?.stats ||
      payload?.homeTeam?.stats ||
      {};

    const awayStats =
      payload?.awayStats ||
      payload?.away_statistics ||
      payload?.statistics?.away ||
      payload?.stats?.away ||
      payload?.away?.stats ||
      payload?.awayTeam?.stats ||
      {};

    const buildStats = (stats: any) => {
      const corners = this.numeric(
        this.findValue(stats, ['corners', 'corner_kicks', 'cornerKicks']),
      );

      const shotsOnGoal = this.numeric(
        this.findValue(stats, [
          'shots_on_goal',
          'shotsOnGoal',
          'shots_on_target',
          'shotsOnTarget',
          'sot',
        ]),
      );

      const totalShots = this.numeric(
        this.findValue(stats, ['shots', 'total_shots', 'totalShots']),
      );

      const possession = this.numeric(
        this.findValue(stats, ['possession', 'ball_possession']),
      );

      const yellowCards = this.numeric(
        this.findValue(stats, ['yellow_cards', 'yellowCards']),
      );

      return [
        { type: 'Corner Kicks', value: corners },
        { type: 'Shots on Goal', value: shotsOnGoal },
        { type: 'Total Shots', value: totalShots },
        { type: 'Ball Possession', value: possession },
        { type: 'Yellow Cards', value: yellowCards },
      ].filter((s) => s.value !== null && s.value !== undefined);
    };

    const teams = [
      {
        team: { name: homeName },
        statistics: buildStats(homeStats),
      },
      {
        team: { name: awayName },
        statistics: buildStats(awayStats),
      },
    ];

    const hasStats = teams.some((team) => team.statistics.length > 0);

    return {
      available: hasStats,
      simulated: false,
      fixtureId: String(fixtureId),
      source: 'soccer-football-info',
      message: hasStats
        ? 'Estatísticas reais da Soccer Football Info.'
        : 'Sem estatísticas reais na Soccer Football Info.',
      teams,
      raw: payload,
    };
  }

  normalizeMatch(raw: any) {
    const homeName = this.getHomeName(raw);
    const awayName = this.getAwayName(raw);

    const matchId = this.getMatchId(raw);
    const competitionId = this.getCompetitionId(raw);
    const seasonId = this.getSeasonId(raw);

    return {
      provider: 'soccer-football-info',

      fixture: {
        id: matchId || raw?.id || raw?.matchId,
        externalId: matchId || '',
        competitionId,
        seasonId,
        date:
          raw?.date ||
          raw?.startTime ||
          raw?.start_time ||
          raw?.time ||
          raw?.utcTime ||
          null,
        timestamp: raw?.timestamp || raw?.timeTS || null,

        status: {
          long: raw?.status || raw?.statusName || raw?.status_name || '',
          short: raw?.statusShort || raw?.status_short || raw?.shortStatus || '',
          elapsed: raw?.minute || raw?.elapsed || raw?.time || 0,
          extra: raw?.extra || null,
        },

        timezone: 'UTC',
      },

      league: {
        id: competitionId || 0,
        name:
          raw?.competitionName ||
          raw?.competition?.name ||
          raw?.league?.name ||
          'Liga',
        country: raw?.country || raw?.competition?.country || '',
        logo: raw?.competitionLogo || raw?.league?.logo || '',
      },

      teams: {
        home: {
          id: raw?.homeTeam?.id || raw?.home?.id || 0,
          name: homeName || 'Casa',
          logo: raw?.homeTeam?.logo || raw?.home?.logo || '',
          winner: false,
        },

        away: {
          id: raw?.awayTeam?.id || raw?.away?.id || 0,
          name: awayName || 'Fora',
          logo: raw?.awayTeam?.logo || raw?.away?.logo || '',
          winner: false,
        },
      },

      goals: {
        home: Number(raw?.homeScore ?? raw?.score?.home ?? 0),
        away: Number(raw?.awayScore ?? raw?.score?.away ?? 0),
      },

      score: {
        fulltime: {
          home: Number(raw?.homeScore ?? raw?.score?.home ?? 0),
          away: Number(raw?.awayScore ?? raw?.score?.away ?? 0),
        },
      },
    };
  }

  normalizeMatches(payload: any) {
    return this.extractList(payload).map((m) => this.normalizeMatch(m));
  }
}