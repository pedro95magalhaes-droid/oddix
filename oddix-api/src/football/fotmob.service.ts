import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export type FotmobApiResult<T = any> = {
  ok: boolean;
  data: T;
  error: any;
};

@Injectable()
export class FotmobService {
  private readonly logger = new Logger(FotmobService.name);

  private baseUrl() {
    return (process.env.FOTMOB_BASE_URL || 'https://fotmob-api.p.rapidapi.com').replace(/\/$/, '');
  }

  private host() {
    return process.env.FOTMOB_API_HOST || 'fotmob-api.p.rapidapi.com';
  }

  private key() {
    return process.env.FOTMOB_API_KEY || process.env.FOTMOB_RAPIDAPI_KEY || '';
  }

  isEnabled() {
    return String(process.env.FOTMOB_ENABLED || 'false').toLowerCase() === 'true' && !!this.key();
  }

  hasKey() {
    return !!this.key();
  }

  getBaseUrl() {
    return this.baseUrl();
  }

  private headers() {
    return {
      'x-rapidapi-key': this.key(),
      'x-rapidapi-host': this.host(),
      'Content-Type': 'application/json',
    };
  }

  private async request<T = any>(path: string, params: Record<string, any> = {}): Promise<FotmobApiResult<T | null>> {
    if (!this.isEnabled()) {
      return { ok: false, data: null, error: 'FotMob desativada. Defina FOTMOB_ENABLED=true e FOTMOB_API_KEY no .env' };
    }

    try {
      const response = await axios.get(`${this.baseUrl()}${path}`, {
        timeout: Number(process.env.FOTMOB_TIMEOUT_MS || 15000),
        headers: this.headers(),
        params,
      });

      return { ok: true, data: response.data, error: null };
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data ||
        error?.message ||
        'Erro desconhecido na FotMob API';

      this.logger.warn(`FotMob falhou em ${path}: ${JSON.stringify(message).slice(0, 240)}`);
      return { ok: false, data: null, error: message };
    }
  }

