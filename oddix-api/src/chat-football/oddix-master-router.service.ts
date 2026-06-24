import { Injectable } from '@nestjs/common';

export type OddixMasterRouteKind =
  | 'GENERAL_CHAT'
  | 'GENERAL_RESEARCH'
  | 'GENERAL_WRITING'
  | 'GENERAL_EXPLANATION'
  | 'GENERAL_CODE'
  | 'GENERAL_MATH'
  | 'GENERAL_CREATIVE'
  | 'GENERAL_BUSINESS'
  | 'GENERAL_PLANNING'
  | 'FOOTBALL_GLOBAL'
  | 'FOOTBALL_TODAY_GAMES'
  | 'FOOTBALL_LIVE'
  | 'FOOTBALL_LINEUP'
  | 'FOOTBALL_ODDS'
  | 'FOOTBALL_STANDINGS'
  | 'FOOTBALL_NEWS'
  | 'FOOTBALL_TEAM'
  | 'FOOTBALL_PLAYER'
  | 'FOOTBALL_MATCH_ANALYSIS'
  | 'BETTING_TOP_PICK'
  | 'BETTING_MULTIPLE'
  | 'BETTING_VALUE';

export type OddixMasterRoute = {
  kind: OddixMasterRouteKind;
  confidence: number;
  reason: string;
  normalizedQuestion: string;
  requiresFootballData: boolean;
  requiresLiveData: boolean;
  preferredProvider: 'flashscore' | 'research' | 'llm' | 'mixed';
  entities: {
    team?: string;
    player?: string;
    homeTeam?: string;
    awayTeam?: string;
    competition?: string;
    market?: string;
  };
};

