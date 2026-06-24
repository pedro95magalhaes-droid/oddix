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
  provider?: string;
  cacheHit?: boolean;
  rateLimited?: boolean;
  error?: string;
};

export type WebOddsMarkets = {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  over15?: number;
  over25?: number;
  under35?: number;
  bttsYes?: number;
  bttsNo?: number;
};

export type WebOddsResult = {
  found: boolean;
  source: 'web-research' | 'none';
  query: string;
  bookmaker?: string;
  markets: WebOddsMarkets;
  evidence: ResearchItem[];
  warning: string;
};

type ResearchCacheEntry = {
  result: ResearchResult;
  expiresAt: number;
};

type SearchProvider = {
  name: string;
  host: string;
  endpoint: string;
  apiKey: string;
  mode: 'google-search116' | 'google-serp10';
};

@Injectable()
export class FootballResearchService {
  private readonly logger = new Logger(FootballResearchService.name);

  private readonly cache = new Map<string, ResearchCacheEntry>();
  private readonly cooldowns = new Map<string, number>();

  private get enabled() {
    return String(process.env.ODDIX_RESEARCH_ENABLED || '').toLowerCase() === 'true';
  }

  private get primaryApiKey() {
    return (
      process.env.GOOGLE_SEARCH_API_KEY ||
      process.env.RAPIDAPI_KEY ||
      process.env.X_RAPIDAPI_KEY ||
      ''
    );
  }

  private get primaryHost() {
    return process.env.GOOGLE_SEARCH_HOST || 'google-search116.p.rapidapi.com';
  }

  private get primaryEndpoint() {
    return process.env.GOOGLE_SEARCH_ENDPOINT || `https://${this.primaryHost}/search`;
  }

  private get legacyApiKey() {
    return process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || this.primaryApiKey || '';
  }

  private get legacyHost() {
    return process.env.RAPIDAPI_GOOGLE_SERP_HOST || 'google-serp10.p.rapidapi.com';
  }

  private get legacyEndpoint() {
    return process.env.RAPIDAPI_GOOGLE_SERP_ENDPOINT || `https://${this.legacyHost}/search`;
  }

  private get cacheTtlMs() {
    return Number(process.env.ODDIX_RESEARCH_CACHE_TTL_MS || 1000 * 60 * 30);
  }

  private get timeoutMs() {
    return Number(process.env.ODDIX_RESEARCH_TIMEOUT_MS || 15000);
  }

  async researchTeam(teamName: string): Promise<ResearchResult> {
    const query = `${teamName} futebol notícias próximos jogos resultados classificação escalações`;
    return this.search(query);
  }

  async researchMatch(home: string, away: string): Promise<ResearchResult> {
    const query = `${home} x ${away} futebol notícias escalações estatísticas odds placar`;
    return this.search(query);
  }

  async researchTodayGames(scope = 'futebol'): Promise<ResearchResult> {
    const query = `${scope} jogos de hoje futebol calendário partidas ao vivo`;
    return this.search(query);
  }

  async researchLiveGames(scope = 'futebol'): Promise<ResearchResult> {
    const query = `${scope} futebol ao vivo placar agora jogos em andamento`;
    return this.search(query);
  }

  async researchOdds(home: string, away: string): Promise<WebOddsResult> {
    const safeHome = this.cleanQuery(home);
    const safeAway = this.cleanQuery(away);
    const query = `${safeHome} x ${safeAway} odds over 1.5 over 2.5 btts aposta cotação`;
    const research = await this.search(query);

    return this.extractOddsFromResearch(research);
  }

  async searchEverything(query: string, country = 'br'): Promise<ResearchResult> {
    return this.search(query, country);
  }