  private formatDateCompact(date?: string | null) {
    const raw = String(date || '').trim();
    if (/^\d{8}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '');

    const parsed = raw ? new Date(raw) : new Date();
    const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return safe.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private normalizeStatus(status: any) {
    const reason = status?.reason || {};
    const liveShort = String(status?.liveTime?.short || '').replace(/[^0-9+]/g, '');
    const liveLong = String(status?.liveTime?.long || '');
    const elapsedFromLong = Number(liveLong.split(':')[0]);
    const elapsedFromShort = Number(liveShort.split('+')[0]);
    const elapsed = Number.isFinite(elapsedFromLong) && elapsedFromLong > 0 ? elapsedFromLong : Number.isFinite(elapsedFromShort) ? elapsedFromShort : null;

    let short = String(reason?.short || '').toUpperCase();
    let long = String(reason?.long || '').trim();

    if (status?.finished) {
      short = short || 'FT';
      long = long || 'Full-Time';
    } else if (status?.ongoing || status?.started) {
      if (!short || short === 'NS') {
        if (elapsed !== null && elapsed > 45) short = '2H';
        else short = '1H';
      }
      long = long || 'In Play';
    } else {
      short = short || 'NS';
      long = long || 'Not Started';
    }

    return {
      long,
      short,
      elapsed,
      extra: Number(status?.liveTime?.addedTime || 0) || null,
    };
  }

  private parseScore(scoreStr?: string | null) {
    const match = String(scoreStr || '').match(/(\d+)\s*-\s*(\d+)/);
    if (!match) return { home: null, away: null };
    return { home: Number(match[1]), away: Number(match[2]) };
  }

  private mapMatch(match: any, league: any = {}) {
    const status = match?.status || {};
    const score = this.parseScore(status?.scoreStr);
    const homeScore = match?.home?.score ?? score.home;
    const awayScore = match?.away?.score ?? score.away;

    return {
      provider: 'fotmob',
      fixture: {
        id: Number(match?.id || 0),
        externalId: String(match?.id || ''),
        date: status?.utcTime || match?.timeUTC || match?.utcTime || (match?.timeTS ? new Date(Number(match.timeTS)).toISOString() : new Date().toISOString()),
        timestamp: match?.timeTS ? Math.floor(Number(match.timeTS) / 1000) : null,
        timezone: 'UTC',
        status: this.normalizeStatus(status),
      },
      league: {
        id: Number(match?.leagueId || league?.id || league?.primaryId || 0),
        name: league?.name || match?.leagueName || 'Liga não informada',
        country: league?.ccode || league?.country || '',
        logo: league?.logo || '',
      },
      teams: {
        home: {
          id: Number(match?.home?.id || 0),
          name: match?.home?.name || match?.home?.longName || 'Casa',
          logo: match?.home?.imageUrl || (match?.home?.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${match.home.id}_small.png` : ''),
          winner: homeScore !== null && awayScore !== null ? Number(homeScore) > Number(awayScore) : null,
          redCards: Number(match?.home?.redCards || 0),
        },
        away: {
          id: Number(match?.away?.id || 0),
          name: match?.away?.name || match?.away?.longName || 'Fora',
          logo: match?.away?.imageUrl || (match?.away?.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${match.away.id}_small.png` : ''),
          winner: homeScore !== null && awayScore !== null ? Number(awayScore) > Number(homeScore) : null,
          redCards: Number(match?.away?.redCards || 0),
        },
      },
      goals: {
        home: homeScore ?? null,
        away: awayScore ?? null,
      },
      score: {
        fulltime: {
          home: homeScore ?? null,
          away: awayScore ?? null,
        },
      },
      fotmobRaw: {
        matchId: match?.id,
        leagueId: match?.leagueId || league?.id,
        pageUrl: match?.pageUrl,
        status,
      },
    };
  }

  private mapMatchesResponse(payload: any) {
    const out: any[] = [];

    for (const league of payload?.leagues || []) {
      for (const match of league?.matches || []) {
        out.push(this.mapMatch(match, league));
      }
    }

    if (Array.isArray(payload?.matches)) {
      for (const match of payload.matches) {
        out.push(this.mapMatch(match, payload));
      }
    }

    return out;
  }

  async getMatchesByDate(date?: string): Promise<FotmobApiResult<any[]>> {
    const payload = await this.request('/api/v1/matches/by-date', {
      date: this.formatDateCompact(date),
      timezone: process.env.FOTMOB_TIMEZONE || 'America/Sao_Paulo',
    });

    if (!payload.ok || !payload.data) return { ok: false, data: [], error: payload.error };

    return { ok: true, data: this.mapMatchesResponse(payload.data), error: null };
  }

  async getLiveMatches(): Promise<FotmobApiResult<any[]>> {
    const payload = await this.request('/api/v1/matches/live', {
      ccode: process.env.FOTMOB_CCODE || 'BRA',
      timezone: process.env.FOTMOB_TIMEZONE || 'America/Sao_Paulo',
    });

    if (!payload.ok || !payload.data) return { ok: false, data: [], error: payload.error };

    return { ok: true, data: this.mapMatchesResponse(payload.data), error: null };
  }

  async getMatch(matchId: string): Promise<FotmobApiResult<any | null>> {
    const payload = await this.request(`/api/v1/matches/${matchId}`);
    if (!payload.ok || !payload.data) return { ok: false, data: null, error: payload.error };

    const general = (payload.data as any)?.general || {};
    const header = (payload.data as any)?.header || {};
    const teams = header?.teams || [];
    const home = teams[0] || general?.homeTeam || {};
    const away = teams[1] || general?.awayTeam || {};
    const status = header?.status || {};

    const fixture = this.mapMatch(
      {
        id: general?.matchId || matchId,
        leagueId: general?.leagueId,
        home: { id: home?.id || general?.homeTeam?.id, name: home?.name || general?.homeTeam?.name, score: home?.score, imageUrl: home?.imageUrl },
        away: { id: away?.id || general?.awayTeam?.id, name: away?.name || general?.awayTeam?.name, score: away?.score, imageUrl: away?.imageUrl },
        status: {
          ...status,
          utcTime: status?.utcTime || general?.matchTimeUTCDate,
          scoreStr: status?.scoreStr,
          finished: status?.finished ?? general?.finished,
          started: status?.started ?? general?.started,
          cancelled: status?.cancelled,
          ongoing: status?.started && !status?.finished,
        },
      },
      {
        id: general?.leagueId,
        name: general?.leagueName,
        country: general?.countryCode,
      },
    );

    return {
      ok: true,
      data: {
        ...fixture,
        statistics: this.mapDetailsToOddixStatistics(String(matchId), payload.data),
        details: payload.data,
      },
      error: null,
    };
  }

  async getMomentum(matchId: string) {
    return this.request(`/api/v1/matches/${matchId}/momentum`);
  }

  async getShotmap(matchId: string) {
    return this.request(`/api/v1/matches/${matchId}/shotmap`);
  }

  async getLineups(matchId: string) {
    return this.request(`/api/v1/matches/${matchId}/lineups`);
  }

  async getScore(matchId: string) {
    return this.request(`/api/v1/matches/${matchId}/score`);
  }

  private statValue(item: any) {
    if (item === null || item === undefined) return null;
    if (typeof item === 'number') return item;
    if (typeof item === 'string') return item;
    if (item?.stat?.value !== undefined) return item.stat.value;
    if (item?.value !== undefined) return item.value;
    return null;
  }

  private findStatsSections(details: any): any[] {
    const candidates = [
      details?.content?.stats?.Periods?.All?.stats,
      details?.content?.stats?.Periods?.All,
      details?.content?.stats?.stats,
      details?.stats?.Periods?.All?.stats,
      details?.stats?.stats,
      details?.matchStats,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }

    return [];
  }

  private extractTeamStatFromSections(details: any, aliases: string[]) {
    const sections = this.findStatsSections(details);
    const normalizedAliases = aliases.map((a) => this.normalize(a));

    for (const section of sections) {
      const stats = Array.isArray(section?.stats) ? section.stats : Array.isArray(section) ? section : [];

      for (const stat of stats) {
        const title = this.normalize(stat?.title || stat?.name || stat?.key || stat?.type);
        if (!normalizedAliases.some((alias) => title.includes(alias))) continue;

        const values = stat?.stats || stat?.values || stat?.value || [];
        if (Array.isArray(values) && values.length >= 2) {
          return [this.statValue(values[0]), this.statValue(values[1])];
        }

        if (stat?.home !== undefined || stat?.away !== undefined) return [this.statValue(stat.home), this.statValue(stat.away)];
      }
    }

    return [null, null];
  }

  private normalize(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private countShotmap(details: any, predicate: (shot: any) => boolean, teamId?: number | null) {
    const shotmap =
      details?.content?.shotmap?.shots ||
      details?.content?.shotmap ||
      details?.shotmap?.shots ||
      details?.shotmap ||
      [];

    if (!Array.isArray(shotmap)) return 0;

    return shotmap.filter((shot: any) => {
      if (teamId && Number(shot?.teamId) !== Number(teamId)) return false;
      return predicate(shot);
    }).length;
  }

  private sumShotmap(details: any, key: string, teamId?: number | null) {
    const shotmap =
      details?.content?.shotmap?.shots ||
      details?.content?.shotmap ||
      details?.shotmap?.shots ||
      details?.shotmap ||
      [];

    if (!Array.isArray(shotmap)) return 0;

    return Number(
      shotmap
        .filter((shot: any) => (teamId ? Number(shot?.teamId) === Number(teamId) : true))
        .reduce((sum: number, shot: any) => sum + Number(shot?.[key] || 0), 0)
        .toFixed(2),
    );
  }

  mapDetailsToOddixStatistics(fixtureId: string, details: any) {
    const general = details?.general || {};
    const headerTeams = details?.header?.teams || [];
    const home = headerTeams[0] || general?.homeTeam || {};
    const away = headerTeams[1] || general?.awayTeam || {};
    const homeId = Number(home?.id || general?.homeTeam?.id || 0);
    const awayId = Number(away?.id || general?.awayTeam?.id || 0);

    const [homePossession, awayPossession] = this.extractTeamStatFromSections(details, ['Ball possession', 'Possession', 'Posse']);
    const [homeCorners, awayCorners] = this.extractTeamStatFromSections(details, ['Corners', 'Corner kicks', 'Escanteios']);
    const [homeYellowCards, awayYellowCards] = this.extractTeamStatFromSections(details, ['Yellow cards', 'Cartões amarelos']);
    const [homeFouls, awayFouls] = this.extractTeamStatFromSections(details, ['Fouls', 'Faltas']);

    const homeTotalShots = this.countShotmap(details, () => true, homeId);
    const awayTotalShots = this.countShotmap(details, () => true, awayId);
    const homeShotsOnGoal = this.countShotmap(details, (shot) => shot?.isOnTarget === true || String(shot?.eventType || '').toLowerCase().includes('goal'), homeId);
    const awayShotsOnGoal = this.countShotmap(details, (shot) => shot?.isOnTarget === true || String(shot?.eventType || '').toLowerCase().includes('goal'), awayId);
    const homeXg = this.sumShotmap(details, 'expectedGoals', homeId);
    const awayXg = this.sumShotmap(details, 'expectedGoals', awayId);

    const teams = [
      {
        team: { id: homeId, name: home?.name || general?.homeTeam?.name || 'Casa', logo: home?.imageUrl || (homeId ? `https://images.fotmob.com/image_resources/logo/teamlogo/${homeId}_small.png` : '') },
        statistics: [
          { type: 'Ball Possession', value: homePossession },
          { type: 'Total Shots', value: homeTotalShots || null },
          { type: 'Shots on Goal', value: homeShotsOnGoal || null },
          { type: 'Corner Kicks', value: homeCorners },
          { type: 'Yellow Cards', value: homeYellowCards },
          { type: 'Fouls', value: homeFouls },
          { type: 'Expected Goals', value: homeXg || null },
        ],
      },
      {
        team: { id: awayId, name: away?.name || general?.awayTeam?.name || 'Fora', logo: away?.imageUrl || (awayId ? `https://images.fotmob.com/image_resources/logo/teamlogo/${awayId}_small.png` : '') },
        statistics: [
          { type: 'Ball Possession', value: awayPossession },
          { type: 'Total Shots', value: awayTotalShots || null },
          { type: 'Shots on Goal', value: awayShotsOnGoal || null },
          { type: 'Corner Kicks', value: awayCorners },
          { type: 'Yellow Cards', value: awayYellowCards },
          { type: 'Fouls', value: awayFouls },
          { type: 'Expected Goals', value: awayXg || null },
        ],
      },
    ];

    const hasAny = teams.some((team) =>
      team.statistics.some((stat) => stat.value !== null && stat.value !== undefined && stat.value !== ''),
    );

    return {
      available: hasAny,
      simulated: false,
      fixtureId,
      source: 'fotmob',
      message: hasAny ? 'Estatísticas reais da FotMob.' : 'FotMob retornou detalhes, mas sem estatísticas mapeáveis.',
      coverageLevel: general?.coverageLevel || null,
      teams,
      raw: {
        matchId: general?.matchId || fixtureId,
        leagueId: general?.leagueId,
        leagueName: general?.leagueName,
        coverageLevel: general?.coverageLevel,
      },
    };
  }

  async getStatistics(matchId: string): Promise<FotmobApiResult<any | null>> {
    const match = await this.getMatch(matchId);
    if (!match.ok || !match.data) return { ok: false, data: null, error: match.error };

    const stats = match.data.statistics || this.mapDetailsToOddixStatistics(matchId, match.data.details);
    return { ok: !!stats?.available, data: stats, error: stats?.available ? null : stats?.message || 'Sem estatísticas FotMob' };
  }
}
