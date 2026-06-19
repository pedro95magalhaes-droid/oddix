import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import type { VirtualLeague, VirtualRawMatch } from "../virtual.types";

@Injectable()
export class VirtualBet365Provider {
  private readonly logger = new Logger(VirtualBet365Provider.name);

  private readonly baseUrl =
    process.env.VIRTUAL_BET365_BASE_URL ||
    "https://futebol-virtual-bet3651.p.rapidapi.com";

  private readonly rapidApiHost =
    process.env.VIRTUAL_BET365_RAPIDAPI_HOST ||
    "futebol-virtual-bet3651.p.rapidapi.com";

  private readonly rapidApiKey =
    process.env.VIRTUAL_BET365_RAPIDAPI_KEY ||
    process.env.RAPIDAPI_KEY ||
    "";

  private readonly defaultHome = process.env.VIRTUAL_BET365_HOME || "bet365";
  private readonly defaultSportId = Number(process.env.VIRTUAL_BET365_SPORT_ID || 1);

  private headers() {
    if (!this.rapidApiKey) {
      throw new Error(
        "VIRTUAL_BET365_RAPIDAPI_KEY ou RAPIDAPI_KEY não configurada no ambiente.",
      );
    }

    return {
      "content-type": "application/x-www-form-urlencoded",
      "x-rapidapi-host": this.rapidApiHost,
      "x-rapidapi-key": this.rapidApiKey,
    };
  }

  private toForm(data: Record<string, any>) {
    const params = new URLSearchParams();

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });

    return params;
  }

  async getHistory(params: {
    league: VirtualLeague | string;
    limit?: number;
    activateOdds?: boolean;
  }): Promise<VirtualRawMatch[]> {
    const limit = Math.min(Math.max(Number(params.limit || 100), 1), 1500);

    const body = this.toForm({
      league: params.league,
      home: this.defaultHome,
      sport_id: this.defaultSportId,
      limit,
      activate_odds: String(params.activateOdds ?? true),
    });

    try {
      const response = await axios.post(`${this.baseUrl}/matchs`, body, {
        headers: this.headers(),
        timeout: 20000,
      });

      return Array.isArray(response.data?.matchs) ? response.data.matchs : [];
    } catch (error: any) {
      this.logger.warn(
        `Falha ao buscar histórico virtual (${params.league}): ${error?.response?.status || ""} ${error?.message}`,
      );
      return [];
    }
  }

  async getUpcoming(params: {
    league: VirtualLeague | string;
    activateOdds?: boolean;
  }): Promise<VirtualRawMatch[]> {
    const body = this.toForm({
      league: params.league,
      home: this.defaultHome,
      sport_id: this.defaultSportId,
      activate_odds: String(params.activateOdds ?? true),
    });

    try {
      const response = await axios.post(`${this.baseUrl}/next-matchs`, body, {
        headers: this.headers(),
        timeout: 20000,
      });

      return Array.isArray(response.data?.matchs) ? response.data.matchs : [];
    } catch (error: any) {
      this.logger.warn(
        `Falha ao buscar próximos virtuais (${params.league}): ${error?.response?.status || ""} ${error?.message}`,
      );
      return [];
    }
  }

  async getLastUpdated(league: VirtualLeague | string) {
    const body = this.toForm({
      league,
      home: this.defaultHome,
      sport_id: this.defaultSportId,
    });

    try {
      const response = await axios.post(`${this.baseUrl}/last-updated`, body, {
        headers: this.headers(),
        timeout: 12000,
      });

      return response.data || null;
    } catch (error: any) {
      this.logger.warn(
        `Falha ao buscar última atualização virtual (${league}): ${error?.response?.status || ""} ${error?.message}`,
      );
      return null;
    }
  }
}
