import { Injectable } from '@nestjs/common';

export type OddixIntent =
  | 'GENERAL'
  | 'TODAY_GAMES'
  | 'TOP_PICKS'
  | 'MATCH_ANALYSIS'
  | 'MULTIPLE'
  | 'LIVE'
  | 'NEWS'
  | 'TEAM'
  | 'PLAYER'
  | 'BANKROLL'
  | 'VALUE_BETS'
  | 'VIRTUAL'
  | 'EXPLAIN'
  | 'FOLLOW_UP';

@Injectable()
export class OddixIntentService {
  detect(message: string): OddixIntent {
    const text = this.normalize(message);

    if (this.hasAny(text, ['ao vivo', 'live', 'em andamento', 'placar agora', 'quanto ta', 'quanto esta', 'jogos live'])) {
      return 'LIVE';
    }

    if (this.hasAny(text, [
      'jogos de hoje',
      'partidas de hoje',
      'quais jogos',
      'lista jogos',
      'listar jogos',
      'mostrar jogos',
      'tem jogo hoje',
      'copa hoje',
      'jogos da copa',
      'jogo da copa',
      'jogos do mundial',
      'mundial hoje',
      'mundial de clubes',
      'copa do mundo',
      'copa do mundo de clubes',
      'world cup today',
      'club world cup',
      'fifa club world cup',
      'fifa world cup',
      'club wc',
      'cwc hoje',
    ])) {
      return 'TODAY_GAMES';
    }

    if (
      this.hasAny(text, [
        'top pick',
        'top picks',
        'melhor entrada',
        'melhores entradas',
        'maior confianca',
        'mais confiavel',
        'entrada segura',
        'aposta segura',
        'o que apostar',
        'qual aposta',
        'tem algo bom',
        'me indica',
        'me recomenda',
        'palpite de hoje',
        'palpites de hoje',
      ])
    ) {
      return 'TOP_PICKS';
    }

    if (this.hasAny(text, ['multipla', 'bilhete', 'combinada', 'acumulada'])) {
      return 'MULTIPLE';
    }

    if (this.hasAny(text, ['quanto ganho', 'quanto retorna', 'retorno', 'lucro', 'stake', 'banca', 'gestao', 'gestão'])) {
      return 'BANKROLL';
    }

    if (this.hasAny(text, ['noticia', 'noticias', 'news', 'lesao', 'lesao', 'desfalque', 'escalação', 'escalacao'])) {
      return 'NEWS';
    }

    if (this.hasAny(text, ['player props', 'jogador', 'chute', 'finalizacao', 'marca gol', 'cartao', 'cartão'])) {
      return 'PLAYER';
    }

    if (this.hasAny(text, ['value', 'valor de mercado', 'odd justa', 'mercado de valor', 'odd com valor'])) {
      return 'VALUE_BETS';
    }

    if (text.includes('virtual')) {
      return 'VIRTUAL';
    }

    if (this.looksLikeMatch(text)) {
      return 'MATCH_ANALYSIS';
    }

    if (this.hasAny(text, ['esse jogo', 'essa partida', 'isso', 'vale a pena', 'presta', 'tem entrada', 'e agora', 'continua', 'continue', 'mais detalhes'])) {
      return 'FOLLOW_UP';
    }

    if (this.hasAny(text, ['explica', 'explique', 'por que', 'porque', 'me explica'])) {
      return 'EXPLAIN';
    }

    return 'GENERAL';
  }

  private looksLikeMatch(text: string) {
    return (
      text.includes(' x ') ||
      text.includes(' vs ') ||
      text.includes(' v ') ||
      text.includes(' versus ') ||
      text.includes(' contra ')
    );
  }

  private hasAny(text: string, terms: string[]) {
    return terms.some((term) => text.includes(this.normalize(term)));
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
