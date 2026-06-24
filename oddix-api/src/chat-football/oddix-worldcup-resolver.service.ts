import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballService } from '../football/football.service';
import { FootballResearchService, ResearchItem, ResearchResult } from './football-research.service';
import { OddixResearchAgentService } from './oddix-research-agent.service';
import { OddixLlmMessage, OddixLlmService } from './oddix-llm.service';

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
  provider?: string | null;
  sourceTitle?: string | null;
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

type FixtureArrayResponse = {
  data?: any[];
  fixtures?: any[];
  games?: any[];
  matches?: any[];
  items?: any[];
  response?: any[];
  results?: any[];
};

@Injectable()
export class OddixWorldCupResolverService {
  private readonly logger = new Logger(OddixWorldCupResolverService.name);
  private readonly timeZone = process.env.ODDIX_TIMEZONE || 'America/Sao_Paulo';

  constructor(
    @Optional() private readonly footballService?: FootballService,
    @Optional() private readonly researchService?: FootballResearchService,
    @Optional() private readonly researchAgent?: OddixResearchAgentService,
    @Optional() private readonly llmService?: OddixLlmService,
  ) {}

  async resolveToday(question: string): Promise<OddixWorldCupResolution> {
    const todayIso = this.todayIso();
    const todayHuman = this.todayHuman(todayIso);
    const localFixtures = await this.getLocalCupFixtures(todayIso);
    const { items: rawItems, queries, provider, error } = await this.runWorldCupResearch(question, todayIso, todayHuman);
    const items = await this.enrichResearchItemsWithPageText(rawItems);
    const webFixtures = await this.extractFixturesFromResearch(question, items, todayIso, todayHuman);

    const fixtures = this.dedupeFixtures([...localFixtures, ...webFixtures])
      .filter((fixture) => this.isDateCompatible(fixture.date, todayIso))
      .sort((a, b) => this.fixtureSortScore(b) - this.fixtureSortScore(a));

    this.logger.log(
      `[V19_WORLDCUP] today=${todayIso} local=${localFixtures.length} web=${webFixtures.length} total=${fixtures.length} items=${items.length}`,
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
    if (!this.footballService) return [];

    const service: any = this.footballService as any;
    const calls: Array<{ name: string; call: () => Promise<any> | any }> = [
      { name: 'getFixtures', call: () => service.getFixtures?.(todayIso) },
      { name: 'getTodayFixtures', call: () => service.getTodayFixtures?.() },
      { name: 'getTodayMatches', call: () => service.getTodayMatches?.() },
      { name: 'getMatchesByDate', call: () => service.getMatchesByDate?.(todayIso) },
      { name: 'getFlashScoreToday', call: () => service.getFlashScoreToday?.() },
      { name: 'getFlashScoreFixtures', call: () => service.getFlashScoreFixtures?.(todayIso) },
      { name: 'getFlashScoreMatches', call: () => service.getFlashScoreMatches?.(todayIso) },
      { name: 'getAllTodayFixtures', call: () => service.getAllTodayFixtures?.() },
      { name: 'getFixturesFromCache', call: () => service.getFixturesFromCache?.() },
      { name: 'getCachedFixtures', call: () => service.getCachedFixtures?.() },
    ];

    const fixtures: any[] = [];

    for (const entry of calls) {
      try {
        const result = await entry.call();
        const list = this.extractFixtureArray(result);
        if (list.length) {
          this.logger.log(`[V19_WORLDCUP] local.${entry.name}=${list.length}`);
          fixtures.push(...list);
        }
      } catch (error: any) {
        this.logger.warn(`[V19_WORLDCUP] local.${entry.name} falhou: ${error?.message || error}`);
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
    const providers = new Set<string>();
    let provider = 'none';

    if (this.researchAgent) {
      try {
        const agentResult = await this.researchAgent.research(question, queries[0]);
        if (agentResult) {
          provider = agentResult.provider || provider;
          providers.add(provider);
          if ((agentResult as any)?.error) errors.push(`agent: ${(agentResult as any).error}`);
          if (Array.isArray(agentResult.partialFailures)) errors.push(...agentResult.partialFailures.slice(0, 3));
          if (Array.isArray(agentResult.items)) items.push(...agentResult.items);
        }
      } catch (error: any) {
        errors.push(`agent: ${error?.message || error}`);
      }
    }

    for (const query of queries) {
      if (!this.researchService && this.researchAgent) {
        try {
          const agentResult = await this.researchAgent.research(question, query);
          if (agentResult?.items?.length) items.push(...agentResult.items);
          if (agentResult?.provider) providers.add(agentResult.provider);
        } catch (error: any) {
          errors.push(`${query}: ${error?.message || error}`);
        }
        if (this.uniqueItems(items).length >= 100) break;
        continue;
      }

      if (!this.researchService) continue;

      try {
        const result: ResearchResult | null = this.researchService.searchEverything
          ? await this.researchService.searchEverything(query, 'br')
          : await this.researchService.search(query, 'br');

        if (!result) continue;
        provider = (result as any)?.provider || provider;
        providers.add(provider);
        if ((result as any)?.error) errors.push(`${query}: ${(result as any).error}`);
        if (Array.isArray(result.items)) items.push(...result.items);
        if (this.uniqueItems(items).length >= 100) break;
      } catch (error: any) {
        errors.push(`${query}: ${error?.message || error}`);
      }
    }

    const unique = this.uniqueItems(items)
      .sort((a, b) => this.researchItemScore(b, todayIso) - this.researchItemScore(a, todayIso))
      .slice(0, 100);

    return {
      items: unique,
      queries,
      provider: Array.from(providers).filter(Boolean).join(' + ') || provider,
      error: errors.length ? errors.slice(0, 5).join(' | ') : null,
    };
  }

  private buildWorldCupQueries(question: string, todayIso: string, todayHuman: string) {
    const [year] = todayIso.split('-');
    const englishDate = this.monthDayEnglish(todayIso);
    const original = String(question || '').replace(/\s+/g, ' ').trim();

    return Array.from(
      new Set([
        `FIFA Club World Cup fixtures ${todayIso}`,
        `FIFA Club World Cup matches today ${todayIso}`,
        `FIFA Club World Cup ${englishDate} ${year} schedule`,
        `Club World Cup games today ${todayIso}`,
        `Club World Cup live matches today`,
        `today Club World Cup games`,
        `FIFA World Cup fixtures today ${todayIso}`,
        `World Cup football fixtures ${todayIso}`,
        `FlashScore Club World Cup fixtures ${todayIso}`,
        `SofaScore Club World Cup fixtures ${todayIso}`,
        `ESPN Club World Cup fixtures ${todayIso}`,
        `FIFA Club World Cup schedule ${year}`,
        `jogos Mundial de Clubes hoje ${todayHuman}`,
        `jogos da Copa do Mundo hoje ${todayHuman}`,
        original,
      ].filter(Boolean)),
    ).slice(0, 15);
  }

  private async enrichResearchItemsWithPageText(items: ResearchItem[]): Promise<ResearchItem[]> {
    if (!items.length || !this.researchService) return items;

    const service: any = this.researchService as any;
    const reader = service.openUrl || service.fetchUrl || service.readUrl || service.extractPageText || null;
    if (typeof reader !== 'function') return items;

    const enriched: ResearchItem[] = [...items];
    const candidates = this.uniqueItems(items)
      .filter((item) => item.url && this.isUsefulFixtureSource(item.url))
      .slice(0, Number(process.env.ODDIX_WORLDCUP_OPEN_URL_LIMIT || 8));

    for (const item of candidates) {
      try {
        const page = await reader.call(service, item.url);
        const text = this.extractPageText(page);
        if (!text) continue;

        enriched.push({
          ...item,
          title: item.title || `Página ${item.url}`,
          description: [item.description, text.slice(0, 12000)].filter(Boolean).join('\n'),
        } as ResearchItem);
      } catch (error: any) {
        this.logger.warn(`[V19_WORLDCUP] não consegui abrir URL ${item.url}: ${error?.message || error}`);
      }
    }

    return this.uniqueItems(enriched);
  }

  private extractPageText(page: any): string | null {
    if (!page) return null;
    if (typeof page === 'string') return page.trim() || null;

    const text = [
      page?.title,
      page?.description,
      page?.snippet,
      page?.content,
      page?.body,
      page?.text,
      page?.markdown,
      page?.htmlText,
      page?.data?.content,
      page?.data?.text,
      page?.data?.body,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join('\n');

    return text || null;
  }

  private async extractFixturesFromResearch(
    question: string,
    items: ResearchItem[],
    todayIso: string,
    todayHuman: string,
  ): Promise<OddixWorldCupFixture[]> {
    if (!items.length) return [];

    const deterministic = this.extractFixturesDeterministically(items, todayIso);

    if (!this.llmService?.isEnabled()) {
      return deterministic;
    }

    const compactItems = items.slice(0, 30).map((item) => ({
      title: item.title,
      description: item.description,
      snippet: (item as any).snippet,
      content: String((item as any).content || (item as any).body || (item as any).text || '').slice(0, 2500),
      source: item.source,
      url: item.url,
    }));

    const messages: OddixLlmMessage[] = [
      {
        role: 'system',
        content:
          'Você é um extrator profissional de fixtures de futebol. Responda somente JSON válido. Não invente jogos, horários ou datas. Extraia todos os jogos explícitos de Copa/Mundial/World Cup/Club World Cup do dia informado.',
      },
      {
        role: 'user',
        content: `Hoje no fuso do Brasil é ${todayIso} (${todayHuman}).
Pergunta original: ${question}

Tarefa:
1. Extraia TODOS os jogos de Copa/Mundial/FIFA World Cup/FIFA Club World Cup/Mundial de Clubes que estejam explicitamente no texto.
2. Inclua somente partidas da data ${todayIso}. Se o texto disser "today" ou "hoje", trate como ${todayIso}.
3. Não invente times a partir de título genérico como "fixtures today".
4. Se não houver time mandante e visitante claros, não inclua.
5. Não retorne partidas futuras/passadas.

Formato JSON obrigatório:
{"fixtures":[{"home":"","away":"","competition":"","kickoff":"","date":"${todayIso}","sourceUrl":"","confidence":0.0}]}

Resultados/fontes:
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
        confidence: this.clampConfidence(Number(fixture.confidence || 0.72)),
      }))
      .filter((fixture) => this.isValidTeamPair(fixture.home, fixture.away))
      .filter((fixture) => this.isDateCompatible(fixture.date, todayIso));

    return this.dedupeFixtures([...deterministic, ...llmFixtures]);
  }

  private extractFixturesDeterministically(items: ResearchItem[], todayIso: string): OddixWorldCupFixture[] {
    const fixtures: OddixWorldCupFixture[] = [];

    for (const item of items) {
      const text = this.researchItemText(item);
      const normalized = this.normalize(text);

      if (!text || !this.isCupText(normalized)) continue;

      const textDate = this.extractDateFromText(text, todayIso);
      const date = textDate || (this.mentionsToday(text) ? todayIso : null);

      if (date && !this.isDateCompatible(date, todayIso)) continue;
      if (!date && !this.dateNeedles(todayIso).some((needle) => normalized.includes(this.normalize(needle)))) {
        // Sem data clara, só aceitamos se o próprio texto indicar hoje/today/agora.
        if (!this.mentionsToday(text)) continue;
      }

      const compactText = this.compactFixtureText(text);
      const extracted = this.extractMatchesFromText(compactText);

      for (const fixture of extracted) {
        fixtures.push({
          home: fixture.home,
          away: fixture.away,
          competition: this.detectCompetition(text),
          kickoff: fixture.kickoff || this.extractKickoff(text),
          status: 'programado',
          source: 'web-research',
          url: item.url,
          date: date || todayIso,
          confidence: fixture.confidence,
          provider: item.source || null,
          sourceTitle: item.title || null,
        });
      }
    }

    return this.dedupeFixtures(fixtures)
      .filter((fixture) => this.isValidTeamPair(fixture.home, fixture.away))
      .filter((fixture) => this.isDateCompatible(fixture.date, todayIso));
  }

  private extractMatchesFromText(text: string): Array<{ home: string; away: string; kickoff?: string | null; confidence: number }> {
    const fixtures: Array<{ home: string; away: string; kickoff?: string | null; confidence: number }> = [];
    const team = `[A-ZÀ-Ý0-9][A-Za-zÀ-ÿ0-9 .'’&()/-]{1,64}?`;
    const boundary = `(?=\\s*(?:$|[-–—,;|•]|\\d{1,2}:\\d{2}|\\b(?:today|hoje|preview|odds|tickets|lineups|score|result|fixture|match)\\b))`;

    const patterns = [
      new RegExp(`\\b(${team})\\s+(?:vs\\.?|versus|contra)\\s+(${team})${boundary}`, 'gi'),
      new RegExp(`\\b(${team})\\s+x\\s+(${team})${boundary}`, 'gi'),
      new RegExp(`\\b(${team})\\s+v\\.?\\s+(${team})${boundary}`, 'gi'),
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const before = text.slice(Math.max(0, match.index - 30), match.index);
        const after = text.slice(match.index, Math.min(text.length, match.index + match[0].length + 40));
        const home = this.cleanTeamName(match[1]);
        const away = this.cleanTeamName(match[2]);
        const kickoff = this.extractKickoff(`${before} ${match[0]} ${after}`);

        if (this.isValidTeamPair(home, away)) {
          fixtures.push({ home, away, kickoff, confidence: 0.78 });
        }
      }
    }

    // Alguns providers retornam lista vertical: Time A\nTime B\nTime C\nTime D.
    // Só pareamos linhas próximas quando o bloco contém sinais fortes de fixture.
    const lines = text
      .split(/\n+/)
      .map((line) => this.cleanTeamName(line))
      .filter((line) => this.isPossibleTeam(line));

    if (this.hasFixtureVocabulary(text) && lines.length >= 2) {
      for (let index = 0; index < lines.length - 1; index += 2) {
        const home = lines[index];
        const away = lines[index + 1];
        if (this.isValidTeamPair(home, away)) {
          fixtures.push({ home, away, kickoff: this.extractKickoff(text), confidence: 0.58 });
        }
      }
    }

    return fixtures;
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

  private compactFixtureText(value: string): string {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\t\r]+/g, '\n')
      .replace(/[|•]/g, '\n')
      .replace(/\s+vs\s+/gi, ' vs ')
      .replace(/\s+x\s+/gi, ' x ')
      .replace(/\s+/g, ' ')
      .replace(/\s*([,;])\s*/g, '$1 ')
      .trim();
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
      const webStatus = error
        ? `\n\n🔎 Pesquisa web acionada, mas não consegui validar a lista completa. Motivo: ${error}`
        : items.length
          ? '\n\n🔎 Pesquisa web acionada, mas os resultados ainda não trouxeram confrontos claros com data de hoje.'
          : '\n\n🔎 Pesquisa web acionada, mas não trouxe resultados úteis.';

      return `🏆 Jogos de Copa/Mundial hoje (${todayPt})\n\nNão encontrei partidas de Copa/Mundial com data de hoje confirmada nas fontes disponíveis.${webStatus}\n\nNão vou inventar jogos. Para máxima precisão, conecte uma fonte de fixtures reais como FlashScore, Broadage ou API-Football como provider principal.`;
    }

    const grouped = fixtures
      .map((fixture, index) => {
        const kickoff = fixture.kickoff ? ` — ${fixture.kickoff}` : '';
        const confidence = fixture.confidence ? ` | confiança ${Math.round(fixture.confidence * 100)}%` : '';
        const source = fixture.source === 'local-api' ? 'base Oddix' : fixture.provider || 'pesquisa web';
        return `${index + 1}. ${fixture.home} x ${fixture.away} — ${fixture.competition}${kickoff}\n   Fonte: ${source}${confidence}`;
      })
      .join('\n\n');

    const origin = [
      localFixtures.length ? `${localFixtures.length} pela base Oddix` : null,
      webFixtures.length ? `${webFixtures.length} pela pesquisa/web/LLM` : null,
    ]
      .filter(Boolean)
      .join(' + ');

    return `🏆 Jogos de Copa/Mundial hoje (${todayPt})\n\nEncontrei ${fixtures.length} partida(s) com data de hoje confirmada${origin ? ` (${origin})` : ''}:\n\n${grouped}\n\n✅ Validação V19: usei fuso do Brasil, removi datas incompatíveis, dedupliquei confrontos e evitei listar partidas sem mandante/visitante claros.`;
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
      confidence: 0.96,
      provider: simplified.provider || 'football-service',
    };
  }

  private extractFixtureArray(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    const source = response as FixtureArrayResponse;
    const candidates = [
      source.data,
      source.fixtures,
      source.games,
      source.matches,
      source.items,
      source.response,
      source.results,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
      if (Array.isArray((candidate as any)?.data)) return (candidate as any).data;
      if (Array.isArray((candidate as any)?.fixtures)) return (candidate as any).fixtures;
      if (Array.isArray((candidate as any)?.matches)) return (candidate as any).matches;
      if (Array.isArray((candidate as any)?.games)) return (candidate as any).games;
    }

    return [];
  }

  private simplifyFixture(game: any) {
    const home =
      game?.teams?.home?.name ||
      game?.teams?.casa?.nome ||
      game?.times?.home?.name ||
      game?.times?.casa?.nome ||
      game?.homeTeam?.name ||
      game?.homeTeam ||
      game?.home?.name ||
      game?.home ||
      game?.casa ||
      '';

    const away =
      game?.teams?.away?.name ||
      game?.teams?.fora?.nome ||
      game?.times?.away?.name ||
      game?.times?.fora?.nome ||
      game?.awayTeam?.name ||
      game?.awayTeam ||
      game?.away?.name ||
      game?.away ||
      game?.fora ||
      '';

    const league =
      game?.league?.name ||
      game?.liga?.nome ||
      game?.competition?.name ||
      game?.tournament?.name ||
      game?.championship?.name ||
      game?.league ||
      game?.competition ||
      game?.tournament ||
      'Liga não informada';

    const country =
      game?.league?.country ||
      game?.country ||
      game?.liga?.pais ||
      game?.competition?.country ||
      '';

    const date =
      game?.fixture?.date ||
      game?.date ||
      game?.kickoff ||
      game?.kickoffTime ||
      game?.startTime ||
      game?.start_time ||
      game?.time ||
      null;

    const status = game?.fixture?.status?.short || game?.status?.short || game?.fixture?.status?.long || game?.status || null;

    return {
      id: game?.fixture?.id || game?.id || game?.matchId || game?.match_id || null,
      home: String(home || '').trim(),
      away: String(away || '').trim(),
      league: String(league || '').trim(),
      country: String(country || '').trim(),
      date: date ? this.isoDate(date) : null,
      kickoff: date ? this.formatKickoff(date) : null,
      status: status ? String(status) : null,
      provider: game?.provider || game?.source || null,
    };
  }

  private isCupCompetition(game: any) {
    const simplified = this.simplifyFixture(game);
    const haystack = this.normalize(`${simplified.league} ${simplified.country}`);

    return [
      'world cup',
      'fifa world cup',
      'club world cup',
      'fifa club world cup',
      'copa do mundo',
      'copa mundial',
      'mundial',
      'mundial de clubes',
      'copa do mundo de clubes',
      'club wc',
      'cwc',
      'fifa cwc',
      'club championship',
      'world championship',
      'club world championship',
    ].some((term) => haystack.includes(this.normalize(term)));
  }

  private isCupText(text: string) {
    return [
      'world cup',
      'club world cup',
      'fifa world cup',
      'fifa club world cup',
      'club wc',
      'cwc',
      'fifa cwc',
      'mundial',
      'mundial de clubes',
      'copa do mundo',
      'copa do mundo de clubes',
      'club championship',
      'fifa',
    ].some((term) => text.includes(this.normalize(term)));
  }

  private isPossibleTeam(name: string) {
    const bad = [
      'fixtures',
      'fixture',
      'schedule',
      'matches',
      'match',
      'today',
      'hoje',
      'tomorrow',
      'world cup',
      'mundial',
      'copa do mundo',
      'fifa',
      'flashscore',
      'sofascore',
      'espn',
      'calendar',
      'standings',
      'results',
      'news',
    ];

    const normalized = this.normalize(name);

    return (
      name.length >= 2 &&
      name.length <= 64 &&
      !/^\d+$/.test(name) &&
      !bad.some((term) => normalized === this.normalize(term) || normalized.includes(this.normalize(term)))
    );
  }

  private isValidTeamPair(home: string, away: string): boolean {
    if (!this.isPossibleTeam(home) || !this.isPossibleTeam(away)) return false;
    if (this.normalize(home) === this.normalize(away)) return false;

    const combined = this.normalize(`${home} ${away}`);
    if (combined.includes('privacy policy') || combined.includes('terms of use')) return false;
    if (combined.includes('fixtures today') || combined.includes('matches today')) return false;

    return true;
  }

  private isTodayFixture(game: any, todayIso: string) {
    const simplified = this.simplifyFixture(game);
    if (!simplified.date) return false;
    return simplified.date === todayIso;
  }

  private isDateCompatible(date: any, todayIso: string) {
    if (!date) return false;
    const normalized = this.isoDate(date);
    return normalized === todayIso;
  }

  private fixtureSortScore(fixture: OddixWorldCupFixture) {
    let score = 0;
    if (fixture.source === 'local-api') score += 100;
    if (fixture.source === 'llm-extracted') score += 40;
    if (fixture.source === 'web-research') score += 30;
    score += Math.round((fixture.confidence || 0) * 100);
    if (fixture.kickoff) score += 5;
    return score;
  }

  private dedupeFixtures(fixtures: OddixWorldCupFixture[]) {
    const seen = new Set<string>();
    return (fixtures || [])
      .map((fixture) => ({
        ...fixture,
        home: this.cleanTeamName(fixture.home),
        away: this.cleanTeamName(fixture.away),
        competition: String(fixture.competition || 'Copa/Mundial').trim(),
      }))
      .filter((fixture) => {
        if (!this.isValidTeamPair(fixture.home, fixture.away)) return false;
        const normalizedHome = this.normalizeTeamForKey(fixture.home);
        const normalizedAway = this.normalizeTeamForKey(fixture.away);
        const ordered = [normalizedHome, normalizedAway].sort().join('__');
        const key = `${ordered}__${this.normalize(fixture.competition)}__${fixture.date || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private uniqueItems(items: ResearchItem[]) {
    const seen = new Set<string>();
    return (items || []).filter((item: any) => {
      const text = this.researchItemText(item);
      const key = `${item.url || ''}:${item.title || ''}:${text.slice(0, 120)}`.toLowerCase();
      if (!text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private researchItemScore(item: ResearchItem, todayIso: string) {
    const text = this.researchItemText(item);
    const normalized = this.normalize(text);
    let score = 0;

    if (this.isCupText(normalized)) score += 30;
    if (this.mentionsToday(text)) score += 20;
    if (this.dateNeedles(todayIso).some((needle) => normalized.includes(this.normalize(needle)))) score += 20;
    if (this.isUsefulFixtureSource(item.url || item.source || '')) score += 20;
    if (this.hasFixtureVocabulary(text)) score += 10;
    if (/(?:vs\.?|versus|\sx\s|contra)/i.test(text)) score += 15;

    return score;
  }

  private isUsefulFixtureSource(value: string) {
    const normalized = this.normalize(value);
    return ['fifa', 'flashscore', 'sofascore', 'espn', 'fotmob', '365scores', 'onefootball', 'livescore'].some((source) => normalized.includes(source));
  }

  private detectCompetition(text: string) {
    const normalized = this.normalize(text);
    if (normalized.includes('fifa club world cup') || normalized.includes('club world cup') || normalized.includes('mundial de clubes') || normalized.includes('copa do mundo de clubes')) return 'FIFA Club World Cup';
    if (normalized.includes('fifa world cup') || normalized.includes('copa do mundo')) return 'FIFA World Cup';
    if (normalized.includes('world cup')) return 'World Cup';
    if (normalized.includes('mundial')) return 'Mundial';
    return 'Copa/Mundial';
  }

  private extractKickoff(text: string) {
    const match = String(text).match(/\b(\d{1,2}:\d{2})\b/);
    return match?.[1] || null;
  }

  private extractDateFromText(text: string, todayIso: string): string | null {
    const directIso = String(text).match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (directIso) return directIso[1];

    const br = String(text).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;

    const us = String(text).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (us) {
      const candidate = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
      if (candidate === todayIso) return candidate;
    }

    const normalized = this.normalize(text);
    if (this.dateNeedles(todayIso).some((needle) => normalized.includes(this.normalize(needle)))) {
      return todayIso;
    }

    return null;
  }

  private mentionsToday(text: string) {
    const normalized = this.normalize(text);
    return ['hoje', 'today', 'agora', 'tonight', 'esta noite'].some((term) => normalized.includes(this.normalize(term)));
  }

  private hasFixtureVocabulary(text: string) {
    const normalized = this.normalize(text);
    return ['fixture', 'fixtures', 'match', 'matches', 'jogo', 'jogos', 'partida', 'partidas', 'schedule', 'calendario', 'calendário'].some((term) => normalized.includes(this.normalize(term)));
  }

  private cleanTeamName(value: any) {
    const cleaned = String(value || '')
      .replace(/\b(today|hoje|tomorrow|amanha|amanhã|fixtures?|matches?|schedule|jogos?|partidas?|futebol|football|world cup|club world cup|fifa|copa do mundo|mundial|preview|odds|tickets|lineups?|score|result|resultado|placar)\b/gi, ' ')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
      .replace(/[^A-Za-zÀ-ÿ0-9 .’'&()/-]/g, ' ')
      .replace(/^[-–—:,./\s]+|[-–—:,./\s]+$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return this.titleCasePreservingAcronyms(cleaned);
  }

  private titleCasePreservingAcronyms(value: string) {
    return String(value || '')
      .split(' ')
      .filter(Boolean)
      .map((part) => {
        if (/^[A-Z0-9]{2,5}$/.test(part)) return part;
        if (/^(FC|CF|SC|AC|RB|PSG|USA|UAE)$/i.test(part)) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }

  private normalizeTeamForKey(value: string) {
    return this.normalize(value)
      .replace(/\b(fc|cf|sc|ac|club|de|do|da|the)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

  private todayIso(timeZone = this.timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      return new Date().toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  }

  private todayHuman(todayIso: string) {
    const [year, month, day] = todayIso.split('-');
    return `${day}/${month}/${year}`;
  }

  private monthDayEnglish(todayIso: string) {
    const date = new Date(`${todayIso}T12:00:00Z`);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
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

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private formatKickoff(value: any) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private clampConfidence(value: number) {
    if (!Number.isFinite(value)) return 0.65;
    return Math.max(0.05, Math.min(0.99, value));
  }
}