@Injectable()
export class OddixMasterRouterService {
  classify(message: string, brainDecision?: any, cleanedQuery?: any): OddixMasterRoute {
    const original = String(message || '').trim();
    const text = this.normalize(original);
    const explicitTeams = this.extractTeams(original) || cleanedQuery?.teams || null;
    const brainIntent = String(brainDecision?.intent || '').toUpperCase();

    const base: Omit<OddixMasterRoute, 'kind' | 'confidence' | 'reason' | 'requiresFootballData' | 'requiresLiveData' | 'preferredProvider'> = {
      normalizedQuestion: text,
      entities: {
        ...(explicitTeams ? { homeTeam: explicitTeams.home, awayTeam: explicitTeams.away } : {}),
        team: this.extractKnownTeam(original),
        player: this.extractKnownPlayer(original),
        competition: this.extractCompetition(original),
      },
    };

    const route = (
      kind: OddixMasterRouteKind,
      confidence: number,
      reason: string,
      preferredProvider: OddixMasterRoute['preferredProvider'] = 'mixed',
      requiresLiveData = false,
    ): OddixMasterRoute => ({
      ...base,
      kind,
      confidence,
      reason,
      requiresFootballData: kind.startsWith('FOOTBALL') || kind.startsWith('BETTING'),
      requiresLiveData,
      preferredProvider,
    });

    if (!text) return route('GENERAL_CHAT', 0.99, 'Mensagem vazia ou sem texto útil.', 'llm');

    // V22: detectar intenção geral antes dos gatilhos de futebol.
    // Isso impede que palavras genéricas como "jogo", "copa" ou "agora" puxem o fluxo esportivo
    // quando a pergunta é sobre texto, explicação, código, negócio, planejamento ou criatividade.
    const generalKind = this.classifyGeneralKind(text);
    if (generalKind) {
      return route(generalKind, 0.93, 'Pergunta geral identificada pelo Master Router V22.', this.generalKindNeedsResearch(generalKind, text) ? 'research' : 'llm');
    }

    if (cleanedQuery?.intentHint === 'TODAY_CUP_GAMES') {
      return route('FOOTBALL_TODAY_GAMES', 0.99, 'QueryCleaner identificou jogos de Copa/Mundial hoje.', 'flashscore');
    }

    if (cleanedQuery?.intentHint === 'MATCH_RESULT' && cleanedQuery?.teams) {
      return route('FOOTBALL_MATCH_ANALYSIS', 0.96, 'QueryCleaner identificou confronto/resultado.', 'flashscore', this.hasLiveTerm(text));
    }

    if (this.hasAny(text, ['escalacao', 'escalação', 'provavel escalacao', 'provavel escalação', 'provaveis titulares', 'prováveis titulares', 'time titular', 'titulares', 'lineup', 'lineups', 'starting xi', 'desfalque', 'desfalques'])) {
      return route('FOOTBALL_LINEUP', 0.97, 'Pergunta pede escalação, titulares ou desfalques.', 'flashscore', this.hasLiveTerm(text));
    }

    if (this.hasAny(text, ['odd', 'odds', 'cotacao', 'cotação', 'cotacoes', 'cotações', 'quanto esta pagando', 'quanto tá pagando', 'mercado', 'handicap', 'over', 'under', 'ambas marcam', 'btts'])) {
      return route('FOOTBALL_ODDS', 0.95, 'Pergunta pede odds/cotações/mercados.', 'flashscore', this.hasLiveTerm(text));
    }

    if (this.hasAny(text, ['multipla', 'múltipla', 'bilhete', 'combinada', 'acumulada', 'monta uma aposta', 'montar aposta'])) {
      return route('BETTING_MULTIPLE', 0.94, 'Pedido de múltipla/bilhete.', 'flashscore');
    }

    if (this.hasAny(text, ['melhor entrada', 'top pick', 'pick', 'o que apostar', 'aposta segura', 'entrada de hoje', 'maior confianca', 'maior confiança'])) {
      return route('BETTING_TOP_PICK', 0.93, 'Pedido de melhor entrada/aposta.', 'flashscore', this.hasLiveTerm(text));
    }

    if (this.hasAny(text, ['value bet', 'valor esperado', 'aposta de valor', 'ev positivo', 'odd justa'])) {
      return route('BETTING_VALUE', 0.93, 'Pedido de value bet/EV.', 'flashscore');
    }

    if (this.hasAny(text, ['ao vivo', 'live', 'agora', 'em andamento', 'placar agora', 'jogo rolando'])) {
      return route('FOOTBALL_LIVE', 0.94, 'Pergunta pede jogos ao vivo/placar atual.', 'flashscore', true);
    }

    if (this.hasTodayGamesIntent(text)) {
      return route('FOOTBALL_TODAY_GAMES', 0.95, 'Pergunta pede jogos de hoje.', 'flashscore');
    }

    if (explicitTeams) {
      return route('FOOTBALL_MATCH_ANALYSIS', 0.92, 'Pergunta contém confronto explícito.', 'flashscore', this.hasLiveTerm(text));
    }

    if (this.hasAny(text, ['classificacao', 'classificação', 'tabela', 'standings', 'grupo', 'grupos', 'posição', 'posicao', 'ranking', 'artilharia', 'artilheiro'])) {
      return route('FOOTBALL_STANDINGS', 0.9, 'Pergunta pede tabela/classificação/ranking.', 'research');
    }

    if (this.hasAny(text, ['noticia', 'notícia', 'ultimas', 'últimas', 'lesao', 'lesão', 'machucado', 'convocados', 'convocacao', 'convocação', 'transferencia', 'transferência'])) {
      return route('FOOTBALL_NEWS', 0.88, 'Pergunta pede notícia ou informação atual.', 'research');
    }

    if (brainIntent && brainIntent !== 'GENERAL') {
      if (['TEAM'].includes(brainIntent)) return route('FOOTBALL_TEAM', 0.82, 'Brain classificou como pergunta de time.', 'mixed');
      if (['PLAYER'].includes(brainIntent)) return route('FOOTBALL_PLAYER', 0.82, 'Brain classificou como pergunta de jogador.', 'mixed');
      if (['MATCH_ANALYSIS'].includes(brainIntent)) return route('FOOTBALL_MATCH_ANALYSIS', 0.82, 'Brain classificou como análise de partida.', 'mixed');
      if (['TODAY_GAMES'].includes(brainIntent)) return route('FOOTBALL_TODAY_GAMES', 0.82, 'Brain classificou como jogos de hoje.', 'mixed');
      if (['LIVE'].includes(brainIntent)) return route('FOOTBALL_LIVE', 0.82, 'Brain classificou como live.', 'mixed', true);
      if (['MULTIPLE'].includes(brainIntent)) return route('BETTING_MULTIPLE', 0.82, 'Brain classificou como múltipla.', 'mixed');
      if (['TOP_PICKS'].includes(brainIntent)) return route('BETTING_TOP_PICK', 0.82, 'Brain classificou como top picks.', 'mixed');
    }

    if (this.isFootballish(text)) {
      const knownTeam = this.extractKnownTeam(original);
      if (knownTeam) return route('FOOTBALL_TEAM', 0.78, 'Pergunta menciona time/seleção conhecida.', 'mixed');
      return route('FOOTBALL_GLOBAL', 0.72, 'Pergunta parece ser de futebol, mas sem subtipo específico.', 'mixed');
    }

    if (this.needsCurrentResearch(text)) {
      return route('GENERAL_RESEARCH', 0.66, 'Pergunta geral com possível necessidade de informação atual.', 'research');
    }

    return route('GENERAL_CHAT', 0.86, 'Pergunta geral; não deve forçar cérebro de futebol.', 'llm');
  }

