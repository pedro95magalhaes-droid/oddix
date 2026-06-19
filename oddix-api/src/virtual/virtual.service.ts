import { Injectable } from "@nestjs/common";
import { VirtualBet365Provider } from "./providers/virtual-bet365.provider";
import { VirtualAiService } from "./virtual-ai.service";

@Injectable()
export class VirtualService {
  private readonly leagues = ["euro", "copa", "super", "primeiro", "expressar"];

  constructor(
    private readonly provider: VirtualBet365Provider,
    private readonly ai: VirtualAiService,
  ) {}

  getLeagues() {
    return {
      success: true,
      leagues: this.leagues.map((key) => ({
        key,
        name: this.getLeagueName(key),
        provider: "Bet365 Virtual",
        sportId: 1,
      })),
    };
  }

  async getUpcoming(league = "euro") {
    const matches = await this.provider.getUpcoming({
      league,
      activateOdds: true,
    });

    return {
      success: true,
      league,
      returned: matches.length,
      matches,
    };
  }

  async getHistory(league = "euro", limit = 100) {
    const matches = await this.provider.getHistory({
      league,
      limit,
      activateOdds: true,
    });

    return {
      success: true,
      league,
      returned: matches.length,
      matches,
    };
  }

  async getPatterns(league = "euro", limit = 300) {
    const history = await this.provider.getHistory({
      league,
      limit,
      activateOdds: false,
    });

    const patterns = this.ai.getPatterns(history);

    return {
      success: true,
      league,
      returned: history.length,
      patterns,
      warning:
        "Futebol virtual usa RNG. Estes padrões são estatísticos e não garantem resultado.",
    };
  }

  async getTopPicks(league = "euro", historyLimit = 300) {
    const [upcoming, history] = await Promise.all([
      this.provider.getUpcoming({ league, activateOdds: true }),
      this.provider.getHistory({ league, limit: historyLimit, activateOdds: false }),
    ]);

    const analyzed = this.ai.analyzeUpcoming(upcoming, history);
    const topPicks = analyzed
      .filter((item) => item.topPick)
      .sort((a, b) => (b.topPick?.score || 0) - (a.topPick?.score || 0));

    return {
      success: true,
      league,
      returned: topPicks.length,
      sampleSize: history.length,
      topPicks,
      warning:
        "Oddix Virtual analisa histórico, odds e padrões. Não existe garantia em jogos virtuais RNG.",
    };
  }

  async getLastUpdated(league = "euro") {
    const result = await this.provider.getLastUpdated(league);

    return {
      success: Boolean(result),
      league,
      data: result,
    };
  }

  private getLeagueName(key: string) {
    const names: Record<string, string> = {
      euro: "Euro Cup Virtual",
      copa: "Copa Virtual",
      super: "Super Liga Virtual",
      primeiro: "Primeira Liga Virtual",
      expressar: "Express Virtual",
    };

    return names[key] || key;
  }
}
