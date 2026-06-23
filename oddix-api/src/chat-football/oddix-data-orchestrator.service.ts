import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import { OddixLlmService, OddixLlmMessage } from './oddix-llm.service';

export type OddixDataOrchestratorResponse = {
  handled: boolean;
  answer: string;
  data?: Record<string, any>;
  suggestions?: string[];
};

@Injectable()
export class OddixDataOrchestratorService {
  private readonly logger = new Logger(OddixDataOrchestratorService.name);

  constructor(
    @Optional() private readonly footballService?: FootballService,
    @Optional() private readonly llmService?: OddixLlmService,
  ) {}

  async answer(message: string): Promise<OddixDataOrchestratorResponse> {
    const text = this.normalize(message);

    if (!this.isCurrentFootballQuestion(text)) {
      return {
        handled: false,
        answer: '',
      };
    }

    try {
      if (this.isLiveQuestion(text)) {
        return this.answerLiveGames(message);
      }

      if (this.isTodayQuestion(text)) {
        return this.answerTodayGames(message);
      }

      const teams = this.extractTeams(message);
      if (teams) {
        return this.answerMatchQuestion(message, teams.home, teams.away);
      }

      return this.answerTodayGames(message);
    } catch (error: any) {
      this.logger.warn(
        `[ODDIX_ORCHESTRATOR] falhou: ${error?.message || error}`,
      );

      return {
        handled: true,
        answer:
          '⚠️ Tentei buscar dados reais agora, mas não consegui validar a base Oddix neste momento. Não vou inventar jogos, odds ou estatísticas.',
        data: {
          waitingForData: true,
          error: error?.message || 'orchestrator_failed',
        },
      };
    }
  }

