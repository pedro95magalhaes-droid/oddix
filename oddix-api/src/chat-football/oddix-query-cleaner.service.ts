import { Injectable } from '@nestjs/common';

export type OddixQueryIntentHint =
  | 'MATCH_RESULT'
  | 'MATCH_ANALYSIS'
  | 'TODAY_CUP_GAMES'
  | 'TODAY_GAMES'
  | 'LIVE'
  | 'NEWS'
  | 'GENERAL';

export type OddixCleanedQuery = {
  original: string;
  normalized: string;
  cleanMessage: string;
  intentHint: OddixQueryIntentHint;
  teams: { home: string; away: string } | null;
  researchQueries: string[];
  shouldForceResearch: boolean;
};

@Injectable()
export class OddixQueryCleanerService {
  analyze(message: string): OddixCleanedQuery {
    const original = String(message || '').trim();
    const normalized = this.normalize(original);
    const intentHint = this.detectIntentHint(normalized);
    const cleanMessage = this.cleanFootballQuestion(original, intentHint);
    const teams = this.extractTeams(cleanMessage);
    const researchQueries = this.buildResearchQueries(original, intentHint, teams);

    return {
      original,
      normalized,
      cleanMessage,
      intentHint,
      teams,
      researchQueries,
      shouldForceResearch: this.shouldForceResearch(intentHint, normalized),
    };
  }

