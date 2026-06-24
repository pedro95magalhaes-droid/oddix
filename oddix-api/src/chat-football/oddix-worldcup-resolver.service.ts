import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import { FootballResearchService, ResearchItem, ResearchResult } from './football-research.service';
import { OddixResearchAgentService } from './oddix-research-agent.service';
import { OddixLlmMessage, OddixLlmService } from './oddix-llm.service';
import { FlashScoreService } from './flashscore.service';

export type OddixWorldCupFixture = {
  home: string;
  away: string;
  competition: string;
  kickoff?: string | null;
  status?: string | null;
  source: 'local-api' | 'web-research' | 'llm-extracted';
  url?: string | null;
  date?: string | null;
  confidence?: number;
};

export type OddixWorldCupResolution = {
  handled: boolean;
  answer: string;
  fixtures: OddixWorldCupFixture[];
  localFixtures: OddixWorldCupFixture[];
  webFixtures: OddixWorldCupFixture[];
  researchItems: ResearchItem[];
  researchQueries: string[];
  todayIso: string;
  provider?: string;
  error?: string | null;
};

@Injectable()
export class OddixWorldCupResolverService {
  private readonly logger = new Logger(OddixWorldCupResolverService.name);

  constructor(
    @Optional() private readonly footballService?: FootballService,
    @Optional() private readonly flashScoreService?: FlashScoreService,
    @Optional() private readonly researchService?: FootballResearchService,
    @Optional() private readonly researchAgent?: OddixResearchAgentService,
    @Optional() private readonly llmService?: OddixLlmService,
  ) {}

  async resolveToday(question: string): Promise<OddixWorldCupResolution> {
    const todayIso = this.todayIso();
    const todayHuman = this.todayHuman(todayIso);
    const localFixtures = await this.getLocalCupFixtures(todayIso);

    // V21.1: se a base real/FlashScore já trouxe jogos, não chama pesquisa web quebrada/desnecessária.
    // A pesquisa web vira fallback apenas quando não existe fixture real validado.
    const researchPayload = localFixtures.length
      ? { items: [] as ResearchItem[], queries: [] as string[], provider: 'local-api', error: null as string | null }
      : await this.runWorldCupResearch(question, todayIso, todayHuman);

    const { items, queries, provider, error } = researchPayload;
    const webFixtures = localFixtures.length ? [] : await this.extractFixturesFromResearch(question, items, todayIso, todayHuman);
    const fixtures = this.dedupeFixtures([
      ...localFixtures,
      ...webFixtures,
    ]).filter(
      (fixture) =>
        fixture.date &&
        this.isoDate(fixture.date) === todayIso,
    );

    this.logger.log(
      `[V18_WORLDCUP] today=${todayIso} local=${localFixtures.length} web=${webFixtures.length} items=${items.length}`,
    );

    return {
      handled: true,
      answer: this.formatAnswer(fixtures, localFixtures, webFixtures, items, todayIso, error),
      fixtures,
      localFixtures,
      webFixtures,
      researchItems: items,
      researchQueries: queries,
      todayIso,
      provider,
      error,
    };
  }

