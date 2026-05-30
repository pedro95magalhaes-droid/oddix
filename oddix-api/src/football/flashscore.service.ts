import { Injectable } from '@nestjs/common';
import axios from 'axios';

type ProviderResult<T> = {
  ok: boolean;
  data: T;
  error: any | null;
};

@Injectable()
export class FlashScoreService {
  private readonly baseURL = 'https://flashscore4.p.rapidapi.com';

  isEnabled() {
    return String(process.env.FLASHSCORE_ENABLED || 'false').toLowerCase() === 'true';
  }

  hasKey() {
    return !!this.getKey();
  }

  private getKey() {
    return process.env.FLASHSCORE_KEY || process.env.RAPIDAPI_KEY || '';
  }

  private getHost() {
    return process.env.FLASHSCORE_HOST || 'flashscore4.p.rapidapi.com';
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

    // Mantém dentro do range do Int do Prisma/Postgres.
    return 1600000000 + (hash % 400000000);
  }

  private async request<T = any>(path: string, params: Record<string, any> = {}): Promise<ProviderResult<T | null>> {
    if (!this.isEnabled()) {
      return { ok: false, data: null, error: 'FlashScore desativada. Defina FLASHSCORE_ENABLED=true' };
    }

    const key = this.getKey();
    if (!key) {
      return { ok: false, data: null, error: 'FLASHSCORE_KEY não encontrada' };
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

      return { ok: true, data: response.data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na FlashScore',
      };
    }
  }

  private readArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.matches)) return data.matches;
    if (Array.isArray(data?.events)) return data.events;
    if (Array.isArray(data?.response)) return data.response;
    if (Array.isArray(data?.data?.matches)) return data.data.matches;
    if (Array.isArray(data?.data?.events)) return data.data.events;
    if (Array.isArray(data?.response?.matches)) return data.response.matches;
    if (Array.isArray(data?.response?.events)) return data.response.events;
    return [];
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

  private normalizeStatus(match: any) {
    const statusRaw = String(this.read(match, [
      'status.short',
      'status.type',
      'status.name',
      'status',
      'stage',
      'shortStatusText',
      'statusText',
    ], '')).toLowerCase();

    const elapsed = Number(this.read(match, [
      'time.minute',
      'minute',
      'gameTime',
      'elapsed',
      'status.elapsed',
    ], 0));

    if (statusRaw.includes('finished') || statusRaw.includes('ended') || statusRaw === 'ft' || statusRaw.includes('after')) {
      return { long: 'Match Finished', short: 'FT', elapsed: null, extra: null };
    }

    if (statusRaw.includes('postponed')) return { long: 'Postponed', short: 'PST', elapsed: null, extra: null };
    if (statusRaw.includes('cancel')) return { long: 'Canceled', short: 'CANC', elapsed: null, extra: null };

    if (statusRaw.includes('half') || statusRaw === 'ht') {
      return { long: 'Halftime', short: 'HT', elapsed: elapsed > 0 ? elapsed : 45, extra: null };
    }

    if (statusRaw.includes('live') || statusRaw.includes('progress') || statusRaw.includes('1st') || statusRaw.includes('2nd') || elapsed > 0) {
      const short = elapsed > 45 || statusRaw.includes('2nd') ? '2H' : '1H';
      return { long: short === '2H' ? 'Second Half' : 'First Half', short, elapsed: elapsed > 0 ? elapsed : null, extra: null };
    }

    if (statusRaw.includes('scheduled') || statusRaw.includes('not started') || statusRaw === 'ns') {
      return { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
    }

    return { long: statusRaw || 'Unknown', short: statusRaw ? statusRaw.toUpperCase().slice(0, 8) : 'UNK', elapsed: elapsed > 0 ? elapsed : null, extra: null };
  }

  private readTeam(match: any, side: 'home' | 'away') {
    const isHome = side === 'home';
    const prefix = isHome ? 'home' : 'away';
    const competitorPrefix = isHome ? 'homeTeam' : 'awayTeam';

    return {
      id: Number(this.read(match, [
        `${prefix}.id`,
        `${prefix}Team.id`,
        `${competitorPrefix}.id`,
        `${prefix}Competitor.id`,
      ], 0) || 0),
      name: String(this.read(match, [
        `${prefix}.name`,
        `${prefix}Team.name`,
        `${competitorPrefix}.name`,
        `${prefix}Competitor.name`,
        `${prefix}_name`,
      ], '')),
      logo: String(this.read(match, [
        `${prefix}.logo`,
        `${prefix}Team.logo`,
        `${competitorPrefix}.logo`,
        `${prefix}.image`,
        `${prefix}Team.image`,
      ], '')),
      winner: null,
    };
  }

  private readScore(match: any, side: 'home' | 'away') {
    const value = this.read(match, [
      `score.${side}`,
      `scores.${side}`,
      `${side}Score`,
      `${side}.score`,
      `${side}Team.score`,
      `${side}Competitor.score`,
    ], null);
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n < 100 ? n : null;
  }

  mapMatch(match: any) {
    const rawId = this.read(match, ['id', 'matchId', 'eventId', 'flashscoreId'], '');
    const fixtureId = this.stableNumericId(rawId);
    const status = this.normalizeStatus(match);
    const home = this.readTeam(match, 'home');
    const away = this.readTeam(match, 'away');
    const homeScore = this.readScore(match, 'home');
    const awayScore = this.readScore(match, 'away');

    const date = this.read(match, [
      'startTime',
      'start_time',
      'startDate',
      'date',
      'eventTime',
      'time.startTime',
    ], new Date().toISOString());

    return {
      provider: 'flashscore',
      fixture: {
        id: fixtureId,
        externalId: String(rawId || fixtureId),
        date,
        timestamp: date ? Math.floor(new Date(date).getTime() / 1000) : null,
        timezone: this.getTimezone(),
        status,
      },
      league: {
        id: Number(this.read(match, ['league.id', 'tournament.id', 'competition.id'], 0) || 0),
        name: String(this.read(match, ['league.name', 'tournament.name', 'competition.name', 'competitionDisplayName'], 'Liga não informada')),
        country: String(this.read(match, ['league.country.name', 'country.name', 'country'], '')),
        logo: String(this.read(match, ['league.logo', 'tournament.logo', 'competition.logo'], '')),
      },
      teams: { home, away },
      goals: { home: homeScore, away: awayScore },
      score: { fulltime: { home: homeScore, away: awayScore } },
      flashScoreRaw: match,
    };
  }

  async getLiveFixtures(): Promise<ProviderResult<any[]>> {
    const response = await this.request('/api/flashscore/v2/matches/live', {
      sport_id: 1,
      timezone: this.getTimezone(),
    });

    if (!response.ok || !response.data) return { ok: false, data: [], error: response.error };

    const matches = this.readArray(response.data).map((match) => this.mapMatch(match));
    return { ok: true, data: matches, error: null };
  }

  async getFixtures(date: string): Promise<ProviderResult<any[]>> {
    const response = await this.request('/api/flashscore/v2/matches/list-by-date', {
      sport_id: 1,
      date,
      timezone: this.getTimezone(),
    });

    if (!response.ok || !response.data) return { ok: false, data: [], error: response.error };

    const matches = this.readArray(response.data).map((match) => this.mapMatch(match));
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
