import { Injectable } from "@nestjs/common";
import type {
  VirtualAnalyzedMatch,
  VirtualMarketPick,
  VirtualOdds,
  VirtualRawMatch,
} from "./virtual.types";

@Injectable()
export class VirtualAiService {
  private toNumber(value: any, fallback = 0) {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseScore(result?: string | null) {
    const match = String(result || "").match(/(\d+)\s*[-x]\s*(\d+)/i);
    if (!match) return null;

    const home = Number(match[1]);
    const away = Number(match[2]);

    if (!Number.isFinite(home) || !Number.isFinite(away)) return null;

    return { home, away, total: home + away };
  }

  private pct(part: number, total: number) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  getPatterns(history: VirtualRawMatch[]) {
    const finished = (history || [])
      .map((match) => ({
        match,
        score: this.parseScore(match.resultadoFt || match.resultado),
      }))
      .filter((item) => item.score);

    const total = finished.length;

    const over05 = finished.filter((item) => item.score!.total >= 1).length;
    const over15 = finished.filter((item) => item.score!.total >= 2).length;
    const over25 = finished.filter((item) => item.score!.total >= 3).length;
    const under35 = finished.filter((item) => item.score!.total <= 3).length;
    const btts = finished.filter((item) => item.score!.home >= 1 && item.score!.away >= 1).length;
    const homeWins = finished.filter((item) => item.score!.home > item.score!.away).length;
    const awayWins = finished.filter((item) => item.score!.away > item.score!.home).length;
    const draws = finished.filter((item) => item.score!.home === item.score!.away).length;
    const htWithGoal = finished.filter((item) => {
      const ht = this.parseScore(item.match.resultadoHt);
      return ht && ht.total >= 1;
    }).length;

    return {
      sampleSize: total,
      over05: this.pct(over05, total),
      over15: this.pct(over15, total),
      over25: this.pct(over25, total),
      under35: this.pct(under35, total),
      btts: this.pct(btts, total),
      homeWins: this.pct(homeWins, total),
      awayWins: this.pct(awayWins, total),
      draws: this.pct(draws, total),
      htWithGoal: this.pct(htWithGoal, total),
      raw: {
        over05,
        over15,
        over25,
        under35,
        btts,
        homeWins,
        awayWins,
        draws,
        htWithGoal,
      },
    };
  }

  analyzeUpcoming(upcoming: VirtualRawMatch[], history: VirtualRawMatch[]): VirtualAnalyzedMatch[] {
    const patterns = this.getPatterns(history);

    return (upcoming || []).map((match) => {
      const picks = this.buildPicks(match.odds || {}, patterns)
        .filter((pick) => pick.odd >= 1.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        id: String(match.id),
        league: match.competition || match.league || "virtual",
        homeTeam: match.timeA || "Casa",
        awayTeam: match.timeB || "Fora",
        timeLabel: match.horario || `${match.hora || ""}:${match.minuto || ""}`,
        createdAt: match.created_at,
        odds: match.odds || {},
        picks,
        topPick: picks[0] || null,
        warning:
          "Futebol virtual é RNG. A Oddix Virtual analisa padrões estatísticos e odds, não garante resultado.",
      };
    });
  }

  private buildPicks(odds: VirtualOdds, patterns: any): VirtualMarketPick[] {
    const picks: VirtualMarketPick[] = [];

    const add = (
      market: string,
      selection: string,
      oddKey: string,
      patternRate: number,
      baseWeight: number,
      risk: "Baixo" | "Médio" | "Alto",
      reason: string,
    ) => {
      const odd = this.toNumber(odds[oddKey], 0);
      if (!odd) return;

      const oddPenalty = Math.abs(odd - 1.75) * 8;
      const sampleBonus = Math.min(8, Math.round((patterns.sampleSize || 0) / 80));
      const score = Math.max(
        0,
        Math.min(99, Math.round(patternRate * baseWeight + sampleBonus - oddPenalty)),
      );

      const confidence = Math.max(0, Math.min(95, Math.round(score * 0.92)));

      picks.push({
        market,
        selection,
        odd,
        score,
        confidence,
        risk,
        reason,
      });
    };

    add(
      "Total de Gols",
      "Over 1.5 gols",
      "odd_over_1.5",
      patterns.over15,
      1.02,
      "Baixo",
      `Over 1.5 apareceu em ${patterns.over15}% da amostra recente.`,
    );

    add(
      "Total de Gols",
      "Under 3.5 gols",
      "odd_under_3.5",
      patterns.under35,
      1.0,
      "Baixo",
      `Under 3.5 apareceu em ${patterns.under35}% da amostra recente.`,
    );

    add(
      "Ambas Marcam",
      "BTTS - Sim",
      "odd_ambas_sim",
      patterns.btts,
      0.98,
      "Médio",
      `Ambas marcam apareceu em ${patterns.btts}% da amostra recente.`,
    );

    add(
      "Dupla Chance",
      "Casa ou Empate",
      "odd_dupla_hipotese_casa_ou_empate",
      patterns.homeWins + patterns.draws,
      0.76,
      "Baixo",
      `Casa não perdeu em ${patterns.homeWins + patterns.draws}% da amostra recente.`,
    );

    add(
      "Dupla Chance",
      "Fora ou Empate",
      "odd_dupla_hipotese_fora_ou_empate",
      patterns.awayWins + patterns.draws,
      0.76,
      "Baixo",
      `Fora não perdeu em ${patterns.awayWins + patterns.draws}% da amostra recente.`,
    );

    add(
      "Total de Gols",
      "Over 2.5 gols",
      "odd_over_2.5",
      patterns.over25,
      0.96,
      "Médio",
      `Over 2.5 apareceu em ${patterns.over25}% da amostra recente.`,
    );

    return picks;
  }
}
