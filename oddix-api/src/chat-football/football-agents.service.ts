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
  richContext?: any;
  h2h?: any;
  odds?: any;
  lineups?: any;
  prematchStats?: any;
};

type AgentRisk = 'BAIXO' | 'MEDIO' | 'ALTO';

type AgentSignal = {
  score: number;
  confidence: number;
  risk: AgentRisk;
  label: string;
  reasons: string[];
  markets: string[];
};

@Injectable()
export class FootballAgentsService {
  buildTeamResearchAgent(context: OddixAgentContext) {
    return `🧠 TeamResearchAgent V7.5

Equipe analisada:
${context.teamName || 'Não identificada'}

${this.buildTrendAgent(context)}

${this.buildMomentumAgent(context)}

${this.buildHomeAwayAgent(context)}

${this.buildTacticalAgent(context)}

${this.buildInjuryAgent(context)}

${this.buildHistoryAgent(context)}

${this.buildNewsSummaryAgent(context)}

${this.buildNewsImpactAgent(context)}

${this.buildConfidenceEngineAgent(context)}

${this.buildBettingContextAgent(context)}

${this.buildFinalDecisionAgent(context)}`;
  }

  buildMatchResearchAgent(context: OddixAgentContext) {
    const home = context.homeTeam || context.fixture?.teams?.home?.name || 'Casa';
    const away = context.awayTeam || context.fixture?.teams?.away?.name || 'Fora';

    return `⚽ MatchResearchAgent V7.5

Jogo analisado:
${home} x ${away}

${this.buildRichContextAgent(context)}

${this.buildH2HAgent(context)}

${this.buildTrendAgent(context)}

${this.buildMomentumAgent(context)}

${this.buildHomeAwayAgent(context)}

${this.buildTacticalAgent(context)}

${this.buildInjuryAgent(context)}

${this.buildMarketMovementAgent(context)}

${this.buildNewsSummaryAgent(context)}

${this.buildNewsImpactAgent(context)}

${this.buildStatisticsAgent(context)}

${this.buildPlayerPropsAgent(context)}

${this.buildValueBetAgent(context)}

${this.buildPredictionAgent(context)}

${this.buildRecommendationAgent(context)}

${this.buildConfidenceEngineAgent(context)}

${this.buildFinalDecisionAgent(context)}`;
  }

  buildRichContextAgent(context: OddixAgentContext) {
    const rich = context.richContext || {};
    const stats = context.statistics || rich.statistics;
    const odds = context.odds || rich.odds;
    const h2h = context.h2h || rich.h2h;
    const lineups = context.lineups || rich.lineups;
    const prematchStats = context.prematchStats || rich.prematchStats;

    const hasStats = !!stats;
    const hasOdds = !!odds;
    const hasH2h = !!h2h;
    const hasLineups = !!lineups;
    const hasPrematch = !!prematchStats;

    return `🧠 RichContextAgent V8.1

FlashScore Rich Context:
${hasStats ? '✅ Estatísticas reais recebidas' : '⚠️ Estatísticas ainda não recebidas'}
${hasOdds ? '✅ Odds reais recebidas' : '⚠️ Odds ainda não recebidas'}
${hasH2h ? '✅ H2H recebido' : '⚠️ H2H ainda não recebido'}
${hasLineups ? '✅ Escalações/lineups recebidas' : '⚠️ Lineups ainda não recebidas'}
${hasPrematch ? '✅ Estatísticas pré-jogo recebidas' : '⚠️ Pré-jogo ainda sem estatísticas'}

Leitura:
${
  hasStats || hasOdds || hasH2h || hasLineups || hasPrematch
    ? '✅ O chat já está recebendo contexto rico para análise.'
    : '⚠️ O contexto rico ainda não chegou completo nos agents.'
}`;
  }