  private async getLocalCupFixtures(todayIso: string): Promise<OddixWorldCupFixture[]> {
    const fixtures: any[] = [];

    // V20: FlashScore direto como fonte real prioritária.
    if (this.flashScoreService?.isEnabled?.() && this.flashScoreService?.hasKey?.()) {
      try {
        const response = await this.flashScoreService.getFixtures(todayIso);
        const list = this.extractFixtureArray(response);
        if (list.length) {
          this.logger.log(`[V20_WORLDCUP] flashscore.getFixtures(${todayIso})=${list.length}`);
          fixtures.push(...list);
        } else if (!response.ok) {
          this.logger.warn(`[V20_WORLDCUP] flashscore.getFixtures falhou: ${response.error}`);
        }
      } catch (error: any) {
        this.logger.warn(`[V20_WORLDCUP] flashscore direto falhou: ${error?.message || error}`);
      }
    }

    if (this.footballService) {
      const service: any = this.footballService as any;
      const calls: Array<{ name: string; call: () => Promise<any> }> = [
        { name: 'getFixtures', call: () => service.getFixtures?.(todayIso) },
        { name: 'getTodayFixtures', call: () => service.getTodayFixtures?.() },
        { name: 'getTodayMatches', call: () => service.getTodayMatches?.() },
        { name: 'getMatchesByDate', call: () => service.getMatchesByDate?.(todayIso) },
        { name: 'getFlashScoreToday', call: () => service.getFlashScoreToday?.() },
        { name: 'getFlashScoreFixtures', call: () => service.getFlashScoreFixtures?.(todayIso) },
        { name: 'getFlashScoreMatches', call: () => service.getFlashScoreMatches?.(todayIso) },
        { name: 'getAllTodayFixtures', call: () => service.getAllTodayFixtures?.() },
      ];

      for (const entry of calls) {
        try {
          const result = await entry.call();
          const list = this.extractFixtureArray(result);
          if (list.length) {
            this.logger.log(`[V20_WORLDCUP] local.${entry.name}=${list.length}`);
            fixtures.push(...list);
          }
        } catch (error: any) {
          this.logger.warn(`[V20_WORLDCUP] local.${entry.name} falhou: ${error?.message || error}`);
        }
      }
    }

    return this.dedupeFixtures(
      fixtures
        .filter((fixture) => this.isCupCompetition(fixture))
        .filter((fixture) => this.isTodayFixture(fixture, todayIso))
        .map((fixture) => this.fixtureToWorldCupFixture(fixture)),
    );
  }

  private async runWorldCupResearch(question: string, todayIso: string, todayHuman: string) {
    const queries = this.buildWorldCupQueries(question, todayIso, todayHuman);
    const items: ResearchItem[] = [];
    const errors: string[] = [];
    let provider = 'none';

    for (const query of queries) {
      try {
        let result: ResearchResult | null = null;
        if (this.researchService?.searchEverything) {
          result = await this.researchService.searchEverything(query, 'br');
        } else if (this.researchService?.search) {
          result = await this.researchService.search(query, 'br');
        } else if (this.researchAgent) {
          result = await this.researchAgent.research(query, query);
        }

        if (!result) continue;
        provider = (result as any)?.provider || provider;
        if ((result as any)?.error) errors.push(`${query}: ${(result as any).error}`);
        if (Array.isArray(result.items)) items.push(...result.items);
        if (this.uniqueItems(items).length >= 100) break;
      } catch (error: any) {
        errors.push(`${query}: ${error?.message || error}`);
      }
    }

    return {
      items: this.uniqueItems(items).slice(0, 100),
      queries,
      provider,
      error: errors.length ? errors.slice(0, 3).join(' | ') : null,
    };
  }

  private buildWorldCupQueries(question: string, todayIso: string, todayHuman: string) {
    return Array.from(
      new Set([
        `FIFA Club World Cup fixtures ${todayIso}`,
        `FIFA Club World Cup matches today ${todayIso}`,
        `Club World Cup games today ${todayIso}`,
        `today Club World Cup games`,
        `Club World Cup live matches`,
        `FlashScore Club World Cup fixtures ${todayIso}`,
        `SofaScore Club World Cup fixtures ${todayIso}`,
        `ESPN Club World Cup fixtures ${todayIso}`,
        `FIFA World Cup fixtures today ${todayIso}`,
        `Copa do Mundo jogos hoje ${todayHuman}`,
        String(question || '').trim(),
      ].filter(Boolean)),
    ).slice(0, 12);
  }

