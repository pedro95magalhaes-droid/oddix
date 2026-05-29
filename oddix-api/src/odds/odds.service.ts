import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OddsPick = {
  marketKey: string;
  marketName: string;
  player?: string;
  tip: string;
  odd: number;
  bookmaker: string;
  source?: string;
  outcomeName?: string;
  point?: number | null;
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
    return process.env.THE_ODDS_API_ENABLED !== 'false' && !!this.apiKey();
  }

  private region() {
    return process.env.THE_ODDS_API_REGION || 'eu';
  }

  private oddsFormat() {
    return process.env.THE_ODDS_API_ODDS_FORMAT || 'decimal';
  }

  private normalize(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(fc|sc|ec|afc|cf|club|women|woman|w|u20|u21|u23|rs)\b/g, '')
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
    if (normalized.includes('brazil') || normalized.includes('brasileir')) return ['soccer_brazil_campeonato'];

    return [
      'soccer_epl',
      'soccer_spain_la_liga',
      'soccer_italy_serie_a',
      'soccer_germany_bundesliga',
      'soccer_france_ligue_one',
      'soccer_usa_mls',
      'soccer_brazil_campeonato',
    ];
  }

  private teamScore(a: any, b: any) {
    const left = this.normalize(a);
    const right = this.normalize(b);

    if (!left || !right) return 0;
    if (left === right) return 100;
    if (left.includes(right) || right.includes(left)) return 90;

    const leftWords = left.split(' ').filter((word) => word.length >= 3);
    const rightWords = right.split(' ').filter((word) => word.length >= 3);

    if (!leftWords.length || !rightWords.length) return 0;

    let common = 0;

    for (const word of leftWords) {
      if (rightWords.some((rw) => word === rw || word.includes(rw) || rw.includes(word))) {
        common++;
      }
    }

    return Math.round((common / Math.max(leftWords.length, rightWords.length)) * 100);
  }

  private isSameGame(event: any, homeTeam: string, awayTeam: string) {
    const normalScore =
      this.teamScore(event?.home_team, homeTeam) + this.teamScore(event?.away_team, awayTeam);

    const reverseScore =
      this.teamScore(event?.home_team, awayTeam) + this.teamScore(event?.away_team, homeTeam);

    const teams = (event?.teams || []).map((team: string) => this.normalize(team));
    const home = this.normalize(homeTeam);
    const away = this.normalize(awayTeam);

    const listScore =
      (teams.some((team) => team.includes(home) || home.includes(team)) ? 80 : 0) +
      (teams.some((team) => team.includes(away) || away.includes(team)) ? 80 : 0);

    return Math.max(normalScore, reverseScore, listScore) >= 130;
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

  private marketsForGameOdds() {
    return ['h2h', 'totals', 'btts', 'spreads'];
  }

  private marketName(key: string) {
    const names: Record<string, string> = {
      h2h: 'Resultado Final',
      totals: 'Total de gols',
      btts: 'Ambas marcam',
      spreads: 'Handicap',
      player_shots_on_target: 'Jogador chutes no gol',
      player_shots: 'Jogador chutes totais',
      player_goal_scorer_anytime: 'Jogador marca gol',
    };

    return names[key] || key;
  }

  private buildTipFromOutcome(params: {
    marketKey: string;
    outcome: any;
    homeTeam: string;
    awayTeam: string;
  }) {
    const { marketKey, outcome, homeTeam, awayTeam } = params;
    const name = String(outcome?.name || '');
    const point = outcome?.point;
    const normalized = this.normalize(name);

    if (marketKey === 'h2h') {
      if (this.teamScore(name, homeTeam) >= 80) return `${homeTeam} para vencer`;
      if (this.teamScore(name, awayTeam) >= 80) return `${awayTeam} para vencer`;
      if (normalized.includes('draw') || normalized.includes('empate')) return 'Empate';
      return `${name} para vencer`;
    }

    if (marketKey === 'totals') {
      const side = normalized.includes('under') || normalized.includes('menos') ? 'Under' : 'Over';
      return `${side} ${point ?? ''} gols`.trim();
    }

    if (marketKey === 'btts') {
      const yes = normalized.includes('yes') || normalized.includes('sim');
      return `Ambas equipes marcam: ${yes ? 'Sim' : 'Não'}`;
    }

    if (marketKey === 'spreads') {
      const team = this.teamScore(name, awayTeam) >= 80 ? awayTeam : homeTeam;
      return `${team} ${point ?? ''} handicap`.trim();
    }

    return name;
  }

  async getGameOdds(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<OddsPick[]> {
    if (!this.enabled()) return [];

    const found = await this.findSoccerEvent(params);

    if (!found?.sportKey || !found?.event?.id) return [];

    const url = new URL(`${this.baseUrl}/sports/${found.sportKey}/events/${found.event.id}/odds`);
    url.searchParams.set('apiKey', this.apiKey());
    url.searchParams.set('regions', this.region());
    url.searchParams.set('markets', this.marketsForGameOdds().join(','));
    url.searchParams.set('oddsFormat', this.oddsFormat());

    if (process.env.THE_ODDS_API_BOOKMAKERS) {
      url.searchParams.set('bookmakers', process.env.THE_ODDS_API_BOOKMAKERS);
    }

    const data = await this.fetchJson(url.toString());
    const picks: OddsPick[] = [];

    for (const bookmaker of data?.bookmakers || []) {
      for (const market of bookmaker?.markets || []) {
        for (const outcome of market?.outcomes || []) {
          const odd = Number(outcome?.price || 0);
          if (!odd || odd < 1.2 || odd > 3.4) continue;

          picks.push({
            marketKey: market.key,
            marketName: this.marketName(market.key),
            tip: this.buildTipFromOutcome({
              marketKey: market.key,
              outcome,
              homeTeam: params.homeTeam,
              awayTeam: params.awayTeam,
            }),
            odd,
            bookmaker: bookmaker.title || bookmaker.key || 'The Odds API',
            source: 'the-odds-api',
            outcomeName: outcome?.name,
            point: outcome?.point ?? null,
          });
        }
      }
    }

    return picks
      .sort((a, b) => {
        const priority: Record<string, number> = { totals: 24, btts: 18, spreads: 16, h2h: 8 };
        return (priority[b.marketKey] || 0) + b.odd - ((priority[a.marketKey] || 0) + a.odd);
      })
      .slice(0, 20);
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
    url.searchParams.set('regions', this.region());
    url.searchParams.set('markets', markets.join(','));
    url.searchParams.set('oddsFormat', this.oddsFormat());

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
              source: 'the-odds-api',
              point: point ?? null,
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
              source: 'the-odds-api',
              point: point ?? null,
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
              source: 'the-odds-api',
              point: point ?? null,
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

  async getBestOdds(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<OddsPick[]> {
    const [gameOdds, playerProps] = await Promise.all([
      this.getGameOdds(params),
      this.getPlayerProps(params),
    ]);

    return [...playerProps, ...gameOdds]
      .filter((pick) => Number(pick.odd || 0) >= 1.2)
      .sort((a, b) => {
        const priority: Record<string, number> = {
          player_shots_on_target: 40,
          player_shots: 34,
          totals: 28,
          btts: 22,
          spreads: 18,
          h2h: 8,
          player_goal_scorer_anytime: 4,
        };

        return (priority[b.marketKey] || 0) + b.odd - ((priority[a.marketKey] || 0) + a.odd);
      })
      .slice(0, 15);
  }
}
