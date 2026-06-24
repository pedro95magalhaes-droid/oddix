import { Injectable } from '@nestjs/common';

export type OddixValueBetInput = {
  game?: string;
  market?: string;
  odd?: number | null;
  modelProbability?: number | null;
  confidence?: number | null;
  source?: string | null;
};

export type OddixValueBetResult = {
  game: string;
  market: string;
  odd: number;
  impliedProbability: number;
  modelProbability: number | null;
  expectedValue: number | null;
  edge: number | null;
  isValueBet: boolean;
  source: string;
  label: string;
  warning?: string;
};

export type OddixBetSlipSelection = {
  game: string;
  market: string;
  odd: number;
  confidence?: number;
  source?: string;
  value?: OddixValueBetResult;
};

export type OddixBetSlip = {
  id: string;
  title: string;
  type: 'simple' | 'multiple' | 'observed';
  selections: OddixBetSlipSelection[];
  totalOdd: number;
  impliedProbability: number;
  averageConfidence: number | null;
  risk: 'BAIXO' | 'MEDIO' | 'MEDIO_ALTO' | 'ALTO';
  status: 'OFICIAL' | 'OBSERVACAO' | 'NO_BET';
  warning: string;
};

@Injectable()
export class ValueBetService {
  impliedProbability(odd: number): number {
    if (!Number.isFinite(odd) || odd <= 1) return 0;
    return Number(((1 / odd) * 100).toFixed(2));
  }

  expectedValue(modelProbability: number, odd: number): number {
    if (!Number.isFinite(modelProbability) || !Number.isFinite(odd) || odd <= 1) return 0;
    return Number(((modelProbability / 100) * odd).toFixed(4));
  }

  classifyOdd(odd: number): string {
    if (!Number.isFinite(odd) || odd <= 1) return 'odd inválida';
    if (odd <= 1.35) return 'favoritismo muito forte';
    if (odd <= 1.7) return 'favoritismo forte';
    if (odd <= 2.2) return 'favoritismo moderado';
    if (odd <= 3.5) return 'mercado equilibrado';
    if (odd <= 5.5) return 'azarão moderado';
    return 'azarão de baixa probabilidade';
  }

  analyze(input: OddixValueBetInput): OddixValueBetResult | null {
    const odd = Number(input.odd || 0);
    if (!Number.isFinite(odd) || odd <= 1) return null;

    const implied = this.impliedProbability(odd);
    const modelProbability =
      input.modelProbability !== null && input.modelProbability !== undefined
        ? Number(input.modelProbability)
        : input.confidence !== null && input.confidence !== undefined
          ? Number(input.confidence)
          : null;

    const ev =
      modelProbability !== null && Number.isFinite(modelProbability)
        ? this.expectedValue(modelProbability, odd)
        : null;

    const edge =
      modelProbability !== null && Number.isFinite(modelProbability)
        ? Number((modelProbability - implied).toFixed(2))
        : null;

    return {
      game: input.game || 'Jogo não informado',
      market: input.market || 'Mercado não informado',
      odd,
      impliedProbability: implied,
      modelProbability: modelProbability !== null && Number.isFinite(modelProbability) ? Number(modelProbability.toFixed(2)) : null,
      expectedValue: ev,
      edge,
      isValueBet: ev !== null ? ev > 1.05 && (edge || 0) >= 3 : false,
      source: input.source || 'unknown',
      label: this.classifyOdd(odd),
      warning:
        modelProbability === null
          ? 'Sem probabilidade modelada suficiente para cravar value bet.'
          : undefined,
    };
  }

  buildSlip(selections: OddixBetSlipSelection[], type: 'simple' | 'multiple' | 'observed' = 'observed'): OddixBetSlip | null {
    const clean = (selections || [])
      .map((selection) => ({
        ...selection,
        odd: Number(selection.odd),
      }))
      .filter((selection) => Number.isFinite(selection.odd) && selection.odd > 1);

    if (!clean.length) return null;

    const totalOdd = clean.reduce((acc, selection) => acc * selection.odd, 1);
    const confidences = clean
      .map((selection) => Number(selection.confidence || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    const averageConfidence = confidences.length
      ? Number((confidences.reduce((acc, value) => acc + value, 0) / confidences.length).toFixed(2))
      : null;

    const risk = this.classifyRisk(totalOdd, averageConfidence);
    const hasValue = clean.some((selection) => selection.value?.isValueBet === true);

    return {
      id: `ODX-${Date.now().toString(36).toUpperCase()}`,
      title: type === 'multiple' ? '🎫 Bilhete Oddix V14' : '🎯 Entrada Oddix V14',
      type,
      selections: clean,
      totalOdd: Number(totalOdd.toFixed(2)),
      impliedProbability: this.impliedProbability(totalOdd),
      averageConfidence,
      risk,
      status: hasValue && averageConfidence !== null && averageConfidence >= 75 ? 'OFICIAL' : 'OBSERVACAO',
      warning:
        hasValue && averageConfidence !== null && averageConfidence >= 75
          ? 'Entrada baseada em odds validadas e probabilidade modelada. Confirme a cotação antes de apostar.'
          : 'Observação: não transformar em entrada oficial sem estatísticas/odds completas e validação final.',
    };
  }

  private classifyRisk(totalOdd: number, confidence: number | null): OddixBetSlip['risk'] {
    if (totalOdd <= 1.6 && (confidence === null || confidence >= 75)) return 'BAIXO';
    if (totalOdd <= 2.5 && (confidence === null || confidence >= 68)) return 'MEDIO';
    if (totalOdd <= 4) return 'MEDIO_ALTO';
    return 'ALTO';
  }
}
