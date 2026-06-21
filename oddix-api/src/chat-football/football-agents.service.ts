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
  buildNewsAgent(context: OddixAgentContext) {
    const research = context.research;

    if (!research) {
      return `📰 Notícias:
⚠️ Agente de notícias ainda não retornou dados.`;
    }

    if (!research.enabled) {
      return `📰 Notícias:
⚠️ ${research.summary}`;
    }

    if (!research.items?.length) {
      return `📰 Notícias:
⚠️ Nenhuma notícia relevante encontrada agora.`;
    }

    return `📰 Notícias e contexto:

${research.items
  .slice(0, 5)
  .map(
    (item) =>
      `• ${item.title}${item.source ? `\n  Fonte: ${item.source}` : ''}${
        item.description ? `\n  ${item.description}` : ''
      }`,
  )
  .join('\n\n')}`;
  }

  buildHistoryAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const team = this.normalize(context.teamName || '');

    if (!fixtures.length || !team) {
      return `📊 Histórico:
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
      return `📊 Histórico:
⚠️ Nenhum jogo recente encontrado para ${context.teamName}.`;
    }

    return `📊 Histórico recente:

${games
  .map((game, index) => {
    const home = game?.teams?.home?.name || 'Casa';
    const away = game?.teams?.away?.name || 'Fora';
    const score = this.formatScore(game);
    const status = game?.fixture?.status?.short || 'NS';
    const date = this.formatDate(game?.fixture?.date);

    return `${index + 1}️⃣ ${home} x ${away}
📅 ${date}
📌 Status: ${status}${score ? `\n⚽ Placar: ${score}` : ''}`;
  })
  .join('\n\n')}`;
  }

  buildTeamResearchAgent(context: OddixAgentContext) {
    return `🧠 TeamResearchAgent

Equipe analisada:
${context.teamName || 'Não identificada'}

${this.buildHistoryAgent(context)}

${this.buildNewsAgent(context)}

⚠️ Leitura Oddix:
Notícias ajudam no contexto, mas palpite só é liberado com estatísticas reais + odds reais.`;
  }

  buildMatchResearchAgent(context: OddixAgentContext) {
    const home = context.homeTeam || context.fixture?.teams?.home?.name || 'Casa';
    const away = context.awayTeam || context.fixture?.teams?.away?.name || 'Fora';

    return `⚽ MatchResearchAgent

Jogo:
${home} x ${away}

${this.buildNewsAgent(context)}

${this.buildStatisticsAgent(context)}

${this.buildBettingResearchAgent(context)}`;
  }

  buildStatisticsAgent(context: OddixAgentContext) {
    const stats = context.statistics;

    if (!stats) {
      return `📈 StatisticsAgent:
⚠️ Estatísticas reais ainda não validadas.`;
    }

    return `📈 StatisticsAgent:
✅ Estatísticas recebidas.

Posso avaliar:
• gols
• ambas marcam
• dupla chance
• escanteios
• player props
• risco da entrada`;
  }

  buildPlayerResearchAgent(context: OddixAgentContext) {
    const fixture = context.fixture;

    if (!fixture) {
      return `👤 PlayerResearchAgent:
⚠️ Preciso de uma partida válida para buscar jogadores.`;
    }

    return `👤 PlayerResearchAgent:
⚠️ Aguardando escalações/player props reais para esta partida.

Quando disponíveis, posso avaliar:
• chutes no gol
• jogador para marcar
• finalizações
• cartões
• participação ofensiva`;
  }

  buildBettingResearchAgent(context: OddixAgentContext) {
    const hasStats = !!context.statistics;

    if (!hasStats) {
      return `🎯 BettingResearchAgent:
❌ Nenhuma entrada liberada.

Motivo:
Sem estatísticas reais suficientes.`;
    }

    return `🎯 BettingResearchAgent:
✅ Dados mínimos encontrados.

Próximos mercados para avaliar:
• Over 1.5 gols
• Dupla chance
• Ambas marcam
• Handicap seguro
• Player props

⚠️ Entrada final depende das odds reais.`;
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