  private classifyGeneralKind(text: string): OddixMasterRouteKind | null {
    const hasFootballTerm = this.isFootballish(text);
    const hasStrongFootballAction = this.hasAny(text, [
      'jogos de hoje', 'jogo de hoje', 'quais jogos', 'quem joga hoje', 'ao vivo', 'placar',
      'escalação', 'escalacao', 'lineup', 'odds', 'odd', 'cotação', 'cotacao', 'aposta',
      'multipla', 'múltipla', 'top pick', 'classificação', 'classificacao', 'tabela',
    ]);

    // Se claramente é uma pergunta de futebol, não rotular como geral.
    if (hasFootballTerm && hasStrongFootballAction) return null;

    if (this.hasAny(text, [
      'crie um texto', 'cria um texto', 'escreva', 'reescreva', 'melhore esse texto', 'corrija esse texto',
      'texto formal', 'mensagem para cliente', 'email', 'e-mail', 'legenda', 'copy', 'roteiro', 'proposta',
      'contrato', 'orçamento', 'orcamento', 'bio para instagram', 'post', 'anuncio', 'anúncio',
    ])) return 'GENERAL_WRITING';

    if (this.hasAny(text, [
      'me explica', 'explique', 'o que é', 'o que e', 'como funciona', 'qual a diferença', 'resuma',
      'passo a passo', 'ensina', 'tutorial', 'defina', 'conceito de',
    ])) return 'GENERAL_EXPLANATION';

    if (this.hasAny(text, [
      'código', 'codigo', 'programa', 'typescript', 'javascript', 'node', 'nest', 'react', 'next',
      'erro ts', 'build', 'git', 'api', 'endpoint', 'função', 'funcao', 'classe', 'sql', 'python',
    ])) return 'GENERAL_CODE';

    if (this.hasAny(text, [
      'calcule', 'quanto é', 'quanto e', 'porcentagem', 'percentual', 'juros', 'regra de três',
      'regra de tres', 'somar', 'dividir', 'multiplicar', 'subtrair',
    ])) return 'GENERAL_MATH';

    if (this.hasAny(text, [
      'ideia', 'ideias', 'criativo', 'criatividade', 'nome para', 'slogan', 'marca', 'logo',
      'campanha', 'conteúdo', 'conteudo', 'brainstorm', 'meme', 'prompt',
    ])) return 'GENERAL_CREATIVE';

    if (this.hasAny(text, [
      'negócio', 'negocio', 'cliente', 'vendas', 'empresa', 'preço', 'preco', 'estratégia', 'estrategia',
      'marketing', 'atendimento', 'prospecção', 'prospeccao', 'orcamento', 'orçamento',
    ])) return 'GENERAL_BUSINESS';

    if (this.hasAny(text, [
      'plano', 'planejamento', 'organize', 'organizar', 'cronograma', 'agenda', 'tarefa',
      'prioridade', 'metas', 'rotina', 'checklist',
    ])) return 'GENERAL_PLANNING';

    return null;
  }

  private generalKindNeedsResearch(kind: OddixMasterRouteKind, text: string) {
    if (kind === 'GENERAL_CODE') return false;
    return this.needsCurrentResearch(text);
  }

  private hasTodayGamesIntent(text: string) {
    return (
      this.hasAny(text, ['jogos de hoje', 'jogo de hoje', 'quais jogos', 'quem joga hoje', 'partidas de hoje', 'calendario de hoje', 'calendário de hoje']) ||
      (this.hasAny(text, ['hoje', 'today']) && this.hasAny(text, ['jogos', 'partidas', 'fixtures', 'matches', 'copa', 'mundial', 'world cup']))
    );
  }

  private isFootballish(text: string) {
    return this.hasAny(text, [
      'futebol', 'football', 'soccer', 'time', 'times', 'seleção', 'selecao', 'jogador', 'jogadores',
      'goleiro', 'atacante', 'meia', 'zagueiro', 'lateral', 'tecnico', 'técnico', 'treinador',
      'gol', 'gols', 'placar', 'partida', 'jogo', 'jogos', 'campeonato', 'liga', 'copa', 'mundial',
      'brasileirao', 'brasileirão', 'libertadores', 'champions', 'premier league', 'la liga', 'serie a',
      'flamengo', 'palmeiras', 'corinthians', 'vasco', 'botafogo', 'fluminense', 'sao paulo', 'são paulo',
      'brasil', 'brazil', 'argentina', 'portugal', 'france', 'franca', 'inglaterra', 'england', 'scotland', 'escocia',
    ]);
  }

