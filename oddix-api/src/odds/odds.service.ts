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
  eventId?: number | string;
  leagueName?: string;
  currentMinute?: number | null;
  stats?: Record<string, any> | null;
};

type SportsBettingEvent = {
  eventId?: number | string;
  groupId?: number | string;
  appId?: string;
  gameId?: string;
  sportId?: number;
  sportName?: string;
  leagueId?: number | string;
  leagueName?: string;
  country?: string;
  vs?: string;
  home?: string;
  away?: string;
  homeScore?: any;
  awayScore?: any;
  current?: {
    live?: string;
    minute?: number | string;
    second?: number | string;
    title?: string;
  };
  odds?: Array<{
    id?: string;
    name?: string;
    markets?: Array<{
      id?: number | string;
      name?: string;
      status?: string;
      rate?: number | string;
    }>;
  }>;
  history?: any;
};

@Injectable()
export class OddsService {
  private readonly logger = new Logger(OddsService.name);

  private sportsBettingEventsCache: {
    expiresAt: number;
    data: SportsBettingEvent[];
  } | null = null;

  private sportsBettingEventCache = new Map<
    string,
    { expiresAt: number; data: SportsBettingEvent | null }
  >();

  constructor(private readonly config: ConfigService) {}

  // =========================
  // SPORTS BETTING API CONFIG
  // =========================

  private sportsBettingEnabled() {
    return (
      process.env.SPORTS_BETTING_ENABLED === 'true' &&
      !!this.sportsBettingKey()
    );
  }

  private sportsBettingKey() {
    return (
      this.config.get<string>('SPORTS_BETTING_KEY') ||
      process.env.SPORTS_BETTING_KEY ||
      process.env.SPORTS_BETTING_RAPIDAPI_KEY ||
      ''
    );
  }

  private sportsBettingHost() {
    return (
      process.env.SPORTS_BETTING_HOST ||
      'sports-betting-api.p.rapidapi.com'
    );
  }

  private sportsBettingBaseUrl() {
    return `https://${this.sportsBettingHost()}`;
  }

  private sportsBettingSportId() {
    return process.env.SPORTS_BETTING_SPORT_ID || '1';
  }

  private sportsBettingCacheSeconds() {
    return Number(process.env.SPORTS_BETTING_CACHE_SECONDS || 180);
  }

  private sportsBettingDetailCacheSeconds() {
    return Number(process.env.SPORTS_BETTING_DETAIL_CACHE_SECONDS || 120);
  }

  private sportsBettingMaxEventsToScan() {
    return Number(process.env.SPORTS_BETTING_MAX_EVENTS_SCAN || 120);
  }

  private sportsBettingDetailPath(eventId: string | number) {
    const template =
      process.env.SPORTS_BETTING_EVENT_PATH_TEMPLATE ||
      '/api/v1/event?eventId={eventId}';

    return template.replace('{eventId}', encodeURIComponent(String(eventId)));
  }

  private headers() {
    return {
      'x-rapidapi-key': this.sportsBettingKey(),
      'x-rapidapi-host': this.sportsBettingHost(),
      'Content-Type': 'application/json',
    };
  }

