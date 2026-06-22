import { Injectable, Logger, Optional } from '@nestjs/common';
import { OddixGlobalAiService } from './oddix-global-ai.service';
import { OddixIntentService, OddixIntent } from './oddix-intent.service';

export type OddixRiskMode = 'safe' | 'balanced' | 'aggressive';

export type ParsedOddixIntent = {
  intent: OddixIntent;
  homeTeam?: string;
  awayTeam?: string;
  riskMode: OddixRiskMode;
  market?: string;
  originalMessage: string;
  source: 'local' | 'fallback';
};

@Injectable()
export class OddixIntentParserService {
  private readonly logger = new Logger(OddixIntentParserService.name);

  constructor(
    @Optional()
    private readonly globalAi: OddixGlobalAiService | undefined,
    private readonly intentService: OddixIntentService,
  ) {}

  async parse(message: string): Promise<ParsedOddixIntent> {
    const originalMessage = String(message || '').trim();
    const fallbackIntent = this.intentService.detect(originalMessage);
    const riskMode = this.detectRiskMode(originalMessage);
    const teams = this.extractTeams(originalMessage);
    const market = this.extractMarket(originalMessage);

    try {
      return {
        intent: fallbackIntent,
        homeTeam: teams?.home,
        awayTeam: teams?.away,
        riskMode,
        market,
        originalMessage,
        source: 'local',
      };
    } catch (error: any) {
      this.logger.warn(`Intent parser fallback: ${error?.message || error}`);

      return {
        intent: fallbackIntent,
        riskMode: 'balanced',
        originalMessage,
        source: 'fallback',
      };
    }
  }

  private detectRiskMode(message: string): OddixRiskMode {
    const text = this.normalize(message);

    if (
      text.includes('segura') ||
      text.includes('conservadora') ||
      text.includes('baixo risco') ||
      text.includes('risco baixo')
    ) {
      return 'safe';
    }

    if (
      text.includes('agressiva') ||
      text.includes('odd alta') ||
      text.includes('odd maior') ||
      text.includes('alto risco') ||
      text.includes('arriscar')
    ) {
      return 'aggressive';
    }

    return 'balanced';
  }

  private extractMarket(message: string): string | undefined {
    const text = this.normalize(message);

    if (text.includes('over 1 5') || text.includes('mais de 1 5')) return 'Over 1.5';
    if (text.includes('over 2 5') || text.includes('mais de 2 5')) return 'Over 2.5';
    if (text.includes('under 3 5') || text.includes('menos de 3 5')) return 'Under 3.5';
    if (text.includes('ambas marcam') || text.includes('btts')) return 'BTTS';
    if (text.includes('dupla chance')) return 'Dupla Chance';
    if (text.includes('handicap')) return 'Handicap';

    return undefined;
  }

  private extractTeams(message: string) {
    const cleaned = String(message || '')
      .replace(/analisa/gi, '')
      .replace(/analisar/gi, '')
      .replace(/analise/gi, '')
      .replace(/análise/gi, '')
      .replace(/player props/gi, '')
      .trim();

    const normalized = cleaned.toLowerCase();

    for (const separator of [' x ', ' vs ', ' versus ', ' contra ']) {
      if (normalized.includes(separator)) {
        const parts = normalized.split(separator);

        if (parts[0]?.trim() && parts[1]?.trim()) {
          return {
            home: this.titleCase(parts[0].trim()),
            away: this.titleCase(parts[1].trim()),
          };
        }
      }
    }

    return null;
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
