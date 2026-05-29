import { Injectable } from '@nestjs/common';
import axios from 'axios';

type ProviderResult<T> = {
  ok: boolean;
  data: T;
  error: any | null;
};

@Injectable()
export class AllScoresService {
  private readonly baseURL = 'https://allscores.p.rapidapi.com';

  isEnabled() {
    return String(process.env.ALLSCORES_ENABLED || 'false').toLowerCase() === 'true';
  }

  hasKey() {
    return !!this.getKey();
  }

  private getKey() {
    return process.env.ALLSCORES_KEY || process.env.RAPIDAPI_KEY || '';
  }

  private getHost() {
    return process.env.ALLSCORES_HOST || 'allscores.p.rapidapi.com';
  }

  private getTimezone() {
    return process.env.ALLSCORES_TIMEZONE || 'America/Sao_Paulo';
  }

  private timeoutMs() {
    return Number(process.env.ALLSCORES_TIMEOUT_MS || 12000);
  }

  private onlyMajorGames() {
    return String(process.env.ALLSCORES_ONLY_MAJOR_GAMES || 'false').toLowerCase() === 'true';
  }

  private dateToAllScores(date: string | Date) {
    const d = typeof date === 'string' ? new Date(`${date}T12:00:00.000Z`) : date;

    if (Number.isNaN(d.getTime())) {
      const now = new Date();
      return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }

    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }

  private async request<T = any>(path: string, params: Record<string, any> = {}): Promise<ProviderResult<T | null>> {
    if (!this.isEnabled()) {
      return { ok: false, data: null, error: 'AllScores desativada. Defina ALLSCORES_ENABLED=true' };
    }

    const key = this.getKey();
    if (!key) {
      return { ok: false, data: null, error: 'ALLSCORES_KEY não encontrada' };
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
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na AllScores',
      };
    }
  }

  private normalizeStatus(game: any) {
    const statusText = String(game?.statusText || '').toLowerCase();
    const shortText = String(game?.shortStatusText || '').toLowerCase();
    const statusGroup = Number(game?.statusGroup ?? 0);
    const gameTime = Number(game?.gameTime ?? -1);
    const justEnded = !!game?.justEnded;

    if (
      justEnded ||
      statusGroup === 4 ||
      statusText.includes('final') ||
      statusText.includes('ended') ||
      statusText.includes('finished') ||
      shortText.includes('final') ||
      shortText === 'ft'
    ) {
      return { long: 'Match Finished', short: 'FT', elapsed: null, extra: null };
    }

    if (
      statusText.includes('half') ||
      shortText.includes('half') ||
      shortText === 'ht'
    ) {
      return { long: 'Halftime', short: 'HT', elapsed: 45, extra: null };
    }

    if (
      statusGroup === 3 ||
      statusText.includes('live') ||
      statusText.includes('in progress') ||
      gameTime > 0
    ) {
      const elapsed = gameTime > 0 ? gameTime : null;
      const short = elapsed !== null && elapsed > 45 ? '2H' : '1H';
      return { long: short === '2H' ? 'Second Half' : 'First Half', short, elapsed, extra: null };
    }

    if (statusGroup === 2 || statusText.includes('sched') || shortText.includes('sched')) {
      return { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
    }

    if (statusText.includes('postponed')) {
      return { long: 'Postponed', short: 'PST', elapsed: null, extra: null };
    }

    if (statusText.includes('cancel')) {
      return { long: 'Canceled', short: 'CANC', elapsed: null, extra: null };
    }

    return {
      long: game?.statusText || 'Unknown',
      short: game?.shortStatusText || 'UNK',
      elapsed: gameTime > 0 ? gameTime : null,
      extra: null,
    };
  }

  private readScore(value: any) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  mapGame(game: any) {
    const home = game?.homeCompetitor || {};
    const away = game?.awayCompetitor || {};
    const competitionName = game?.competitionDisplayName || game?.competition?.name || 'Liga não informada';
    const status = this.normalizeStatus(game);
    const homeScore = this.readScore(home?.score);
    const awayScore = this.readScore(away?.score);

    const predictions = game?.promotedPredictions?.predictions || [];
    const firstPrediction = Array.isArray(predictions) ? predictions[0] : null;
    const odds = firstPrediction?.odds || null;

    return {
      provider: 'allscores',
      fixture: {
        id: Number(game?.id || 0),
        date: game?.startTime || new Date().toISOString(),
        timestamp: game?.startTime ? Math.floor(new Date(game.startTime).getTime() / 1000) : null,
        timezone: this.getTimezone(),
        status,
      },
      league: {
        id: Number(game?.competitionId || 0),
        name: competitionName,
        country: '',
        logo: '',
      },
      teams: {
        home: {
          id: Number(home?.id || 0),
          name: home?.name || home?.longName || '',
          logo: '',
          winner: home?.isWinner ?? null,
        },
        away: {
          id: Number(away?.id || 0),
          name: away?.name || away?.longName || '',
          logo: '',
          winner: away?.isWinner ?? null,
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
      },
      odds: odds
        ? {
            source: 'allscores-bet365',
            bookmaker: odds?.bookmaker?.name || 'Bet365',
            market: odds?.lineType?.name || odds?.lineType?.shortName || '1X2',
            options: (odds?.options || []).map((option: any) => ({
              name: option?.name,
              odd: Number(option?.rate?.decimal || 0),
              oldOdd: Number(option?.oldRate?.decimal || 0) || null,
              originalOdd: Number(option?.originalRate?.decimal || 0) || null,
              trend: option?.trend ?? null,
            })),
          }
        : null,
      allScoresRaw: game,
    };
  }

  private extractGames(data: any) {
    if (Array.isArray(data?.games)) return data.games;
    if (Array.isArray(data?.data?.games)) return data.data.games;
    if (Array.isArray(data?.response?.games)) return data.response.games;
    if (Array.isArray(data)) return data;
    return [];
  }

  async getGamesScores(date: string): Promise<ProviderResult<any[]>> {
    const formattedDate = this.dateToAllScores(date);
    const response = await this.request('/api/allscores/games-scores', {
      withTop: true,
      timezone: this.getTimezone(),
      sport: 1,
      startDate: formattedDate,
      endDate: formattedDate,
      onlyMajorGames: this.onlyMajorGames(),
      langId: 1,
    });

    if (!response.ok || !response.data) {
      return { ok: false, data: [], error: response.error };
    }

    const games = this.extractGames(response.data).map((game: any) => this.mapGame(game));
    return { ok: true, data: games, error: null };
  }

  async getFixtures(date: string): Promise<ProviderResult<any[]>> {
    return this.getGamesScores(date);
  }

  async getLiveFixtures(date?: string): Promise<ProviderResult<any[]>> {
    const dateKey = date || new Date().toISOString().slice(0, 10);
    const response = await this.getGamesScores(dateKey);

    if (!response.ok) return response;

    const live = response.data.filter((item: any) =>
      ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET'].includes(
        String(item?.fixture?.status?.short || '').toUpperCase(),
      ),
    );

    return { ok: true, data: live, error: null };
  }

  async getGameDetails(gameId: string): Promise<ProviderResult<any | null>> {
    const response = await this.request('/api/allscores/game-details', {
      gameId,
      timezone: this.getTimezone(),
      langId: 1,
    });

    if (!response.ok || !response.data) {
      return { ok: false, data: null, error: response.error };
    }

    const game = (response.data as any)?.game || (response.data as any)?.data?.game;
    if (!game) {
      return { ok: false, data: null, error: 'Game Details não retornou game' };
    }

    return { ok: true, data: this.mapGame(game), error: null };
  }

  async getGamePredictions(gameId: string): Promise<ProviderResult<any | null>> {
    const response = await this.request('/api/allscores/game-predictions', {
      gameId,
      timezone: this.getTimezone(),
      langId: 1,
    });

    if (!response.ok) return { ok: false, data: null, error: response.error };
    return { ok: true, data: response.data, error: null };
  }
}