  private needsCurrentResearch(text: string) {
    return this.hasAny(text, ['hoje', 'agora', 'atual', 'último', 'ultimo', 'noticia', 'notícia', '2026', 'preço', 'preco', 'cotação', 'cotacao']);
  }

  private hasLiveTerm(text: string) {
    return this.hasAny(text, ['ao vivo', 'live', 'agora', 'em andamento', 'rolando', '1 tempo', '2 tempo', 'intervalo']);
  }

  private extractTeams(message: string): { home: string; away: string } | null {
    const text = String(message || '')
      .replace(/[–—]/g, ' x ')
      .replace(/\bversus\b/gi, ' x ')
      .replace(/\bcontra\b/gi, ' x ')
      .replace(/\bvs\.?\b/gi, ' x ')
      .replace(/\bv\.?\b/gi, ' x ')
      .replace(/\s+/g, ' ')
      .trim();

    const match = text.match(/(.{2,80}?)\s+x\s+(.{2,80})/i);
    if (!match) return null;

    return {
      home: this.cleanEntity(match[1]),
      away: this.cleanEntity(match[2]),
    };
  }

  private extractKnownTeam(message: string) {
    const normalized = this.normalize(message);
    const teams: Record<string, string> = {
      'selecao brasileira': 'Brazil',
      brasil: 'Brazil',
      brazil: 'Brazil',
      argentina: 'Argentina',
      franca: 'France',
      france: 'France',
      espanha: 'Spain',
      spain: 'Spain',
      inglaterra: 'England',
      england: 'England',
      alemanha: 'Germany',
      germany: 'Germany',
      escocia: 'Scotland',
      scotland: 'Scotland',
      suica: 'Switzerland',
      switzerland: 'Switzerland',
      marrocos: 'Morocco',
      morocco: 'Morocco',
      haiti: 'Haiti',
      canada: 'Canada',
      qatar: 'Qatar',
      catar: 'Qatar',
      flamengo: 'Flamengo',
      palmeiras: 'Palmeiras',
      corinthians: 'Corinthians',
      vasco: 'Vasco',
      botafogo: 'Botafogo',
      fluminense: 'Fluminense',
      santos: 'Santos',
      gremio: 'Grêmio',
      grêmio: 'Grêmio',
      internacional: 'Internacional',
      cruzeiro: 'Cruzeiro',
      atletico: 'Atlético',
      atlético: 'Atlético',
      'sao paulo': 'São Paulo',
      'são paulo': 'São Paulo',
    };

    for (const [key, value] of Object.entries(teams).sort((a, b) => b[0].length - a[0].length)) {
      if (normalized.includes(this.normalize(key))) return value;
    }

    return undefined;
  }

  private extractKnownPlayer(message: string) {
    const normalized = this.normalize(message);
    const playerIndicators = ['jogador', 'artilheiro', 'gols de', 'cartoes de', 'cartões de', 'assistencias de', 'assistências de'];
    if (!this.hasAny(normalized, playerIndicators)) return undefined;

    const cleaned = String(message || '')
      .replace(/\b(jogador|artilheiro|gols de|cart[oõ]es de|assist[eê]ncias de|estat[ií]sticas de)\b/gi, ' ')
      .replace(/[?!.:,;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || undefined;
  }

  private extractCompetition(message: string) {
    const normalized = this.normalize(message);
    const competitions: Record<string, string> = {
      'club world cup': 'FIFA Club World Cup',
      'mundial de clubes': 'FIFA Club World Cup',
      'copa do mundo de clubes': 'FIFA Club World Cup',
      'world cup': 'FIFA World Cup',
      'copa do mundo': 'FIFA World Cup',
      copa: 'Copa/Mundial',
      mundial: 'Copa/Mundial',
      brasileirao: 'Brasileirão',
      'brasileirão': 'Brasileirão',
      libertadores: 'Libertadores',
      champions: 'Champions League',
    };

    for (const [key, value] of Object.entries(competitions).sort((a, b) => b[0].length - a[0].length)) {
      if (normalized.includes(this.normalize(key))) return value;
    }

    return undefined;
  }

  private cleanEntity(value: string) {
    return String(value || '')
      .replace(/\b(analisa|analisar|analise|odds|cotacao|cotação|escalação|escalacao|hoje|agora|jogo|partida|do|da|de|o|a|os|as|qual|quais)\b/gi, ' ')
      .replace(/[?!.:,;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasAny(text: string, terms: string[]) {
    const normalized = this.normalize(text);
    return terms.some((term) => normalized.includes(this.normalize(term)));
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
