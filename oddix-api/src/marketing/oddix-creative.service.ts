import { Injectable } from "@nestjs/common";

export type OddixCreativeTheme =
  | "VIP_GOLD"
  | "VIP_CHAMPIONS"
  | "VIP_DARK"
  | "VIP_PRO"
  | "VIP_GREEN"
  | "VIP_ELITE"
  | "VIP_LUXURY"
  | "VIP_GAMER";

export type OddixCreativeInput = {
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  tip?: string;
  market?: string;
  odd?: number | string;
  confidence?: number | string;
  risk?: string;
  stage?: "early" | "main" | "final" | string;
  isFree?: boolean;
};

export type OddixCreativeResult = {
  theme: OddixCreativeTheme;
  headline: string;
  subheadline: string;
  vipBadge: string;
  edge: string;
  confidenceLabel: string;
  valueLabel: string;
  visualPrompt: string;
};

@Injectable()
export class OddixCreativeService {
  generate(input: OddixCreativeInput): OddixCreativeResult {
    const seed = this.seedFromText(
      `${input.homeTeam}-${input.awayTeam}-${input.league}-${input.tip}-${input.odd}`,
    );

    const theme = this.pickTheme(input, seed);
    const edge = this.calculateEdge(input, seed);

    return {
      theme,
      headline: this.headline(theme, input),
      subheadline: this.subheadline(input),
      vipBadge: input.isFree ? "ODDIX FREE" : "ODDIX PRO AI",
      edge,
      confidenceLabel: this.confidenceLabel(input.confidence),
      valueLabel: this.valueLabel(edge),
      visualPrompt: this.visualPrompt(theme, input),
    };
  }

  private pickTheme(
    input: OddixCreativeInput,
    seed: number,
  ): OddixCreativeTheme {
    const tip = this.normalize(input.tip);
    const odd = Number(input.odd || 0);
    const confidence = Number(input.confidence || 0);

    if (tip.includes("escanteio") || tip.includes("corner"))
      return "VIP_CHAMPIONS";
    if (tip.includes("cartao") || tip.includes("card")) return "VIP_DARK";
    if (
      tip.includes("player") ||
      tip.includes("chute") ||
      tip.includes("finalizacao")
    )
      return "VIP_GAMER";
    if (odd >= 2) return "VIP_ELITE";
    if (confidence >= 84) return "VIP_GREEN";

    const themes: OddixCreativeTheme[] = [
      "VIP_GOLD",
      "VIP_CHAMPIONS",
      "VIP_DARK",
      "VIP_PRO",
      "VIP_GREEN",
      "VIP_ELITE",
      "VIP_LUXURY",
      "VIP_GAMER",
    ];

    return themes[seed % themes.length];
  }

  private headline(theme: OddixCreativeTheme, input: OddixCreativeInput) {
    const stage = String(input.stage || "").toLowerCase();

    if (stage === "final") return "🔥 ENTRADA FINAL";
    if (theme === "VIP_GOLD") return "💎 ENTRADA PREMIUM";
    if (theme === "VIP_CHAMPIONS") return "🏆 LINHA FORTE";
    if (theme === "VIP_DARK") return "⚡ MERCADO PROTEGIDO";
    if (theme === "VIP_PRO") return "🤖 IA ODDIX PRO";
    if (theme === "VIP_GREEN") return "🎯 CAÇA GREEN";
    if (theme === "VIP_ELITE") return "🚀 VALOR ENCONTRADO";
    if (theme === "VIP_LUXURY") return "💰 SINAL VIP";
    return "🔥 ODDIX BOOST";
  }

  private subheadline(input: OddixCreativeInput) {
    const tip = this.normalize(input.tip);

    if (tip.includes("escanteio") || tip.includes("corner")) {
      return "Pressão ofensiva e tendência de volume";
    }

    if (tip.includes("gol") || tip.includes("over") || tip.includes("under")) {
      return "Linha validada pela leitura estatística";
    }

    if (tip.includes("chute") || tip.includes("finalizacao")) {
      return "Mercado de volume identificado pela IA";
    }

    return "Oportunidade acima da média detectada";
  }

  private calculateEdge(input: OddixCreativeInput, seed: number) {
    const odd = Number(input.odd || 1.5);
    const confidence = Number(input.confidence || 75);
    const risk = this.normalize(input.risk);

    let edge = Math.round((confidence - 65) * 0.55 + (odd - 1.4) * 8);

    if (risk.includes("baixo")) edge += 3;
    if (risk.includes("alto")) edge -= 4;

    edge += seed % 4;
    edge = Math.max(8, Math.min(edge, 24));

    return `+${edge}%`;
  }

  private confidenceLabel(confidence: any) {
    const value = Number(confidence || 0);

    if (value >= 84) return "Alta";
    if (value >= 76) return "Boa";
    if (value >= 70) return "Moderada";

    return "Controlada";
  }

  private valueLabel(edge: string) {
    const value = Number(String(edge).replace(/[^0-9]/g, ""));

    if (value >= 20) return "Valor muito alto";
    if (value >= 15) return "Valor alto";
    if (value >= 10) return "Valor positivo";

    return "Valor controlado";
  }

  private visualPrompt(theme: OddixCreativeTheme, input: OddixCreativeInput) {
    const base = [
      "premium football betting poster",
      "horizontal banner",
      "cinematic stadium",
      "luxury sportsbook marketing",
      "clean center for overlay",
      "two generic football players",
      "no text",
      "no logos",
      "no watermark",
      "no letters",
      "no numbers",
    ];

    const themePrompt: Record<OddixCreativeTheme, string[]> = {
      VIP_GOLD: ["black and gold", "luxury glow", "premium VIP"],
      VIP_CHAMPIONS: [
        "champions league style",
        "blue gold lights",
        "epic stadium",
      ],
      VIP_DARK: ["dark graphite", "red gold accents", "aggressive premium"],
      VIP_PRO: ["futuristic AI sports", "neon cyan gold", "data glow"],
      VIP_GREEN: ["green neon energy", "winner mood", "high contrast"],
      VIP_ELITE: ["elite sportsbook", "orange gold glow", "cinematic smoke"],
      VIP_LUXURY: ["black marble", "soft gold smoke", "elegant premium"],
      VIP_GAMER: [
        "esports football style",
        "neon green purple",
        "gamer energy",
      ],
    };

    return [
      ...base,
      ...themePrompt[theme],
      input.league || "football match",
    ].join(", ");
  }

  private seedFromText(text: string) {
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash);
  }

  private normalize(value: any) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }
}
