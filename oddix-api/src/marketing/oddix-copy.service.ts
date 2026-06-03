import { Injectable } from "@nestjs/common";
import { OddixCreativeResult } from "./oddix-creative.service";

export type OddixCopyInput = {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  tip: string;
  odd: number | string;
  risk?: string;
  stage?: string;
  creative?: OddixCreativeResult;
  vipLink?: string;
};

@Injectable()
export class OddixCopyService {
  vipBefore(input: OddixCopyInput) {
    return [
      `🚨 *${input.creative?.headline || "ODDIX VIP"}*`,
      "",
      `A IA encontrou valor em *${input.homeTeam} x ${input.awayTeam}*.`,
      input.creative?.subheadline ? `📌 ${input.creative.subheadline}` : "",
      "",
      "Card premium abaixo 👇",
    ]
      .filter(Boolean)
      .join("\n");
  }

  vipCaption(input: OddixCopyInput) {
    return [
      `💎 *ODDIX VIP | ENTRADA PREMIUM*`,
      "",
      `⚽ *${input.homeTeam} x ${input.awayTeam}*`,
      input.league ? `🏆 ${input.league}` : "",
      `✅ *Entrada:* ${input.tip}`,
      `📈 *Odd:* ${input.odd}`,
      input.creative?.edge ? `🎯 *Edge IA:* ${input.creative.edge}` : "",
      input.creative?.confidenceLabel
        ? `📊 *Confiança:* ${input.creative.confidenceLabel}`
        : "",
      `⚠️ *Risco:* ${input.risk || "Médio"}`,
      "",
      `💵 *Gestão:* 0.5 a 1 unidade. Sem all-in.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  freeTeaser(input: OddixCopyInput) {
    return [
      "🔥 *ODDIX FREE*",
      "",
      `⚽ ${input.homeTeam} x ${input.awayTeam}`,
      input.league ? `🏆 ${input.league}` : "",
      `✅ Entrada liberada: *${input.tip}*`,
      `📈 Odd: *${input.odd}*`,
      "",
      "🔒 A análise completa, edge IA, gestão e card premium ficam no VIP.",
      "",
      "👇 Entre no VIP para receber o sinal completo.",
      input.vipLink || "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  green(input: OddixCopyInput) {
    return [
      "🟢 *GREEN ODDIX!*",
      "",
      `✅ ${input.homeTeam} x ${input.awayTeam}`,
      `🎯 Entrada: ${input.tip}`,
      "",
      "Leitura validada pela IA. Gestão sempre em primeiro lugar.",
    ].join("\n");
  }

  red(input: OddixCopyInput) {
    return [
      "🔴 *RED CONTROLADO*",
      "",
      `❌ ${input.homeTeam} x ${input.awayTeam}`,
      `🎯 Entrada: ${input.tip}`,
      "",
      "Seguimos o plano. Sem all-in, sem emoção e buscando o próximo valor.",
    ].join("\n");
  }

  liveUpdate(input: OddixCopyInput) {
    return [
      "👀 *ODDIX MONITORANDO*",
      "",
      `${input.homeTeam} x ${input.awayTeam}`,
      `🎯 Entrada: ${input.tip}`,
      "",
      "A IA segue acompanhando o cenário da partida.",
    ].join("\n");
  }
}