  private async answerTodayGames(message: string): Promise<OddixDataOrchestratorResponse> {
    const fixtures = await this.getTodayFixtures();

    if (!fixtures.length) {
      return {
        handled: true,
        answer:
          '⚽ Não encontrei jogos reais confirmados na base Oddix para hoje.\n\nPode ser atraso da API, filtro de ligas ou ausência de jogos elegíveis. Não vou inventar partidas.',
        data: {
          waitingForData: true,
          fixtures: [],
        },
        suggestions: [
          'Mostrar jogos ao vivo',
          'Top Picks de hoje',
          'Analisar um jogo específico',
        ],
      };
    }

    const context = this.buildFixturesContext(fixtures, 'jogos de hoje');
    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Liste os jogos encontrados usando apenas os dados fornecidos. Se a pergunta mencionar Copa, destaque apenas jogos de competições com Copa/World Cup/FIFA no nome quando existirem. Não invente partidas.`,
    );

    return {
      handled: true,
      answer: answer || this.formatFixturesList(fixtures, '⚽ Jogos encontrados hoje na base Oddix'),
      data: {
        fixtures,
      },
      suggestions: fixtures.slice(0, 4).map((game: any) => {
        const home = game?.teams?.home?.name || 'Casa';
        const away = game?.teams?.away?.name || 'Fora';
        return `Analise ${home} x ${away}`;
      }),
    };
  }

  private async answerLiveGames(message: string): Promise<OddixDataOrchestratorResponse> {
    const fixtures = await this.getLiveFixtures();

    if (!fixtures.length) {
      return {
        handled: true,
        answer:
          '⚡ Não encontrei jogos ao vivo/ativos na base Oddix agora.\n\nSe você está vendo uma partida em outra fonte, pode ser atraso da API ou diferença de nome. Não vou inventar placar.',
        data: {
          waitingForData: true,
          fixtures: [],
        },
        suggestions: [
          'Mostrar jogos de hoje',
          'Top Picks de hoje',
          'Analisar um jogo específico',
        ],
      };
    }

    const context = this.buildFixturesContext(fixtures, 'jogos ao vivo');
    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      'Liste os jogos ao vivo encontrados usando apenas os dados fornecidos. Inclua placar, minuto/status e competição quando disponível. Não invente partidas.',
    );

    return {
      handled: true,
      answer: answer || this.formatFixturesList(fixtures, '⚡ Jogos ao vivo/ativos na base Oddix'),
      data: {
        fixtures,
      },
      suggestions: fixtures.slice(0, 4).map((game: any) => {
        const home = game?.teams?.home?.name || 'Casa';
        const away = game?.teams?.away?.name || 'Fora';
        return `Como está ${home} x ${away}?`;
      }),
    };
  }

  private async answerMatchQuestion(
    message: string,
    homeQuery: string,
    awayQuery: string,
  ): Promise<OddixDataOrchestratorResponse> {
    const fixtures = await this.getFixturesWindow(3, 7);
    const match = this.findMatch(fixtures, homeQuery, awayQuery);

    if (!match) {
      return {
        handled: true,
        answer:
          `⚽ Procurei ${homeQuery} x ${awayQuery} na base Oddix, mas não encontrei a partida na janela atual.\n\nSem partida real, odds e estatísticas, não libero análise nem entrada oficial.`,
        data: {
          waitingForData: true,
          homeQuery,
          awayQuery,
        },
        suggestions: [
          'Mostrar jogos de hoje',
          'Mostrar jogos ao vivo',
          'Top Picks de hoje',
        ],
      };
    }

    const fixtureId = String(match?.fixture?.id || '');
    const richContext = await this.getRichContext(fixtureId, match);

    const context = JSON.stringify(
      {
        pergunta: message,
        jogo: this.simplifyFixture(match),
        contextoRico: this.simplifyRichContext(richContext),
        regra:
          'Use apenas estes dados reais. Se odds, estatísticas, H2H ou escalações estiverem ausentes, diga que não há entrada oficial.',
      },
      null,
      2,
    );

    const answer = await this.humanizeWithDeepSeek(
      message,
      context,
      `Monte uma análise Oddix profissional.
Formato:
⚽ Jogo
📊 Situação atual
📈 Leitura da partida
🎯 Mercados observados
⚠️ Riscos
🧠 Conclusão Oddix

Nunca invente odds, estatísticas, escalações ou resultado. Se faltar dado real, bloqueie entrada oficial.`,
    );

    return {
      handled: true,
      answer: answer || this.localMatchAnalysis(match, richContext),
      data: {
        fixture: match,
        richContext,
        waitingForData: !richContext?.ok,
      },
      suggestions: [
        'Esse jogo presta?',
        'Me dá uma opção segura',
        'Monte uma múltipla',
        'Quanto ganho com R$50?',
      ],
    };
  }

  private async humanizeWithDeepSeek(
    userMessage: string,
    realContext: string,
    instruction: string,
  ) {
    if (!this.llmService?.isEnabled()) return null;

    const messages: OddixLlmMessage[] = [
      {
        role: 'system',
        content:
          'Você é a IA Oddix. Você nunca inventa dados atuais. Para futebol, responda somente com os dados reais fornecidos pelo backend. Se faltar dado, diga claramente.',
      },
      {
        role: 'user',
        content: `${instruction}

Dados reais do backend:
${realContext}

Pergunta do usuário:
${userMessage}`,
      },
    ];

    return this.llmService.complete(messages);
  }

  private async getTodayFixtures() {
    if (!this.footballService) return [];

    const today = new Date().toISOString().slice(0, 10);

    const response =
      typeof (this.footballService as any).getFixtures === 'function'
        ? await (this.footballService as any).getFixtures(today)
        : null;

    return this.extractFixtureArray(response)
      .filter((game: any) => game?.teams?.home?.name && game?.teams?.away?.name)
      .slice(0, 60);
  }

  private async getLiveFixtures() {
    if (!this.footballService) return [];

    const flashScoreLive =
      typeof (this.footballService as any).getLiveFixturesFromFlashScore === 'function'
        ? await (this.footballService as any).getLiveFixturesFromFlashScore()
        : null;

    let fixtures = this.extractFixtureArray(flashScoreLive);

    if (!fixtures.length) {
      const fallback =
        typeof (this.footballService as any).getLiveFixtures === 'function'
          ? await (this.footballService as any).getLiveFixtures()
          : null;

      fixtures = this.extractFixtureArray(fallback);
    }

    return fixtures
      .filter((game: any) => game?.teams?.home?.name && game?.teams?.away?.name)
      .slice(0, 40);
  }

  private async getFixturesWindow(daysBack = 3, daysForward = 7) {
    if (!this.footballService) return [];

    const dates: string[] = [];
    const now = new Date();

    for (let i = -daysBack; i <= daysForward; i += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }

    const all: any[] = [];

    for (const date of dates) {
      try {
        const response =
          typeof (this.footballService as any).getFixtures === 'function'
            ? await (this.footballService as any).getFixtures(date)
            : null;

        all.push(...this.extractFixtureArray(response));
      } catch {
        // ignora falha pontual
      }
    }

    const seen = new Set<string>();

    return all.filter((game: any) => {
      const id = String(
        game?.fixture?.id ||
          `${game?.teams?.home?.name}-${game?.teams?.away?.name}-${game?.fixture?.date}`,
      );

      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private async getRichContext(fixtureId: string, fixture: any) {
    if (!fixtureId || !this.footballService) return null;

    const service: any = this.footballService as any;

    if (typeof service.getFlashScoreRichContext === 'function') {
      const externalId =
        fixture?.fixture?.externalId ||
        fixture?.fixture?.external_id ||
        fixture?.fixture?.matchId ||
        fixture?.fixture?.match_id ||
        fixture?.externalId ||
        null;

      return service.getFlashScoreRichContext(fixtureId, externalId);
    }

    if (typeof service.getStatistics === 'function') {
      const statistics = await service.getStatistics(fixtureId).catch(() => null);

      return {
        ok: !!statistics,
        fixture,
        fixtureId,
        statistics,
        odds: fixture?.odds || null,
        h2h: null,
        lineups: null,
      };
    }

    return null;
  }

  private isCurrentFootballQuestion(text: string) {
    return (
      this.isTodayQuestion(text) ||
      this.isLiveQuestion(text) ||
      this.extractTeams(text) ||
      this.hasAny(text, [
        'jogos da copa',
        'copa hoje',
        'copa do mundo hoje',
        'copa do mundo atual',
        'copa do mundo 2026',
        'world cup',
        'mundial hoje',
        'jogos de hoje',
        'partidas de hoje',
        'tem jogo hoje',
        'analise',
        'analisar',
        'palpite',
        'aposta',
        'odd',
        'odds',
      ])
    );
  }

  private isTodayQuestion(text: string) {
    return this.hasAny(text, [
      'hoje',
      'jogos de hoje',
      'partidas de hoje',
      'quais jogos',
      'mostrar jogos',
      'mostra jogos',
      'jogos da copa',
      'copa hoje',
      'copa do mundo hoje',
      'mundial hoje',
    ]);
  }

  private isLiveQuestion(text: string) {
    return this.hasAny(text, [
      'ao vivo',
      'live',
      'em andamento',
      'quanto ta',
      'placar',
      'resultado agora',
      'jogos ao vivo',
    ]);
  }

  private extractTeams(message: string): { home: string; away: string } | null {
    const sanitized = String(message || '')
      .replace(/\b\d+\s*x\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*-\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*:\s*\d+\b/gi, ' x ')
      .replace(/analisa|analisar|analise|análise/gi, '')
      .trim();

    for (const separator of [' x ', ' vs ', ' versus ', ' contra ']) {
      const normalized = sanitized.toLowerCase();

      if (normalized.includes(separator)) {
        const parts = normalized.split(separator);
        if (parts[0]?.trim() && parts[1]?.trim()) {
          return {
            home: this.cleanTeamName(parts[0]),
            away: this.cleanTeamName(parts[1]),
          };
        }
      }
    }

    return null;
  }

  private findMatch(fixtures: any[], homeQueryRaw: string, awayQueryRaw: string) {
    const homeQuery = this.normalize(this.cleanTeamName(homeQueryRaw));
    const awayQuery = this.normalize(this.cleanTeamName(awayQueryRaw));

    return fixtures.find((item: any) => {
      const home = this.normalize(item?.teams?.home?.name);
      const away = this.normalize(item?.teams?.away?.name);

      return (
        (home.includes(homeQuery) && away.includes(awayQuery)) ||
        (home.includes(awayQuery) && away.includes(homeQuery)) ||
        (homeQuery.includes(home) && awayQuery.includes(away)) ||
        (homeQuery.includes(away) && awayQuery.includes(home))
      );
    });
  }

  private buildFixturesContext(fixtures: any[], label: string) {
    return JSON.stringify(
      {
        label,
        total: fixtures.length,
        fixtures: fixtures.slice(0, 25).map((game: any) => this.simplifyFixture(game)),
      },
      null,
      2,
    );
  }

  private simplifyFixture(game: any) {
    return {
      id: game?.fixture?.id,
      externalId:
        game?.fixture?.externalId ||
        game?.fixture?.external_id ||
        game?.externalId ||
        null,
      home: game?.teams?.home?.name,
      away: game?.teams?.away?.name,
      league: game?.league?.name,
      country: game?.league?.country,
      date: game?.fixture?.date,
      status: game?.fixture?.status,
      goals: game?.goals,
      score: game?.score,
      provider: game?.provider,
    };
  }

  private simplifyRichContext(rich: any) {
    if (!rich) return null;

    return {
      ok: rich?.ok,
      source: rich?.source,
      hasStatistics: !!rich?.statistics,
      hasOdds: !!rich?.odds,
      hasH2H: !!rich?.h2h,
      hasLineups: !!rich?.lineups,
      prematchStats: rich?.prematchStats || null,
      errors: rich?.errors || [],
    };
  }

  private formatFixturesList(fixtures: any[], title: string) {
    const lines = fixtures.slice(0, 15).map((game: any, index: number) => {
      const home = game?.teams?.home?.name || 'Casa';
      const away = game?.teams?.away?.name || 'Fora';
      const league = game?.league?.name || 'Liga não informada';
      const status = game?.fixture?.status?.elapsed
        ? `${game.fixture.status.elapsed}'`
        : game?.fixture?.status?.short || 'NS';
      const homeGoals = game?.goals?.home ?? 0;
      const awayGoals = game?.goals?.away ?? 0;

      return `${index + 1}. ${home} ${homeGoals} x ${awayGoals} ${away} (${status})\n   🏆 ${league}`;
    });

    return `${title}:\n\n${lines.join('\n\n')}`;
  }

  private localMatchAnalysis(match: any, richContext: any) {
    const home = match?.teams?.home?.name || 'Casa';
    const away = match?.teams?.away?.name || 'Fora';
    const league = match?.league?.name || 'Liga não informada';
    const status = match?.fixture?.status?.elapsed
      ? `${match.fixture.status.elapsed}'`
      : match?.fixture?.status?.short || 'NS';
    const homeGoals = match?.goals?.home ?? 0;
    const awayGoals = match?.goals?.away ?? 0;

    return `⚽ ${home} x ${away}

🏆 ${league}
⏱️ Status: ${status}
📊 Placar: ${homeGoals} x ${awayGoals}

📌 Contexto real:
${richContext?.statistics ? '✅ Estatísticas disponíveis' : '⚠️ Estatísticas pendentes'}
${richContext?.odds ? '✅ Odds disponíveis' : '⚠️ Odds pendentes'}
${richContext?.h2h ? '✅ H2H disponível' : '⚠️ H2H pendente'}
${richContext?.lineups ? '✅ Escalações disponíveis' : '⚠️ Escalações pendentes'}

🧠 Conclusão Oddix:
Sem odds reais e estatísticas completas, não libero entrada oficial.`;
  }

  private extractFixtureArray(response: any) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.fixtures)) return response.fixtures;
    if (Array.isArray(response?.games)) return response.games;
    if (Array.isArray(response?.matches)) return response.matches;
    if (Array.isArray(response?.items)) return response.items;
    return [];
  }

  private cleanTeamName(value: string) {
    return String(value || '')
      .replace(/\b\d+\b/g, '')
      .replace(/\bao vivo\b/gi, '')
      .replace(/\blive\b/gi, '')
      .replace(/\bhoje\b/gi, '')
      .replace(/\bagora\b/gi, '')
      .replace(/[?!.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasAny(text: string, terms: string[]) {
    return terms.some((term) => text.includes(this.normalize(term)));
  }

  private normalize(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
