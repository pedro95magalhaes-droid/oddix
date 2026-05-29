import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class Bet365DataService {
  private readonly baseURL = 'https://bet365data.p.rapidapi.com';

  isEnabled() {
    return String(process.env.BET365DATA_ENABLED || 'false').toLowerCase() === 'true';
  }

  hasKey() {
    return !!(process.env.BET365DATA_KEY || process.env.RAPIDAPI_KEY || '');
  }

  private key() {
    return process.env.BET365DATA_KEY || process.env.RAPIDAPI_KEY || '';
  }

  private host() {
    return process.env.BET365DATA_HOST || 'bet365data.p.rapidapi.com';
  }

  private async request(path: string, params: Record<string, any> = {}) {
    if (!this.isEnabled()) return { ok: false, data: null, error: 'Bet365Data desativada' };
    if (!this.key()) return { ok: false, data: null, error: 'BET365DATA_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.baseURL}${path}`, {
        timeout: Number(process.env.BET365DATA_TIMEOUT_MS || 12000),
        headers: {
          'x-rapidapi-key': this.key(),
          'x-rapidapi-host': this.host(),
          'Content-Type': 'application/json',
        },
        params,
      });
      return { ok: true, data: response.data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na Bet365Data',
      };
    }
  }

  async getSoccerLiveEvents() {
    const path = process.env.BET365DATA_SOCCER_LIVE_PATH || '/soccer/live';
    return this.request(path);
  }

  async getLiveEventMarkets(eventId: string) {
    const path = process.env.BET365DATA_MARKETS_PATH || '/event/markets';
    return this.request(path, { eventId });
  }
}
