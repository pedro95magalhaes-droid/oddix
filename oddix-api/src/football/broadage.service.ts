import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class BroadageService {
  private readonly defaultBaseUrl = 'https://soccer-data.p.rapidapi.com';
  private readonly defaultHost = 'soccer-data.p.rapidapi.com';

  isEnabled() {
    return process.env.BROADAGE_ENABLED === 'true';
  }

  hasKey() {
    return !!this.getKey();
  }

  getBaseUrl() {
    return (process.env.BROADAGE_BASE_URL || this.defaultBaseUrl).replace(/\/$/, '');
  }

  private getHost() {
    return process.env.BROADAGE_HOST || this.defaultHost;
  }

  private getKey() {
    return process.env.BROADAGE_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '';
  }

  private getTimeoutMs() {
    return Number(process.env.BROADAGE_TIMEOUT_MS || 12000);
  }

  private headers() {
    const key = this.getKey();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-rapidapi-host': this.getHost(),
    };

    if (key) headers['x-rapidapi-key'] = key;

    return headers;
  }

  private formatBroadageDate(date: string) {
    // Broadage/RapidAPI endpoint confirmado usa DD/MM/YYYY: 29/01/2021
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;

    const parsed = new Date(`${date}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return date;

    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getUTCFullYear();

    return `${dd}/${mm}/${yyyy}`;
  }

  private normalizeName(name: any) {
    return String(name || '').trim();
  }

  private parseScore(value: any) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private parseBroadageDateValue(value: any) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    // Broadage costuma enviar DD/MM/YYYY HH:mm:ss.
    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
    if (br) {
      const [, dd, mm, yyyy, timeRaw] = br;
      const time = timeRaw ? (timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw) : '00:00:00';
      const parsed = new Date(`${yyyy}-${mm}-${dd}T${time}.000Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

    return null;
  }

  private parseDate(raw: any, fallbackDate?: string) {
    const dateValue =
      raw?.date ||
      raw?.matchDate ||
      raw?.match_date ||
      raw?.startDate ||
      raw?.start_date ||
      raw?.kickoff ||
      raw?.kickOff ||
      raw?.utcDate ||
      raw?.scheduled_at ||
      raw?.scheduledAt ||
      null;

    const parsedFromProvider = this.parseBroadageDateValue(dateValue);
    if (parsedFromProvider) return parsedFromProvider;

    const timeValue = raw?.time || raw?.matchTime || raw?.kickoffTime || raw?.startTime || '00:00:00';

    if (fallbackDate) {
      const yyyyMmDd = /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)
        ? fallbackDate
        : this.convertBroadageDateToIso(fallbackDate);

      const parsed = new Date(`${yyyyMmDd}T${String(timeValue).slice(0, 8)}.000Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    return new Date().toISOString();
  }

  private convertBroadageDateToIso(date: string) {
    const [dd, mm, yyyy] = String(date).split('/');
    if (!dd || !mm || !yyyy) return date;
    return `${yyyy}-${mm}-${dd}`;
  }

  private dateKeyFromIso(iso: string) {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  private isProviderDateAcceptable(raw: any, fallbackDate?: string) {
    const fixtureDate = this.parseDate(raw, fallbackDate);
    const parsed = new Date(fixtureDate);
    if (Number.isNaN(parsed.getTime())) return false;

    const currentYear = new Date().getUTCFullYear();
    if (parsed.getUTCFullYear() < currentYear - 1) return false;

    // Para lista diária, se o provider devolver um exemplo antigo ou de outra data, descarta.
    if (fallbackDate) {
      const requestedKey = /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)
        ? fallbackDate
        : this.convertBroadageDateToIso(fallbackDate);

      if (/^\d{4}-\d{2}-\d{2}$/.test(requestedKey)) {
        return this.dateKeyFromIso(fixtureDate) === requestedKey;
      }
    }

    return true;
  }

  private getStatus(raw: any) {
    const statusRaw = raw?.status || raw?.matchStatus || raw?.match_status || raw?.state || raw?.period || {};
    const statusText =
      typeof statusRaw === 'string'
        ? statusRaw
        : statusRaw?.name || statusRaw?.long || statusRaw?.short || statusRaw?.description || '';

    const s = String(statusText || '').toLowerCase();

    if (s.includes('finished') || s === 'ft' || s.includes('full')) {
      return { long: 'Match Finished', short: 'FT', elapsed: raw?.minute ?? raw?.elapsed ?? null, extra: null };
    }

    if (s.includes('half') || s === 'ht') {
      return { long: 'Halftime', short: 'HT', elapsed: raw?.minute ?? raw?.elapsed ?? 45, extra: null };
    }

    if (s.includes('live') || s.includes('play') || s === '1h' || s === '2h') {
      return {
        long: 'In Play',
        short: s === '1h' ? '1H' : s === '2h' ? '2H' : 'LIVE',
        elapsed: raw?.minute ?? raw?.elapsed ?? raw?.time_elapsed ?? null,
        extra: raw?.extra ?? null,
      };
    }

    if (s.includes('postpon')) return { long: 'Postponed', short: 'PST', elapsed: null, extra: null };
    if (s.includes('cancel')) return { long: 'Canceled', short: 'CANC', elapsed: null, extra: null };

    return { long: statusText || 'Not Started', short: statusText ? String(statusText).toUpperCase().slice(0, 8) : 'NS', elapsed: null, extra: null };
  }

  private findArray(payload: any): any[] {
    if (Array.isArray(payload)) return payload;

    const direct =
      payload?.data ||
      payload?.matches ||
      payload?.matchList ||
      payload?.match_list ||
      payload?.fixtures ||
      payload?.events ||
      payload?.result ||
      payload?.response;

    if (Array.isArray(direct)) return direct;

    if (direct && typeof direct === 'object') {
      const nested = this.findArray(direct);
      if (nested.length) return nested;
    }

    if (payload && typeof payload === 'object') {
      for (const value of Object.values(payload)) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object') {
          const nested = this.findArray(value);
          if (nested.length) return nested;
        }
      }
    }

    return [];
  }

  private mapFixture(raw: any, fallbackDate?: string) {
    if (!this.isProviderDateAcceptable(raw, fallbackDate)) return null;

    const home = raw?.homeTeam || raw?.home_team || raw?.home || raw?.teamHome || raw?.localTeam || raw?.competitors?.home || raw?.teams?.home || {};
    const away = raw?.awayTeam || raw?.away_team || raw?.away || raw?.teamAway || raw?.visitorTeam || raw?.competitors?.away || raw?.teams?.away || {};
    const league = raw?.tournament || raw?.competition || raw?.league || raw?.season?.tournament || {};
    const country = raw?.country || league?.country || league?.countryName || league?.category || {};

    const homeScore = this.parseScore(raw?.homeScore ?? raw?.home_score ?? raw?.score?.home ?? raw?.goals?.home ?? home?.score);
    const awayScore = this.parseScore(raw?.awayScore ?? raw?.away_score ?? raw?.score?.away ?? raw?.goals?.away ?? away?.score);
    const status = this.getStatus(raw);
    const fixtureDate = this.parseDate(raw, fallbackDate);

    const fixtureId =
      raw?.id ||
      raw?.matchId ||
      raw?.match_id ||
      raw?.fixtureId ||
      raw?.fixture_id ||
      raw?.eventId ||
      raw?.event_id ||
      `${this.normalizeName(home?.name || home?.displayName)}-${this.normalizeName(away?.name || away?.displayName)}-${fixtureDate}`;

    return {
      provider: 'broadage',
      fixture: {
        id: Number(String(fixtureId).replace(/\D/g, '').slice(0, 15)) || Math.abs(this.hashCode(String(fixtureId))),
        externalId: String(fixtureId),
        date: fixtureDate,
        timestamp: null,
        timezone: 'UTC',
        status,
      },
      league: {
        id: Number(league?.id || league?.tournamentId || league?.competitionId || 0),
        name: league?.name || league?.displayName || league?.tournamentName || league?.competitionName || raw?.tournamentName || raw?.leagueName || 'Liga não informada',
        country: typeof country === 'string' ? country : country?.name || country?.displayName || raw?.countryName || '',
        logo: league?.logo || league?.image || league?.imageUrl || league?.logoUrl || '',
      },
      teams: {
        home: {
          id: Number(home?.id || home?.teamId || home?.team_id || 0),
          name: this.normalizeName(home?.name || home?.displayName || home?.teamName || raw?.homeTeamName || raw?.home_name),
          logo: home?.logo || home?.image || home?.imageUrl || home?.logoUrl || '',
          winner: homeScore !== null && awayScore !== null ? homeScore > awayScore : null,
        },
        away: {
          id: Number(away?.id || away?.teamId || away?.team_id || 0),
          name: this.normalizeName(away?.name || away?.displayName || away?.teamName || raw?.awayTeamName || raw?.away_name),
          logo: away?.logo || away?.image || away?.imageUrl || away?.logoUrl || '',
          winner: homeScore !== null && awayScore !== null ? awayScore > homeScore : null,
        },
      },
      goals: { home: homeScore, away: awayScore },
      score: { fulltime: { home: homeScore, away: awayScore } },
      broadageRaw: raw,
    };
  }

  private hashCode(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash || 1;
  }

  private async request(path: string, params: Record<string, any> = {}) {
    if (!this.isEnabled()) {
      return { ok: false, data: null, error: 'Broadage desativada. Defina BROADAGE_ENABLED=true no .env' };
    }

    if (!this.hasKey()) {
      return { ok: false, data: null, error: 'BROADAGE_RAPIDAPI_KEY não encontrada no .env' };
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
        error: error?.response?.data?.message || error?.response?.data || error?.message || `Erro Broadage em ${path}`,
      };
    }
  }

  async getScheduledFixtures(date: string) {
    const broadageDate = this.formatBroadageDate(date);
    const response = await this.request('/match/list/scheduled', { date: broadageDate });

    if (!response.ok) return { ok: false, data: [], error: response.error };

    const rows = this.findArray(response.data);
    const data = rows.map((item) => this.mapFixture(item, broadageDate)).filter(Boolean);

    return { ok: true, data, error: null };
  }

  async getLiveFixtures() {
    const livePaths = [
      '/match/list/live',
      '/match/list/inplay',
      '/match/live/list',
    ];

    const errors: any[] = [];

    for (const path of livePaths) {
      const response = await this.request(path);
      if (!response.ok) {
        errors.push(response.error);
        continue;
      }

      const rows = this.findArray(response.data);
      const data = rows.map((item) => this.mapFixture(item)).filter(Boolean);
      if (data.length > 0) return { ok: true, data, error: null };
    }

    return { ok: false, data: [], error: errors[0] || 'Endpoint live Broadage ainda não confirmado' };
  }

  async getFixtureById(fixtureId: string) {
    const paths = [
      '/match/info',
      '/match/detail',
      '/match/details',
    ];

    const errors: any[] = [];

    for (const path of paths) {
      const response = await this.request(path, { id: fixtureId, matchId: fixtureId });
      if (!response.ok) {
        errors.push(response.error);
        continue;
      }

      const rows = this.findArray(response.data);
      const raw = rows[0] || response.data?.data || response.data?.match || response.data;
      if (raw && typeof raw === 'object') {
        const mapped = this.mapFixture(raw);
        return mapped
          ? { ok: true, data: mapped, error: null }
          : { ok: false, data: null, error: 'Fixture Broadage descartado por data antiga/inválida' };
      }
    }

    return { ok: false, data: null, error: errors[0] || 'Endpoint Match Info Broadage ainda não confirmado' };
  }

  async getStatistics(fixtureId: string) {
    const paths = [
      '/match/stats',
      '/match/statistics',
      '/match/detailed-info',
      '/match/details',
    ];

    const errors: any[] = [];

    for (const path of paths) {
      const response = await this.request(path, { id: fixtureId, matchId: fixtureId });
      if (!response.ok) {
        errors.push(response.error);
        continue;
      }

      const payload = response.data?.data || response.data;
      const teams = this.mapStatisticsTeams(payload);

      if (teams.length > 0) {
        return {
          ok: true,
          data: {
            available: true,
            simulated: false,
            fixtureId,
            source: 'broadage',
            message: 'Estatísticas reais da Broadage Soccer Data.',
            teams,
          },
          error: null,
        };
      }
    }

    return { ok: false, data: null, error: errors[0] || 'Endpoint Match Stats Broadage ainda não confirmado' };
  }

  private mapStatisticsTeams(payload: any) {
    const candidates =
      payload?.teams ||
      payload?.statistics ||
      payload?.stats ||
      payload?.matchStats ||
      payload?.match_statistics ||
      [];

    if (!Array.isArray(candidates)) return [];

    return candidates.map((item: any) => ({
      team: item.team || item.participant || { id: item.teamId || 0, name: item.teamName || '', logo: item.logo || '' },
      statistics: (item.statistics || item.stats || item.values || [])
        .map((stat: any) => ({
          type: stat.type || stat.name || stat.key || stat.label,
          value: stat.value ?? stat.total ?? stat.amount ?? stat.percent ?? null,
        }))
        .filter((stat: any) => stat.type),
    })).filter((team: any) => team.statistics.length > 0);
  }


  async getTournaments() {
    const paths = [
      '/tournament/list',
      '/tournaments',
      '/tournament/all',
      '/league/list',
      '/leagues',
    ];

    const errors: any[] = [];

    for (const path of paths) {
      const response = await this.request(path);

      if (!response.ok) {
        errors.push({ path, error: response.error });
        continue;
      }

      const rows = this.findArray(response.data);

      if (rows.length > 0) {
        return {
          ok: true,
          path,
          data: rows,
          error: null,
        };
      }

      if (response.data && typeof response.data === 'object') {
        return {
          ok: true,
          path,
          data: response.data,
          error: null,
        };
      }
    }

    return {
      ok: false,
      path: null,
      data: [],
      error: errors[0]?.error || 'Endpoint de torneios Broadage ainda não confirmado',
      errors,
    };
  }

}
