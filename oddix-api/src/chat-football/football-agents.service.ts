import { Injectable } from '@nestjs/common';
import type { ResearchResult } from './football-research.service';

export type OddixAgentContext = {
  teamName?: string;
  homeTeam?: string;
  awayTeam?: string;
  fixtures?: any[];
  fixture?: any;
  statistics?: any;
  research?: ResearchResult | null;
};

@Injectable()
export class FootballAgentsService {
  buildTeamResearchAgent(context: OddixAgentContext) {
    return `🧠 TeamResearchAgent

Equipe analisada:
${context.teamName || 'Não identificada'}

${this.buildFormAgent(context)}

${this.buildHistoryAgent(context)}

${this.buildNewsSummaryAgent(context)}

${this.buildBettingContextAgent(context)}`;
  }

  buildMatchResearchAgent(context: OddixAgentContext) {
    const home = context.homeTeam || context.fixture?.teams?.home?.name || 'Casa';
    const away = context.awayTeam || context.fixture?.teams?.away?.name || 'Fora';

    return `⚽ MatchResearchAgent

Jogo analisado:
${home} x ${away}

${this.buildH2HAgent(context)}

${this.buildNewsSummaryAgent(context)}

${this.buildStatisticsAgent(context)}

${this.buildPlayerResearchAgent(context)}

${this.buildBettingContextAgent(context)}`;
  }

  buildMatchDiscoveryAgent(context: OddixAgentContext) {
    const home = context.homeTeam || 'Time A';
    const away = context.awayTeam || 'Time B';

    return `🔎 MatchDiscoveryAgent

Procurei por:
${home} x ${away}

📊 Base Oddix:
⚠️ A partida ainda não foi encontrada no FootballService.

${this.buildH2HAgent(context)}

${this.buildNewsSummaryAgent(context)}

⚠️ Status Oddix:
Mesmo encontrando notícias ou contexto externo, não libero entrada oficial sem:
✅ partida na base Oddix
✅ odds reais
✅ estatísticas reais`;
  }

  buildNewsSummaryAgent(context: OddixAgentContext) {
    const research = context.research;

    if (!research) {
      return `📰 NewsSummaryAgent:
⚠️ Pesquisa externa ainda não retornou dados.`;
    }

    if (!research.enabled) {
      return `📰 NewsSummaryAgent:
⚠️ ${research.summary}`;
    }

    if (!research.items?.length) {
      return `📰 NewsSummaryAgent:
⚠️ Nenhuma notícia relevante encontrada agora.`;
    }

    const highlights = research.items
      .slice(0, 5)
      .map((item) => {
        const source = item.source ? ` — ${item.source}` : '';
        const description = item.description ? `\n  ${item.description}` : '';
        return `• ${item.title}${source}${description}`;
      })
      .join('\n\n');

    return `📰 NewsSummaryAgent — contexto encontrado:

${highlights}

📌 Leitura rápida:
As fontes externas ajudam a entender contexto, calendário, agenda, histórico e notícias, mas não substituem dados reais de odds e estatísticas.`;
  }

  buildH2HAgent(context: OddixAgentContext) {
    const home = this.normalize(context.homeTeam || '');
    const away = this.normalize(context.awayTeam || '');
    const fixtures = context.fixtures || [];

    if (!home || !away) {
      return `🤝 H2HAgent:
⚠️ Preciso de dois times para montar histórico direto.`;
    }

    const h2h = fixtures
      .filter((game) => {
        const gameHome = this.normalize(game?.teams?.home?.name);
        const gameAway = this.normalize(game?.teams?.away?.name);

        return (
          (gameHome.includes(home) && gameAway.includes(away)) ||
          (gameHome.includes(away) && gameAway.includes(home))
        );
      })
      .slice(0, 8);

    if (!h2h.length) {
      const externalHint = this.extractH2HFromResearch(context.research);

      return `🤝 H2HAgent:
⚠️ Não encontrei confrontos diretos na base Oddix atual.${externalHint ? `\n\n${externalHint}` : ''}`;
    }

    return `🤝 H2HAgent — confrontos encontrados:

${h2h
  .map((game, index) => {
    const homeName = game?.teams?.home?.name || 'Casa';
    const awayName = game?.teams?.away?.name || 'Fora';
    const score = this.formatScore(game);
    const date = this.formatDate(game?.fixture?.date);
    const status = game?.fixture?.status?.short || 'NS';

    return `${index + 1}️⃣ ${homeName} x ${awayName}
📅 ${date}
📌 Status: ${status}${score ? `\n⚽ Placar: ${score}` : ''}`;
  })
  .join('\n\n')}`;
  }

  buildFormAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const team = this.normalize(context.teamName || '');

    if (!fixtures.length || !team) {
      return `📈 FormAgent:
⚠️ Ainda não encontrei jogos suficientes para medir fase recente.`;
    }

    const finished = fixtures
      .filter((game) => this.isFinished(game))
      .filter((game) => {
        const home = this.normalize(game?.teams?.home?.name);
        const away = this.normalize(game?.teams?.away?.name);
        return home.includes(team) || away.includes(team);
      })
      .slice(-5);

    if (!finished.length) {
      return `📈 FormAgent:
⚠️ Sem jogos finalizados suficientes na base Oddix.`;
    }

    const form = finished.map((game) => this.getTeamResultEmoji(game, team)).join(' ');
    const goals = this.calculateGoalsSummary(finished, team);

