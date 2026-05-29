import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OddsPapiService {
  private baseURL() {
    return process.env.ODDSPAPI_BASE_URL || 'https://api.oddspapi.io';
  }

  isEnabled() {
    return String(process.env.ODDSPAPI_ENABLED || 'false').toLowerCase() === 'true';
  }

  hasKey() {
    return !!process.env.ODDSPAPI_KEY;
  }

  private async request(path: string, params: Record<string, any> = {}) {
    if (!this.isEnabled()) return { ok: false, data: null, error: 'OddsPapi desativada' };
    if (!this.hasKey()) return { ok: false, data: null, error: 'ODDSPAPI_KEY não encontrada' };

    try {
      const response = await axios.get(`${this.baseURL()}${path}`, {
        timeout: Number(process.env.ODDSPAPI_TIMEOUT_MS || 12000),
        headers: {
          Authorization: `Bearer ${process.env.ODDSPAPI_KEY}`,
          'x-api-key': process.env.ODDSPAPI_KEY,
          'Content-Type': 'application/json',
        },
        params: {
          apiKey: process.env.ODDSPAPI_KEY,
          ...params,
        },
      });
      return { ok: true, data: response.data, error: null };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.response?.data?.message || error?.response?.data || error?.message || 'Erro na OddsPapi',
      };
    }
  }

  async getFixtures(params: Record<string, any> = {}) {
    const path = process.env.ODDSPAPI_FIXTURES_PATH || '/fixtures';
    return this.request(path, params);
  }

  async getFixtureOdds(params: Record<string, any> = {}) {
    const path = process.env.ODDSPAPI_FIXTURE_ODDS_PATH || '/fixtures/odds';
    return this.request(path, params);
  }
}
