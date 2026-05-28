import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OddsPick = {
  marketKey: string;
  marketName: string;
  player?: string;
  tip: string;
  odd: number;
  bookmaker: string;
};

@Injectable()
export class OddsService {
  private readonly logger = new Logger(OddsService.name);
  private readonly baseUrl = 'https://api.the-odds-api.com/v4';

  constructor(private readonly config: ConfigService) {}

  private apiKey() {
    return this.config.get<string>('THE_ODDS_API_KEY') || process.env.THE_ODDS_API_KEY || '';
  }

  private enabled() {
    return process.env.THE_ODDS_API_ENABLED === 'true' && !!this.apiKey();
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

  private sportKeysForSoccer(league: string) {
    const normalized = this.normalize(league);

    if (normalized.includes('premier')) return ['soccer_epl'];
    if (normalized.includes('la liga') || normalized.includes('spain')) return ['soccer_spain_la_liga'];
    if (normalized.includes('serie a') || normalized.includes('italy')) return ['soccer_italy_serie_a'];
    if (normalized.includes('bundesliga') || normalized.includes('germany')) return ['soccer_germany_bundesliga'];
    if (normalized.includes('ligue 1') || normalized.includes('france')) return ['soccer_france_ligue_one'];
    if (normalized.includes('mls')) return ['soccer_usa_mls'];

    return [
      'soccer_epl',
      'soccer_spain_la_liga',
      'soccer_italy_serie_a',
      'soccer_germany_bundesliga',
      'soccer_france_ligue_one',
      'soccer_usa_mls',
    ];
  }

  private isSameGame(event: any, homeTeam: string, awayTeam: string) {
    const home = this.normalize(homeTeam);
    const away = this.normalize(awayTeam);
    const eventHome = this.normalize(event?.home_team);
    const eventAway = this.normalize(event?.away_team);
    const teams = (event?.teams || []).map((team: string) => this.normalize(team));

    const hasHome =
      eventHome.includes(home) ||
      home.includes(eventHome) ||
      teams.some((team: string) => team.includes(home) || home.includes(team));

    const hasAway =
      eventAway.includes(away) ||
      away.includes(eventAway) ||
      teams.some((team: string) => team.includes(away) || away.includes(team));

    return hasHome && hasAway;
  }

  private async fetchJson(url: string) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`The Odds API erro ${response.status}: ${text}`);
        return null;
      }

      return response.json();
    } catch (error: any) {
      this.logger.warn(`Erro ao chamar The Odds API: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }

  async findSoccerEvent(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }) {
    if (!this.enabled()) return null;

    for (const sportKey of this.sportKeysForSoccer(params.league)) {
      const url = new URL(`${this.baseUrl}/sports/${sportKey}/events`);
      url.searchParams.set('apiKey', this.apiKey());

      const events = await this.fetchJson(url.toString());

      if (!Array.isArray(events)) continue;

      const found = events.find((event) =>
        this.isSameGame(event, params.homeTeam, params.awayTeam),
      );

      if (found) {
        return {
          sportKey,
          event: found,
        };
      }
    }

    return null;
  }

  async getPlayerProps(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<OddsPick[]> {
    if (!this.enabled()) return [];

    const found = await this.findSoccerEvent(params);

    if (!found?.sportKey || !found?.event?.id) return [];

    const markets = [
      'player_shots_on_target',
      'player_shots',
      'player_goal_scorer_anytime',
    ];

    const url = new URL(`${this.baseUrl}/sports/${found.sportKey}/events/${found.event.id}/odds`);

    url.searchParams.set('apiKey', this.apiKey());
    url.searchParams.set('regions', process.env.THE_ODDS_API_REGION || 'us');
    url.searchParams.set('markets', markets.join(','));
    url.searchParams.set('oddsFormat', process.env.THE_ODDS_API_ODDS_FORMAT || 'decimal');

    if (process.env.THE_ODDS_API_BOOKMAKERS) {
      url.searchParams.set('bookmakers', process.env.THE_ODDS_API_BOOKMAKERS);
    }

    const data = await this.fetchJson(url.toString());

    const picks: OddsPick[] = [];

    for (const bookmaker of data?.bookmakers || []) {
      for (const market of bookmaker?.markets || []) {
        for (const outcome of market?.outcomes || []) {
          const odd = Number(outcome?.price || 0);
          const point = outcome?.point;
          const player = outcome?.description || outcome?.name;

          if (!player) continue;
          if (!odd || odd < 1.25 || odd > 2.35) continue;

          if (market.key === 'player_shots_on_target') {
            picks.push({
              marketKey: market.key,
              marketName: 'Jogador chutes no gol',
              player,
              tip: `${player} ${point ?? 0.5}+ chutes no gol`,
              odd,
              bookmaker: bookmaker.title || bookmaker.key || 'The Odds API',
            });
          }

          if (market.key === 'player_shots') {
            picks.push({
              marketKey: market.key,
              marketName: 'Jogador chutes totais',
              player,
              tip: `${player} ${point ?? 1.5}+ chutes totais`,
              odd,
              bookmaker: bookmaker.title || bookmaker.key || 'The Odds API',
            });
          }

          if (market.key === 'player_goal_scorer_anytime') {
            picks.push({
              marketKey: market.key,
              marketName: 'Jogador marca gol',
              player,
              tip: `${player} para marcar a qualquer momento`,
              odd,
              bookmaker: bookmaker.title || bookmaker.key || 'The Odds API',
            });
          }
        }
      }
    }

    return picks
      .sort((a, b) => {
        const priority: Record<string, number> = {
          player_shots_on_target: 30,
          player_shots: 24,
          player_goal_scorer_anytime: 6,
        };

        return (priority[b.marketKey] || 0) + b.odd - ((priority[a.marketKey] || 0) + a.odd);
      })
      .slice(0, 8);
  }
}