  async search(query: string, country = 'br'): Promise<ResearchResult> {
    const safeQuery = this.cleanQuery(query);
    const normalizedCountry = this.normalizeCountry(country);
    const cacheKey = `${safeQuery.toLowerCase()}::${normalizedCountry.toLowerCase()}`;

    if (!this.enabled || !this.primaryApiKey) {
      return {
        enabled: false,
        query: safeQuery,
        items: [],
        summary:
          'Pesquisa externa desativada. Configure ODDIX_RESEARCH_ENABLED=true e GOOGLE_SEARCH_API_KEY para ativar busca web em tempo real.',
        provider: 'disabled',
      };
    }

    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const providers = this.buildProviders();
    let lastError = '';
    let wasRateLimited = false;

    for (const provider of providers) {
      if (!provider.apiKey || !provider.host || !provider.endpoint) continue;

      const cooldown = this.cooldowns.get(provider.name) || 0;
      if (cooldown > Date.now()) {
        lastError = `${provider.name} em cooldown por rate limit`;
        wasRateLimited = true;
        continue;
      }

      try {
        const result = await this.callProvider(provider, safeQuery, normalizedCountry);
        this.cache.set(cacheKey, {
          result,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
        return result;
      } catch (error: any) {
        const status = Number(error?.status || error?.response?.status || 0);
        lastError = error?.message || `falha em ${provider.name}`;
        wasRateLimited = wasRateLimited || status === 429 || /429|too many/i.test(lastError);

        this.logger.warn(`[ODDIX_RESEARCH] ${provider.name} falhou: ${lastError}`);

        if (status === 429 || /429|too many/i.test(lastError)) {
          const cooldownMs = Number(process.env.ODDIX_RESEARCH_429_COOLDOWN_MS || 1000 * 60 * 5);
          this.cooldowns.set(provider.name, Date.now() + cooldownMs);
        }
      }
    }

    const failedResult: ResearchResult = {
      enabled: true,
      query: safeQuery,
      items: [],
      summary: wasRateLimited
        ? '🔎 Pesquisa web acionada, mas o provedor retornou limite de requisições (429). Usando apenas dados locais/cache.'
        : `🔎 Pesquisa web acionada, mas não consegui consultar notícias externas agora. Motivo: ${lastError || 'falha desconhecida'}`,
      provider: providers.map((p) => p.name).join(' > ') || 'none',
      rateLimited: wasRateLimited,
      error: lastError || undefined,
    };

    this.cache.set(cacheKey, {
      result: failedResult,
      expiresAt: Date.now() + Math.min(this.cacheTtlMs, 1000 * 60 * 5),
    });

    return failedResult;
  }

  private buildProviders(): SearchProvider[] {
    const providers: SearchProvider[] = [
      {
        name: 'google-search116',
        host: this.primaryHost,
        endpoint: this.primaryEndpoint,
        apiKey: this.primaryApiKey,
        mode: 'google-search116',
      },
    ];

    const enableLegacyFallback =
      String(process.env.ODDIX_RESEARCH_ENABLE_LEGACY_FALLBACK || 'true').toLowerCase() !== 'false';

    if (enableLegacyFallback && this.legacyHost && this.legacyEndpoint) {
      providers.push({
        name: 'google-serp10-legacy',
        host: this.legacyHost,
        endpoint: this.legacyEndpoint,
        apiKey: this.legacyApiKey,
        mode: 'google-serp10',
      });
    }

    return providers;
  }

  private async callProvider(
    provider: SearchProvider,
    query: string,
    country: string,
  ): Promise<ResearchResult> {
    const url = new URL(provider.endpoint);

    if (provider.mode === 'google-search116') {
      url.searchParams.set('query', query);
      url.searchParams.set('country', country.toUpperCase());
      url.searchParams.set('gl', country.toUpperCase());
      url.searchParams.set('hl', 'pt-BR');
      url.searchParams.set('limit', String(Number(process.env.ODDIX_RESEARCH_LIMIT || 10)));
    } else {
      url.searchParams.set('keyword', query);
      url.searchParams.set('q', query);
      url.searchParams.set('query', query);
      url.searchParams.set('country', country);
      url.searchParams.set('pais', country);
      url.searchParams.set('palavra-chave', query);
      url.searchParams.set('hl', 'pt-BR');
      url.searchParams.set('gl', country);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      this.logger.log(`[ODDIX_RESEARCH] provider=${provider.name} query="${query.slice(0, 160)}"`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'x-rapidapi-key': provider.apiKey,
          'x-rapidapi-host': provider.host,
          accept: 'application/json',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const error: any = new Error(`Research API HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
        error.status = response.status;
        throw error;
      }

      const json: any = await response.json();
      const rawItems = this.extractRawItems(json);

      const items = rawItems
        .map((item: any, index: number) => this.normalizeItem(item, index))
        .filter((item: ResearchItem) => item.title && item.url)
        .filter((item: ResearchItem) => this.isUsefulFootballResult(item))
        .slice(0, 10);

      this.logger.log(`[ODDIX_RESEARCH] provider=${provider.name} results=${items.length}`);

      return {
        enabled: true,
        query,
        items,
        summary: this.buildSummary(items),
        provider: provider.name,
        rateLimited: false,
      };
    } catch (error: any) {
      clearTimeout(timeout);
      if (error?.name === 'AbortError') {
        const abortError: any = new Error(`Research API timeout após ${this.timeoutMs}ms`);
        abortError.status = 408;
        throw abortError;
      }
      throw error;
    }
  }

  private getCached(cacheKey: string): ResearchResult | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return {
      ...cached.result,
      cacheHit: true,
      summary: cached.result.summary || this.buildSummary(cached.result.items || []),
    };
  }

  private extractOddsFromResearch(research: ResearchResult): WebOddsResult {
    const markets: WebOddsMarkets = {};
    const evidence: ResearchItem[] = [];

    for (const item of research.items || []) {
      const text = `${item.title} ${item.description}`;
      const normalized = this.normalizeForOdds(text);
      const source = String(item.source || '').toLowerCase();

      const hasOddsContext =
        normalized.includes('odd') ||
        normalized.includes('odds') ||
        normalized.includes('cotacao') ||
        normalized.includes('cotação') ||
        normalized.includes('aposta') ||
        normalized.includes('bet') ||
        source.includes('odds') ||
        source.includes('bet') ||
        source.includes('bookmaker');

      if (!hasOddsContext) continue;

      const extracted = this.extractMarketOdds(normalized);
      if (Object.keys(extracted).length) {
        Object.assign(markets, extracted);
        evidence.push(item);
      }
    }

    const found = Object.keys(markets).length > 0;

    return {
      found,
      source: found ? 'web-research' : 'none',
      query: research.query,
      bookmaker: evidence[0]?.source,
      markets,
      evidence: evidence.slice(0, 5),
      warning: found
        ? 'Odds extraídas de pesquisa web. Confirme a cotação na casa de apostas antes de apostar.'
        : research.rateLimited
          ? 'Pesquisa web acionada, mas o provedor retornou limite de requisições. Nenhuma odd confiável foi extraída.'
          : 'Nenhuma odd confiável foi extraída da pesquisa web.',
    };
  }

  private extractMarketOdds(text: string): WebOddsMarkets {
    const markets: WebOddsMarkets = {};

    const readNear = (patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        const odd = this.parseOdd(match?.[1]);
        if (odd) return odd;
      }
      return undefined;
    };

    markets.over15 = readNear([
      /over\s*1[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
      /mais\s+de\s+1[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
      /acima\s+de\s+1[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
    ]);

    markets.over25 = readNear([
      /over\s*2[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
      /mais\s+de\s+2[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
      /acima\s+de\s+2[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
    ]);

    markets.under35 = readNear([
      /under\s*3[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
      /menos\s+de\s+3[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
      /abaixo\s+de\s+3[.,]?5\D{0,18}(\d+[.,]\d{2})/i,
    ]);

    markets.bttsYes = readNear([
      /btts\D{0,18}(\d+[.,]\d{2})/i,
      /ambas\s+marcam\D{0,18}(\d+[.,]\d{2})/i,
      /both\s+teams\s+to\s+score\D{0,18}(\d+[.,]\d{2})/i,
    ]);

    markets.homeWin = readNear([
      /casa\D{0,14}(\d+[.,]\d{2})/i,
      /mandante\D{0,14}(\d+[.,]\d{2})/i,
      /home\D{0,14}(\d+[.,]\d{2})/i,
    ]);

    markets.draw = readNear([
      /empate\D{0,14}(\d+[.,]\d{2})/i,
      /draw\D{0,14}(\d+[.,]\d{2})/i,
    ]);

    markets.awayWin = readNear([
      /fora\D{0,14}(\d+[.,]\d{2})/i,
      /visitante\D{0,14}(\d+[.,]\d{2})/i,
      /away\D{0,14}(\d+[.,]\d{2})/i,
    ]);

    return Object.fromEntries(
      Object.entries(markets).filter(([, value]) => typeof value === 'number'),
    ) as WebOddsMarkets;
  }

  private parseOdd(value?: string) {
    if (!value) return undefined;
    const odd = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(odd)) return undefined;
    if (odd < 1.01 || odd > 15) return undefined;
    return Number(odd.toFixed(2));
  }

  private normalizeForOdds(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractRawItems(json: any): any[] {
    const candidates = [
      json?.results,
      json?.result,
      json?.organic_results,
      json?.organic,
      json?.data,
      json?.items,
      json?.news_results,
      json?.top_stories,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }

    if (Array.isArray(json)) return json;

    return [];
  }

  private normalizeItem(item: any, index: number): ResearchItem {
    const url = String(item?.url || item?.link || item?.href || '').trim();
    const title = String(item?.title || item?.name || '').trim();
    const description = String(
      item?.description ||
        item?.snippet ||
        item?.summary ||
        item?.content ||
        '',
    ).trim();

    return {
      position: Number(item?.position || item?.rank || index + 1),
      title,
      url,
      description,
      source: this.extractSource(url) || item?.source || item?.displayed_link,
    };
  }

  private isUsefulFootballResult(item: ResearchItem) {
    const haystack = `${item.title} ${item.description} ${item.source || ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const bad = ['youtube shorts', 'tiktok', 'pinterest'];
    if (bad.some((term) => haystack.includes(term))) return false;

    return true;
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
      return 'Não encontrei resultados relevantes na pesquisa externa.';
    }

    return items
      .slice(0, 5)
      .map((item) => {
        const source = item.source ? ` — ${item.source}` : '';
        const description = item.description ? `\n  ${item.description}` : '';
        return `• ${item.title}${source}${description}`;
      })
      .join('\n');
  }

  private cleanQuery(query: string) {
    return String(query || '')
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);
  }

  private normalizeCountry(country: string) {
    const value = String(country || 'BR').trim();
    if (!value) return 'BR';
    if (value.toLowerCase() === 'br') return 'BR';
    return value.toUpperCase();
  }
}
