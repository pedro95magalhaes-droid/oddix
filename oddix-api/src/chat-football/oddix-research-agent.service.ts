import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballResearchService, ResearchResult, ResearchItem } from './football-research.service';
import { OddixQueryCleanerService, OddixCleanedQuery } from './oddix-query-cleaner.service';

export type OddixResearchAgentResult = ResearchResult & {
  provider?: string;
  queries?: string[];
  partialFailures?: string[];
  agent?: string;
  cacheHit?: boolean;
};

@Injectable()
export class OddixResearchAgentService {
  private readonly logger = new Logger(OddixResearchAgentService.name);
  private readonly cache = new Map<string, { expiresAt: number; data: OddixResearchAgentResult }>();
  private readonly ttlMs = Number(process.env.ODDIX_RESEARCH_AGENT_CACHE_MS || 1000 * 60 * 12);
  private readonly maxQueries = Number(process.env.ODDIX_RESEARCH_AGENT_MAX_QUERIES || 8);
  private readonly maxItems = Number(process.env.ODDIX_RESEARCH_AGENT_MAX_ITEMS || 100);

  constructor(
    @Optional() private readonly researchService?: FootballResearchService,
    @Optional() private readonly queryCleaner?: OddixQueryCleanerService,
  ) {}

  async research(message: string, forcedQuery?: string): Promise<OddixResearchAgentResult | null> {
    if (!this.researchService) return null;

    const plan = this.queryCleaner?.analyze(forcedQuery || message) || null;
    const queries = this.buildQueries(message, forcedQuery, plan);
    const cacheKey = queries.join('|').toLowerCase();
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.data,
        summary: `${cached.data.summary}\n\nFonte: cache de pesquisa Oddix V19.`,
        cacheHit: true,
      } as OddixResearchAgentResult;
    }

    const allItems: ResearchItem[] = [];
    const partialFailures: string[] = [];
    let enabled = true;
    let provider = 'research-agent';
    let lastQuery = queries[0] || message;

    for (const query of queries.slice(0, this.maxQueries)) {
      lastQuery = query;
      try {
        const result = await (this.researchService.searchEverything
          ? this.researchService.searchEverything(query, 'br')
          : this.researchService.search(query, 'br'));

        enabled = result.enabled;
        provider = (result as any)?.provider || provider;

        if ((result as any)?.error) partialFailures.push(`${query}: ${(result as any).error}`);
        if (Array.isArray(result.items)) allItems.push(...result.items);

        if (this.uniqueItems(allItems).length >= this.maxItems) break;
      } catch (error: any) {
        partialFailures.push(`${query}: ${error?.message || error}`);
        this.logger.warn(`[ODDIX_RESEARCH_AGENT_V19] falhou query="${query}": ${error?.message || error}`);
      }
    }

    const items = this.uniqueItems(allItems)
      .sort((a, b) => this.itemScore(b, plan) - this.itemScore(a, plan))
      .slice(0, this.maxItems);

    const data: OddixResearchAgentResult = {
      enabled,
      query: lastQuery,
      queries,
      items,
      provider,
      partialFailures,
      agent: 'oddix-research-agent-v19-football-intelligence',
      summary: items.length
        ? this.buildSummary(items)
        : partialFailures.length
          ? `Pesquisa web acionada, mas não trouxe resultado útil. Falhas: ${partialFailures.slice(0, 5).join(' | ')}`
          : 'Pesquisa web acionada, mas não encontrei resultados relevantes.',
    };

    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });

    return data;
  }

  private buildQueries(message: string, forcedQuery?: string, plan?: OddixCleanedQuery | null): string[] {
    const todayIso = this.todayIso();
    const fallbackCupQueries = this.isCupQuestion(message) || plan?.intentHint === 'TODAY_CUP_GAMES'
      ? [
          `FIFA Club World Cup fixtures ${todayIso}`,
          `FIFA Club World Cup matches today ${todayIso}`,
          `Club World Cup games today ${todayIso}`,
          `FlashScore Club World Cup fixtures ${todayIso}`,
          `SofaScore Club World Cup fixtures ${todayIso}`,
          `ESPN Club World Cup fixtures ${todayIso}`,
        ]
      : [];

    const queries = [
      ...(plan?.researchQueries || []),
      ...fallbackCupQueries,
      forcedQuery || '',
      message || '',
    ]
      .map((query) => String(query || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    return Array.from(new Set(queries)).slice(0, Math.max(this.maxQueries, 5));
  }

  private uniqueItems(items: ResearchItem[]): ResearchItem[] {
    const seen = new Set<string>();
    return (items || []).filter((item: any) => {
      const text = this.itemText(item);
      const key = `${item.url || ''}:${item.title || ''}:${text.slice(0, 180)}`.toLowerCase();
      if (!text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private itemScore(item: ResearchItem, plan?: OddixCleanedQuery | null) {
    const text = this.normalize(this.itemText(item));
    const url = this.normalize((item as any)?.url || '');
    let score = 0;

    if (plan?.intentHint === 'TODAY_CUP_GAMES') {
      if (this.hasAny(text, ['club world cup', 'fifa club world cup', 'world cup', 'mundial', 'copa do mundo'])) score += 35;
      if (this.hasAny(text, ['today', 'hoje', this.todayIso()])) score += 25;
      if (this.hasAny(url, ['flashscore', 'sofascore', 'espn', 'fifa', 'fotmob', '365scores', 'livescore'])) score += 20;
      if (/(?:vs\.?|versus|\sx\s|contra)/i.test(this.itemText(item))) score += 20;
    }

    if (this.hasAny(text, ['fixture', 'fixtures', 'match', 'matches', 'schedule', 'jogos', 'partidas'])) score += 10;
    if ((item as any)?.content || (item as any)?.body || (item as any)?.text || (item as any)?.snippet) score += 8;

    return score;
  }

  private buildSummary(items: ResearchItem[]) {
    return items
      .slice(0, 20)
      .map((item: any) => {
        const source = item.source ? ` — ${item.source}` : '';
        const description = this.itemText({
          description: item.description,
          snippet: item.snippet,
          content: item.content,
          body: item.body,
          text: item.text,
        } as any)
          .replace(/\s+/g, ' ')
          .slice(0, 420);
        return `• ${item.title || 'Sem título'}${source}${description ? `\n  ${description}` : ''}${item.url ? `\n  URL: ${item.url}` : ''}`;
      })
      .join('\n');
  }

  private itemText(item: any) {
    return [
      item?.title,
      item?.description,
      item?.snippet,
      item?.content,
      item?.body,
      item?.text,
      item?.summary,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join('\n');
  }

  private isCupQuestion(message: string) {
    const text = this.normalize(message);
    return this.hasAny(text, ['copa', 'mundial', 'world cup', 'club world cup', 'fifa club world cup', 'cwc']);
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

  private todayIso(timeZone = process.env.ODDIX_TIMEZONE || 'America/Sao_Paulo') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) return new Date().toISOString().slice(0, 10);
    return `${year}-${month}-${day}`;
  }
}
