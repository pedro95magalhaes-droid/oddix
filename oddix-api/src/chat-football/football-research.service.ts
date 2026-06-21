import { Injectable, Logger } from '@nestjs/common';

export type ResearchItem = {
  position: number;
  title: string;
  url: string;
  description: string;
  source?: string;
};

export type ResearchResult = {
  enabled: boolean;
  query: string;
  items: ResearchItem[];
  summary: string;
};

@Injectable()
export class FootballResearchService {
  private readonly logger = new Logger(FootballResearchService.name);

  private get enabled() {
    return String(process.env.ODDIX_RESEARCH_ENABLED || '').toLowerCase() === 'true';
  }

  private get apiKey() {
    return process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '';
  }

  private get host() {
    return process.env.RAPIDAPI_GOOGLE_SERP_HOST || 'google-serp10.p.rapidapi.com';
  }

  private get endpoint() {
    return process.env.RAPIDAPI_GOOGLE_SERP_ENDPOINT || `https://${this.host}/search`;
  }

  async researchTeam(teamName: string): Promise<ResearchResult> {
    const query = `${teamName} futebol notícias próximos jogos resultados convocações`;
    return this.search(query);
  }

  async researchMatch(home: string, away: string): Promise<ResearchResult> {
    const query = `${home} x ${away} futebol notícias escalações estatísticas odds`;
    return this.search(query);
  }

  async search(query: string, country = 'br'): Promise<ResearchResult> {
    if (!this.enabled || !this.apiKey) {
      return {
        enabled: false,
        query,
        items: [],
        summary:
          'Pesquisa externa desativada. Configure ODDIX_RESEARCH_ENABLED=true e RAPIDAPI_KEY para ativar notícias em tempo real.',
      };
    }

    try {
      const url = new URL(this.endpoint);

      url.searchParams.set('keyword', query);
      url.searchParams.set('country', country);
      url.searchParams.set('pais', country);
      url.searchParams.set('palavra-chave', query);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.host,
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Research API HTTP ${response.status}`);
      }

      const json: any = await response.json();
      const rawItems = Array.isArray(json?.result)
        ? json.result
        : Array.isArray(json?.results)
          ? json.results
          : Array.isArray(json?.organic_results)
            ? json.organic_results
            : [];

      const items = rawItems
        .map((item: any, index: number) => this.normalizeItem(item, index))
        .filter((item: ResearchItem) => item.title && item.url)
        .slice(0, 6);

      return {
        enabled: true,
        query,
        items,
        summary: this.buildSummary(items),
      };
    } catch (error: any) {
      this.logger.warn(`Research falhou: ${error?.message || error}`);

      return {
        enabled: true,
        query,
        items: [],
        summary: `Não consegui consultar notícias externas agora. Motivo: ${
          error?.message || 'falha desconhecida'
        }`,
      };
    }
  }

  private normalizeItem(item: any, index: number): ResearchItem {
    const url = String(item?.url || item?.link || '').trim();

    return {
      position: Number(item?.position || index + 1),
      title: String(item?.title || '').trim(),
      url,
      description: String(item?.description || item?.snippet || '').trim(),
      source: this.extractSource(url),
    };
  }

  private extractSource(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }

  private buildSummary(items: ResearchItem[]) {
    if (!items.length) {
      return 'Não encontrei notícias relevantes na pesquisa externa.';
    }

    return items
      .slice(0, 4)
      .map((item) => `• ${item.title}${item.source ? ` — ${item.source}` : ''}`)
      .join('\n');
  }
}