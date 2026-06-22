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
    return `🧠 TeamResearchAgent V9

Equipe analisada:
${context.teamName || 'Não identificada'}

${this.buildRichContextAgent(context)}

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

    return `⚽ MatchResearchAgent V9

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

    const flags = [
      stats ? '✅ Estatísticas reais' : '⚠️ Estatísticas pendentes',
      this.extractOdds(odds).length ? '✅ Odds reais' : '⚠️ Odds pendentes',
      h2h ? '✅ H2H' : '⚠️ H2H pendente',
      lineups ? '✅ Lineups/escalações' : '⚠️ Lineups pendentes',
      prematchStats?.available ? '✅ Pré-jogo' : '⚠️ Pré-jogo parcial',
    ];

    return `🧠 RichContextAgent V9

${flags.join('\n')}

Leitura:
${stats || odds || h2h || lineups || prematchStats?.available
  ? 'O cérebro recebeu contexto real e pode fazer análise estruturada.'
  : 'Ainda falta contexto real completo; não liberar entrada oficial.'}`;
  }

  buildMatchDiscoveryAgent(context: OddixAgentContext) {
    const home = context.homeTeam || 'Time A';
    const away = context.awayTeam || 'Time B';

    return `🔎 MatchDiscoveryAgent V9

Procurei por:
${home} x ${away}

📊 Base Oddix:
A partida ainda não foi encontrada no FootballService.

${this.buildNewsSummaryAgent(context)}

${this.buildNewsImpactAgent(context)}

Decisão:
Sem partida na base, sem odds e sem estatísticas reais, não existe entrada oficial.`;
  }

  buildNewsSummaryAgent(context: OddixAgentContext) {
    const research = context.research;

    if (!research) {
      return `📰 NewsSummaryAgent:
Pesquisa externa ainda não retornou dados.`;
    }

    if (!research.enabled) {
      return `📰 NewsSummaryAgent:
${research.summary || 'Pesquisa externa desativada.'}`;
    }

    if (!research.items?.length) {
      return `📰 NewsSummaryAgent:
Nenhuma notícia relevante encontrada agora.`;
    }

    const highlights = research.items
      .slice(0, 5)
      .map((item) => `• ${item.title}${item.source ? ` — ${item.source}` : ''}${item.description ? `\n  ${item.description}` : ''}`)
      .join('\n\n');

    return `📰 NewsSummaryAgent:

${highlights}

Leitura:
Notícia ajuda contexto, mas não substitui estatística e odd real.`;
  }

  buildH2HAgent(context: OddixAgentContext) {
    const richH2H = context.h2h || context.richContext?.h2h || context.prematchStats?.h2h;

    if (richH2H?.available) {
      return `🤝 H2HAgent — FlashScore:

Total de jogos: ${richH2H.totalMatches || 0}
Média de gols: ${richH2H.avgGoals ?? '-'}
Over 2.5: ${richH2H.over25Rate ?? '-'}%
BTTS: ${richH2H.bttsRate ?? '-'}%

Leitura:
${Number(richH2H.avgGoals || 0) >= 2.5 ? 'Histórico favorece gols.' : 'Histórico sem explosão clara de gols.'}`;
    }

    const home = this.normalize(context.homeTeam || '');
    const away = this.normalize(context.awayTeam || '');
    const fixtures = context.fixtures || [];

    if (!home || !away) {
      return `🤝 H2HAgent:
Preciso de dois times para montar histórico direto.`;
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
      return `🤝 H2HAgent:
Não encontrei confrontos diretos na base Oddix atual.`;
    }

    return `🤝 H2HAgent:

${h2h
  .map((game, index) => `${index + 1}️⃣ ${game?.teams?.home?.name || 'Casa'} x ${game?.teams?.away?.name || 'Fora'}${this.formatScore(game) ? ` — ${this.formatScore(game)}` : ''}`)
  .join('\n')}`;
  }

  buildTrendAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const home = this.normalize(context.homeTeam || context.teamName || '');
    const away = this.normalize(context.awayTeam || '');

    if (!fixtures.length) {
      return `📊 TrendAgent:
Ainda não tenho jogos suficientes para medir tendência.`;
    }

    const homeTrend = home ? this.calculateTeamTrend(fixtures, home) : null;
    const awayTrend = away ? this.calculateTeamTrend(fixtures, away) : null;

    if (!homeTrend && !awayTrend) {
      return `📊 TrendAgent:
Não encontrei amostra suficiente para tendência recente.`;
    }

    return `📊 TrendAgent:

${homeTrend ? `Mandante/Equipe 1: ${homeTrend.form} | Gols pró ${homeTrend.scored} | contra ${homeTrend.conceded} | média ${homeTrend.avgScored.toFixed(2)}-${homeTrend.avgConceded.toFixed(2)}` : ''}

${awayTrend ? `Visitante/Equipe 2: ${awayTrend.form} | Gols pró ${awayTrend.scored} | contra ${awayTrend.conceded} | média ${awayTrend.avgScored.toFixed(2)}-${awayTrend.avgConceded.toFixed(2)}` : ''}

Leitura:
${this.describeTrend(homeTrend, awayTrend)}`;
  }

  buildMomentumAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);

    return `🔥 MomentumAgent:

Score: ${signal.score}/100
Confiança: ${signal.confidence}%
Risco: ${signal.risk}

${signal.label}

Fatores:
${signal.reasons.map((r) => `• ${r}`).join('\n')}`;
  }

  buildHomeAwayAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const home = this.normalize(context.homeTeam || context.teamName || '');
    const away = this.normalize(context.awayTeam || '');

    if (!fixtures.length) return `🏟️ HomeAwayAgent:\nSem jogos suficientes para medir casa/fora.`;

    const homeStats = home ? this.calculateHomeAwayStats(fixtures, home, 'home') : null;
    const awayStats = away ? this.calculateHomeAwayStats(fixtures, away, 'away') : null;

    if (!homeStats && !awayStats) return `🏟️ HomeAwayAgent:\nAmostra casa/fora insuficiente.`;

    return `🏟️ HomeAwayAgent:

${homeStats ? `Casa: ${homeStats.games} jogos | ${homeStats.wins}V ${homeStats.draws}E ${homeStats.losses}D | gols ${homeStats.scored}-${homeStats.conceded}` : ''}
${awayStats ? `Fora: ${awayStats.games} jogos | ${awayStats.wins}V ${awayStats.draws}E ${awayStats.losses}D | gols ${awayStats.scored}-${awayStats.conceded}` : ''}

Leitura:
${this.describeHomeAway(homeStats, awayStats)}`;
  }

  buildTacticalAgent(context: OddixAgentContext) {
    const text = this.normalize(context.research?.items?.map((item) => `${item.title} ${item.description}`).join(' ') || '');
    const notes: string[] = [];

    if (text.includes('posse')) notes.push('Notícias citam posse/controle.');
    if (text.includes('contra ataque') || text.includes('contraataque')) notes.push('Possível transição/contra-ataque.');
    if (text.includes('pressao') || text.includes('pressão')) notes.push('Indício de pressão ofensiva.');
    if (text.includes('defesa') || text.includes('defensivo')) notes.push('Contexto defensivo citado.');
    if (text.includes('ataque') || text.includes('ofensivo')) notes.push('Força ofensiva citada.');
    if (!notes.length) notes.push('Sem sinal tático forte nas notícias.');

    return `🧠 TacticalAgent:\n${notes.map((n) => `• ${n}`).join('\n')}`;
  }

  buildInjuryAgent(context: OddixAgentContext) {
    const lineups = context.lineups || context.richContext?.lineups;
    const research = context.research;

    const alerts: string[] = [];

    if (lineups?.available) alerts.push('Lineups/escalações recebidas via contexto rico.');

    const text = this.normalize(research?.items?.map((item) => `${item.title} ${item.description}`).join(' ') || '');

    if (text.includes('lesao') || text.includes('lesionado') || text.includes('injury')) alerts.push('Possível lesão citada.');
    if (text.includes('duvida') || text.includes('dúvida')) alerts.push('Possível dúvida para o jogo.');
    if (text.includes('suspenso') || text.includes('suspensao') || text.includes('suspensão')) alerts.push('Possível suspensão citada.');
    if (text.includes('desfalque') || text.includes('fora do jogo')) alerts.push('Possível desfalque citado.');
    if (!alerts.length) alerts.push('Nenhum alerta claro de lesão/suspensão encontrado.');

    return `🏥 InjuryAgent:\n${alerts.map((a) => `• ${a}`).join('\n')}`;
  }

  buildMarketMovementAgent(context: OddixAgentContext) {
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    return `📈 MarketMovementAgent:

${odds.length ? `Odds detectadas: ${odds.map((o) => `${o.name} ${o.value.toFixed(2)}`).join(' | ')}` : 'Odds reais ainda não detectadas.'}

Leitura:
${odds.length ? 'Já existe base para comparar mercado e risco.' : 'Sem odds, não calculo value bet nem libero bilhete.'}`;
  }

  buildHistoryAgent(context: OddixAgentContext) {
    const fixtures = context.fixtures || [];
    const team = this.normalize(context.teamName || context.homeTeam || '');

    if (!fixtures.length || !team) return `📊 HistoryAgent:\nAinda não encontrei jogos suficientes para histórico.`;

    const games = fixtures
      .filter((game) => {
        const home = this.normalize(game?.teams?.home?.name);
        const away = this.normalize(game?.teams?.away?.name);
        return home.includes(team) || away.includes(team);
      })
      .slice(0, 8);

    if (!games.length) return `📊 HistoryAgent:\nNenhum jogo recente/próximo encontrado.`;

    return `📊 HistoryAgent:\n${games.map((game, index) => `${index + 1}️⃣ ${game?.teams?.home?.name || 'Casa'} x ${game?.teams?.away?.name || 'Fora'}${this.formatScore(game) ? ` — ${this.formatScore(game)}` : ''}`).join('\n')}`;
  }

  buildStatisticsAgent(context: OddixAgentContext) {
    const stats = context.statistics || context.richContext?.statistics;
    const prematch = context.prematchStats || context.richContext?.prematchStats;

    if (!stats && !prematch?.available) {
      return `📈 StatisticsAgent:\nEstatísticas reais ainda não validadas.`;
    }

    if (!stats && prematch?.available) {
      return `📈 StatisticsAgent:
Pré-jogo recebido.

Over 2.5 H2H: ${prematch.h2h?.over25Rate ?? '-'}%
BTTS H2H: ${prematch.h2h?.bttsRate ?? '-'}%
Média gols H2H: ${prematch.h2h?.avgGoals ?? '-'}`;
    }

    return `📈 StatisticsAgent:
Estatísticas reais recebidas. Posso avaliar gols, BTTS, dupla chance, escanteios, player props e risco.`;
  }

  buildPlayerPropsAgent(context: OddixAgentContext) {
    const hasFixture = !!context.fixture;
    const hasStats = !!(context.statistics || context.richContext?.statistics);
    const hasLineups = !!(context.lineups || context.richContext?.lineups);

    if (!hasFixture) return `👤 PlayerPropsAgent:\nPreciso de partida válida.`;
    if (!hasStats && !hasLineups) return `👤 PlayerPropsAgent:\nAguardando estatísticas de jogadores e lineups.`;

    return `👤 PlayerPropsAgent:
Base mínima encontrada para avaliar chutes, finalizações, jogador para marcar, cartões e participação ofensiva.`;
  }

  buildValueBetAgent(context: OddixAgentContext) {
    const hasStats = !!(context.statistics || context.richContext?.statistics || context.prematchStats?.available || context.richContext?.prematchStats?.available);
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    if (!hasStats) return `💰 ValueBetAgent:\nSem estatística real suficiente para calcular odd justa.`;
    if (!odds.length) return `💰 ValueBetAgent:\nSem odds reais. Não calculo value bet.`;

    return `💰 ValueBetAgent:
Odds reais encontradas:
${odds.map((odd) => `• ${odd.name}: ${odd.value.toFixed(2)}`).join('\n')}

Próximo passo: comparar odd real x odd justa estimada.`;
  }

  buildPredictionAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);

    if (!this.hasAnyRealContext(context)) {
      return `🔮 PredictionAgent:\nPrevisão bloqueada por falta de dados reais suficientes.`;
    }

    return `🔮 PredictionAgent:

Mercados candidatos:
${(signal.markets.length ? signal.markets : ['Over 1.5 gols', 'Dupla chance']).map((market) => `• ${market}`).join('\n')}

Confiança preliminar: ${signal.confidence}%
Risco: ${signal.risk}`;
  }

  buildRecommendationAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);

    if (!this.hasAnyRealContext(context)) {
      return `🎯 RecommendationAgent:\nNÃO APOSTAR AGORA. Falta dado real suficiente.`;
    }

    if (signal.confidence < 78) {
      return `🎯 RecommendationAgent:\nNÃO APOSTAR. Confiança abaixo do padrão Oddix (${signal.confidence}%).`;
    }

    return `🎯 RecommendationAgent:

Possível entrada em análise:
${signal.markets.map((market) => `• ${market}`).join('\n') || '• Over 1.5 gols'}

Confiança: ${signal.confidence}%
Risco: ${signal.risk}`;
  }

  buildNewsImpactAgent(context: OddixAgentContext) {
    const research = context.research;

    if (!research?.items?.length) return `🗞️ NewsImpactAgent:\nSem notícias suficientes para medir impacto.`;

    const text = this.normalize(research.items.map((item) => `${item.title} ${item.description}`).join(' '));
    const impacts: string[] = [];

    if (text.includes('lesao') || text.includes('injury')) impacts.push('Possível impacto de lesões.');
    if (text.includes('suspenso') || text.includes('suspensao')) impacts.push('Possível suspensão.');
    if (text.includes('treinador') || text.includes('tecnico')) impacts.push('Notícia sobre comando técnico.');
    if (text.includes('odds') || text.includes('palpite')) impacts.push('Mercado citado externamente; usar só como contexto.');
    if (!impacts.length) impacts.push('Notícias sem impacto claro em escalação/mercado.');

    return `🗞️ NewsImpactAgent:\n${impacts.map((i) => `• ${i}`).join('\n')}`;
  }

  buildBettingContextAgent(context: OddixAgentContext) {
    if (!this.hasAnyRealContext(context)) {
      return `🎯 BettingContextAgent:\nNenhuma entrada oficial liberada. Aguardar odds + estatísticas reais.`;
    }

    return `🎯 BettingContextAgent:
Dados mínimos encontrados. Mercados avaliáveis: Over 1.5, dupla chance, BTTS, handicap seguro e player props.`;
  }

  buildConfidenceEngineAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    const agentScores = {
      RichContextAgent: this.hasAnyRealContext(context) ? 78 : 35,
      TrendAgent: context.fixtures?.length ? 70 : 45,
      MomentumAgent: signal.score,
      MarketMovementAgent: odds.length ? 72 : 40,
      StatisticsAgent: context.statistics || context.richContext?.statistics ? 85 : 45,
      ValueBetAgent: odds.length && this.hasAnyRealContext(context) ? 80 : 35,
      NewsImpactAgent: context.research?.items?.length ? 65 : 45,
    };

    const values = Object.values(agentScores);
    const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const finalConfidence = Math.min(95, Math.max(0, Math.round((average + signal.confidence) / 2)));
    const risk: AgentRisk = finalConfidence >= 88 ? 'BAIXO' : finalConfidence >= 78 ? 'MEDIO' : 'ALTO';

    return `🤖 ConfidenceEngineAgent:

${Object.entries(agentScores).map(([name, value]) => `• ${name}: ${value}/100`).join('\n')}

Confiança consolidada: ${finalConfidence}%
Risco consolidado: ${risk}`;
  }

  buildFinalDecisionAgent(context: OddixAgentContext) {
    const signal = this.calculateSignal(context);
    const odds = this.extractOdds(context.odds || context.richContext?.odds || context.fixture);

    if (!this.hasAnyRealContext(context)) {
      return `🤖 FinalDecisionAgent:

Decisão: SEM ENTRADA
Motivo: sem dados reais suficientes.
Confiança: 0%
Risco: ALTO`;
    }

    if (!odds.length) {
      return `🤖 FinalDecisionAgent:

Decisão: AGUARDAR ODDS
Motivo: há contexto, mas odds reais ainda não foram validadas.
Confiança preliminar: ${signal.confidence}%
Risco: ${signal.risk}`;
    }

    if (signal.confidence < 78) {
      return `🤖 FinalDecisionAgent:

Decisão: SEM ENTRADA
Motivo: confiança abaixo do mínimo Oddix.
Confiança: ${signal.confidence}%
Risco: ${signal.risk}`;
    }

    return `🤖 FinalDecisionAgent:

Decisão: ENTRADA CANDIDATA
Mercados:
${signal.markets.map((market) => `• ${market}`).join('\n') || '• Over 1.5 gols'}

Confiança: ${signal.confidence}%
Risco: ${signal.risk}
Status: validar odd final antes de apostar.`;
  }

  private calculateSignal(context: OddixAgentContext): AgentSignal {
    let score = 50;
    const reasons: string[] = [];
    const markets: string[] = [];

    if (context.statistics || context.richContext?.statistics) {
      score += 25;
      reasons.push('Estatísticas reais disponíveis.');
    } else if (context.prematchStats?.available || context.richContext?.prematchStats?.available || context.h2h || context.richContext?.h2h) {
      score += 14;
      reasons.push('Contexto pré-jogo/H2H disponível.');
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
      reasons.push('Amostra de jogos suficiente.');
    } else if (fixtures.length > 0) {
      score += 4;
      reasons.push('Poucos jogos encontrados para contexto.');
    }

    if (context.research?.items?.length) {
      score += 5;
      reasons.push('Notícias/contexto externo encontrados.');
    }

    if (score >= 72) markets.push('Over 1.5 gols');
    if (score >= 80) markets.push('Dupla chance');
    if (score >= 84) markets.push('Ambas marcam');
    if (score >= 88) markets.push('Handicap seguro');

    const confidence = Math.max(0, Math.min(95, score));
    const risk: AgentRisk = confidence >= 88 ? 'BAIXO' : confidence >= 78 ? 'MEDIO' : 'ALTO';
    const label =
      confidence >= 88
        ? 'Cenário forte, mas exige odd real.'
        : confidence >= 78
          ? 'Cenário interessante com cautela.'
          : 'Cenário insuficiente para entrada profissional.';

    return { score, confidence, risk, label, reasons, markets };
  }

  private hasAnyRealContext(context: OddixAgentContext) {
    return !!(
      context.statistics ||
      context.richContext?.statistics ||
      context.prematchStats?.available ||
      context.richContext?.prematchStats?.available ||
      context.h2h ||
      context.richContext?.h2h ||
      this.extractOdds(context.odds || context.richContext?.odds || context.fixture).length
    );
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

    const options = source?.options || source?.odds?.options || source?.odds || [];
    if (!Array.isArray(options)) return [];

    return options
      .map((item: any) => ({
        name: String(item?.name || item?.label || item?.market || 'Odd'),
        value: Number(item?.odd || item?.value || item?.price || 0),
      }))
      .filter((item) => Number.isFinite(item.value) && item.value > 1);
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

    return { games: filtered.length, wins, draws, losses, scored, conceded };
  }

  private describeHomeAway(homeStats: any, awayStats: any) {
    if (!homeStats && !awayStats) return 'Aguardando mais jogos casa/fora.';
    if (homeStats && !awayStats) return homeStats.wins >= homeStats.losses + 2 ? 'Mandante forte em casa.' : 'Mandante sem domínio claro.';
    if (!homeStats && awayStats) return awayStats.wins >= awayStats.losses + 2 ? 'Visitante forte fora.' : 'Visitante sem domínio claro.';
    const homeBalance = homeStats.wins - homeStats.losses;
    const awayBalance = awayStats.wins - awayStats.losses;
    if (homeBalance > awayBalance + 1) return 'Mandante tem vantagem casa/fora.';
    if (awayBalance > homeBalance + 1) return 'Visitante chega forte fora.';
    return 'Casa/fora equilibrado.';
  }

  private describeTrend(homeTrend: any, awayTrend: any) {
    if (!homeTrend && !awayTrend) return 'Aguardando amostra maior.';
    if (homeTrend && !awayTrend) return this.describeForm(homeTrend.form);
    if (!homeTrend && awayTrend) return this.describeForm(awayTrend.form);
    const homeBalance = homeTrend.avgScored - homeTrend.avgConceded;
    const awayBalance = awayTrend.avgScored - awayTrend.avgConceded;
    if (homeBalance > awayBalance + 0.5) return 'Equipe 1 chega com tendência superior.';
    if (awayBalance > homeBalance + 0.5) return 'Equipe 2 chega com tendência superior.';
    return 'Tendência equilibrada.';
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
    if (wins >= 4) return 'Momento muito forte.';
    if (wins >= 3) return 'Boa fase.';
    if (losses >= 3) return 'Momento instável.';
    return 'Momento equilibrado.';
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