  private async extractFixturesFromResearch(
    question: string,
    items: ResearchItem[],
    todayIso: string,
    todayHuman: string,
  ): Promise<OddixWorldCupFixture[]> {
    if (!items.length) return [];

    const deterministic = this.extractFixturesDeterministically(items, todayIso);

    if (!this.llmService?.isEnabled()) return deterministic;

    const compactItems = items.slice(0, 40).map((item: any) => ({
      title: item.title,
      description: item.description,
      snippet: item.snippet,
      content: item.content,
      body: item.body,
      text: item.text,
      source: item.source,
      url: item.url,
    }));

    const messages: OddixLlmMessage[] = [
      {
        role: 'system',
        content:
          'Você extrai jogos de futebol de resultados de busca. Responda somente JSON válido. Não invente jogos. Não inclua partidas de outra data.',
      },
      {
        role: 'user',
        content: `Hoje é ${todayIso} (${todayHuman}).
Pergunta: ${question}

Extraia TODOS os jogos de Copa/Mundial/World Cup/Club World Cup que sejam explicitamente para hoje.
Ignore partidas futuras/passadas. Se a data não estiver clara, use confidence baixo e só inclua se o texto disser today/hoje.

Formato JSON obrigatório:
{"fixtures":[{"home":"","away":"","competition":"","kickoff":"","date":"${todayIso}","sourceUrl":"","confidence":0.0}]}

Resultados de busca:
${JSON.stringify(compactItems, null, 2)}`,
      },
    ];

    const extracted = await this.llmService.completeJson<{ fixtures?: any[] }>(messages).catch(() => null);
    const llmFixtures = (extracted?.fixtures || [])
      .map((fixture: any) => ({
        home: this.cleanTeamName(fixture.home),
        away: this.cleanTeamName(fixture.away),
        competition: String(fixture.competition || 'Copa/Mundial').trim(),
        kickoff: fixture.kickoff ? String(fixture.kickoff).trim() : null,
        status: 'programado',
        source: 'llm-extracted' as const,
        url: fixture.sourceUrl || null,
        date: fixture.date || todayIso,
        confidence: Number(fixture.confidence || 0.65),
      }))
      .filter((fixture) => fixture.home && fixture.away)
      .filter((fixture) => this.isDateCompatible(fixture.date, todayIso));

    return this.dedupeFixtures([...deterministic, ...llmFixtures]);
  }

