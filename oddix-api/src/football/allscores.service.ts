import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type ProviderResult<T> = {
  ok: boolean;
  data: T;
  error: any;
};

@Injectable()
export class AllScoresService {
  private readonly logger = new Logger(AllScoresService.name);

  private enabled() {
    return String(process.env.ALLSCORES_ENABLED || 'false').toLowerCase() === 'true';
  }

  private getKey() {
    return process.env.ALLSCORES_KEY || process.env.ALLSCORES_RAPIDAPI_KEY || '';
  }

  private getHost() {
    return process.env.ALLSCORES_HOST || 'allscores.p.rapidapi.com';
  }

  private getBaseUrl() {
    return process.env.ALLSCORES_BASE_URL || `https://${this.getHost()}`;
  }

  private getTimezone() {
    return process.env.ALLSCORES_TIMEZONE || 'America/Sao_Paulo';
  }

  private getLangId() {
    return Number(process.env.ALLSCORES_LANG_ID || 1);
  }

  private getScoresPath() {
    return process.env.ALLSCORES_SCORES_PATH || '/api/allscores/games-scores';
  }

  private getGameDetailsPath() {
    return process.env.ALLSCORES_GAME_DETAILS_PATH || '/api/allscores/game-details';
  }

  private headers() {
    return {
      'x-rapidapi-key': this.getKey(),
      'x-rapidapi-host': this.getHost(),
      'Content-Type': 'application/json',
    };
  }

  private canCall() {
    return this.enabled() && !!this.getKey();
  }

