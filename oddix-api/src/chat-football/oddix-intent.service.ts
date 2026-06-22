import { Injectable } from '@nestjs/common';

export type OddixIntent =
  | 'GENERAL'
  | 'TOP_PICKS'
  | 'MATCH_ANALYSIS'
  | 'MULTIPLE'
  | 'LIVE'
  | 'NEWS'
  | 'TEAM'
  | 'PLAYER'
  | 'BANKROLL';

@Injectable()
export class OddixIntentService {
  detect(message: string): OddixIntent {
    const text = (message || '').toLowerCase();

    if (
      text.includes('top picks') ||
      text.includes('melhores palpites') ||
      text.includes('maior confiança')
    ) {
      return 'TOP_PICKS';
    }

    if (
      text.includes('múltipla') ||
      text.includes('multipla') ||
      text.includes('bilhete')
    ) {
      return 'MULTIPLE';
    }

    if (
      text.includes('ao vivo') ||
      text.includes('live')
    ) {
      return 'LIVE';
    }

    if (
      text.includes('notícia') ||
      text.includes('noticias') ||
      text.includes('news')
    ) {
      return 'NEWS';
    }

    if (
      text.includes('quanto ganho') ||
      text.includes('retorno') ||
      text.includes('lucro')
    ) {
      return 'BANKROLL';
    }

    if (text.includes(' x ')) {
      return 'MATCH_ANALYSIS';
    }

    return 'GENERAL';
  }
}