    return `📈 FormAgent — fase recente:

Forma:
${form}

Gols nos jogos encontrados:
⚽ Marcados: ${goals.scored}
🛡️ Sofridos: ${goals.conceded}

Leitura:
${this.describeForm(form)}`;
  }

  buildHistoryAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const team = this.normalize(context.teamName || '');

    if (!fixtures.length || !team) {
      return `📊 HistoryAgent:
⚠️ Ainda não encontrei jogos suficientes para montar histórico.`;
    }

    const games = fixtures
      .filter((game) => {
        const home = this.normalize(game?.teams?.home?.name);
        const away = this.normalize(game?.teams?.away?.name);
        return home.includes(team) || away.includes(team);
      })
      .slice(0, 8);

    if (!games.length) {
      return `📊 HistoryAgent:
⚠️ Nenhum jogo recente/próximo encontrado para ${context.teamName}.`;
    }

    return `📊 HistoryAgent — jogos encontrados:

${games
  .map((game, index) => {
    const home = game?.teams?.home?.name || 'Casa';
    const away = game?.teams?.away?.name || 'Fora';
    const score = this.formatScore(game);
    const status = game?.fixture?.status?.short || 'NS';
    const date = this.formatDate(game?.fixture?.date);
    const league = game?.league?.name || 'Liga não informada';

    return `${index + 1}️⃣ ${home} x ${away}
🏆 ${league}
📅 ${date}
📌 Status: ${status}${score ? `\n⚽ Placar: ${score}` : ''}`;
  })
  .join('\n\n')}`;
  }

  buildStatisticsAgent(context: OddixAgentContext) {
    if (!context.statistics) {
      return `📈 StatisticsAgent:
⚠️ Estatísticas reais ainda não validadas.`;
    }

    return `📈 StatisticsAgent:
✅ Estatísticas reais recebidas.

Posso avaliar:
• gols
• ambas marcam
• dupla chance
• escanteios
• player props
• risco da entrada`;
  }

  buildPlayerResearchAgent(context: OddixAgentContext) {
    if (!context.fixture) {
      return `👤 PlayerAgent:
⚠️ Preciso de uma partida válida para buscar jogadores.`;
    }

    return `👤 PlayerAgent:
⚠️ Aguardando escalações/player props reais para esta partida.

Quando disponíveis, posso avaliar:
• chutes no gol
• jogador para marcar
• finalizações
• cartões
• participação ofensiva`;
  }

  buildBettingContextAgent(context: OddixAgentContext) {
    if (!context.statistics) {
      return `🎯 BettingContextAgent:
❌ Nenhuma entrada oficial liberada.

Motivo:
Sem estatísticas reais suficientes.

Caminho seguro:
Aguardar odds reais + estatísticas reais antes de montar bilhete.`;
    }

    return `🎯 BettingContextAgent:
✅ Dados mínimos encontrados.

Mercados que podem ser avaliados:
• Over 1.5 gols
• Dupla chance
• Ambas marcam
• Handicap seguro
• Player props

⚠️ Entrada final depende das odds reais.`;
  }

  private extractH2HFromResearch(research?: ResearchResult | null) {
    if (!research?.items?.length) return '';

    const h2hItem = research.items.find((item) => {
      const text = this.normalize(`${item.title} ${item.description}`);
      return (
        text.includes('historico') ||
        text.includes('confrontos') ||
        text.includes('jogos entre') ||
        text.includes('disputados')
      );
    });

    if (!h2hItem) return '';

    return `🔎 Contexto externo:
${h2hItem.title}
${h2hItem.description || ''}
${h2hItem.source ? `Fonte: ${h2hItem.source}` : ''}`;
  }

  private calculateGoalsSummary(games: any[], team: string) {
    let scored = 0;
    let conceded = 0;

    for (const game of games) {
      const homeName = this.normalize(game?.teams?.home?.name);
      const awayName = this.normalize(game?.teams?.away?.name);
      const homeGoals = Number(game?.goals?.home);
      const awayGoals = Number(game?.goals?.away);

      if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;

      if (homeName.includes(team)) {
        scored += homeGoals;
        conceded += awayGoals;
      }

      if (awayName.includes(team)) {
        scored += awayGoals;
        conceded += homeGoals;
      }
    }

    return { scored, conceded };
  }

  private getTeamResultEmoji(game: any, team: string) {
    const homeName = this.normalize(game?.teams?.home?.name);
    const awayName = this.normalize(game?.teams?.away?.name);

    const homeGoals = Number(game?.goals?.home);
    const awayGoals = Number(game?.goals?.away);

    if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return '➖';

    const isHome = homeName.includes(team);
    const isAway = awayName.includes(team);

    if (!isHome && !isAway) return '➖';

    const teamGoals = isHome ? homeGoals : awayGoals;
    const oppGoals = isHome ? awayGoals : homeGoals;

    if (teamGoals > oppGoals) return '✅';
    if (teamGoals === oppGoals) return '➖';
    return '❌';
  }

  private describeForm(form: string) {
    const wins = (form.match(/✅/g) || []).length;
    const losses = (form.match(/❌/g) || []).length;

    if (wins >= 4) return '🔥 Momento muito forte.';
    if (wins >= 3) return '🟢 Boa fase.';
    if (losses >= 3) return '🔴 Momento instável.';
    return '🟡 Momento equilibrado.';
  }

  private isFinished(game: any) {
    const short = String(game?.fixture?.status?.short || '').toUpperCase();
    return ['FT', 'AET', 'PEN', 'CANC', 'PST'].includes(short);
  }

  private formatScore(game: any) {
    const home = game?.goals?.home;
    const away = game?.goals?.away;

    if (home === null || home === undefined || away === null || away === undefined) return '';

    return `${home} x ${away}`;
  }

  private formatDate(value: any) {
    if (!value) return 'Data não informada';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Data não informada';

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private normalize(value: any) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}