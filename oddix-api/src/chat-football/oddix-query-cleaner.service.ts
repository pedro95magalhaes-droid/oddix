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
  private readonly timeZone = process.env.ODDIX_TIMEZONE || 'America/Sao_Paulo';

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

    // Não transformar "copa e mundial" em confronto.
    if (intentHint === 'MATCH_RESULT' || (intentHint === 'MATCH_ANALYSIS' && !this.hasExplicitSeparator(text))) {
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
        const home = this.cleanTeamName(parts[0]);
        const away = this.cleanTeamName(parts.slice(1).join(separator));
        if (this.isValidTeamName(home) && this.isValidTeamName(away)) {
          return { home, away };
        }
      }
    }

    return null;
  }

  cleanTeamName(value: string): string {
    return String(value || '')
      .replace(/\b(the)\b/gi, ' ')
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

    if (this.hasAny(normalized, [
      'jogos da copa',
      'jogo da copa',
      'quais jogos da copa',
      'tem copa',
      'copa hoje',
      'copa do mundo hoje',
      'copa do mundo de clubes',
      'mundial hoje',
      'jogos do mundial',
      'mundial de clubes',
      'world cup today',
      'club world cup',
      'fifa club world cup',
      'fifa world cup',
      'club wc',
      'cwc hoje',
    ])) {
      return 'TODAY_CUP_GAMES';
    }

    if (this.hasAny(normalized, ['jogos de hoje', 'quais jogos', 'analise os jogos', 'mostrar jogos', 'lista jogos', 'listar jogos', 'partidas de hoje'])) {
      return 'TODAY_GAMES';
    }

    if (this.hasAny(normalized, ['ao vivo', 'live', 'em andamento', 'placar agora', 'quanto ta', 'quanto esta'])) return 'LIVE';
    if (this.hasAny(normalized, ['noticia', 'noticias', 'news', 'escalação', 'escalacao', 'desfalque', 'lesao', 'lesão'])) return 'NEWS';
    if (this.hasExplicitSeparator(normalized)) return 'MATCH_ANALYSIS';

    return 'GENERAL';
  }

  private buildResearchQueries(original: string, intentHint: OddixQueryIntentHint, teams: { home: string; away: string } | null): string[] {
    const cleanOriginal = String(original || '').replace(/\s+/g, ' ').trim();
    const todayIso = this.todayIso();
    const todayPt = this.todayHuman(todayIso);
    const englishDate = this.monthDayEnglish(todayIso);
    const year = todayIso.slice(0, 4);

    if (intentHint === 'MATCH_RESULT' && teams) {
      const awayVariants = this.expandTeamVariants(teams.away);
      const homeVariants = this.expandTeamVariants(teams.home);
      const queries: string[] = [];

      for (const home of homeVariants.slice(0, 3)) {
        for (const away of awayVariants.slice(0, 4)) {
          queries.push(`${home} vs ${away} football result score`);
          queries.push(`${home} ${away} resultado placar futebol`);
        }
      }

      queries.push(`site:flashscore.com ${teams.home} ${teams.away}`);
      queries.push(`site:espn.com ${teams.home} ${teams.away} score`);
      queries.push(`site:fifa.com ${teams.home} ${teams.away}`);

      return Array.from(new Set(queries)).slice(0, 12);
    }

    if (intentHint === 'TODAY_CUP_GAMES') {
      return [
        `FIFA Club World Cup fixtures ${todayIso}`,
        `FIFA Club World Cup matches today ${todayIso}`,
        `FIFA Club World Cup ${englishDate} ${year} schedule`,
        `Club World Cup games today ${todayIso}`,
        `Club World Cup live matches today`,
        `FlashScore Club World Cup fixtures ${todayIso}`,
        `SofaScore Club World Cup fixtures ${todayIso}`,
        `ESPN Club World Cup fixtures ${todayIso}`,
        `FIFA World Cup fixtures today ${todayIso}`,
        `World Cup football fixtures ${todayIso}`,
        `jogos Mundial de Clubes hoje ${todayPt}`,
        `jogos da Copa do Mundo hoje ${todayPt}`,
        cleanOriginal,
      ];
    }

    if (intentHint === 'TODAY_GAMES') {
      return [
        `${cleanOriginal} futebol jogos hoje ${todayIso}`,
        `football fixtures today ${todayIso}`,
        `soccer matches today ${todayIso} FlashScore`,
        `jogos de futebol hoje ${todayPt}`,
      ];
    }

    if (intentHint === 'MATCH_ANALYSIS' && teams) {
      return [
        `${teams.home} vs ${teams.away} odds lineups news statistics`,
        `${teams.home} x ${teams.away} escalações odds notícias estatísticas`,
        `${teams.home} ${teams.away} futebol hoje`,
      ];
    }

    return [cleanOriginal];
  }

  private shouldForceResearch(intentHint: OddixQueryIntentHint, normalized: string): boolean {
    return (
      intentHint === 'MATCH_RESULT' ||
      intentHint === 'TODAY_CUP_GAMES' ||
      intentHint === 'TODAY_GAMES' ||
      intentHint === 'LIVE' ||
      intentHint === 'NEWS' ||
      this.hasAny(normalized, ['hoje', 'agora', 'resultado', 'placar', 'copa', 'mundial', 'world cup', 'fifa', 'escalação', 'escalacao'])
    );
  }

  private hasExplicitSeparator(text: string): boolean {
    return [' x ', ' vs ', ' v ', ' versus ', ' contra '].some((separator) => String(text || '').toLowerCase().includes(separator));
  }

  private isValidTeamName(value: string): boolean {
    const normalized = this.normalize(value);
    if (!value || value.length < 2 || value.length > 70) return false;
    return ![
      'jogos',
      'copa',
      'mundial',
      'world cup',
      'club world cup',
      'hoje',
      'fixtures',
      'matches',
      'schedule',
    ].some((bad) => normalized === this.normalize(bad) || normalized.includes(this.normalize(bad)));
  }

  private expandTeamVariants(team: string): string[] {
    const clean = this.cleanTeamName(team);
    const normalized = this.normalize(clean);
    const variants = new Set<string>([clean]);

    const aliasMap: Record<string, string[]> = {
      congo: ['Congo', 'DR Congo', 'Congo DR', 'Democratic Republic of Congo', 'Republic of Congo'],
      'rd congo': ['DR Congo', 'Congo DR', 'Democratic Republic of Congo'],
      'republica democratica do congo': ['DR Congo', 'Congo DR', 'Democratic Republic of Congo'],
      colombia: ['Colombia', 'Colômbia'],
      croacia: ['Croatia', 'Croácia', 'Croacia'],
      panama: ['Panama', 'Panamá'],
      'estados unidos': ['USA', 'United States', 'United States of America'],
      eua: ['USA', 'United States'],
      'coreia do sul': ['South Korea', 'Korea Republic'],
      alemanha: ['Germany', 'Alemanha'],
      japao: ['Japan', 'Japão'],
    };

    for (const [key, values] of Object.entries(aliasMap)) {
      if (normalized === this.normalize(key) || normalized.includes(this.normalize(key))) {
        values.forEach((value) => variants.add(value));
      }
    }

    return Array.from(variants).filter(Boolean);
  }

  private todayIso(timeZone = this.timeZone): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) return new Date().toISOString().slice(0, 10);
    return `${year}-${month}-${day}`;
  }

  private todayHuman(todayIso: string): string {
    const [year, month, day] = todayIso.split('-');
    return `${day}/${month}/${year}`;
  }

  private monthDayEnglish(todayIso: string): string {
    const date = new Date(`${todayIso}T12:00:00Z`);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  private hasAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(this.normalize(term)));
  }
}