  private formatDatePtBr(date: string | Date) {
    const d = typeof date === 'string' ? new Date(`${date}T12:00:00.000Z`) : date;

    if (Number.isNaN(d.getTime())) {
      const now = new Date();
      return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }

    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  private parseScore(value: any) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  private mapStatus(game: any) {
    const statusText = String(game?.statusText || '').toLowerCase();
    const shortText = String(game?.shortStatusText || '').toLowerCase();
    const group = Number(game?.statusGroup || 0);
    const gameTime = Number(game?.gameTime || 0);
    const display = String(game?.gameTimeDisplay || '');

    if (
      statusText.includes('final') ||
      shortText.includes('final') ||
      statusText.includes('finished') ||
      group === 4
    ) {
      return { long: 'Match Finished', short: 'FT', elapsed: 90, extra: null };
    }

    if (statusText.includes('half') || shortText.includes('ht')) {
      return { long: 'Halftime', short: 'HT', elapsed: 45, extra: null };
    }

    if (
      statusText.includes('scheduled') ||
      shortText.includes('sched') ||
      statusText.includes('not started') ||
      group === 2
    ) {
      return { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
    }

    if (statusText.includes('postponed')) {
      return { long: 'Postponed', short: 'PST', elapsed: null, extra: null };
    }

    if (statusText.includes('cancel') || statusText.includes('canceled')) {
      return { long: 'Canceled', short: 'CANC', elapsed: null, extra: null };
    }

    if (gameTime > 0 || display) {
      return {
        long: gameTime > 45 ? 'Second Half' : 'First Half',
        short: gameTime > 45 ? '2H' : '1H',
        elapsed: gameTime || null,
        extra: null,
      };
    }

    if (group === 3) {
      return { long: 'In Play', short: 'LIVE', elapsed: gameTime || null, extra: null };
    }

    return {
      long: game?.statusText || 'Unknown',
      short: game?.shortStatusText || 'UNK',
      elapsed: gameTime || null,
      extra: null,
    };
  }

  mapGameToOddixFixture(game: any) {
    const home = game?.homeCompetitor || {};
    const away = game?.awayCompetitor || {};
    const status = this.mapStatus(game);
    const homeScore = this.parseScore(home?.score);
    const awayScore = this.parseScore(away?.score);

    const prediction = game?.promotedPredictions?.predictions?.[0] || null;
    const odds = prediction?.odds || null;

    return {
      provider: 'allscores',
      allScoresGameId: Number(game?.id || 0),
      fixture: {
        id: Number(game?.id || 0),
        date: game?.startTime || new Date().toISOString(),
        timestamp: game?.startTime ? Math.floor(new Date(game.startTime).getTime() / 1000) : null,
        timezone: this.getTimezone(),
        status,
      },
      league: {
        id: Number(game?.competitionId || 0),
        name: game?.competitionDisplayName || game?.competition?.name || 'Liga não informada',
        country: game?.country?.name || '',
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
      goals: { home: homeScore, away: awayScore },
      score: { fulltime: { home: homeScore, away: awayScore } },
      allScores: {
        statusGroup: game?.statusGroup ?? null,
        statusText: game?.statusText ?? null,
        shortStatusText: game?.shortStatusText ?? null,
        gameTime: game?.gameTime ?? null,
        gameTimeDisplay: game?.gameTimeDisplay ?? null,
        hasStats: !!game?.hasStats,
        hasBets: !!game?.hasBets,
        hasPlayerBets: !!game?.hasPlayerBets,
        prediction: prediction
          ? {
              title: prediction.title,
              votes: prediction.options || [],
              odds,
            }
          : null,
      },
      rawAllScores: game,
    };
  }

  private isLiveMapped(item: any) {
    const short = String(item?.fixture?.status?.short || '').toUpperCase();
    const elapsed = Number(item?.fixture?.status?.elapsed || 0);

    if (['FT', 'AET', 'PEN', 'PST', 'CANC'].includes(short)) return false;
    if (short === '2H' && elapsed >= 90) return false;

    return ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(short);
  }

  async getGamesScores(date: string): Promise<ProviderResult<any[]>> {
    if (!this.canCall()) {
      return { ok: false, data: [], error: 'AllScores desativada ou ALLSCORES_KEY ausente' };
    }

    const formattedDate = this.formatDatePtBr(date);

    try {
      const response = await axios.get(`${this.getBaseUrl()}${this.getScoresPath()}`, {
        timeout: 12000,
        headers: this.headers(),
        params: {
          withTop: true,
          timezone: this.getTimezone(),
          sport: 1,
          startDate: formattedDate,
          endDate: formattedDate,
          onlyMajorGames: String(process.env.ALLSCORES_ONLY_MAJOR_GAMES || 'false').toLowerCase() === 'true',
          langId: this.getLangId(),
        },
      });

      const games = Array.isArray(response.data?.games) ? response.data.games : [];
      const mapped = games
        .filter((game: any) => Number(game?.sportId || 1) === 1)
        .map((game: any) => this.mapGameToOddixFixture(game))
        .filter((game: any) => game?.fixture?.id && game?.teams?.home?.name && game?.teams?.away?.name);

      return { ok: true, data: mapped, error: null };
    } catch (error: any) {
      this.logger.warn(`AllScores games-scores falhou: ${error?.message || 'erro'}`);
      return {
        ok: false,
        data: [],
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na AllScores',
      };
    }
  }

  async getLiveFixtures(date?: string): Promise<ProviderResult<any[]>> {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const scores = await this.getGamesScores(targetDate);

    if (!scores.ok) return scores;

    return {
      ok: true,
      data: scores.data.filter((item: any) => this.isLiveMapped(item)),
      error: null,
    };
  }

  async getGameDetails(gameId: string): Promise<ProviderResult<any | null>> {
    if (!this.canCall()) {
      return { ok: false, data: null, error: 'AllScores desativada ou ALLSCORES_KEY ausente' };
    }

    try {
      const response = await axios.get(`${this.getBaseUrl()}${this.getGameDetailsPath()}`, {
        timeout: 12000,
        headers: this.headers(),
        params: {
          gameId,
          langId: this.getLangId(),
        },
      });

      const game = response.data?.game;
      if (!game) return { ok: false, data: null, error: 'Jogo não encontrado na AllScores' };

      return { ok: true, data: this.mapGameToOddixFixture(game), error: null };
    } catch (error: any) {
      this.logger.warn(`AllScores game-details falhou: ${error?.message || 'erro'}`);
      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro no game-details AllScores',
      };
    }
  }

  async getStatistics(gameId: string): Promise<ProviderResult<any | null>> {
    const details = await this.getGameDetails(gameId);
    if (!details.ok || !details.data) return { ok: false, data: null, error: details.error };

    const raw = details.data?.rawAllScores || {};
    const home = raw?.homeCompetitor || {};
    const away = raw?.awayCompetitor || {};

    const teams = [home, away].map((team: any) => ({
      team: {
        id: Number(team?.id || 0),
        name: team?.name || team?.longName || '',
        logo: '',
      },
      statistics: Array.isArray(team?.statistics)
        ? team.statistics.map((stat: any) => ({ type: stat?.name || stat?.shortName || String(stat?.type || ''), value: stat?.value }))
        : [],
    }));

    const available = teams.some((team: any) => team.statistics.length > 0);

    return {
      ok: available,
      data: {
        available,
        simulated: false,
        fixtureId: gameId,
        source: 'allscores',
        message: available ? 'Estatísticas reais da AllScores.' : 'AllScores retornou o jogo, mas sem estatísticas por time.',
        teams,
        rawAllScores: raw,
      },
      error: available ? null : 'Sem estatísticas na AllScores',
    };
  }
}
