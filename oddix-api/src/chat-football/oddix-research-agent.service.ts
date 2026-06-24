import { Injectable, Logger, Optional } from '@nestjs/common';
import { FootballResearchService, ResearchResult, ResearchItem } from './football-research.service';
import { OddixQueryCleanerService, OddixCleanedQuery } from './oddix-query-cleaner.service';

export type OddixResearchAgentResult = ResearchResult & {
  provider?: string;
  queries?: string[];
  partialFailures?: string[];
  agent?: string;
};

@Injectable()
export class OddixResearchAgentService {
  private readonly logger = new Logger(OddixResearchAgentService.name);
  private readonly cache = new Map<string, { expiresAt: number; data: OddixResearchAgentResult }>();
  private readonly ttlMs = Number(process.env.ODDIX_RESEARCH_AGENT_CACHE_MS || 1000 * 60 * 30);

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
        summary: `${cached.data.summary}\n\nFonte: cache de pesquisa Oddix.`,
        cacheHit: true,
      } as any;
    }

    const allItems: ResearchItem[] = [];
    const partialFailures: string[] = [];
    let enabled = true;
    let provider = 'research-agent';
    let lastQuery = queries[0] || message;

    for (const query of queries.slice(0, 4)) {
      lastQuery = query;
      try {
        const result = await this.researchService.searchEverything
          ? await this.researchService.searchEverything(query, 'br')
          : await this.researchService.search(query, 'br');

        enabled = result.enabled;
        provider = (result as any)?.provider || provider;

        if ((result as any)?.error) partialFailures.push(`${query}: ${(result as any).error}`);
        if (Array.isArray(result.items)) allItems.push(...result.items);

        // Se já temos bons resultados, economiza cota.
        if (allItems.length >= 8) break;
      } catch (error: any) {
        partialFailures.push(`${query}: ${error?.message || error}`);
        this.logger.warn(`[ODDIX_RESEARCH_AGENT] falhou query="${query}": ${error?.message || error}`);
      }
    }

    const items = this.uniqueItems(allItems).slice(0, 12);
    const data: OddixResearchAgentResult = {
      enabled,
      query: lastQuery,
      queries,
      items,
      provider,
      partialFailures,
      agent: 'oddix-research-agent-v16-core',
      summary: items.length
        ? this.buildSummary(items)
        : partialFailures.length
          ? `Pesquisa web acionada, mas não trouxe resultado útil. Falhas: ${partialFailures.slice(0, 3).join(' | ')}`
          : 'Pesquisa web acionada, mas não encontrei resultados relevantes.',
    };

    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });

    return data;
  }

  private buildQueries(message: string, forcedQuery?: string, plan?: OddixCleanedQuery | null): string[] {
    const queries = [
      ...(plan?.researchQueries || []),
      forcedQuery || '',
      message || '',
    ]
      .map((query) => String(query || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    return Array.from(new Set(queries)).slice(0, 5);
  }

  private uniqueItems(items: ResearchItem[]): ResearchItem[] {
    const seen = new Set<string>();
    return (items || []).filter((item) => {
      const key = `${item.url || ''}:${item.title || ''}`.toLowerCase();
      if (!item.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildSummary(items: ResearchItem[]) {
    return items
      .slice(0, 8)
      .map((item) => {
        const source = item.source ? ` — ${item.source}` : '';
        const description = item.description ? `\n  ${item.description}` : '';
        return `• ${item.title}${source}${description}`;
      })
      .join('\n');
  }
}
