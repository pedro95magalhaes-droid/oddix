import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

type BetResult = 'won' | 'lost' | 'open';

@Injectable()
export class ResultsCronService {
  private readonly logger = new Logger(ResultsCronService.name);
  private readonly apiFootballURL = 'https://v3.football.api-sports.io';
  private readonly sportsDbURL = 'https://www.thesportsdb.com/api/v1/json';
  private readonly timezone = 'America/Fortaleza';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
  ) {}

  @Cron('0 * * * *')
  async syncResultsAutomatically() {
    return this.syncResults('auto');
  }

  normalize(text: any) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(fc|sc|ec|afc|cf|club|women|woman|w|u20|u21|u23|rs)\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  dateCandidates(date: any) {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return [];

    const dates = [0, -1, 1].map((offset) => {
      const copy = new Date(parsed);
      copy.setUTCDate(copy.getUTCDate() + offset);
      return copy.toISOString().slice(0, 10);
    });

    return Array.from(new Set(dates));
  }

  isFinished(statusShort: string, statusLong: string) {
    const short = this.normalize(statusShort);
    const long = this.normalize(statusLong);

    return (
      ['ft', 'aet', 'pen'].includes(short) ||
      long.includes('match finished') ||
      long.includes('finished') ||
      long.includes('after extra time') ||
      long.includes('penalty')
    );
  }

  getGoals(fixture: any) {
    const homeGoals =
      fixture.goals?.home ??
      fixture.score?.fulltime?.home ??
      fixture.score?.extratime?.home ??
      0;

    const awayGoals =
      fixture.goals?.away ??
      fixture.score?.fulltime?.away ??
      fixture.score?.extratime?.away ??
      0;

    return {
      homeGoals: Number(homeGoals || 0),
      awayGoals: Number(awayGoals || 0),
      totalGoals: Number(homeGoals || 0) + Number(awayGoals || 0),
    };
  }

  async fetchApiFootball(apiKey: string, path: string, params: Record<string, any>) {
    const url = new URL(`${this.apiFootballURL}${path}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'x-apisports-key': apiKey,
        },
        signal: controller.signal,
      });

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchFixtureById(apiKey: string, fixtureId: number) {
    try {
      const data = await this.fetchApiFootball(apiKey, '/fixtures', {
        id: fixtureId,
        timezone: this.timezone,
      });

      if (data?.errors && Object.keys(data.errors).length > 0) {
        return null;
      }

      return data?.response?.[0] || null;
    } catch {
      return null;
    }
  }

  async getApiFootballFixturesByDate(
    apiKey: string,
    date: string,
    dateCache: Map<string, any[]>,
  ) {
    const cacheKey = `api-football:${date}`;

    if (dateCache.has(cacheKey)) {
      return dateCache.get(cacheKey) || [];
    }

    try {
      const data = await this.fetchApiFootball(apiKey, '/fixtures', {
        date,
        timezone: this.timezone,
      });

      if (data?.errors && Object.keys(data.errors).length > 0) {
        dateCache.set(cacheKey, []);
        return [];
      }

      const fixtures = data?.response || [];
      dateCache.set(cacheKey, fixtures);

      return fixtures;
    } catch {
      dateCache.set(cacheKey, []);
      return [];
    }
  }

  getSportsDbKey() {
    return this.config.get<string>('THESPORTSDB_KEY') || process.env.THESPORTSDB_KEY || '123';
  }

  mapSportsDbEvent(event: any) {
    const homeScore =
      event.intHomeScore !== null && event.intHomeScore !== undefined
        ? Number(event.intHomeScore)
        : null;

    const awayScore =
      event.intAwayScore !== null && event.intAwayScore !== undefined
        ? Number(event.intAwayScore)
        : null;

    const finished = homeScore !== null && awayScore !== null;

    return {
      provider: 'thesportsdb',
      fixture: {
        id: Number(event.idEvent),
        date: `${event.dateEvent}T${event.strTime || '00:00:00'}`,
        timezone: 'UTC',
        status: {
          long: finished ? 'Match Finished' : 'Not Started',
          short: finished ? 'FT' : 'NS',
          elapsed: null,
        },
      },
      league: {
        id: Number(event.idLeague || 0),
        name: event.strLeague || 'Liga não informada',
        country: event.strCountry || '',
        logo: event.strLeagueBadge || '',
      },
      teams: {
        home: {
          id: Number(event.idHomeTeam || 0),
          name: event.strHomeTeam || '',
          logo: event.strHomeTeamBadge || '',
          winner: finished ? homeScore > awayScore : null,
        },
        away: {
          id: Number(event.idAwayTeam || 0),
          name: event.strAwayTeam || '',
          logo: event.strAwayTeamBadge || '',
          winner: finished ? awayScore > homeScore : null,
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
    };
  }

  async getSportsDbFixturesByDate(date: string, dateCache: Map<string, any[]>) {
    const cacheKey = `thesportsdb:${date}`;

    if (dateCache.has(cacheKey)) {
      return dateCache.get(cacheKey) || [];
    }

    const key = this.getSportsDbKey();
    const url = new URL(`${this.sportsDbURL}/${key}/eventsday.php`);
    url.searchParams.set('d', date);
    url.searchParams.set('s', 'Soccer');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      const data = await response.json();
      const events = data?.events || [];
      const fixtures = events.map((event: any) => this.mapSportsDbEvent(event));

      dateCache.set(cacheKey, fixtures);

      return fixtures;
    } catch {
      dateCache.set(cacheKey, []);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  teamScore(apiNameRaw: string, betNameRaw: string) {
    const apiName = this.normalize(apiNameRaw);
    const betName = this.normalize(betNameRaw);

    if (!apiName || !betName) return 0;

    if (apiName === betName) return 100;
    if (apiName.includes(betName) || betName.includes(apiName)) return 90;

    const apiWords = apiName.split(' ').filter((word) => word.length >= 3);
    const betWords = betName.split(' ').filter((word) => word.length >= 3);

    if (!apiWords.length || !betWords.length) return 0;

    let common = 0;

    for (const apiWord of apiWords) {
      if (
        betWords.some(
          (betWord) =>
            apiWord === betWord ||
            apiWord.includes(betWord) ||
            betWord.includes(apiWord),
        )
      ) {
        common++;
      }
    }

    const maxWords = Math.max(apiWords.length, betWords.length);

    return Math.round((common / maxWords) * 100);
  }

  fixtureScore(fixture: any, bet: any) {
    const homeScore = this.teamScore(fixture.teams?.home?.name, bet.homeTeam);
    const awayScore = this.teamScore(fixture.teams?.away?.name, bet.awayTeam);

    const reversedHomeScore = this.teamScore(
      fixture.teams?.home?.name,
      bet.awayTeam,
    );
    const reversedAwayScore = this.teamScore(
      fixture.teams?.away?.name,
      bet.homeTeam,
    );

    const normalScore = homeScore + awayScore;
    const reversedScore = reversedHomeScore + reversedAwayScore;

    return Math.max(normalScore, reversedScore);
  }

  async fetchFixtureByDateAndTeams(
    apiKey: string,
    bet: any,
    dateCache: Map<string, any[]>,
  ) {
    const candidates = this.dateCandidates(bet.gameDate || bet.createdAt);

    if (!candidates.length) {
      return {
        fixture: null,
        bestScore: 0,
        searchedDates: [],
        provider: null,
      };
    }

    let bestFixture = null;
    let bestScore = 0;
    let bestProvider = null;
    const searchedDates: string[] = [];

    for (const date of candidates) {
      searchedDates.push(date);

      const apiFixtures = await this.getApiFootballFixturesByDate(
        apiKey,
        date,
        dateCache,
      );

      const sportsDbFixtures = await this.getSportsDbFixturesByDate(date, dateCache);

      const fixtures = [
        ...apiFixtures.map((fixture: any) => ({
          ...fixture,
          provider: fixture.provider || 'api-football',
        })),
        ...sportsDbFixtures,
      ];

      for (const fixture of fixtures) {
        const score = this.fixtureScore(fixture, bet);

        if (score > bestScore) {
          bestScore = score;
          bestFixture = fixture;
          bestProvider = fixture.provider || 'api-football';
        }
      }

      if (bestScore >= 180) {
        break;
      }
    }

    if (bestFixture && bestScore >= 80) {
      return {
        fixture: bestFixture,
        bestScore,
        searchedDates,
        provider: bestProvider,
      };
    }

    return {
      fixture: null,
      bestScore,
      searchedDates,
      provider: bestProvider,
    };
  }

  resolveResult(params: {
    tip: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    totalGoals: number;
  }): BetResult {
    const tip = this.normalize(params.tip);
    const homeTeam = this.normalize(params.homeTeam);
    const awayTeam = this.normalize(params.awayTeam);

    const homeGoals = params.homeGoals;
    const awayGoals = params.awayGoals;
    const totalGoals = params.totalGoals;

    const homeWon = homeGoals > awayGoals;
    const awayWon = awayGoals > homeGoals;
    const draw = homeGoals === awayGoals;

    if (!tip) return 'open';

    const overMatch =
      tip.match(/over\s*(\d+(\.\d+)?)/) ||
      tip.match(/mais de\s*(\d+(\.\d+)?)/) ||
      tip.match(/\+(\d+(\.\d+)?)/);

    if (overMatch) {
      const line = Number(overMatch[1]);
      return totalGoals > line ? 'won' : 'lost';
    }

    const underMatch =
      tip.match(/under\s*(\d+(\.\d+)?)/) ||
      tip.match(/menos de\s*(\d+(\.\d+)?)/) ||
      tip.match(/-(\d+(\.\d+)?)/);

    if (underMatch) {
      const line = Number(underMatch[1]);
      return totalGoals < line ? 'won' : 'lost';
    }

    if (
      tip.includes('ambas marcam') ||
      tip.includes('ambos marcam') ||
      tip.includes('btts sim') ||
      tip.includes('btts yes')
    ) {
      return homeGoals > 0 && awayGoals > 0 ? 'won' : 'lost';
    }

    if (
      tip.includes('ambas nao marcam') ||
      tip.includes('ambos nao marcam') ||
      tip.includes('btts nao') ||
      tip.includes('btts no')
    ) {
      return homeGoals === 0 || awayGoals === 0 ? 'won' : 'lost';
    }

    if (
      tip.includes('casa vence') ||
      tip.includes('mandante vence') ||
      tip.includes('home win') ||
      tip.includes(`${homeTeam} vence`) ||
      tip.includes(homeTeam)
    ) {
      return homeWon ? 'won' : 'lost';
    }

    if (
      tip.includes('visitante vence') ||
      tip.includes('fora vence') ||
      tip.includes('away win') ||
      tip.includes(`${awayTeam} vence`) ||
      tip.includes(awayTeam)
    ) {
      return awayWon ? 'won' : 'lost';
    }

    if (tip.includes('empate') || tip === 'x' || tip.includes('draw')) {
      return draw ? 'won' : 'lost';
    }

    if (tip.includes('1x') || tip.includes('casa ou empate')) {
      return homeWon || draw ? 'won' : 'lost';
    }

    if (tip.includes('x2') || tip.includes('visitante ou empate')) {
      return awayWon || draw ? 'won' : 'lost';
    }

    if (tip.includes('12') || tip.includes('sem empate')) {
      return !draw ? 'won' : 'lost';
    }

    return 'open';
  }

  async syncResults(source: 'auto' | 'manual' = 'auto') {
    this.logger.log(`IA Oddix verificando resultados... origem=${source}`);

    const openBets = await this.prisma.bet.findMany({
      where: {
        status: 'open',
      },
    });

    let updatedWon = 0;
    let updatedLost = 0;
    let stillOpen = 0;
    let noFixtureId = 0;
    let notFinished = 0;
    let notRecognized = 0;
    let fixtureNotFound = 0;
    let fixtureFoundByFallback = 0;

    const details: any[] = [];
    const dateCache = new Map<string, any[]>();
    const apiKey =
      this.config.get<string>('API_FOOTBALL_KEY') ||
      process.env.API_FOOTBALL_KEY ||
      '';

    for (const bet of openBets) {
      try {
        if (!bet.fixtureId) {
          noFixtureId++;
        }

        let fixture: any = null;
        let foundBy = 'fixtureId';
        let fallbackInfo: any = null;
        let provider = 'api-football';

        if (bet.fixtureId && apiKey) {
          fixture = await this.fetchFixtureById(apiKey, Number(bet.fixtureId));
        }

        if (!fixture) {
          fallbackInfo = await this.fetchFixtureByDateAndTeams(
            apiKey,
            bet,
            dateCache,
          );

          fixture = fallbackInfo?.fixture || null;
          foundBy = 'date_and_teams';
          provider = fallbackInfo?.provider || provider;

          if (fixture) {
            fixtureFoundByFallback++;

            if (
              fixture.fixture?.id &&
              Number(fixture.fixture.id) !== Number(bet.fixtureId)
            ) {
              await this.prisma.bet.update({
                where: { id: bet.id },
                data: {
                  fixtureId: Number(fixture.fixture.id),
                },
              });
            }
          }
        }

        if (!fixture) {
          fixtureNotFound++;
          stillOpen++;

          details.push({
            betId: bet.id,
            fixtureId: bet.fixtureId,
            game: `${bet.homeTeam} x ${bet.awayTeam}`,
            tip: bet.tip,
            gameDate: bet.gameDate,
            searchedDates:
              fallbackInfo?.searchedDates || this.dateCandidates(bet.gameDate),
            bestScore: fallbackInfo?.bestScore || 0,
            reason: 'Fixture não encontrado nem por ID nem por data/times',
          });

          continue;
        }

        const statusShort = fixture.fixture?.status?.short || '';
        const statusLong = fixture.fixture?.status?.long || '';

        if (!this.isFinished(statusShort, statusLong)) {
          notFinished++;
          stillOpen++;

          details.push({
            betId: bet.id,
            fixtureId: fixture.fixture?.id || bet.fixtureId,
            game: `${bet.homeTeam} x ${bet.awayTeam}`,
            tip: bet.tip,
            apiStatus: statusShort,
            foundBy,
            provider,
            reason: 'Jogo ainda não finalizado pela API',
          });

          continue;
        }

        const { homeGoals, awayGoals, totalGoals } = this.getGoals(fixture);

        const result = this.resolveResult({
          tip: bet.tip,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          homeGoals,
          awayGoals,
          totalGoals,
        });

        if (result === 'open') {
          notRecognized++;
          stillOpen++;

          details.push({
            betId: bet.id,
            fixtureId: fixture.fixture?.id || bet.fixtureId,
            game: `${bet.homeTeam} x ${bet.awayTeam}`,
            tip: bet.tip,
            score: `${homeGoals}x${awayGoals}`,
            apiStatus: statusShort,
            foundBy,
            provider,
            reason: 'Jogo finalizado, mas mercado não reconhecido',
          });

          continue;
        }

        await this.prisma.bet.update({
          where: {
            id: bet.id,
          },
          data: {
            status: result,
            fixtureId: fixture.fixture?.id
              ? Number(fixture.fixture.id)
              : bet.fixtureId,
          },
        });

        if (result === 'won') updatedWon++;
        if (result === 'lost') updatedLost++;

        await this.telegram.sendResultMessage({
          result,
          homeTeam: bet.homeTeam,
          awayTeam: bet.awayTeam,
          tip: bet.tip,
          score: `${homeGoals}x${awayGoals}`,
          provider,
        });

        details.push({
          betId: bet.id,
          fixtureId: fixture.fixture?.id || bet.fixtureId,
          game: `${bet.homeTeam} x ${bet.awayTeam}`,
          tip: bet.tip,
          score: `${homeGoals}x${awayGoals}`,
          totalGoals,
          apiStatus: statusShort,
          foundBy,
          provider,
          result,
        });
      } catch (error: any) {
        stillOpen++;

        details.push({
          betId: bet.id,
          fixtureId: bet.fixtureId,
          game: `${bet.homeTeam} x ${bet.awayTeam}`,
          tip: bet.tip,
          reason: 'Erro ao verificar este palpite',
          error: error?.message || 'Erro desconhecido',
        });
      }
    }

    await this.telegram.sendSyncSummary({
      checked: openBets.length,
      updatedWon,
      updatedLost,
      stillOpen,
      source,
    });

return {
      message: 'Resultados sincronizados com sucesso',
      checked: openBets.length,
      updatedWon,
      updatedLost,
      stillOpen,
      noFixtureId,
      notFinished,
      notRecognized,
      fixtureNotFound,
      fixtureFoundByFallback,
      source,
      searchedDatesCached: Array.from(dateCache.keys()),
      details,
    };
  }
}
