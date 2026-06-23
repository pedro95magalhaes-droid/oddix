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

    if (this.hasAny(text, ['ao vivo', 'live', 'em andamento', 'placar agora', 'quanto ta', 'quanto está'])) {
      return 'LIVE';
    }

    if (this.hasAny(text, ['jogos de hoje', 'partidas de hoje', 'quais jogos', 'copa hoje', 'jogos da copa', 'tem jogo hoje'])) {
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

    if (this.hasAny(text, ['multipla', 'múltipla', 'bilhete', 'combinada'])) {
      return 'MULTIPLE';
    }

    if (this.hasAny(text, ['quanto ganho', 'quanto retorna', 'retorno', 'lucro', 'stake', 'banca', 'gestao', 'gestão'])) {
      return 'BANKROLL';
    }

    if (this.hasAny(text, ['noticia', 'notícias', 'noticias', 'news', 'lesao', 'lesão', 'desfalque'])) {
      return 'NEWS';
    }

    if (this.hasAny(text, ['player props', 'jogador', 'chute', 'finalizacao', 'finalização', 'marca gol'])) {
      return 'PLAYER';
    }

    if (this.hasAny(text, ['value', 'valor de mercado', 'odd justa', 'mercado de valor'])) {
      return 'VALUE_BETS';
    }

    if (text.includes('virtual')) {
      return 'VIRTUAL';
    }

    if (this.looksLikeMatch(text)) {
      return 'MATCH_ANALYSIS';
    }

    if (this.hasAny(text, ['esse jogo', 'essa partida', 'isso', 'vale a pena', 'presta', 'tem entrada', 'e agora', 'continua'])) {
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
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
