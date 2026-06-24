import { Injectable } from '@nestjs/common';

@Injectable()
export class MatchResolverService {
  normalize(value: any) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  stripContextualTerms(value: string) {
    return String(value || '')
      .replace(/[?!.]+/g, ' ')
      .replace(/\bvale\s+entrar\b/gi, ' ')
      .replace(/\bvale\s+a\s+pena\b/gi, ' ')
      .replace(/\bposso\s+entrar\b/gi, ' ')
      .replace(/\bentraria\b/gi, ' ')
      .replace(/\bqual\s+mercado\b/gi, ' ')
      .replace(/\bquais\s+s[aã]o\s+as\s+odds\b/gi, ' ')
      .replace(/\bquais\s+odds\b/gi, ' ')
      .replace(/\bo\s+que\s+voc[eê]\s+faria\b/gi, ' ')
      .replace(/\bquem\s+est[aá]\s+melhor\b/gi, ' ')
      .replace(/\bpr[oó]ximo\s+gol\b/gi, ' ')
      .replace(/\bnesse\s+jogo\b/gi, ' ')
      .replace(/\bdesse\s+jogo\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractTeams(message: string): { home: string; away: string } | null {
    const cleaned = this.stripContextualTerms(String(message || ''))
      .replace(/\b(analisar|analisa|analise|análise)\b/gi, ' ')
      .replace(/\b\d+\s*[x:-]\s*\d+\b/gi, ' x ')
      .replace(/\s+/g, ' ')
      .trim();

    for (const separator of [' x ', ' vs ', ' v ', ' versus ', ' contra ']) {
      const lower = cleaned.toLowerCase();
      if (!lower.includes(separator)) continue;
      const [home, ...rest] = lower.split(separator);
      const away = rest.join(separator).trim();
      if (home?.trim() && away) {
        return {
          home: this.stripContextualTerms(home).trim(),
          away: this.stripContextualTerms(away).trim(),
        };
      }
    }

    return null;
  }

  aliases(value: any): string[] {
    const base = this.normalize(value);
    if (!base) return [];

    const dictionary: Record<string, string[]> = {
      panama: ['panama', 'panamá'],
      croacia: ['croacia', 'croácia', 'croatia'],
      croatia: ['croatia', 'croacia', 'croácia'],
      estados: ['usa', 'united states', 'estados unidos'],
      usa: ['usa', 'united states', 'estados unidos', 'estados unidos da america'],
      flamengo: ['flamengo'],
      palmeiras: ['palmeiras'],
    };

    const expanded = new Set<string>([base]);
    for (const [key, values] of Object.entries(dictionary)) {
      if (base === key || values.includes(base)) {
        values.forEach((item) => expanded.add(this.normalize(item)));
      }
    }

    return [...expanded].filter(Boolean);
  }

  namesFromFixture(fixture: any) {
    const home =
      fixture?.teams?.home?.name ||
      fixture?.times?.home?.name ||
      fixture?.times?.casa?.nome ||
      fixture?.homeTeam ||
      fixture?.home ||
      '';

    const away =
      fixture?.teams?.away?.name ||
      fixture?.times?.away?.name ||
      fixture?.times?.fora?.nome ||
      fixture?.awayTeam ||
      fixture?.away ||
      '';

    return { home, away };
  }

  fixtureScore(fixture: any) {
    const provider = this.normalize(fixture?.provider || fixture?.source || '');
    const status = String(
      fixture?.fixture?.status?.short ||
        fixture?.status?.short ||
        fixture?.fixture?.status?.long ||
        fixture?.status?.long ||
        '',
    ).toUpperCase();

    const elapsed = Number(
      fixture?.fixture?.status?.elapsed ??
        fixture?.status?.elapsed ??
        fixture?.fixture?.status?.minute ??
        fixture?.minute ??
        0,
    );

    const hasOdds = !!(
      fixture?.odds?.options?.length ||
      fixture?.odds?.opções?.length ||
      fixture?.odds?.market ||
      fixture?.odds?.mercado
    );

    let score = 0;
    if (provider.includes('flashscore')) score += 5000;
    else if (provider.includes('sportscore')) score += 150;

    if (['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'P'].includes(status)) score += 3000 + elapsed;
    else if (status === 'HT' || status.includes('HALF') || status.includes('INTERVAL')) score += 2800;
    else if (elapsed > 0 && elapsed < 130) score += 2500 + elapsed;
    else if (['NS', 'TBD', 'SCHEDULED'].includes(status)) score += 300;
    else if (['FT', 'AET', 'PEN'].includes(status)) score += 100;

    if (hasOdds) score += 800;
    return score;
  }

  findBest(fixtures: any[], homeQuery: string, awayQuery: string) {
    const homeAliases = this.aliases(homeQuery);
    const awayAliases = this.aliases(awayQuery);

    const candidates = (fixtures || []).filter((fixture) => {
      const names = this.namesFromFixture(fixture);
      const fixtureHome = this.aliases(names.home);
      const fixtureAway = this.aliases(names.away);

      const direct = this.intersects(homeAliases, fixtureHome) && this.intersects(awayAliases, fixtureAway);
      const swapped = this.intersects(homeAliases, fixtureAway) && this.intersects(awayAliases, fixtureHome);
      return direct || swapped;
    });

    return candidates.sort((a, b) => this.fixtureScore(b) - this.fixtureScore(a))[0] || null;
  }

  private intersects(a: string[], b: string[]) {
    return a.some((item) => b.includes(item));
  }
}