  private async fetchSportsBettingJson(path: string) {
    const url = `${this.sportsBettingBaseUrl()}${path}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Number(process.env.SPORTS_BETTING_TIMEOUT_MS || 12000),
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`Sports Betting API erro ${response.status}: ${text}`);
        return null;
      }

      return response.json();
    } catch (error: any) {
      this.logger.warn(
        `Erro Sports Betting API: ${error?.message || 'erro desconhecido'}`,
      );
      return null;
    }
  }

  // =========================
  // FALLBACK THE ODDS API CONFIG
  // =========================

  private readonly theOddsBaseUrl = 'https://api.the-odds-api.com/v4';

  private theOddsApiKey() {
    return this.config.get<string>('THE_ODDS_API_KEY') || process.env.THE_ODDS_API_KEY || '';
  }

  private theOddsEnabled() {
    return process.env.THE_ODDS_API_ENABLED === 'true' && !!this.theOddsApiKey();
  }

  private region() {
    return process.env.THE_ODDS_API_REGION || 'eu';
  }

  private oddsFormat() {
    return process.env.THE_ODDS_API_ODDS_FORMAT || 'decimal';
  }

  // =========================
  // NORMALIZAÇÃO / MATCHING
  // =========================

  private normalize(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(fc|sc|ec|afc|cf|club|women|woman|w|u17|u18|u19|u20|u21|u23|rs)\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private teamScore(a: any, b: any) {
    const left = this.normalize(a);
    const right = this.normalize(b);

    if (!left || !right) return 0;
    if (left === right) return 100;
    if (left.includes(right) || right.includes(left)) return 92;

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

  private isSameSportsBettingGame(event: SportsBettingEvent, homeTeam: string, awayTeam: string) {
    const normalScore =
      this.teamScore(event?.home, homeTeam) + this.teamScore(event?.away, awayTeam);

    const reverseScore =
      this.teamScore(event?.home, awayTeam) + this.teamScore(event?.away, homeTeam);

    const vs = String(event?.vs || '');
    const vsScore =
      (this.normalize(vs).includes(this.normalize(homeTeam)) ? 70 : 0) +
      (this.normalize(vs).includes(this.normalize(awayTeam)) ? 70 : 0);

    return Math.max(normalScore, reverseScore, vsScore) >= 130;
  }

  private isBlockedLeague(leagueName: string) {
    const league = this.normalize(leagueName);

    const blocked = [
      'u17',
      'u18',
      'u19',
      'u20',
      'u21',
      'u23',
      'women',
      'woman',
      'amateur',
      'reserve',
      'reserves',
      'youth',
      'friendly',
      'friendlies',
      'regionalliga',
      'regional',
      'division 3',
      'division 4',
      'liga 3',
      'third division',
      'primera b metropolitana',
      'primera c',
      'torneo promocional',
      'nacional b',
      'serie c',
      'serie d',
      'segunda',
      'tercera',
      'nwsl',
      'wpsl',
      'w league',
    ];

    return blocked.some((word) => league.includes(this.normalize(word)));
  }

  private isAllowedLeague(leagueName: string) {
    if (!leagueName) return false;
    if (process.env.SPORTS_BETTING_FILTER_LEAGUES === 'false') return true;
    if (this.isBlockedLeague(leagueName)) return false;

    const league = this.normalize(leagueName);

    const allowed = [
      'world cup',
      'uefa champions league',
      'champions league',
      'uefa europa league',
      'europa league',
      'uefa conference league',
      'conference league',
      'copa libertadores',
      'libertadores',
      'copa sudamericana',
      'sudamericana',
      'brazil campeonato brasileiro serie a',
      'brasileirao serie a',
      'brazil campeonato brasileiro serie b',
      'brasileirao serie b',
      'brazil copa do brasil',
      'copa do brasil',
      'england premier league',
      'premier league',
      'england championship',
      'spain primera division',
      'spain segunda division',
      'la liga',
      'italy serie a',
      'italy serie b',
      'germany bundesliga',
      'germany bundesliga 2',
      'france ligue 1',
      'portugal primeira liga',
      'netherlands eredivisie',
      'usa mls',
      'mexico liga mx',
      'argentina primera division',
      'chile primera division',
      'colombia categoria primera a',
      'uruguay primera division',
      'ecuador serie a',
      'peru liga 1',
      'belgium jupiler league',
      'norway eliteserien',
      'ireland premier league',
      'japan j1',
    ];

    return allowed.some((name) => league.includes(this.normalize(name)));
  }

  private parseLineNumber(name: string) {
    const match = String(name || '').match(/(-?\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  private safeOdd(value: any) {
    const odd = Number(value || 0);
    if (!Number.isFinite(odd)) return 0;
    return odd;
  }

  // =========================
  // SPORTS BETTING API
  // =========================

  async getSportsBettingInplayEvents(): Promise<SportsBettingEvent[]> {
    if (!this.sportsBettingEnabled()) return [];

    const now = Date.now();

    if (this.sportsBettingEventsCache && this.sportsBettingEventsCache.expiresAt > now) {
      return this.sportsBettingEventsCache.data;
    }

    const path = `/api/v1/inplay?sid=${encodeURIComponent(this.sportsBettingSportId())}`;
    const data = await this.fetchSportsBettingJson(path);

    const events = Array.isArray(data?.events) ? data.events : [];
    const filtered = events
      .filter((event: SportsBettingEvent) => this.isAllowedLeague(String(event?.leagueName || '')))
      .slice(0, this.sportsBettingMaxEventsToScan());

    this.sportsBettingEventsCache = {
      expiresAt: now + this.sportsBettingCacheSeconds() * 1000,
      data: filtered,
    };

    return filtered;
  }

  async findSportsBettingEvent(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<SportsBettingEvent | null> {
    const events = await this.getSportsBettingInplayEvents();

    const exact = events.find((event) =>
      this.isSameSportsBettingGame(event, params.homeTeam, params.awayTeam),
    );

    if (exact) return exact;

    const byLeague = events.filter((event) => {
      const score = this.teamScore(event.leagueName, params.league);
      return score >= 40;
    });

    return (
      byLeague.find((event) =>
        this.isSameSportsBettingGame(event, params.homeTeam, params.awayTeam),
      ) || null
    );
  }

  async getSportsBettingEventDetails(eventId: string | number): Promise<SportsBettingEvent | null> {
    if (!this.sportsBettingEnabled()) return null;
    if (!eventId) return null;

    const key = String(eventId);
    const now = Date.now();
    const cached = this.sportsBettingEventCache.get(key);

    if (cached && cached.expiresAt > now) return cached.data;

    const data = await this.fetchSportsBettingJson(this.sportsBettingDetailPath(eventId));

    const event = data?.event
      ? {
          ...data.event,
          odds: Array.isArray(data?.odds) ? data.odds : data.event?.odds || [],
          current: data?.current || data.event?.current || null,
          history: data?.history || data.event?.history || null,
        }
      : null;

    this.sportsBettingEventCache.set(key, {
      expiresAt: now + this.sportsBettingDetailCacheSeconds() * 1000,
      data: event,
    });

    return event;
  }

  private statFromSportsBettingHistory(event: SportsBettingEvent, statName: string) {
    const values = event?.history?.['0']?.[0]?.Value || event?.history?.[0]?.[0]?.Value || [];
    const found = Array.isArray(values)
      ? values.find((item: any) => this.normalize(item?.N) === this.normalize(statName))
      : null;

    return {
      home: found ? Number(found.S1 || 0) : null,
      away: found ? Number(found.S2 || 0) : null,
    };
  }

  private buildStats(event: SportsBettingEvent) {
    if (!event?.history) return null;

    return {
      xg: this.statFromSportsBettingHistory(event, 'xG'),
      attacks: this.statFromSportsBettingHistory(event, 'Attacks'),
      dangerousAttacks: this.statFromSportsBettingHistory(event, 'Dangerous attacks'),
      possession: this.statFromSportsBettingHistory(event, 'Possession %'),
      shotsOnTarget: this.statFromSportsBettingHistory(event, 'Shots on target'),
      shotsOffTarget: this.statFromSportsBettingHistory(event, 'Shots off target'),
      corners: this.statFromSportsBettingHistory(event, 'Corner'),
      yellowCards: this.statFromSportsBettingHistory(event, 'Yellow cards'),
      redCards: this.statFromSportsBettingHistory(event, 'Red card'),
      keyPasses: this.statFromSportsBettingHistory(event, 'Key Passes'),
      passingAccuracy: this.statFromSportsBettingHistory(event, 'Passing Accuracy %'),
    };
  }

  private marketKeyFromSportsBettingMarket(marketName: string) {
    const name = this.normalize(marketName);

    if (name === 'result') return 'h2h';
    if (name === 'total') return 'totals';
    if (name === 'total 3 way') return 'totals';
    if (name.includes('both teams to score')) return 'btts';
    if (name === 'handicap') return 'spreads';
    if (name === 'double chance') return 'double_chance';
    if (name.includes('next goal')) return 'next_goal';
    if (name.includes('corner')) return 'corners';
    if (name.includes('total') && name.includes('leganes')) return 'team_total';
    if (name.includes('total') && name.includes('mirandes')) return 'team_total';

    return name.replace(/\s+/g, '_');
  }

  private marketName(key: string) {
    const names: Record<string, string> = {
      h2h: 'Resultado Final',
      totals: 'Total de gols',
      btts: 'Ambas marcam',
      spreads: 'Handicap',
      double_chance: 'Dupla chance',
      next_goal: 'Próximo gol',
      corners: 'Escanteios',
      team_total: 'Total do time',
      player_shots_on_target: 'Jogador chutes no gol',
      player_shots: 'Jogador chutes totais',
      player_goal_scorer_anytime: 'Jogador marca gol',
    };

    return names[key] || key;
  }

  private buildSportsBettingTip(params: {
    marketKey: string;
    marketName: string;
    outcomeName: string;
    homeTeam: string;
    awayTeam: string;
  }) {
    const { marketKey, outcomeName, homeTeam, awayTeam } = params;
    const normalized = this.normalize(outcomeName);

    if (marketKey === 'h2h') {
      if (this.teamScore(outcomeName, homeTeam) >= 80) return `${homeTeam} para vencer`;
      if (this.teamScore(outcomeName, awayTeam) >= 80) return `${awayTeam} para vencer`;
      if (normalized.includes('draw')) return 'Empate';
      return `${outcomeName} para vencer`;
    }

    if (marketKey === 'totals') {
      if (normalized.includes('over')) return `Over ${this.parseLineNumber(outcomeName) ?? ''} gols`.trim();
      if (normalized.includes('under')) return `Under ${this.parseLineNumber(outcomeName) ?? ''} gols`.trim();
    }

    if (marketKey === 'btts') {
      return `Ambas equipes marcam: ${normalized.includes('yes') ? 'Sim' : 'Não'}`;
    }

    if (marketKey === 'spreads') {
      return `${outcomeName.replace('@', '').replace(/\s+/g, ' ').trim()} handicap`;
    }

    if (marketKey === 'double_chance') {
      return outcomeName.replace(/ Or /g, ' ou ');
    }

    if (marketKey === 'next_goal') {
      return outcomeName.replace(/To Score Next Goal/g, 'marca o próximo gol');
    }

    return outcomeName;
  }

  private isUsefulSportsBettingMarket(marketKey: string, tip: string, odd: number) {
    if (!odd || odd < 1.18 || odd > 3.5) return false;

    const normalizedTip = this.normalize(tip);

    if (normalizedTip.includes('correct score')) return false;
    if (marketKey === 'correct_score') return false;
    if (normalizedTip.includes('exact')) return false;

    const allowed = [
      'totals',
      'btts',
      'spreads',
      'double_chance',
      'h2h',
      'next_goal',
      'corners',
      'team_total',
    ];

    return allowed.includes(marketKey);
  }

  private mapSportsBettingOdds(event: SportsBettingEvent, homeTeam: string, awayTeam: string): OddsPick[] {
    const picks: OddsPick[] = [];
    const stats = this.buildStats(event);
    const minute = Number(event?.current?.minute ?? 0);

    for (const market of event?.odds || []) {
      const marketKey = this.marketKeyFromSportsBettingMarket(String(market?.name || ''));
      const marketName = this.marketName(marketKey);

      for (const outcome of market?.markets || []) {
        if (String(outcome?.status || '').toLowerCase() !== 'show') continue;

        const odd = this.safeOdd(outcome?.rate);
        const tip = this.buildSportsBettingTip({
          marketKey,
          marketName: String(market?.name || ''),
          outcomeName: String(outcome?.name || ''),
          homeTeam,
          awayTeam,
        });

        if (!this.isUsefulSportsBettingMarket(marketKey, tip, odd)) continue;

        picks.push({
          marketKey,
          marketName,
          tip,
          odd,
          bookmaker: 'Sports Betting API',
          source: 'sports-betting-api',
          outcomeName: outcome?.name,
          point: this.parseLineNumber(String(outcome?.name || '')),
          eventId: event?.eventId,
          leagueName: event?.leagueName,
          currentMinute: Number.isFinite(minute) ? minute : null,
          stats,
        });
      }
    }

    return picks
      .sort((a, b) => {
        const priority: Record<string, number> = {
          totals: 42,
          double_chance: 36,
          btts: 30,
          spreads: 24,
          team_total: 18,
          next_goal: 12,
          h2h: 6,
        };

        return (priority[b.marketKey] || 0) + b.odd - ((priority[a.marketKey] || 0) + a.odd);
      })
      .slice(0, 25);
  }

  async getSportsBettingGameOdds(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<OddsPick[]> {
    const found = await this.findSportsBettingEvent(params);
    if (!found?.eventId) return [];

    const detailed = await this.getSportsBettingEventDetails(found.eventId);
    const event = detailed || found;

    return this.mapSportsBettingOdds(event, params.homeTeam, params.awayTeam);
  }

  // =========================
  // THE ODDS API FALLBACK
  // =========================

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

  private isSameTheOddsGame(event: any, homeTeam: string, awayTeam: string) {
    const normalScore =
      this.teamScore(event?.home_team, homeTeam) + this.teamScore(event?.away_team, awayTeam);

    const reverseScore =
      this.teamScore(event?.home_team, awayTeam) + this.teamScore(event?.away_team, homeTeam);

    const teams = (event?.teams || []).map((team: string) => this.normalize(team));
    const home = this.normalize(homeTeam);
    const away = this.normalize(awayTeam);

    const listScore =
      (teams.some((team: string) => team.includes(home) || home.includes(team)) ? 80 : 0) +
      (teams.some((team: string) => team.includes(away) || away.includes(team)) ? 80 : 0);

    return Math.max(normalScore, reverseScore, listScore) >= 130;
  }

  private async fetchTheOddsJson(url: string) {
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

  async findTheOddsSoccerEvent(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }) {
    if (!this.theOddsEnabled()) return null;

    for (const sportKey of this.sportKeysForSoccer(params.league)) {
      const url = new URL(`${this.theOddsBaseUrl}/sports/${sportKey}/events`);
      url.searchParams.set('apiKey', this.theOddsApiKey());

      const events = await this.fetchTheOddsJson(url.toString());

      if (!Array.isArray(events)) continue;

      const found = events.find((event) =>
        this.isSameTheOddsGame(event, params.homeTeam, params.awayTeam),
      );

      if (found) {
        return { sportKey, event: found };
      }
    }

    return null;
  }

  private marketsForTheOddsApi() {
    return ['h2h', 'totals', 'btts', 'spreads'];
  }

  private buildTheOddsTip(params: {
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

  async getTheOddsGameOdds(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<OddsPick[]> {
    if (!this.theOddsEnabled()) return [];

    const found = await this.findTheOddsSoccerEvent(params);
    if (!found?.sportKey || !found?.event?.id) return [];

    const url = new URL(`${this.theOddsBaseUrl}/sports/${found.sportKey}/events/${found.event.id}/odds`);
    url.searchParams.set('apiKey', this.theOddsApiKey());
    url.searchParams.set('regions', this.region());
    url.searchParams.set('markets', this.marketsForTheOddsApi().join(','));
    url.searchParams.set('oddsFormat', this.oddsFormat());

    if (process.env.THE_ODDS_API_BOOKMAKERS) {
      url.searchParams.set('bookmakers', process.env.THE_ODDS_API_BOOKMAKERS);
    }

    const data = await this.fetchTheOddsJson(url.toString());
    const picks: OddsPick[] = [];

    for (const bookmaker of data?.bookmakers || []) {
      for (const market of bookmaker?.markets || []) {
        for (const outcome of market?.outcomes || []) {
          const odd = Number(outcome?.price || 0);
          if (!odd || odd < 1.2 || odd > 3.4) continue;

          picks.push({
            marketKey: market.key,
            marketName: this.marketName(market.key),
            tip: this.buildTheOddsTip({
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

    return picks.slice(0, 15);
  }

  async getGameOdds(params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<OddsPick[]> {
    const sportsBetting = await this.getSportsBettingGameOdds(params);

    if (sportsBetting.length > 0) {
      return sportsBetting;
    }

    return this.getTheOddsGameOdds(params);
  }

  async getPlayerProps(_params: {
    homeTeam: string;
    awayTeam: string;
    league: string;
  }): Promise<OddsPick[]> {
    // A Sports Betting API testada trouxe grupo de Players' stats, mas não trouxe odds de player props
    // no formato confiável para o Oddix. Mantemos vazio para não inventar jogador/linha.
    return [];
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
      .filter((pick) => Number(pick.odd || 0) >= 1.18)
      .filter((pick) => Number(pick.odd || 0) <= 3.5)
      .sort((a, b) => {
        const priority: Record<string, number> = {
          player_shots_on_target: 46,
          player_shots: 40,
          totals: 38,
          double_chance: 34,
          btts: 28,
          spreads: 22,
          team_total: 18,
          next_goal: 10,
          h2h: 6,
          player_goal_scorer_anytime: 4,
        };

        return (priority[b.marketKey] || 0) + b.odd - ((priority[a.marketKey] || 0) + a.odd);
      })
      .slice(0, 15);
  }
}
