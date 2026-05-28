import { Injectable } from '@nestjs/common';

@Injectable()
export class MarketsService {
  getCatalog() {
    return [
      {
        category: 'Mercados Principais',
        markets: [
          {
            key: 'resultado_final',
            name: 'Resultado Final',
            description: 'Vitória casa, empate ou vitória visitante.',
            examples: ['Casa vence', 'Empate', 'Visitante vence'],
          },
          {
            key: 'dupla_chance',
            name: 'Dupla Chance',
            description: 'Dois resultados protegidos.',
            examples: ['Casa ou empate', 'Visitante ou empate', 'Casa ou visitante'],
          },
          {
            key: 'empate_anula',
            name: 'Empate Anula Aposta',
            description: 'Se empatar, aposta é anulada.',
            examples: ['Casa DNB', 'Visitante DNB'],
          },
        ],
      },
      {
        category: 'Gols e Placar',
        markets: [
          {
            key: 'total_gols',
            name: 'Total de Gols',
            description: 'Mais ou menos gols na partida.',
            examples: ['Over 1.5 gols', 'Over 2.5 gols', 'Under 3.5 gols'],
          },
          {
            key: 'ambas_marcam',
            name: 'Ambas Marcam',
            description: 'Se os dois times fazem gol.',
            examples: ['Ambas marcam: Sim', 'Ambas marcam: Não'],
          },
          {
            key: 'placar_correto',
            name: 'Placar Correto',
            description: 'Resultado exato da partida.',
            examples: ['1x0', '1x1', '2x1', '2x2'],
          },
        ],
      },
      {
        category: 'Handicap',
        markets: [
          {
            key: 'handicap_asiatico',
            name: 'Handicap Asiático',
            description: 'Vantagem ou desvantagem virtual de gols.',
            examples: ['Casa -0.25', 'Visitante +0.5', 'Casa -1.0'],
          },
          {
            key: 'handicap_europeu',
            name: 'Handicap Europeu',
            description: 'Handicap com possibilidade de empate no mercado.',
            examples: ['Casa -1', 'Empate handicap', 'Visitante +1'],
          },
        ],
      },
      {
        category: 'Estatísticas e Eventos',
        markets: [
          {
            key: 'escanteios',
            name: 'Escanteios',
            description: 'Total de cantos ou time com mais escanteios.',
            examples: ['Over 8.5 escanteios', 'Casa mais escanteios', 'Under 10.5 escanteios'],
          },
          {
            key: 'cartoes',
            name: 'Cartões',
            description: 'Total de cartões ou cartões por equipe/jogador.',
            examples: ['Over 3.5 cartões', 'Casa over 1.5 cartões', 'Jogador recebe cartão'],
          },
          {
            key: 'chutes',
            name: 'Chutes',
            description: 'Total de finalizações na partida.',
            examples: ['Over 21.5 chutes', 'Casa over 10.5 chutes'],
          },
          {
            key: 'chutes_no_gol',
            name: 'Chutes no Gol',
            description: 'Finalizações certas no alvo.',
            examples: ['Over 7.5 chutes no gol', 'Casa over 4.5 chutes no gol'],
          },
          {
            key: 'primeiro_tempo',
            name: 'Primeiro Tempo',
            description: 'Mercados apenas do primeiro tempo.',
            examples: ['Over 0.5 gols HT', 'Over 3.5 chutes HT', 'Empate HT'],
          },
          {
            key: 'jogadores',
            name: 'Jogadores',
            description: 'Gol, assistência, chute ou cartão de atleta.',
            examples: ['Jogador chuta no gol', 'Jogador marca gol', 'Jogador recebe cartão'],
          },
        ],
      },
      {
        category: 'Formatos de Aposta',
        markets: [
          {
            key: 'aposta_simples',
            name: 'Aposta Simples',
            description: 'Um palpite em um evento.',
            examples: ['Over 2.5 gols'],
          },
          {
            key: 'multipla',
            name: 'Aposta Múltipla',
            description: 'Combinação de palpites.',
            examples: ['Casa vence + Over 1.5 gols'],
          },
          {
            key: 'bet_builder',
            name: 'Bet Builder',
            description: 'Combinar mercados do mesmo jogo.',
            examples: ['Casa vence + Over 1.5 gols + Over 7.5 escanteios'],
          },
          {
            key: 'ao_vivo',
            name: 'Apostas ao Vivo',
            description: 'Mercados durante o jogo.',
            examples: ['Próximo gol', 'Over live', 'Escanteio nos próximos 10 minutos'],
          },
        ],
      },
    ];
  }

  getFlatMarkets() {
    return this.getCatalog().flatMap((category) =>
      category.markets.map((market) => ({
        category: category.category,
        ...market,
      })),
    );
  }
}