  buildMatchDiscoveryAgent(context: OddixAgentContext) {
    const home = context.homeTeam || 'Time A';
    const away = context.awayTeam || 'Time B';

    return `🔎 MatchDiscoveryAgent V7.5

Procurei por:
${home} x ${away}

📊 Base Oddix:
⚠️ A partida ainda não foi encontrada no FootballService.

${this.buildH2HAgent(context)}

${this.buildNewsSummaryAgent(context)}

${this.buildNewsImpactAgent(context)}

${this.buildMarketMovementAgent(context)}

🎯 Status Oddix:
Mesmo encontrando notícias/contexto externo, não libero entrada oficial sem:

✅ partida na base Oddix
✅ odds reais
✅ estatísticas reais
✅ mercado disponível`;
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
As fontes externas ajudam com contexto, agenda, notícias e histórico público, mas não substituem estatísticas reais e odds reais.`;
  }

  buildH2HAgent(context: OddixAgentContext) {
    const home = this.normalize(context.homeTeam || '');
    const away = this.normalize(context.awayTeam || '');
    const fixtures = context.fixtures || [];
    const richH2H = context.h2h || context.richContext?.h2h || context.prematchStats?.h2h;

    if (richH2H?.available) {
      return `🤝 H2HAgent — FlashScore:
✅ Histórico direto encontrado.

Total de jogos: ${richH2H.totalMatches || 0}
Média de gols: ${richH2H.avgGoals ?? '-'}
Over 2.5: ${richH2H.over25Rate ?? '-'}%
BTTS: ${richH2H.bttsRate ?? '-'}%

Leitura:
${Number(richH2H.avgGoals || 0) >= 2.5 ? '🔥 Histórico com tendência de gols.' : '🟡 Histórico sem explosão clara de gols.'}`;
    }

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

  buildTrendAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const home = this.normalize(context.homeTeam || context.teamName || '');
    const away = this.normalize(context.awayTeam || '');

    if (!fixtures.length) {
      return `📊 TrendAgent:
⚠️ Ainda não tenho jogos suficientes para medir tendência.`;
    }

    const homeTrend = home ? this.calculateTeamTrend(fixtures, home) : null;
    const awayTrend = away ? this.calculateTeamTrend(fixtures, away) : null;

    if (!homeTrend && !awayTrend) {
      return `📊 TrendAgent:
⚠️ Não encontrei amostra suficiente para tendência recente.`;
    }

    const homeText = homeTrend
      ? `Casa/Equipe 1:
Forma: ${homeTrend.form}
⚽ Gols marcados: ${homeTrend.scored}
🛡️ Gols sofridos: ${homeTrend.conceded}
📈 Média gols pró: ${homeTrend.avgScored.toFixed(2)}
📉 Média gols contra: ${homeTrend.avgConceded.toFixed(2)}`
      : '';

    const awayText = awayTrend
      ? `Fora/Equipe 2:
Forma: ${awayTrend.form}
⚽ Gols marcados: ${awayTrend.scored}
🛡️ Gols sofridos: ${awayTrend.conceded}
📈 Média gols pró: ${awayTrend.avgScored.toFixed(2)}
📉 Média gols contra: ${awayTrend.avgConceded.toFixed(2)}`
      : '';

    return `📊 TrendAgent — tendências recentes:

${homeText}

${awayText}

Leitura:
${this.describeTrend(homeTrend, awayTrend)}`;
  }

  buildMomentumAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);

    return `🔥 MomentumAgent:

Pontuação de momento:
${signal.score}/100

Confiança:
${signal.confidence}%

Risco:
${signal.risk}

Leitura:
${signal.label}

Fatores:
${signal.reasons.length ? signal.reasons.map((r) => `• ${r}`).join('\n') : '• Aguardando mais dados reais.'}`;
  }

  buildHomeAwayAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const home = this.normalize(context.homeTeam || context.teamName || '');
    const away = this.normalize(context.awayTeam || '');

    if (!fixtures.length) {
      return `🏟️ HomeAwayAgent:
⚠️ Sem jogos suficientes para medir casa/fora.`;
    }

    const homeStats = home ? this.calculateHomeAwayStats(fixtures, home, 'home') : null;
    const awayStats = away ? this.calculateHomeAwayStats(fixtures, away, 'away') : null;

    if (!homeStats && !awayStats) {
      return `🏟️ HomeAwayAgent:
⚠️ Não encontrei amostra casa/fora suficiente.`;
    }

    const homeBlock = homeStats
      ? `🏠 Equipe 1 em casa:
Jogos: ${homeStats.games}
Vitórias: ${homeStats.wins}
Empates: ${homeStats.draws}
Derrotas: ${homeStats.losses}
Gols pró: ${homeStats.scored}
Gols contra: ${homeStats.conceded}`
      : '';

    const awayBlock = awayStats
      ? `🛫 Equipe 2 fora:
Jogos: ${awayStats.games}
Vitórias: ${awayStats.wins}
Empates: ${awayStats.draws}
Derrotas: ${awayStats.losses}
Gols pró: ${awayStats.scored}
Gols contra: ${awayStats.conceded}`
      : '';

    return `🏟️ HomeAwayAgent:

${homeBlock}

${awayBlock}

Leitura:
${this.describeHomeAway(homeStats, awayStats)}`;
  }

  buildTacticalAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);
    const text = this.normalize(
      context.research?.items?.map((item) => `${item.title} ${item.description}`).join(' ') || '',
    );

    const tacticalNotes: string[] = [];

    if (text.includes('posse')) tacticalNotes.push('🔵 Notícias citam posse/controle de jogo.');
    if (text.includes('contra ataque') || text.includes('contraataque')) {
      tacticalNotes.push('⚡ Possível jogo de transição/contra-ataque.');
    }
    if (text.includes('pressao') || text.includes('pressão')) {
      tacticalNotes.push('🔥 Indício de pressão ofensiva no contexto externo.');
    }
    if (text.includes('defesa') || text.includes('defensivo')) {
      tacticalNotes.push('🛡️ Contexto menciona organização defensiva.');
    }
    if (text.includes('ataque') || text.includes('ofensivo')) {
      tacticalNotes.push('🎯 Contexto menciona força ofensiva.');
    }

    if (!tacticalNotes.length) {
      tacticalNotes.push('🟡 Sem sinais táticos claros nas notícias.');
    }

    return `🧠 TacticalAgent:

Leitura tática preliminar:
${tacticalNotes.map((item) => `• ${item}`).join('\n')}

Score tático:
${signal.score}/100

⚠️ Tática estimada por contexto externo e dados disponíveis; precisa de estatísticas reais para virar entrada.`;
  }

  buildInjuryAgent(context: OddixAgentContext) {
    const research = context.research;

    if (!research?.items?.length) {
      return `🏥 InjuryAgent:
⚠️ Sem notícias suficientes para verificar lesões/suspensões.`;
    }

    const text = this.normalize(
      research.items.map((item) => `${item.title} ${item.description}`).join(' '),
    );

    const alerts: string[] = [];

    if (text.includes('lesao') || text.includes('lesionado') || text.includes('injury')) {
      alerts.push('🚑 Possível lesão citada no contexto externo.');
    }

    if (text.includes('duvida') || text.includes('dúvida')) {
      alerts.push('❓ Jogador/equipe pode ter dúvida para o jogo.');
    }

    if (text.includes('suspenso') || text.includes('suspensao') || text.includes('suspensão')) {
      alerts.push('🟥 Possível suspensão citada.');
    }

    if (text.includes('desfalque') || text.includes('fora do jogo')) {
      alerts.push('⚠️ Possível desfalque citado.');
    }

    if (text.includes('retorna') || text.includes('volta')) {
      alerts.push('✅ Possível retorno de jogador citado.');
    }

    if (!alerts.length) {
      alerts.push('🟢 Nenhum alerta claro de lesão/suspensão encontrado nas fontes externas.');
    }

    return `🏥 InjuryAgent:

${alerts.map((item) => `• ${item}`).join('\n')}

⚠️ Lesões/desfalques precisam ser confirmados por fonte oficial antes de afetar entrada.`;
  }

  buildMarketMovementAgent(context: OddixAgentContext) {
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);
    const researchText = this.normalize(
      context.research?.items?.map((item) => `${item.title} ${item.description}`).join(' ') || '',
    );

    const notes: string[] = [];

    if (odds.length) {
      notes.push(
        `✅ Odds reais detectadas: ${odds
          .map((o) => `${o.name} ${o.value.toFixed(2)}`)
          .join(' | ')}`,
      );
    } else {
      notes.push('⚠️ Odds reais ainda não detectadas na base Oddix.');
    }

    if (researchText.includes('odds')) {
      notes.push('💰 Fontes externas citam odds/palpites — usar apenas como contexto.');
    }

    if (researchText.includes('mercado')) {
      notes.push('📈 Contexto externo menciona mercado de apostas.');
    }

    if (researchText.includes('caiu') || researchText.includes('queda')) {
      notes.push('📉 Possível queda de odd citada externamente.');
    }

    if (researchText.includes('subiu') || researchText.includes('alta')) {
      notes.push('📈 Possível alta de odd citada externamente.');
    }

    return `📈 MarketMovementAgent:

${notes.map((item) => `• ${item}`).join('\n')}

⚠️ Para confirmar movimento real, preciso de odds históricas ou snapshot de mercado.`;
  }

  buildHistoryAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const team = this.normalize(context.teamName || context.homeTeam || '');

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
⚠️ Nenhum jogo recente/próximo encontrado.`;
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
    const stats = context.statistics || context.richContext?.statistics;
    const prematch = context.prematchStats || context.richContext?.prematchStats;

    if (!stats && !prematch?.available) {
      return `📈 StatisticsAgent:
⚠️ Estatísticas reais ainda não validadas.`;
    }

    if (!stats && prematch?.available) {
      return `📈 StatisticsAgent:
🟡 Estatística pré-jogo recebida via FlashScore H2H/odds.

Over 2.5 H2H: ${prematch.h2h?.over25Rate ?? '-'}%
BTTS H2H: ${prematch.h2h?.bttsRate ?? '-'}%
Média gols H2H: ${prematch.h2h?.avgGoals ?? '-'}

⚠️ Ainda considero parcial: serve para leitura, mas não substitui estatística live/completa.`;
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

  buildPlayerPropsAgent(context: OddixAgentContext) {
    const hasFixture = !!context.fixture;
    const hasStats = !!context.statistics;

    if (!hasFixture) {
      return `👤 PlayerPropsAgent:
⚠️ Preciso de uma partida válida para analisar jogadores.`;
    }

    if (!hasStats) {
      return `👤 PlayerPropsAgent:
⚠️ Aguardando escalações, estatísticas e player props reais.

Quando disponíveis, posso avaliar:
• chutes no gol
• finalizações
• jogador para marcar
• cartões
• participação ofensiva`;
    }

    return `👤 PlayerPropsAgent:
✅ Base estatística mínima encontrada.

Mercados que podem ser avaliados:
• 1+ chute no gol
• 2+ finalizações
• jogador para marcar
• cartões
• participação ofensiva

⚠️ Ainda preciso validar odds reais antes de liberar entrada oficial.`;
  }

  buildValueBetAgent(context: OddixAgentContext) {
    const hasStats = !!context.statistics;
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    if (!hasStats) {
      return `💰 ValueBetAgent:
❌ Sem cálculo de valor.

Motivo:
Ainda não existem estatísticas reais suficientes para calcular odd justa.`;
    }

    if (!odds.length) {
      return `💰 ValueBetAgent:
⚠️ Estatísticas existem, mas odds reais ainda não foram localizadas.

Sem odd real:
❌ não calculo value bet
❌ não libero bilhete`;
    }

    return `💰 ValueBetAgent:
✅ Odds reais encontradas.

Odds detectadas:
${odds.map((odd) => `• ${odd.name}: ${odd.value.toFixed(2)}`).join('\n')}

Próximo passo:
Comparar odd real x odd justa estimada pela IA.`;
  }

  buildPredictionAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);

    if (!context.statistics && !context.prematchStats?.available && !context.richContext?.prematchStats?.available) {
      return `🔮 PredictionAgent:
⚠️ Previsão bloqueada.

Motivo:
Sem estatísticas reais suficientes.

Mercados que poderei prever quando liberar:
• Over 1.5
• Over 2.5
• Ambas marcam
• Dupla chance
• Handicap seguro`;
    }

    const markets = signal.markets.length ? signal.markets : ['Over 1.5 gols', 'Dupla chance'];

    return `🔮 PredictionAgent:
✅ Dados mínimos encontrados.

Mercados prováveis para análise:
${markets.map((market) => `• ${market}`).join('\n')}

Confiança preliminar:
${signal.confidence}%

Risco:
${signal.risk}`;
  }

  buildRecommendationAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);

    if (!context.statistics && !context.prematchStats?.available && !context.richContext?.prematchStats?.available) {
      return `🎯 RecommendationAgent:
❌ NÃO APOSTAR AGORA.

Motivo:
Sem estatísticas reais suficientes.

Status:
AGUARDAR DADOS.`;
    }

    if (signal.confidence < 80) {
      return `🎯 RecommendationAgent:
❌ NÃO APOSTAR.

Motivo:
Confiança abaixo do padrão Oddix.

Confiança:
${signal.confidence}%`;
    }

    return `🎯 RecommendationAgent:
✅ POSSÍVEL ENTRADA EM ANÁLISE.

Mercados candidatos:
${signal.markets.map((market) => `• ${market}`).join('\n')}

Confiança:
${signal.confidence}%

Risco:
${signal.risk}

⚠️ Entrada final depende das odds reais.`;
  }

  buildNewsImpactAgent(context: OddixAgentContext) {
    const research = context.research;

    if (!research?.items?.length) {
      return `🗞️ NewsImpactAgent:
⚠️ Sem notícias suficientes para medir impacto externo.`;
    }

    const text = this.normalize(
      research.items.map((item) => `${item.title} ${item.description}`).join(' '),
    );

    const impacts: string[] = [];

    if (text.includes('lesao') || text.includes('lesionado') || text.includes('injury')) {
      impacts.push('🚑 Possível impacto de lesões citado nas notícias.');
    }

    if (text.includes('suspenso') || text.includes('suspensao') || text.includes('suspensão')) {
      impacts.push('🟥 Possível suspensão citada nas notícias.');
    }

    if (text.includes('convocacao') || text.includes('convocação') || text.includes('convocado')) {
      impacts.push('📋 Notícias citam convocação/elenco.');
    }

    if (text.includes('treinador') || text.includes('tecnico') || text.includes('técnico')) {
      impacts.push('🧠 Notícias citam treinador/comando técnico.');
    }

    if (text.includes('odds') || text.includes('palpite') || text.includes('apostas')) {
      impacts.push('💰 Notícias citam odds/palpites externos — usar apenas como contexto.');
    }

    if (!impacts.length) {
      impacts.push('🟡 Notícias encontradas, mas sem impacto claro em lesões, suspensões ou escalação.');
    }

    return `🗞️ NewsImpactAgent:

${impacts.map((item) => `• ${item}`).join('\n')}

⚠️ Impacto noticioso não libera entrada sozinho.`;
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

  buildConfidenceEngineAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    const agentScores = {
      TrendAgent: context.fixtures?.length ? 70 : 45,
      MomentumAgent: signal.score,
      HomeAwayAgent: context.fixtures?.length ? 68 : 42,
      TacticalAgent: context.research?.items?.length ? 65 : 45,
      InjuryAgent: context.research?.items?.length ? 60 : 45,
      MarketMovementAgent: odds.length ? 72 : 40,
      StatisticsAgent: context.statistics ? 85 : 35,
      ValueBetAgent: context.statistics && odds.length ? 82 : 35,
      NewsImpactAgent: context.research?.items?.length ? 65 : 45,
    };

    const values = Object.values(agentScores);
    const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const finalConfidence = Math.min(95, Math.max(0, Math.round((average + signal.confidence) / 2)));

    const risk: AgentRisk =
      finalConfidence >= 88 ? 'BAIXO' : finalConfidence >= 78 ? 'MEDIO' : 'ALTO';

    return `🤖 ConfidenceEngineAgent:

Scores dos agentes:
${Object.entries(agentScores)
  .map(([name, value]) => `• ${name}: ${value}/100`)
  .join('\n')}

Confiança consolidada:
${finalConfidence}%

Risco consolidado:
${risk}

Leitura:
${
  finalConfidence >= 88
    ? '🔥 Cenário forte, mas ainda exige odds reais.'
    : finalConfidence >= 78
      ? '🟡 Cenário interessante, mas exige cautela.'
      : '🔴 Cenário insuficiente para entrada profissional.'
}`;
  }

  buildFinalDecisionAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    if (!context.statistics && !context.prematchStats?.available && !context.richContext?.prematchStats?.available) {
      return `🤖 FinalDecisionAgent:

Decisão:
❌ SEM ENTRADA

Motivo:
Sem estatísticas reais suficientes.

Status:
AGUARDANDO DADOS REAIS

Confiança:
0%

Risco:
ALTO`;
    }

    if (!odds.length) {
      return `🤖 FinalDecisionAgent:

Decisão:
⚠️ AGUARDAR ODDS

Motivo:
Estatísticas encontradas, mas odds reais ainda não foram validadas.

Confiança preliminar:
${signal.confidence}%

Risco:
${signal.risk}`;
    }

    if (signal.confidence < 80) {
      return `🤖 FinalDecisionAgent:

Decisão:
❌ SEM ENTRADA

Motivo:
Confiança abaixo do mínimo profissional Oddix.

Confiança:
${signal.confidence}%

Risco:
${signal.risk}`;
    }

    return `🤖 FinalDecisionAgent:

Decisão:
✅ ENTRADA CANDIDATA

Melhores mercados:
${signal.markets.map((market) => `• ${market}`).join('\n')}

Confiança:
${signal.confidence}%

Risco:
${signal.risk}

Status:
AGUARDANDO VALIDAÇÃO FINAL DAS ODDS`;
  }

  private calculateSignal(context: OddixAgentContext): AgentSignal {
    let score = 50;
    const reasons: string[] = [];
    const markets: string[] = [];

    if (context.statistics || context.richContext?.statistics || context.prematchStats?.available || context.richContext?.prematchStats?.available) {
      score += context.statistics || context.richContext?.statistics ? 25 : 14;
      reasons.push('Estatísticas reais disponíveis.');
    } else {
      reasons.push('Estatísticas reais ainda não validadas.');
    }

    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    if (odds.length) {
      score += 10;
      reasons.push('Odds reais detectadas.');
    } else {
      reasons.push('Odds reais ainda não detectadas.');
    }

    const fixtures = context.fixtures || [];

    if (fixtures.length >= 5) {
      score += 8;
      reasons.push('Amostra de jogos suficiente para leitura inicial.');
    } else if (fixtures.length > 0) {
      score += 4;
      reasons.push('Poucos jogos encontrados para contexto.');
    }

    if (context.research?.items?.length) {
      score += 5;
      reasons.push('Notícias/contexto externo encontrados.');
    }

    if (score >= 75) markets.push('Over 1.5 gols');
    if (score >= 82) markets.push('Dupla chance');
    if (score >= 86) markets.push('Ambas marcam');
    if (score >= 90) markets.push('Handicap seguro');

    const confidence = Math.max(0, Math.min(95, score));
    const risk: AgentRisk = confidence >= 88 ? 'BAIXO' : confidence >= 78 ? 'MEDIO' : 'ALTO';

    const label =
      confidence >= 88
        ? '🔥 Cenário forte, mas ainda depende de odds reais.'
        : confidence >= 78
          ? '🟡 Cenário interessante, porém exige cautela.'
          : '🔴 Cenário insuficiente para entrada profissional.';

    return {
      score,
      confidence,
      risk,
      label,
      reasons,
      markets,
    };
  }

  private extractOdds(input: any): { name: string; value: number }[] {
    const source = input?.odds?.available ? input.odds : input?.richContext?.odds?.available ? input.richContext.odds : input;

    if (source?.available && (source.home || source.draw || source.away)) {
      return [
        { name: '1', value: Number(source.home || 0) },
        { name: 'X', value: Number(source.draw || 0) },
        { name: '2', value: Number(source.away || 0) },
      ].filter((item) => Number.isFinite(item.value) && item.value > 1);
    }

    const options = source?.odds?.options || source?.options || source?.odds || [];

    if (!Array.isArray(options)) return [];

    return options
      .map((item: any) => ({
        name: String(item?.name || item?.label || item?.market || 'Odd'),
        value: Number(item?.odd || item?.value || item?.price || 0),
      }))
      .filter((item) => Number.isFinite(item.value) && item.value > 1);
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

  private calculateTeamTrend(games: any[], team: string) {
    const finished = games
      .filter((game) => this.isFinished(game))
      .filter((game) => {
        const home = this.normalize(game?.teams?.home?.name);
        const away = this.normalize(game?.teams?.away?.name);
        return home.includes(team) || away.includes(team);
      })
      .slice(-5);

    if (!finished.length) return null;

    const form = finished.map((game) => this.getTeamResultEmoji(game, team)).join(' ');
    const goals = this.calculateGoalsSummary(finished, team);

    return {
      games: finished.length,
      form,
      scored: goals.scored,
      conceded: goals.conceded,
      avgScored: goals.scored / finished.length,
      avgConceded: goals.conceded / finished.length,
    };
  }

  private calculateHomeAwayStats(games: any[], team: string, mode: 'home' | 'away') {
    const filtered = games
      .filter((game) => this.isFinished(game))
      .filter((game) => {
        const home = this.normalize(game?.teams?.home?.name);
        const away = this.normalize(game?.teams?.away?.name);

        return mode === 'home' ? home.includes(team) : away.includes(team);
      })
      .slice(-10);

    if (!filtered.length) return null;

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let scored = 0;
    let conceded = 0;

    for (const game of filtered) {
      const homeGoals = Number(game?.goals?.home);
      const awayGoals = Number(game?.goals?.away);

      if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;

      const teamGoals = mode === 'home' ? homeGoals : awayGoals;
      const oppGoals = mode === 'home' ? awayGoals : homeGoals;

      scored += teamGoals;
      conceded += oppGoals;

      if (teamGoals > oppGoals) wins += 1;
      else if (teamGoals === oppGoals) draws += 1;
      else losses += 1;
    }

    return {
      games: filtered.length,
      wins,
      draws,
      losses,
      scored,
      conceded,
    };
  }

  private describeHomeAway(homeStats: any, awayStats: any) {
    if (!homeStats && !awayStats) return 'Aguardando mais jogos casa/fora.';

    if (homeStats && !awayStats) {
      if (homeStats.wins >= homeStats.losses + 2) return '🏠 Equipe 1 mostra força como mandante.';
      return '🟡 Mandante sem domínio claro na amostra.';
    }

    if (!homeStats && awayStats) {
      if (awayStats.wins >= awayStats.losses + 2) return '🛫 Equipe 2 tem bom comportamento fora.';
      return '🟡 Visitante sem domínio claro fora.';
    }

    const homeBalance = homeStats.wins - homeStats.losses;
    const awayBalance = awayStats.wins - awayStats.losses;

    if (homeBalance > awayBalance + 1) return '🏠 Mandante tem vantagem casa/fora.';
    if (awayBalance > homeBalance + 1) return '🛫 Visitante chega forte fora.';
    return '🟡 Casa/fora equilibrado.';
  }

  private describeTrend(homeTrend: any, awayTrend: any) {
    if (!homeTrend && !awayTrend) return 'Aguardando amostra maior.';

    if (homeTrend && !awayTrend) return this.describeForm(homeTrend.form);
    if (!homeTrend && awayTrend) return this.describeForm(awayTrend.form);

    const homeBalance = homeTrend.avgScored - homeTrend.avgConceded;
    const awayBalance = awayTrend.avgScored - awayTrend.avgConceded;

    if (homeBalance > awayBalance + 0.5) return '🟢 Equipe 1 chega com tendência superior.';
    if (awayBalance > homeBalance + 0.5) return '🟢 Equipe 2 chega com tendência superior.';
    return '🟡 Tendência equilibrada entre os lados.';
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