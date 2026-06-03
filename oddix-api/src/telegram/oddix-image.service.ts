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
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private cleanText(value: any) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private short(value: any, max = 32) {
    const text = this.cleanText(value);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  private wrapText(value: any, maxCharsPerLine = 24, maxLines = 2) {
    const words = this.cleanText(value).split(" ").filter(Boolean);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;

      if (next.length <= maxCharsPerLine) current = next;
      else {
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
        headers: { "User-Agent": "Oddix/1.0" },
      });
      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  private async logoBuffer(
    url: string | undefined,
    teamName: string,
    size: number,
  ): Promise<Buffer> {
    const downloaded = await this.downloadImage(url);

    if (downloaded) {
      return sharp(downloaded)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    }

    const initials = this.escape(this.initials(teamName));
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="35%" r="72%">
            <stop offset="0%" stop-color="#facc15"/>
            <stop offset="42%" stop-color="#7c3aed"/>
            <stop offset="100%" stop-color="#09090b"/>
          </radialGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#000" flood-opacity=".88"/>
          </filter>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 7}" fill="url(#g)" stroke="#facc15" stroke-width="5" filter="url(#shadow)"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 15}" fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
        <text x="50%" y="58%" text-anchor="middle" font-family="Arial Black,Arial" font-size="${Math.round(size * 0.28)}" fill="#fff">${initials}</text>
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
            "premium football betting background",
            "ultra luxury sportsbook",
            "black gold purple",
            "cinematic stadium",
            "dramatic lighting",
            "professional football player",
            "sports broadcast style",
            "luxury esports design",
            "clean center composition",
            "dark space for overlay",
            "no text",
            "no logos",
            "no watermark",
            "no letters",
            "no numbers",
          ].join(", ");

      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${this.width}` +
        `&height=${this.height}` +
        `&model=${encodeURIComponent(process.env.POLLINATIONS_MODEL || "flux")}` +
        `&seed=${seed}` +
        `&nologo=true`;

      try {
        const response = await axios.get(url, {
          responseType: "arraybuffer",
          timeout: 45000,
          headers: { "User-Agent": "Oddix/1.0" },
        });

        return sharp(Buffer.from(response.data))
          .resize(this.width, this.height, { fit: "cover" })
          .png()
          .toBuffer();
      } catch (error: any) {
        this.logger.warn(
          `Pollinations falhou. Usando fundo local: ${error?.message || "erro desconhecido"}`,
        );
      }
    }

    return this.createFallbackBackground(inputText);
  }

  private async createFallbackBackground(inputText: string): Promise<Buffer> {
    const seed = this.seedFromText(inputText);

    const lines = Array.from({ length: 26 })
      .map((_, i) => {
        const x = (i * 73 + seed) % this.width;
        const opacity = 0.045 + (i % 4) * 0.018;
        return `<line x1="${x}" y1="0" x2="${x - 180}" y2="${this.height}" stroke="#facc15" stroke-width="2" opacity="${opacity}"/>`;
      })
      .join("");

    const dots = Array.from({ length: 58 })
      .map((_, i) => {
        const x = (seed + i * 137) % this.width;
        const y = (seed + i * 211) % this.height;
        const r = 1 + (i % 4);
        const o = 0.05 + (i % 5) * 0.025;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="#facc15" opacity="${o}"/>`;
      })
      .join("");

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#030008"/>
            <stop offset="34%" stop-color="#13062d"/>
            <stop offset="68%" stop-color="#35106f"/>
            <stop offset="100%" stop-color="#050507"/>
          </linearGradient>
          <radialGradient id="gold" cx="50%" cy="0%" r="82%">
            <stop offset="0%" stop-color="#facc15" stop-opacity=".44"/>
            <stop offset="50%" stop-color="#a855f7" stop-opacity=".18"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="green" cx="50%" cy="100%" r="70%">
            <stop offset="0%" stop-color="#22c55e" stop-opacity=".22"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="22"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#gold)"/>
        <rect width="100%" height="100%" fill="url(#green)"/>
        <g>${lines}</g>
        <g>${dots}</g>
        <ellipse cx="185" cy="475" rx="330" ry="80" fill="#22c55e" opacity=".14" filter="url(#blur)"/>
        <ellipse cx="835" cy="58" rx="330" ry="82" fill="#facc15" opacity=".14" filter="url(#blur)"/>
        <ellipse cx="508" cy="258" rx="420" ry="180" fill="#000" opacity=".22" filter="url(#blur)"/>
        <path d="M110 460 C245 360 300 225 385 150 C445 98 520 82 585 132 C660 190 695 338 854 445" fill="none" stroke="#facc15" stroke-width="5" opacity=".08"/>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.18)"/>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private singleOverlaySvg(input: OddixVipCardInput) {
    const home = this.escape(this.short(input.homeTeam, 18));
    const away = this.escape(this.short(input.awayTeam, 18));
    const league = this.escape(this.short(input.league, 42));
    const market = this.escape(
      this.short(input.market || "Entrada Oddix", 24).toUpperCase(),
    );
    const odd = this.escape(String(input.odd ?? "-"));
    const confidence = this.escape(input.confidenceLabel || "Alta");
    const edge = this.escape(input.edge || "+12%");
    const headline = this.escape(input.headline || "💎 ENTRADA PREMIUM");
    const subheadline = this.escape(
      input.subheadline || "Mercado identificado pela IA",
    );
    const vipBadge = this.escape(input.vipBadge || "ODDIX PRO AI");
    const valueLabel = this.escape(input.valueLabel || "Valor positivo");
    const risk = this.escape(this.short(input.risk || "Médio", 13));

    const tipClean = String(input.tip || "")
      .replace(/^Pré-jogo:\s*/i, "")
      .replace(/^Pre-jogo:\s*/i, "")
      .trim();

    const tipLinesArray = this.wrapText(tipClean, 19, 3);
    const tipFontSize =
      tipLinesArray.length >= 3 ? 36 : tipLinesArray.length === 2 ? 42 : 50;
    const firstTipY =
      tipLinesArray.length >= 3 ? 247 : tipLinesArray.length === 2 ? 270 : 292;

    const tipLines = tipLinesArray
      .map(
        (line, index) =>
          `<text x="508" y="${firstTipY + index * 43}" text-anchor="middle" class="mainTip" font-size="${tipFontSize}" fill="#ffffff">${this.escape(
            line.toUpperCase(),
          )}</text>`,
      )
      .join("");

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="52%" stop-color="#facc15"/>
            <stop offset="100%" stop-color="#fde68a"/>
          </linearGradient>
          <linearGradient id="green" x1="0" x2="1">
            <stop offset="0%" stop-color="#15803d"/>
            <stop offset="100%" stop-color="#22c55e"/>
          </linearGradient>
          <linearGradient id="purple" x1="0" x2="1">
            <stop offset="0%" stop-color="#172554"/>
            <stop offset="55%" stop-color="#4c1d95"/>
            <stop offset="100%" stop-color="#7c3aed"/>
          </linearGradient>
          <linearGradient id="panel" x1="0" x2="1">
            <stop offset="0%" stop-color="rgba(0,0,0,.72)"/>
            <stop offset="50%" stop-color="rgba(8,8,14,.58)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,.72)"/>
          </linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".85"/></filter>
          <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#facc15" flood-opacity=".80"/></filter>
          <filter id="greenGlow"><feDropShadow dx="0" dy="0" stdDeviation="11" flood-color="#22c55e" flood-opacity=".55"/></filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
            .mainTip{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px}
            .small{font-family:Arial,sans-serif;font-weight:700}
          </style>
        </defs>

        <rect x="18" y="18" width="980" height="479" rx="34" fill="rgba(0,0,0,.56)" stroke="url(#gold)" stroke-width="5" filter="url(#shadow)"/>
        <rect x="38" y="38" width="940" height="439" rx="28" fill="url(#panel)" stroke="rgba(250,204,21,.30)" stroke-width="2"/>
        <rect x="55" y="55" width="906" height="405" rx="24" fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.08)" stroke-width="1"/>

        <text x="108" y="78" text-anchor="start" class="title" font-size="34" fill="url(#gold)" filter="url(#glow)">${vipBadge}</text>
        <text x="108" y="107" text-anchor="start" class="small" font-size="17" fill="#ffffff">${headline}</text>
        <text x="508" y="86" text-anchor="middle" class="small" font-size="20" fill="#ddd6fe">${league}</text>
        <text x="508" y="112" text-anchor="middle" class="small" font-size="15" fill="#fef3c7">${subheadline}</text>

        <rect x="734" y="55" width="206" height="52" rx="18" fill="url(#purple)" stroke="rgba(255,255,255,.18)"/>
        <text x="837" y="88" text-anchor="middle" class="small" font-size="19" fill="#facc15">${market}</text>

        <rect x="62" y="128" width="220" height="198" rx="30" fill="rgba(255,255,255,.08)" stroke="rgba(250,204,21,.36)" stroke-width="2"/>
        <rect x="734" y="128" width="220" height="198" rx="30" fill="rgba(255,255,255,.08)" stroke="rgba(250,204,21,.36)" stroke-width="2"/>
        <circle cx="172" cy="203" r="88" fill="rgba(0,0,0,.30)" stroke="rgba(250,204,21,.26)" stroke-width="2"/>
        <circle cx="844" cy="203" r="88" fill="rgba(0,0,0,.30)" stroke="rgba(250,204,21,.26)" stroke-width="2"/>
        <text x="172" y="315" text-anchor="middle" class="heavy" font-size="22" fill="#ffffff">${home}</text>
        <text x="844" y="315" text-anchor="middle" class="heavy" font-size="22" fill="#ffffff">${away}</text>

        <circle cx="508" cy="164" r="34" fill="rgba(250,204,21,.15)" stroke="url(#gold)" stroke-width="3" filter="url(#glow)"/>
        <text x="508" y="177" text-anchor="middle" class="title" font-size="29" fill="#ffffff">VS</text>

        <rect x="300" y="218" width="416" height="138" rx="30" fill="rgba(0,0,0,.54)" stroke="rgba(250,204,21,.46)" stroke-width="2" filter="url(#shadow)"/>
        <rect x="316" y="235" width="384" height="104" rx="24" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.06)" stroke-width="1"/>
        ${tipLines}

        <g filter="url(#shadow)">
          <rect x="82" y="374" width="225" height="78" rx="22" fill="url(#gold)"/>
          <text x="194" y="404" text-anchor="middle" class="text" font-size="20" fill="#1f1300">ODD</text>
          <text x="194" y="439" text-anchor="middle" class="heavy" font-size="39" fill="#ffffff">${odd}</text>

          <rect x="340" y="374" width="260" height="78" rx="22" fill="url(#green)" filter="url(#greenGlow)"/>
          <text x="470" y="404" text-anchor="middle" class="text" font-size="18" fill="#052e16">EDGE IA</text>
          <text x="470" y="439" text-anchor="middle" class="heavy" font-size="39" fill="#ffffff">${edge}</text>

          <rect x="632" y="374" width="302" height="78" rx="22" fill="rgba(255,255,255,.10)" stroke="rgba(250,204,21,.40)" stroke-width="2"/>
          <text x="783" y="400" text-anchor="middle" class="text" font-size="18" fill="#facc15">CONFIANÇA</text>
          <text x="783" y="432" text-anchor="middle" class="heavy" font-size="30" fill="#ffffff">${confidence}</text>
          <text x="783" y="454" text-anchor="middle" class="small" font-size="13" fill="#ddd6fe">${valueLabel} • Risco ${risk}</text>
        </g>
      </svg>
    `);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      const outputPath = path.join(
        this.outputDir(),
        `vip-card-${Date.now()}.png`,
      );
      const background = await this.createBackground(
        input.visualPrompt ||
          `${input.homeTeam}-${input.awayTeam}-${input.tip}-${input.theme || "VIP"}`,
      );
      const overlay = this.singleOverlaySvg(input);
      const logoSize = 180;
      const homeLogo = await this.logoBuffer(
        input.homeLogo,
        input.homeTeam,
        logoSize,
      );
      const awayLogo = await this.logoBuffer(
        input.awayLogo,
        input.awayTeam,
        logoSize,
      );

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite([
          { input: homeLogo, left: 82, top: 113 },
          { input: awayLogo, left: 754, top: 113 },
          { input: overlay, left: 0, top: 0 },
        ])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(
        `Erro ao criar card VIP: ${error?.message || "erro desconhecido"}`,
      );
      return null;
    }
  }

  private multipleOverlaySvg(input: OddixVipMultipleCardInput) {
    const title = this.escape(this.short(input.title || "ODDIX BOOST VIP", 24));
    const oddTotal = this.escape(String(input.oddTotal ?? "-"));
    const selections = input.selections.slice(0, 4);

    const rows = selections
      .map((selection, index) => {
        const y = 122 + index * 76;
        const game = this.escape(
          this.short(`${selection.homeTeam} x ${selection.awayTeam}`, 34),
        );
        const tip = this.escape(this.short(selection.tip, 28).toUpperCase());
        const odd = this.escape(String(selection.odd ?? "-"));
        const confidenceValue = selection.confidence
          ? String(selection.confidence)
          : "";
        const confidence = this.escape(
          confidenceValue
            ? confidenceValue.includes("%")
              ? confidenceValue
              : `${confidenceValue}%`
            : "",
        );

        return `
          <rect x="54" y="${y}" width="732" height="62" rx="18" fill="rgba(0,0,0,.46)" stroke="rgba(250,204,21,.26)" stroke-width="2"/>
          <circle cx="88" cy="${y + 31}" r="21" fill="url(#gold)" filter="url(#shadow)"/>
          <text x="88" y="${y + 40}" text-anchor="middle" class="heavy" font-size="23" fill="#111827">${index + 1}</text>
          <text x="126" y="${y + 25}" class="heavy" font-size="20" fill="#ffffff">${game}</text>
          <text x="126" y="${y + 51}" class="text" font-size="20" fill="#facc15">${tip}</text>
          <text x="652" y="${y + 51}" text-anchor="end" class="small" font-size="16" fill="#c4b5fd">${confidence || "Oddix IA"}</text>
          <rect x="806" y="${y}" width="146" height="62" rx="18" fill="url(#green)" filter="url(#shadow)"/>
          <text x="879" y="${y + 25}" text-anchor="middle" class="text" font-size="16" fill="#052e16">ODD</text>
          <text x="879" y="${y + 52}" text-anchor="middle" class="heavy" font-size="30" fill="#ffffff">${odd}</text>
        `;
      })
      .join("");

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#facc15"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".75"/></filter>
          <style>.title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}.heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}.text{font-family:Arial,sans-serif;font-weight:800}.small{font-family:Arial,sans-serif;font-weight:700}</style>
        </defs>
        <rect x="18" y="18" width="980" height="479" rx="34" fill="rgba(0,0,0,.54)" stroke="url(#gold)" stroke-width="5" filter="url(#shadow)"/>
        <rect x="38" y="38" width="940" height="439" rx="28" fill="rgba(8,8,14,.62)" stroke="rgba(250,204,21,.26)" stroke-width="2"/>
        <text x="508" y="78" text-anchor="middle" class="title" font-size="48" fill="#ffffff">${title}</text>
        <text x="508" y="110" text-anchor="middle" class="text" font-size="20" fill="#facc15">Múltipla premium filtrada pela IA</text>
        ${rows}
        <rect x="308" y="438" width="400" height="48" rx="18" fill="url(#gold)" filter="url(#shadow)"/>
        <text x="428" y="469" text-anchor="middle" class="text" font-size="20" fill="#1f1300">ODD COMBINADA</text>
        <text x="598" y="473" text-anchor="middle" class="heavy" font-size="34" fill="#ffffff">${oddTotal}</text>
      </svg>
    `);
  }

  async createVipMultipleCard(
    input: OddixVipMultipleCardInput,
  ): Promise<string | null> {
    try {
      const outputPath = path.join(
        this.outputDir(),
        `vip-multiple-card-${Date.now()}.png`,
      );
      const background = await this.createBackground(
        `${input.title}-${input.oddTotal}`,
      );
      const overlay = this.multipleOverlaySvg(input);

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite([{ input: overlay, left: 0, top: 0 }])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(
        `Erro ao criar card múltipla VIP: ${error?.message || "erro desconhecido"}`,
      );
      return null;
    }
  }
}