  normalize(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[–—]/g, '-')
      .replace(/[^a-z0-9\s\-x]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanFootballQuestion(message: string, intentHint: OddixQueryIntentHint = 'GENERAL'): string {
    let text = String(message || '')
      .replace(/[?!.]+/g, ' ')
      .replace(/[–—]/g, ' ')
      .replace(/\b\d+\s*[-:]\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*x\s*\d+\b/gi, ' x ')
      .replace(/\s+/g, ' ')
      .trim();

    const prefixes = [
      /\bquanto\s+saiu\s+o\s+jogo\b/gi,
      /\bquanto\s+saiu\b/gi,
      /\bquanto\s+ficou\s+o\s+jogo\b/gi,
      /\bquanto\s+ficou\b/gi,
      /\bresultado\s+do\s+jogo\b/gi,
      /\bresultado\s+de\b/gi,
      /\bresultado\b/gi,
      /\bplacar\s+do\s+jogo\b/gi,
      /\bplacar\s+de\b/gi,
      /\bplacar\b/gi,
      /\bquem\s+ganhou\s+o\s+jogo\b/gi,
      /\bquem\s+ganhou\b/gi,
      /\bcomo\s+foi\s+o\s+jogo\b/gi,
      /\bcomo\s+foi\b/gi,
      /\bjogo\s+entre\b/gi,
      /\bjogo\s+do\b/gi,
      /\bjogo\s+da\b/gi,
      /\banalise\b/gi,
      /\banálise\b/gi,
      /\banalisa\b/gi,
      /\banalisar\b/gi,
      /\bcomo\s+ta\b/gi,
      /\bcomo\s+tá\b/gi,
      /\bcomo\s+esta\b/gi,
      /\bcomo\s+está\b/gi,
    ];

    for (const pattern of prefixes) text = text.replace(pattern, ' ');

    text = this.stripContextualTerms(text);

    // Em perguntas de resultado, o usuário costuma escrever "Colombia e Congo".
    // Aqui o "e" entre dois blocos de palavras vira separador de confronto.
    if (intentHint === 'MATCH_RESULT' || !this.hasExplicitSeparator(text)) {
      text = text.replace(/\s+e\s+/gi, ' x ');
    }

    return text.replace(/\s+/g, ' ').trim();
  }

  stripContextualTerms(value: string): string {
    return String(value || '')
      .replace(/\bvale\s+entrar\b/gi, ' ')
      .replace(/\bvale\s+a\s+pena\b/gi, ' ')
      .replace(/\bposso\s+entrar\b/gi, ' ')
      .replace(/\bentraria\b/gi, ' ')
      .replace(/\bqual\s+mercado\b/gi, ' ')
      .replace(/\bque\s+mercado\b/gi, ' ')
      .replace(/\bquais\s+s[aã]o\s+as\s+odds\b/gi, ' ')
      .replace(/\bquais\s+odds\b/gi, ' ')
      .replace(/\bqual\s+odd\b/gi, ' ')
      .replace(/\bo\s+que\s+voc[eê]\s+faria\b/gi, ' ')
      .replace(/\bo\s+que\s+voce\s+faria\b/gi, ' ')
      .replace(/\bo\s+que\s+faria\b/gi, ' ')
      .replace(/\bquem\s+est[aá]\s+melhor\b/gi, ' ')
      .replace(/\bquem\s+ta\s+melhor\b/gi, ' ')
      .replace(/\bquem\s+t[aá]\s+melhor\b/gi, ' ')
      .replace(/\bpr[oó]ximo\s+gol\b/gi, ' ')
      .replace(/\bproximo\s+gol\b/gi, ' ')
      .replace(/\btem\s+entrada\b/gi, ' ')
      .replace(/\bnesse\s+jogo\b/gi, ' ')
      .replace(/\bdesse\s+jogo\b/gi, ' ')
      .replace(/\bnessa\s+partida\b/gi, ' ')
      .replace(/\bdesse\s+confronto\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractTeams(message: string): { home: string; away: string } | null {
    const clean = String(message || '')
      .replace(/[?!.]+/g, ' ')
      .replace(/[–—]/g, ' ')
      .replace(/\b\d+\s*x\s*\d+\b/gi, ' x ')
      .replace(/\b\d+\s*[-:]\s*\d+\b/gi, ' x ')
      .replace(/\s+/g, ' ')
      .trim();

    const normalized = clean.toLowerCase();
    const separators = [' x ', ' vs ', ' v ', ' versus ', ' contra '];

    for (const separator of separators) {
      if (!normalized.includes(separator)) continue;
      const parts = normalized.split(separator);
      if (parts[0]?.trim() && parts[1]?.trim()) {
        return {
          home: this.cleanTeamName(parts[0]),
          away: this.cleanTeamName(parts.slice(1).join(separator)),
        };
      }
    }

    return null;
  }

  cleanTeamName(value: string): string {
    return String(value || '')
      .replace(/\b(the|fc|cf|sc)\b/gi, ' ')
      .replace(/\bselecao\b/gi, ' ')
      .replace(/\bseleção\b/gi, ' ')
      .replace(/\bfutebol\b/gi, ' ')
      .replace(/\bfootball\b/gi, ' ')
      .replace(/\bhoje\b/gi, ' ')
      .replace(/\bagora\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private detectIntentHint(normalized: string): OddixQueryIntentHint {
    if (this.hasAny(normalized, ['quanto saiu', 'quanto ficou', 'resultado', 'placar', 'quem ganhou', 'como foi'])) {
      return 'MATCH_RESULT';
    }

    if (this.hasAny(normalized, ['jogos da copa', 'jogo da copa', 'tem copa', 'copa hoje', 'mundial hoje', 'world cup today', 'club world cup'])) {
      return 'TODAY_CUP_GAMES';
    }

    if (this.hasAny(normalized, ['jogos de hoje', 'quais jogos', 'analise os jogos', 'mostrar jogos'])) {
      return 'TODAY_GAMES';
    }

    if (this.hasAny(normalized, ['ao vivo', 'live', 'em andamento'])) return 'LIVE';
    if (this.hasAny(normalized, ['noticia', 'noticias', 'news', 'escalação', 'escalacao', 'desfalque'])) return 'NEWS';
    if (this.hasExplicitSeparator(normalized)) return 'MATCH_ANALYSIS';

    return 'GENERAL';
  }

  private buildResearchQueries(original: string, intentHint: OddixQueryIntentHint, teams: { home: string; away: string } | null): string[] {
    const cleanOriginal = String(original || '').replace(/\s+/g, ' ').trim();

    if (intentHint === 'MATCH_RESULT' && teams) {
      return [
        `${teams.home} vs ${teams.away} football result score`,
        `${teams.home} ${teams.away} resultado placar futebol`,
        `${teams.home} x ${teams.away} resultado hoje`,
      ];
    }

    if (intentHint === 'TODAY_CUP_GAMES') {
      return [
        'FIFA World Cup fixtures today football',
        'Club World Cup matches today football',
        'World Cup football matches today FlashScore',
        'jogos da copa hoje futebol mundial',
      ];
    }

    if (intentHint === 'MATCH_ANALYSIS' && teams) {
      return [
        `${teams.home} vs ${teams.away} odds lineups news statistics`,
        `${teams.home} x ${teams.away} escalações odds notícias estatísticas`,
      ];
    }

    return [cleanOriginal];
  }

  private shouldForceResearch(intentHint: OddixQueryIntentHint, normalized: string): boolean {
    return (
      intentHint === 'MATCH_RESULT' ||
      intentHint === 'TODAY_CUP_GAMES' ||
      intentHint === 'NEWS' ||
      this.hasAny(normalized, ['hoje', 'agora', 'resultado', 'placar', 'copa', 'mundial', 'escalação', 'escalacao'])
    );
  }

  private hasExplicitSeparator(text: string): boolean {
    return [' x ', ' vs ', ' v ', ' versus ', ' contra '].some((separator) => String(text || '').toLowerCase().includes(separator));
  }

  private hasAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(this.normalize(term)));
  }
}
