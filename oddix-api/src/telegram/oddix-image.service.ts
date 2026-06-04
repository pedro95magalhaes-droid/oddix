import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

export type OddixVipCardInput = {
  homeTeam: string;
  awayTeam: string;
  league: string;
  market?: string;
  tip: string;
  odd: string | number;
  confidence?: string | number;
  risk?: string;
  stake?: string;
  homeLogo?: string;
  awayLogo?: string;
  status?: string;
  elapsed?: string | number | null;
  source?: string;
  headline?: string;
  subheadline?: string;
  vipBadge?: string;
  edge?: string;
  confidenceLabel?: string;
  valueLabel?: string;
  theme?: string;
  visualPrompt?: string;
};

export type OddixVipMultipleCardInput = {
  title?: string;
  oddTotal: string | number;
  selections: Array<{
    homeTeam: string;
    awayTeam: string;
    league?: string;
    tip: string;
    odd: string | number;
    confidence?: string | number;
    risk?: string;
    homeLogo?: string;
    awayLogo?: string;
  }>;
};

@Injectable()
export class OddixImageService {
  private readonly logger = new Logger(OddixImageService.name);
  private readonly width = 1016;
  private readonly height = 515;

  private outputDir() {
    const dir = path.join(process.cwd(), "tmp", "oddix-cards");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private escape(value: any) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private cleanText(value: any) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalize(value: any) {
    return this.cleanText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  private short(value: any, max = 32) {
    const text = this.cleanText(value);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  private stripPrefixTip(value: any) {
    return this.cleanText(value)
      .replace(/^ao vivo:\s*/i, "")
      .replace(/^live:\s*/i, "")
      .replace(/^pré-jogo:\s*/i, "")
      .replace(/^pre-jogo:\s*/i, "")
      .replace(/^entrada:\s*/i, "")
      .trim();
  }

  private splitTip(value: any) {
    const text = this.stripPrefixTip(value).toUpperCase();
    const normalized = this.normalize(text);

    const overUnder = text.match(/^(OVER|UNDER)\s+([0-9]+(?:[.,][0-9]+)?)(.*)$/i);
    if (overUnder) {
      const top = `${overUnder[1]} ${overUnder[2]}`.replace(".", ",");
      const bottom = this.cleanText(overUnder[3] || "").replace(/^DE\s+/i, "");
      return { top, bottom: bottom || "ENTRADA ODDIX" };
    }

    const firstWords = text.split(" ");
    if (firstWords.length > 4) {
      return {
        top: firstWords.slice(0, 3).join(" "),
        bottom: firstWords.slice(3).join(" "),
      };
    }

    if (normalized.includes("empate")) {
      return { top: text.replace(/\s+OU\s+/i, " OU "), bottom: "DUPLA CHANCE" };
    }

    return { top: text, bottom: "ENTRADA ODDIX" };
  }

  private wrapText(value: any, maxCharsPerLine = 22, maxLines = 2) {
    const words = this.cleanText(value).split(" ").filter(Boolean);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxCharsPerLine) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
      if (lines.length >= maxLines) break;
    }

    if (current && lines.length < maxLines) lines.push(current);
    return lines.slice(0, maxLines);
  }

  private seedFromText(text: string) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private initials(name: string) {
    return String(name || "OD")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  private async downloadImage(url?: string): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 12000,
        headers: { "User-Agent": "Oddix/2.0" },
      });
      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  private async logoBuffer(url: string | undefined, teamName: string, size: number): Promise<Buffer> {
    const downloaded = await this.downloadImage(url);

    if (downloaded) {
      return sharp(downloaded)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .modulate({ brightness: 1.2, saturation: 1.15 })
        .png()
        .toBuffer();
    }

    const initials = this.escape(this.initials(teamName));
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff7ad"/>
            <stop offset="42%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#7c2d12"/>
          </linearGradient>
          <filter id="s"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000" flood-opacity=".9"/></filter>
        </defs>
        <path d="M${size / 2} 8 L${size - 18} ${size * 0.32} L${size - 40} ${size - 18} L${size / 2} ${size - 4} L40 ${size - 18} L18 ${size * 0.32} Z" fill="url(#g)" stroke="#fff7ad" stroke-width="5" filter="url(#s)"/>
        <text x="50%" y="58%" text-anchor="middle" font-family="Impact,Arial Black,Arial" font-size="${Math.round(size * 0.28)}" fill="#111827">${initials}</text>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async createBackground(inputText: string): Promise<Buffer> {
    const usePollinations =
      String(
        process.env.ODDIX_USE_POLLINATIONS_BG ||
          process.env.POLLINATIONS_IMAGE_ENABLED ||
          process.env.POLLINATIONS_ENABLED ||
          "false",
      ).toLowerCase() === "true";

    if (usePollinations) {
      const seed = this.seedFromText(inputText);
      const prompt = inputText.includes(",")
        ? inputText
        : [
            "ultra premium sports betting poster",
            "luxury bookmaker advertisement",
            "millionaire tipster thumbnail style",
            "dramatic football stadium at night",
            "two generic professional football players occupying the left and right sides",
            "players large visible bodies",
            "orange gold stadium lights",
            "cinematic smoke and sparks",
            "dark center empty space for betting slip overlay",
            "high contrast commercial composition",
            "ultra realistic 4k",
            "no text no words no numbers no watermark no brand logos",
          ].join(", ");

      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${this.width}` +
        `&height=${this.height}` +
        `&model=${encodeURIComponent(process.env.POLLINATIONS_MODEL || "flux")}` +
        `&seed=${seed}` +
        `&nologo=true` +
        `&enhance=true`;

      try {
        const response = await axios.get(url, {
          responseType: "arraybuffer",
          timeout: 55000,
          headers: { "User-Agent": "Oddix/2.0" },
        });

        return sharp(Buffer.from(response.data))
          .resize(this.width, this.height, { fit: "cover" })
          .modulate({ brightness: 0.92, saturation: 1.12 })
          .png()
          .toBuffer();
      } catch (error: any) {
        this.logger.warn(`Pollinations falhou. Usando fundo local premium v3: ${error?.message || "erro"}`);
      }
    }

    return this.createFallbackBackground(inputText);
  }

  private async createFallbackBackground(inputText: string): Promise<Buffer> {
    const seed = this.seedFromText(inputText);
    const sparks = Array.from({ length: 85 })
      .map((_, i) => {
        const x = (seed + i * 97) % this.width;
        const y = (seed + i * 151) % this.height;
        const r = 1 + (i % 4);
        const o = 0.15 + (i % 5) * 0.045;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fbbf24" opacity="${o}"/>`;
      })
      .join("");

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#030005"/>
            <stop offset="35%" stop-color="#111827"/>
            <stop offset="60%" stop-color="#3b0764"/>
            <stop offset="100%" stop-color="#050505"/>
          </linearGradient>
          <radialGradient id="left" cx="8%" cy="44%" r="46%"><stop offset="0%" stop-color="#1d4ed8" stop-opacity=".78"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
          <radialGradient id="right" cx="92%" cy="42%" r="48%"><stop offset="0%" stop-color="#dc2626" stop-opacity=".64"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
          <radialGradient id="gold" cx="50%" cy="10%" r="70%"><stop offset="0%" stop-color="#f59e0b" stop-opacity=".62"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#left)"/>
        <rect width="100%" height="100%" fill="url(#right)"/>
        <rect width="100%" height="100%" fill="url(#gold)"/>
        <ellipse cx="210" cy="252" rx="150" ry="270" fill="#0f172a" opacity=".78" filter="url(#blur)"/>
        <ellipse cx="806" cy="252" rx="150" ry="270" fill="#160b31" opacity=".78" filter="url(#blur)"/>
        <path d="M118 510 C140 365 132 230 192 108 C232 38 308 40 340 112 C386 220 352 390 392 515" fill="#111827" opacity=".78"/>
        <path d="M898 510 C876 365 884 230 824 108 C784 38 708 40 676 112 C630 220 664 390 624 515" fill="#111827" opacity=".78"/>
        <path d="M0 382 C230 322 386 340 508 360 C650 386 768 386 1016 318 L1016 515 L0 515 Z" fill="#000" opacity=".30"/>
        <g>${sparks}</g>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.10)"/>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private stageLabel(input: OddixVipCardInput) {
    const status = this.normalize(input.status);
    const tip = this.normalize(input.tip);
    if (status.includes("live") || status.includes("ao vivo") || tip.startsWith("ao vivo")) return "AO VIVO";
    if (String(input.headline || "").toLowerCase().includes("final")) return "ENTRADA FINAL";
    return "ENTRADA VIP";
  }

  private singleOverlaySvg(input: OddixVipCardInput) {
    const home = this.escape(this.short(input.homeTeam, 19));
    const away = this.escape(this.short(input.awayTeam, 19));
    const league = this.escape(this.short(input.league, 40));
    const market = this.escape(this.short(input.market || "Mercado IA", 24).toUpperCase());
    const odd = this.escape(String(input.odd ?? "-"));
    const confidence = this.escape(input.confidenceLabel || "Alta");
    const edge = this.escape(input.edge || "+12%");
    const risk = this.escape(this.short(input.risk || "Baixo", 12));
    const valueLabel = this.escape(input.valueLabel || "Valor positivo");
    const stage = this.escape(this.stageLabel(input));
    const tipSplit = this.splitTip(input.tip);
    const topLines = this.wrapText(tipSplit.top, 14, 2);
    const bottomLines = this.wrapText(tipSplit.bottom, 20, 2);
    const topFont = topLines.length > 1 ? 55 : 70;
    const bottomFont = bottomLines.length > 1 ? 30 : 36;

    const topText = topLines
      .map((line, index) => `<text x="508" y="${194 + index * 62}" text-anchor="middle" class="impact" font-size="${topFont}" fill="#ffffff" stroke="#000" stroke-width="3" paint-order="stroke">${this.escape(line)}</text>`)
      .join("");
    const bottomText = bottomLines
      .map((line, index) => `<text x="508" y="${292 + index * 37}" text-anchor="middle" class="heavy" font-size="${bottomFont}" fill="#facc15" stroke="#000" stroke-width="2" paint-order="stroke">${this.escape(line)}</text>`)
      .join("");

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#ff7a18"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#fff7ad"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#15803d"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>
          <linearGradient id="dark" x1="0" x2="1"><stop offset="0%" stop-color="rgba(0,0,0,.78)"/><stop offset="50%" stop-color="rgba(0,0,0,.44)"/><stop offset="100%" stop-color="rgba(0,0,0,.78)"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000" flood-opacity=".85"/></filter>
          <filter id="goldGlow"><feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#facc15" flood-opacity=".85"/></filter>
          <filter id="greenGlow"><feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#22c55e" flood-opacity=".65"/></filter>
          <style>
            .impact{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
            .small{font-family:Arial,sans-serif;font-weight:700}
          </style>
        </defs>

        <!-- ODDIX PREMIUM CARD V3 - confirmar no Render -->
        <rect x="0" y="0" width="1016" height="515" fill="rgba(0,0,0,.12)"/>
        <rect x="18" y="18" width="980" height="479" rx="30" fill="none" stroke="url(#gold)" stroke-width="6" filter="url(#goldGlow)"/>

        <rect x="270" y="42" width="476" height="60" rx="20" fill="rgba(0,0,0,.54)" stroke="rgba(250,204,21,.34)" filter="url(#shadow)"/>
        <text x="508" y="82" text-anchor="middle" class="impact" font-size="38" fill="url(#gold)" filter="url(#goldGlow)">ODDIX VIP</text>
        <text x="508" y="116" text-anchor="middle" class="small" font-size="18" fill="#ffffff" stroke="#000" stroke-width="2" paint-order="stroke">${league}</text>

        <rect x="352" y="126" width="312" height="44" rx="22" fill="url(#gold)" filter="url(#shadow)"/>
        <text x="508" y="155" text-anchor="middle" class="heavy" font-size="19" fill="#130a00">${stage}</text>

        <text x="152" y="345" text-anchor="middle" class="heavy" font-size="25" fill="#ffffff" stroke="#000" stroke-width="3" paint-order="stroke">${home}</text>
        <text x="864" y="345" text-anchor="middle" class="heavy" font-size="25" fill="#ffffff" stroke="#000" stroke-width="3" paint-order="stroke">${away}</text>
        <text x="508" y="148" text-anchor="middle" class="impact" font-size="25" fill="#ffffff" opacity=".0">VS</text>
        <circle cx="508" cy="250" r="30" fill="rgba(0,0,0,.72)" stroke="#facc15" stroke-width="3" filter="url(#goldGlow)"/>
        <text x="508" y="260" text-anchor="middle" class="impact" font-size="25" fill="#fff">VS</text>

        <rect x="280" y="176" width="456" height="156" rx="30" fill="url(#dark)" stroke="rgba(250,204,21,.56)" stroke-width="3" filter="url(#shadow)"/>
        <text x="508" y="209" text-anchor="middle" class="text" font-size="17" fill="#facc15">${market}</text>
        ${topText}
        ${bottomText}

        <g filter="url(#shadow)">
          <rect x="62" y="386" width="206" height="70" rx="21" fill="url(#gold)"/>
          <text x="165" y="413" text-anchor="middle" class="text" font-size="18" fill="#1f1300">ODD</text>
          <text x="165" y="447" text-anchor="middle" class="impact" font-size="40" fill="#ffffff">${odd}</text>

          <rect x="304" y="386" width="208" height="70" rx="21" fill="url(#green)" filter="url(#greenGlow)"/>
          <text x="408" y="413" text-anchor="middle" class="text" font-size="17" fill="#052e16">EDGE IA</text>
          <text x="408" y="447" text-anchor="middle" class="impact" font-size="38" fill="#ffffff">${edge}</text>

          <rect x="548" y="386" width="196" height="70" rx="21" fill="rgba(0,0,0,.64)" stroke="rgba(250,204,21,.62)" stroke-width="2"/>
          <text x="646" y="413" text-anchor="middle" class="text" font-size="17" fill="#facc15">CONFIANÇA</text>
          <text x="646" y="445" text-anchor="middle" class="heavy" font-size="30" fill="#fff">${confidence}</text>

          <rect x="782" y="386" width="172" height="70" rx="21" fill="rgba(0,0,0,.64)" stroke="rgba(255,255,255,.24)" stroke-width="2"/>
          <text x="868" y="413" text-anchor="middle" class="text" font-size="17" fill="#facc15">RISCO</text>
          <text x="868" y="445" text-anchor="middle" class="heavy" font-size="28" fill="#fff">${risk}</text>
        </g>

        <rect x="220" y="468" width="576" height="25" rx="12" fill="rgba(0,0,0,.58)"/>
        <text x="508" y="486" text-anchor="middle" class="small" font-size="13" fill="#fff7ad">${valueLabel} • Parceiro EstrelaBet • 18+ • Jogue com responsabilidade</text>
      </svg>
    `);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      this.logger.log("ODDIX PREMIUM CARD V3 ativo");

      const outputPath = path.join(this.outputDir(), `vip-card-premium-v3-${Date.now()}.png`);
      const background = await this.createBackground(
        input.visualPrompt ||
          `${input.homeTeam} versus ${input.awayTeam}, ${input.league}, ${input.tip}, premium sportsbook poster, giant players, no text`,
      );
      const overlay = this.singleOverlaySvg(input);
      const homeLogo = await this.logoBuffer(input.homeLogo, input.homeTeam, 120);
      const awayLogo = await this.logoBuffer(input.awayLogo, input.awayTeam, 120);

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite([
          { input: homeLogo, left: 92, top: 216 },
          { input: awayLogo, left: 804, top: 216 },
          { input: overlay, left: 0, top: 0 },
        ])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card VIP premium v3: ${error?.message || "erro desconhecido"}`);
      return null;
    }
  }

  private multipleOverlaySvg(input: OddixVipMultipleCardInput) {
    const title = this.escape(this.short(input.title || "ODDIX MÚLTIPLA VIP", 28));
    const oddTotal = this.escape(String(input.oddTotal ?? "-"));
    const selections = input.selections.slice(0, 4);

    const rows = selections
      .map((selection, index) => {
        const y = 118 + index * 78;
        const game = this.escape(this.short(`${selection.homeTeam} x ${selection.awayTeam}`, 34));
        const tip = this.escape(this.short(this.stripPrefixTip(selection.tip).toUpperCase(), 30));
        const odd = this.escape(String(selection.odd ?? "-"));
        const confidence = selection.confidence ? this.escape(String(selection.confidence).includes("%") ? String(selection.confidence) : `${selection.confidence}%`) : "IA";
        return `
          <rect x="48" y="${y}" width="742" height="64" rx="18" fill="rgba(0,0,0,.62)" stroke="rgba(250,204,21,.36)" stroke-width="2"/>
          <circle cx="84" cy="${y + 32}" r="22" fill="url(#gold)"/>
          <text x="84" y="${y + 41}" text-anchor="middle" class="heavy" font-size="24" fill="#111827">${index + 1}</text>
          <text x="124" y="${y + 27}" class="heavy" font-size="20" fill="#fff">${game}</text>
          <text x="124" y="${y + 53}" class="text" font-size="19" fill="#facc15">${tip}</text>
          <text x="682" y="${y + 53}" text-anchor="end" class="small" font-size="16" fill="#c4b5fd">${confidence}</text>
          <rect x="812" y="${y}" width="152" height="64" rx="18" fill="url(#green)"/>
          <text x="888" y="${y + 25}" text-anchor="middle" class="text" font-size="15" fill="#052e16">ODD</text>
          <text x="888" y="${y + 53}" text-anchor="middle" class="impact" font-size="30" fill="#fff">${odd}</text>
        `;
      })
      .join("");

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#ff7a18"/><stop offset="100%" stop-color="#facc15"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#15803d"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".82"/></filter>
          <style>.impact{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px}.heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}.text{font-family:Arial,sans-serif;font-weight:800}.small{font-family:Arial,sans-serif;font-weight:700}</style>
        </defs>
        <rect x="18" y="18" width="980" height="479" rx="30" fill="rgba(0,0,0,.50)" stroke="url(#gold)" stroke-width="6" filter="url(#shadow)"/>
        <text x="508" y="72" text-anchor="middle" class="impact" font-size="44" fill="#fff">${title}</text>
        <text x="508" y="104" text-anchor="middle" class="text" font-size="19" fill="#facc15">Bilhete premium filtrado pela IA</text>
        ${rows}
        <rect x="312" y="438" width="392" height="48" rx="18" fill="url(#gold)" filter="url(#shadow)"/>
        <text x="430" y="469" text-anchor="middle" class="text" font-size="19" fill="#1f1300">ODD COMBINADA</text>
        <text x="600" y="473" text-anchor="middle" class="impact" font-size="34" fill="#fff">${oddTotal}</text>
      </svg>
    `);
  }

  async createVipMultipleCard(input: OddixVipMultipleCardInput): Promise<string | null> {
    try {
      const outputPath = path.join(this.outputDir(), `vip-multiple-premium-v3-${Date.now()}.png`);
      const background = await this.createBackground(`${input.title}-${input.oddTotal}, premium accumulator betting poster, no text`);
      const overlay = this.multipleOverlaySvg(input);
      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite([{ input: overlay, left: 0, top: 0 }])
        .png()
        .toFile(outputPath);
      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card múltipla VIP premium v3: ${error?.message || "erro desconhecido"}`);
      return null;
    }
  }
}
