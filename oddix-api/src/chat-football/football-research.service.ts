import { Injectable, Logger } from "@nestjs/common";

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
  source: "web-research" | "none";
  query: string;
  bookmaker?: string;
  markets: WebOddsMarkets;
  evidence: ResearchItem[];
  warning: string;
};

@Injectable()
export class FootballResearchService {
  private readonly logger = new Logger(FootballResearchService.name);

  private get enabled() {
    return (
      String(process.env.ODDIX_RESEARCH_ENABLED || "").toLowerCase() === "true"
    );
  }

  private get apiKey() {
    return process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || "";
  }

  private get host() {
    return (
      process.env.RAPIDAPI_GOOGLE_SERP_HOST || "google-serp10.p.rapidapi.com"
    );
  }

  private get endpoint() {
    return (
      process.env.RAPIDAPI_GOOGLE_SERP_ENDPOINT || `https://${this.host}/search`
    );
  }

  async researchTeam(teamName: string): Promise<ResearchResult> {
    const query = `${teamName} futebol notícias próximos jogos resultados classificação escalações`;
    return this.search(query);
  }

  async researchMatch(home: string, away: string): Promise<ResearchResult> {
    const query = `${home} x ${away} futebol notícias escalações estatísticas odds placar`;
    return this.search(query);
  }

  async researchTodayGames(scope = "futebol"): Promise<ResearchResult> {
    const query = `${scope} jogos de hoje futebol calendário partidas ao vivo`;
    return this.search(query);
  }

  async researchLiveGames(scope = "futebol"): Promise<ResearchResult> {
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

  async searchEverything(
    query: string,
    country = "br",
  ): Promise<ResearchResult> {
    return this.search(query, country);
  }

  async search(query: string, country = "br"): Promise<ResearchResult> {
    const safeQuery = this.cleanQuery(query);

    if (!this.enabled || !this.apiKey) {
      return {
        enabled: false,
        query: safeQuery,
        items: [],
        summary:
          "Pesquisa externa desativada. Configure ODDIX_RESEARCH_ENABLED=true e RAPIDAPI_KEY para ativar busca web em tempo real.",
      };
    }

    try {
      const url = new URL(this.endpoint);

      // O provider google-serp10 aceita variações de parâmetro dependendo do plano/host.
      // Mantemos os principais para reduzir falha silenciosa.
      url.searchParams.set("keyword", safeQuery);
      url.searchParams.set("q", safeQuery);
      url.searchParams.set("query", safeQuery);
      url.searchParams.set("country", country);
      url.searchParams.set("pais", country);
      url.searchParams.set("palavra-chave", safeQuery);
      url.searchParams.set("hl", "pt-BR");
      url.searchParams.set("gl", country);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-rapidapi-key": this.apiKey,
          "x-rapidapi-host": this.host,
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Research API HTTP ${response.status}`);
      }

      const json: any = await response.json();
      const rawItems = this.extractRawItems(json);

      const items = rawItems
        .map((item: any, index: number) => this.normalizeItem(item, index))
        .filter((item: ResearchItem) => item.title && item.url)
        .filter((item: ResearchItem) => this.isUsefulFootballResult(item))
        .slice(0, 8);

      return {
        enabled: true,
        query: safeQuery,
        items,
        summary: this.buildSummary(items),
      };
    } catch (error: any) {
      this.logger.warn(`Research falhou: ${error?.message || error}`);

      return {
        enabled: true,
        query: safeQuery,
        items: [],
        summary: `Não consegui consultar notícias externas agora. Motivo: ${
          error?.message || "falha desconhecida"
        }`,
      };
    }
  }

  private extractOddsFromResearch(research: ResearchResult): WebOddsResult {
    const markets: WebOddsMarkets = {};
    const evidence: ResearchItem[] = [];

    for (const item of research.items || []) {
      const text = `${item.title} ${item.description}`;
      const normalized = this.normalizeForOdds(text);
      const source = String(item.source || "").toLowerCase();

      const hasOddsContext =
        normalized.includes("odd") ||
        normalized.includes("odds") ||
        normalized.includes("cotacao") ||
        normalized.includes("aposta") ||
        normalized.includes("bet") ||
        source.includes("odds") ||
        source.includes("bet") ||
        source.includes("bookmaker");

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
      source: found ? "web-research" : "none",
      query: research.query,
      bookmaker: evidence[0]?.source,
      markets,
      evidence: evidence.slice(0, 5),
      warning: found
        ? "Odds extraídas de pesquisa web. Confirme a cotação na casa de apostas antes de apostar."
        : "Nenhuma odd confiável foi extraída da pesquisa web.",
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
      Object.entries(markets).filter(([, value]) => typeof value === "number"),
    ) as WebOddsMarkets;
  }

  private parseOdd(value?: string) {
    if (!value) return undefined;
    const odd = Number(String(value).replace(",", "."));
    if (!Number.isFinite(odd)) return undefined;
    if (odd < 1.01 || odd > 15) return undefined;
    return Number(odd.toFixed(2));
  }

  private normalizeForOdds(value: string) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private extractRawItems(json: any): any[] {
    const candidates = [
      json?.result,
      json?.results,
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
    const url = String(item?.url || item?.link || item?.href || "").trim();
    const title = String(item?.title || item?.name || "").trim();
    const description = String(
      item?.description ||
        item?.snippet ||
        item?.summary ||
        item?.content ||
        "",
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
    const haystack = `${item.title} ${item.description} ${item.source || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const bad = ["youtube shorts", "tiktok", "pinterest"];
    if (bad.some((term) => haystack.includes(term))) return false;

    return true;
  }

  private extractSource(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  }

  private buildSummary(items: ResearchItem[]) {
    if (!items.length) {
      return "Não encontrei resultados relevantes na pesquisa externa.";
    }

    return items
      .slice(0, 5)
      .map((item) => {
        const source = item.source ? ` — ${item.source}` : "";
        const description = item.description ? `\n  ${item.description}` : "";
        return `• ${item.title}${source}${description}`;
      })
      .join("\n");
  }

  private cleanQuery(query: string) {
    return String(query || "")
      .replace(/[\n\r\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
  }
}