  private researchItemText(item: any): string {
    return [
      item?.title,
      item?.description,
      item?.snippet,
      item?.content,
      item?.body,
      item?.text,
      item?.summary,
      item?.url,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join('\n');
  }

  private extractFixturesDeterministically(items: ResearchItem[], todayIso: string): OddixWorldCupFixture[] {
    const fixtures: OddixWorldCupFixture[] = [];

    for (const item of items) {
      const text = this.researchItemText(item as any);
      const normalized = this.normalize(text);

      if (!this.isCupText(normalized)) continue;

      const lines = text
        .split(/\n+/)
        .map((x) => this.cleanTeamName(x))
        .filter((x) => this.isPossibleTeam(x));

      for (let i = 0; i < lines.length - 1; i++) {
        const home = lines[i];
        const away = lines[i + 1];

        if (this.isPossibleTeam(home) && this.isPossibleTeam(away)) {
          fixtures.push({
            home,
            away,
            competition: this.detectCompetition(text),
            kickoff: this.extractKickoff(text),
            status: 'programado',
            source: 'web-research',
            url: item.url,
            date: todayIso,
            confidence: 0.55,
          });
        }
      }

      const regex = /(.{3,40})\s+(?:vs\.?|v\.?|x|contra)\s+(.{3,40})/gi;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text))) {
        fixtures.push({
          home: this.cleanTeamName(match[1]),
          away: this.cleanTeamName(match[2]),
          competition: this.detectCompetition(text),
          kickoff: this.extractKickoff(text),
          status: 'programado',
          source: 'web-research',
          url: item.url,
          date: todayIso,
          confidence: 0.75,
        });
      }
    }

    return this.dedupeFixtures(fixtures);
  }

  private formatAnswer(
    fixtures: OddixWorldCupFixture[],
    localFixtures: OddixWorldCupFixture[],
    webFixtures: OddixWorldCupFixture[],
    items: ResearchItem[],
    todayIso: string,
    error?: string | null,
  ) {
    const todayPt = this.todayHuman(todayIso);

    if (!fixtures.length) {
      const webStatus = items.length
        ? '\n\n🔎 Pesquisa web acionada, mas os resultados não tinham jogos com data de hoje confirmada.'
        : error
          ? '\n\n🔎 O fallback de pesquisa web não validou a lista completa. Mantive a resposta segura e não vou exibir erro técnico para o usuário final.'
          : '\n\n🔎 As fontes disponíveis não trouxeram partidas confirmadas para hoje.';

      return `🏆 Jogos de Copa/Mundial hoje (${todayPt})\n\nNão encontrei partidas de Copa/Mundial com data de hoje confirmada nas fontes disponíveis.${webStatus}\n\nNão vou listar jogo de outra data. Se você tiver o nome da competição (Copa do Mundo, Mundial de Clubes, Copa nacional etc.), eu refino a busca.`;
    }

    const grouped = fixtures
      .map((fixture, index) => {
        const kickoff = fixture.kickoff ? ` — ${fixture.kickoff}` : '';
        const source = fixture.source === 'local-api' ? 'base Oddix' : 'pesquisa web';
        return `${index + 1}. ${fixture.home} x ${fixture.away} — ${fixture.competition}${kickoff}\n   Fonte: ${source}`;
      })
      .join('\n\n');

    const origin = [
      localFixtures.length ? `${localFixtures.length} pela base Oddix` : null,
      webFixtures.length ? `${webFixtures.length} pela pesquisa web` : null,
    ]
      .filter(Boolean)
      .join(' + ');

    return `🏆 Jogos de Copa/Mundial hoje (${todayPt})\n\nEncontrei ${fixtures.length} partida(s) com data de hoje confirmada${origin ? ` (${origin})` : ''}:\n\n${grouped}\n\n⚠️ Validação: removi partidas de outras datas. Se uma competição específica tiver tabela própria, posso buscar por ela também.`;
  }

  private fixtureToWorldCupFixture(fixture: any): OddixWorldCupFixture {
    const simplified = this.simplifyFixture(fixture);
    return {
      home: simplified.home,
      away: simplified.away,
      competition: simplified.league || 'Copa/Mundial',
      kickoff: simplified.kickoff,
      status: simplified.status || null,
      source: 'local-api',
      url: null,
      date: simplified.date,
      confidence: 0.95,
    };
  }

  private extractFixtureArray(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    const candidates = [
      response?.data,
      response?.fixtures,
      response?.matches,
      response?.items,
      response?.response,
      response?.results,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
      if (Array.isArray(candidate?.data)) return candidate.data;
      if (Array.isArray(candidate?.fixtures)) return candidate.fixtures;
      if (Array.isArray(candidate?.matches)) return candidate.matches;
    }

    return [];
  }

  private simplifyFixture(game: any) {
    const home =
      game?.teams?.home?.name ||
      game?.teams?.casa?.nome ||
      game?.times?.home?.name ||
      game?.times?.casa?.nome ||
      game?.homeTeam ||
      game?.home ||
      'Casa';
    const away =
      game?.teams?.away?.name ||
      game?.teams?.fora?.nome ||
      game?.times?.away?.name ||
      game?.times?.fora?.nome ||
      game?.awayTeam ||
      game?.away ||
      'Fora';
    const league = game?.league?.name || game?.liga?.nome || game?.competition?.name || game?.league || game?.competition || 'Liga não informada';
    const date = game?.fixture?.date || game?.date || game?.kickoff || game?.startTime || null;
    const status = game?.fixture?.status?.short || game?.status?.short || game?.status || null;

    return {
      home: String(home),
      away: String(away),
      league: String(league),
      country: String(game?.league?.country || game?.country || game?.liga?.pais || ''),
      date: date ? this.isoDate(date) : null,
      kickoff: date ? this.formatKickoff(date) : null,
      status: status ? String(status) : null,
    };
  }

  private isCupCompetition(game: any) {
    const simplified = this.simplifyFixture(game);

    const haystack = this.normalize(
      `${simplified.league} ${simplified.country}`,
    );

    return [
      'world cup',
      'fifa world cup',
      'club world cup',
      'fifa club world cup',
      'copa do mundo',
      'mundial',
      'mundial de clubes',
      'club wc',
      'cwc',
      'fifa cwc',
      'club championship',
      'world championship',
      'club world championship',
    ].some((term) =>
      haystack.includes(this.normalize(term)),
    );
  }

  private isCupText(text: string) {
    return [
      'world cup',
      'club world cup',
      'club wc',
      'cwc',
      'fifa cwc',
      'mundial',
      'mundial de clubes',
      'club championship',
    ].some((term) => text.includes(this.normalize(term)));
  }

  private isPossibleTeam(name: string) {
    const bad = [
      'fixtures',
      'schedule',
      'matches',
      'today',
      'hoje',
      'world cup',
      'mundial',
      'fifa',
    ];

    const normalized = this.normalize(name);

    return name.length >= 3 &&
      name.length <= 40 &&
      !bad.some(x => normalized.includes(this.normalize(x)));
  }

  private isTodayFixture(game: any, todayIso: string) {
    const simplified = this.simplifyFixture(game);
    if (!simplified.date) return false;
    return simplified.date === todayIso;
  }

  private isDateCompatible(date: any, todayIso: string) {
    if (!date) {
      return false;
    }

    const normalized = this.isoDate(date);

    if (!normalized) {
      return false;
    }

    return normalized === todayIso;
  }

  private dedupeFixtures(fixtures: OddixWorldCupFixture[]) {
    const seen = new Set<string>();
    return (fixtures || []).filter((fixture) => {
      const key = this.normalize(`${fixture.home} ${fixture.away} ${fixture.competition} ${fixture.date || ''}`);
      if (!fixture.home || !fixture.away || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private uniqueItems(items: ResearchItem[]) {
    const seen = new Set<string>();
    return (items || []).filter((item) => {
      const key = `${item.url || ''}:${item.title || ''}`.toLowerCase();
      if (!item.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private detectCompetition(text: string) {
    const normalized = this.normalize(text);
    if (normalized.includes('club world cup') || normalized.includes('mundial de clubes')) return 'FIFA Club World Cup';
    if (normalized.includes('fifa world cup') || normalized.includes('copa do mundo')) return 'FIFA World Cup';
    if (normalized.includes('world cup')) return 'World Cup';
    return 'Copa/Mundial';
  }

  private extractKickoff(text: string) {
    const match = String(text).match(/\b(\d{1,2}:\d{2})\b/);
    return match?.[1] || null;
  }

  private cleanTeamName(value: any) {
    return String(value || '')
      .replace(/\b(today|hoje|fixtures|matches|schedule|jogos|partidas|futebol|football|world cup|club world cup|fifa|copa do mundo|mundial)\b/gi, ' ')
      .replace(/[^A-Za-zÀ-ÿ0-9 .'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private normalize(value: any) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private todayIso(timeZone = 'America/Sao_Paulo') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
  }

  private todayHuman(todayIso: string) {
    const [year, month, day] = todayIso.split('-');
    return `${day}/${month}/${year}`;
  }

  private monthDayEnglish(todayIso: string) {
    const date = new Date(`${todayIso}T12:00:00Z`);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  private dateNeedles(todayIso: string) {
    const [year, month, day] = todayIso.split('-');
    const noLeadingDay = String(Number(day));
    const noLeadingMonth = String(Number(month));
    const english = this.monthDayEnglish(todayIso);
    return [
      todayIso,
      `${day}/${month}/${year}`,
      `${noLeadingDay}/${noLeadingMonth}/${year}`,
      `${month}/${day}/${year}`,
      `${noLeadingMonth}/${noLeadingDay}/${year}`,
      english,
      `${english}, ${year}`,
    ];
  }

  private isoDate(value: any) {
    if (!value) return null;
    if (typeof value === 'string') {
      const direct = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (direct) return direct[1];
      const br = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
      if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private formatKickoff(value: any) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(11, 16) + ' UTC';
  }
}
