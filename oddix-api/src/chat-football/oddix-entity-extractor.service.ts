import { Injectable } from '@nestjs/common';

export type OddixEntities = {
  homeTeam?: string;
  awayTeam?: string;
  team?: string;
  player?: string;
  league?: string;
  market?: string;
  stake?: number;
  odd?: number;
};

@Injectable()
export class OddixEntityExtractorService {
  extract(message: string, overrides: Partial<OddixEntities> = {}): OddixEntities {
    const base: OddixEntities = {
      ...this.extractTeams(message),
      team: this.extractSingleTeam(message),
      market: this.extractMarket(message),
      stake: this.extractStake(message),
      odd: this.extractOdd(message),
    };

    return {
      ...base,
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null && value !== ''),
      ),
    };
  }

  private extractTeams(message: string): Pick<OddixEntities, 'homeTeam' | 'awayTeam'> {
    const cleaned = String(message || '')
      .replace(/analisa/gi, '')
      .replace(/analisar/gi, '')
      .replace(/analise/gi, '')
      .replace(/análise/gi, '')
      .replace(/como ta/gi, '')
      .replace(/como tá/gi, '')
      .replace(/como esta/gi, '')
      .replace(/como está/gi, '')
      .replace(/hoje/gi, '')
      .replace(/agora/gi, '')
      .trim();

    const normalized = cleaned.toLowerCase();

    for (const separator of [' x ', ' vs ', ' versus ', ' contra ']) {
      if (normalized.includes(separator)) {
        const parts = normalized.split(separator);
        if (parts[0]?.trim() && parts[1]?.trim()) {
          return {
            homeTeam: this.titleCase(parts[0].trim()),
            awayTeam: this.titleCase(parts[1].trim()),
          };
        }
      }
    }

    const eMatch = normalized.match(/^([a-zA-ZÀ-ÿ0-9 .'-]{2,})\s+e\s+([a-zA-ZÀ-ÿ0-9 .'-]{2,})$/);
    if (eMatch?.[1] && eMatch?.[2]) {
      return {
        homeTeam: this.titleCase(eMatch[1].trim()),
        awayTeam: this.titleCase(eMatch[2].trim()),
      };
    }

    return {};
  }

  private extractSingleTeam(message: string): string | undefined {
    const text = this.normalize(message);

    const aliases: Record<string, string> = {
      franca: 'France',
      frança: 'France',
      france: 'France',
      brasil: 'Brazil',
      brazil: 'Brazil',
      argentina: 'Argentina',
      portugal: 'Portugal',
      espanha: 'Spain',
      spain: 'Spain',
      inglaterra: 'England',
      england: 'England',
      alemanha: 'Germany',
      germany: 'Germany',
      italia: 'Italy',
      italy: 'Italy',
      flamengo: 'Flamengo',
      palmeiras: 'Palmeiras',
      fortaleza: 'Fortaleza',
      ceara: 'Ceará',
      ceará: 'Ceará',
      corinthians: 'Corinthians',
      santos: 'Santos',
      vasco: 'Vasco',
      botafogo: 'Botafogo',
      fluminense: 'Fluminense',
      cruzeiro: 'Cruzeiro',
      gremio: 'Grêmio',
      internacional: 'Internacional',
    };

    for (const [alias, canonical] of Object.entries(aliases)) {
      if (text.includes(this.normalize(alias))) return canonical;
    }

    const patterns = [
      /jogo d[ao] ([a-zA-ZÀ-ÿ .'-]{3,})/i,
      /partida d[ao] ([a-zA-ZÀ-ÿ .'-]{3,})/i,
      /quanto ta [ao]? ?([a-zA-ZÀ-ÿ .'-]{3,})/i,
      /placar d[ao] ([a-zA-ZÀ-ÿ .'-]{3,})/i,
    ];

    for (const pattern of patterns) {
      const match = String(message || '').match(pattern);
      if (match?.[1]) return this.titleCase(match[1].trim());
    }

    return undefined;
  }

  private extractMarket(message: string): string | undefined {
    const text = this.normalize(message);

    if (text.includes('over 1 5') || text.includes('mais de 1 5')) return 'Over 1.5';
    if (text.includes('over 2 5') || text.includes('mais de 2 5')) return 'Over 2.5';
    if (text.includes('under 3 5') || text.includes('menos de 3 5')) return 'Under 3.5';
    if (text.includes('ambas marcam') || text.includes('btts')) return 'BTTS';
    if (text.includes('dupla chance')) return 'Dupla Chance';
    if (text.includes('handicap')) return 'Handicap';
    if (text.includes('escanteio')) return 'Escanteios';
    if (text.includes('player props') || text.includes('jogador')) return 'Player Props';

    return undefined;
  }

  private extractStake(message: string): number | undefined {
    const normalized = String(message || '').replace(',', '.');
    const match =
      normalized.match(/r\$\s*(\d+(\.\d+)?)/i) ||
      normalized.match(/(\d+(\.\d+)?)\s*reais/i) ||
      normalized.match(/colocar\s+(\d+(\.\d+)?)/i) ||
      normalized.match(/com\s+(\d+(\.\d+)?)/i);

    const value = Number(match?.[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  private extractOdd(message: string): number | undefined {
    const normalized = String(message || '').replace(',', '.');
    const match =
      normalized.match(/odd\s*(\d+(\.\d+)?)/i) ||
      normalized.match(/@(\d+(\.\d+)?)/i) ||
      normalized.match(/\b(\d+\.\d{2})\b/i);

    const value = Number(match?.[1]);
    return Number.isFinite(value) && value > 1 ? value : undefined;
  }

  private titleCase(value: string) {
    return value
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
}
