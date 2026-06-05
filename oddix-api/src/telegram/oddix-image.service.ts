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

  private wrapText(value: any, maxCharsPerLine = 26, maxLines = 2) {
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

  private initials(name: string) {
    return String(name || "OD")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  private ticketCode(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return `ODX-${Math.abs(hash).toString().slice(0, 8).padStart(8, "0")}`;
  }

  private formatOdd(value: any) {
    const parsed = Number(String(value ?? "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return String(value ?? "-");
    return parsed.toFixed(2);
  }

  private formatConfidence(value: any, label?: any) {
    if (label) return this.cleanText(label);
    if (value === null || value === undefined || value === "") return "Alta";
    const text = String(value);
    return text.includes("%") ? text : `${text}%`;
  }

  private stageLabel(input: OddixVipCardInput) {
    const status = this.normalize(input.status);
    const tip = this.normalize(input.tip);
    if (status.includes("live") || status.includes("ao vivo") || tip.startsWith("ao vivo")) return "AO VIVO";
    if (String(input.headline || "").toLowerCase().includes("final")) return "ENTRADA FINAL";
    return "ENTRADA VIP";
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
          <filter id="s"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000" flood-opacity=".65"/></filter>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 5}" fill="url(#g)" stroke="#fff7ad" stroke-width="5" filter="url(#s)"/>
        <text x="50%" y="58%" text-anchor="middle" font-family="Arial Black,Arial" font-size="${Math.round(size * 0.26)}" fill="#111827">${initials}</text>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private playerCandidatePaths() {
    return [
      process.env.ODDIX_PLAYER_IMAGE_PATH || "",
      path.join(process.cwd(), "public", "images", "oddix-player.png"),
      path.join(process.cwd(), "..", "oddix-web", "public", "images", "oddix-player.png"),
      path.join(process.cwd(), "oddix-web", "public", "images", "oddix-player.png"),
      path.join(process.cwd(), "src", "public", "images", "oddix-player.png"),
    ].filter(Boolean);
  }

  private async oddixPlayerBuffer(width = 286, height = 385): Promise<Buffer | null> {
    const candidates = this.playerCandidatePaths();

    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        return await sharp(candidate)
          .resize(width, height, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      } catch (error: any) {
        this.logger.warn(`Falha ao carregar jogador Oddix em ${candidate}: ${error?.message || error}`);
      }
    }

    this.logger.warn("Jogador Oddix não encontrado. Defina ODDIX_PLAYER_IMAGE_PATH ou copie oddix-player.png para public/images.");
    return null;
  }

  private async createBetSlipBackground(): Promise<Buffer> {
    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#05020b"/>
            <stop offset="40%" stop-color="#12072a"/>
            <stop offset="70%" stop-color="#2b0b4f"/>
            <stop offset="100%" stop-color="#05020b"/>
          </linearGradient>
          <radialGradient id="gold" cx="35%" cy="0%" r="70%">
            <stop offset="0%" stop-color="#facc15" stop-opacity=".42"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="purple" cx="90%" cy="42%" r="58%">
            <stop offset="0%" stop-color="#7c3aed" stop-opacity=".65"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#gold)"/>
        <rect width="100%" height="100%" fill="url(#purple)"/>
        <ellipse cx="816" cy="272" rx="170" ry="260" fill="#000" opacity=".36" filter="url(#blur)"/>
        <path d="M0 430 C210 390 340 410 508 425 C680 441 812 410 1016 370 L1016 515 L0 515 Z" fill="#000" opacity=".32"/>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private betSlipOverlaySvg(input: OddixVipCardInput, hasPlayer = true) {
    const home = this.escape(this.short(input.homeTeam, 24));
    const away = this.escape(this.short(input.awayTeam, 24));
    const league = this.escape(this.short(input.league, 44));
    const market = this.escape(this.short(input.market || "Mercado IA", 28).toUpperCase());
    const tip = this.stripPrefixTip(input.tip).toUpperCase();
    const tipLines = this.wrapText(tip, 30, 3);
    const odd = this.escape(this.formatOdd(input.odd));
    const confidence = this.escape(this.formatConfidence(input.confidence, input.confidenceLabel));
    const risk = this.escape(this.short(input.risk || "Baixo", 14));
    const stake = this.escape(this.short(input.stake || "1 unidade", 18));
    const stage = this.escape(this.stageLabel(input));
    const code = this.escape(this.ticketCode(`${input.homeTeam}-${input.awayTeam}-${input.tip}-${input.odd}`));
    const valueLabel = this.escape(input.valueLabel || "Entrada validada pela IA Oddix");

    const tipText = tipLines
      .map((line, index) => `<text x="110" y="${232 + index * 34}" class="impact" font-size="30" fill="#111827">${this.escape(line)}</text>`)
      .join("");

    const rightShade = hasPlayer ? "rgba(0,0,0,.10)" : "rgba(0,0,0,.26)";

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ticket" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fffaf0"/>
            <stop offset="53%" stop-color="#fff7df"/>
            <stop offset="100%" stop-color="#f4e7c3"/>
          </linearGradient>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#ff7a18"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#fff7ad"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#047857"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".72"/></filter>
          <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#facc15" flood-opacity=".72"/></filter>
          <style>
            .impact{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:.8px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
            .small{font-family:Arial,sans-serif;font-weight:700}
            .regular{font-family:Arial,sans-serif;font-weight:600}
          </style>
        </defs>

        <rect x="0" y="0" width="1016" height="515" fill="rgba(0,0,0,.08)"/>

        <g filter="url(#shadow)">
          <rect x="42" y="34" width="690" height="447" rx="28" fill="url(#ticket)"/>
          <circle cx="42" cy="258" r="18" fill="#17062d"/>
          <circle cx="732" cy="258" r="18" fill="#1d0735"/>
          <path d="M636 56 L636 458" stroke="#b79a55" stroke-width="3" stroke-dasharray="10 10" opacity=".72"/>
        </g>

        <rect x="60" y="52" width="554" height="54" rx="18" fill="#111827"/>
        <text x="82" y="87" class="impact" font-size="30" fill="url(#gold)" filter="url(#glow)">ODDIX VIP BET SLIP</text>
        <text x="514" y="83" class="small" font-size="14" fill="#fef3c7">${code}</text>

        <rect x="84" y="122" width="180" height="34" rx="17" fill="url(#gold)"/>
        <text x="174" y="145" text-anchor="middle" class="heavy" font-size="15" fill="#1f1300">${stage}</text>
        <text x="286" y="144" class="small" font-size="16" fill="#4b5563">${league}</text>

        <text x="110" y="190" class="heavy" font-size="24" fill="#111827">${home}</text>
        <text x="418" y="190" text-anchor="middle" class="impact" font-size="24" fill="#7c2d12">VS</text>
        <text x="458" y="190" class="heavy" font-size="24" fill="#111827">${away}</text>

        <rect x="86" y="206" width="504" height="112" rx="20" fill="#ffffff" stroke="#ead7a2" stroke-width="2"/>
        <text x="110" y="226" class="small" font-size="14" fill="#92400e">${market}</text>
        ${tipText}

        <g>
          <rect x="86" y="336" width="132" height="74" rx="20" fill="url(#green)"/>
          <text x="152" y="363" text-anchor="middle" class="small" font-size="14" fill="#052e16">ODD</text>
          <text x="152" y="397" text-anchor="middle" class="impact" font-size="36" fill="#ffffff">${odd}</text>

          <rect x="236" y="336" width="156" height="74" rx="20" fill="#111827"/>
          <text x="314" y="363" text-anchor="middle" class="small" font-size="14" fill="#facc15">CONFIANÇA</text>
          <text x="314" y="395" text-anchor="middle" class="heavy" font-size="27" fill="#ffffff">${confidence}</text>

          <rect x="410" y="336" width="180" height="74" rx="20" fill="#fff7df" stroke="#d6b967" stroke-width="2"/>
          <text x="500" y="363" text-anchor="middle" class="small" font-size="14" fill="#92400e">STAKE</text>
          <text x="500" y="395" text-anchor="middle" class="heavy" font-size="25" fill="#111827">${stake}</text>
        </g>

        <rect x="86" y="425" width="504" height="34" rx="17" fill="#111827"/>
        <text x="338" y="447" text-anchor="middle" class="small" font-size="14" fill="#fff7ad">${valueLabel} • Risco ${risk} • 18+ Jogue com responsabilidade</text>

        <rect x="662" y="62" width="54" height="386" rx="18" fill="#111827"/>
        <text x="690" y="106" text-anchor="middle" class="impact" font-size="23" fill="#facc15" transform="rotate(90 690 106)">ESTRELABET</text>
        <text x="690" y="296" text-anchor="middle" class="small" font-size="13" fill="#fff7ad" transform="rotate(90 690 296)">PARCEIRO ODDIX</text>

        <rect x="724" y="0" width="292" height="515" fill="${rightShade}"/>
        <ellipse cx="854" cy="456" rx="140" ry="28" fill="#000" opacity=".46"/>
      </svg>
    `);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      this.logger.log("ODDIX VIP BET SLIP com jogador ativo");

      const outputPath = path.join(this.outputDir(), `vip-betslip-player-${Date.now()}.png`);
      const background = await this.createBetSlipBackground();
      const player = await this.oddixPlayerBuffer(300, 410);
      const overlay = this.betSlipOverlaySvg(input, !!player);
      const homeLogo = await this.logoBuffer(input.homeLogo, input.homeTeam, 58);
      const awayLogo = await this.logoBuffer(input.awayLogo, input.awayTeam, 58);

      const composites: sharp.OverlayOptions[] = [
        { input: homeLogo, left: 72, top: 166 },
        { input: awayLogo, left: 548, top: 166 },
      ];

      if (player) {
        composites.push({ input: player, left: 718, top: 74 });
      }

      composites.push({ input: overlay, left: 0, top: 0 });

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite(composites)
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar bilhete VIP Oddix: ${error?.message || "erro desconhecido"}`);
      return null;
    }
  }

  private multipleBetSlipOverlaySvg(input: OddixVipMultipleCardInput, hasPlayer = true) {
    const title = this.escape(this.short(input.title || "ODDIX MÚLTIPLA VIP", 30));
    const oddTotal = this.escape(this.formatOdd(input.oddTotal));
    const selections = input.selections.slice(0, 4);
    const code = this.escape(this.ticketCode(`${title}-${oddTotal}-${selections.map((s) => s.tip).join("|")}`));

    const rows = selections
      .map((selection, index) => {
        const y = 136 + index * 70;
        const game = this.escape(this.short(`${selection.homeTeam} x ${selection.awayTeam}`, 32));
        const tip = this.escape(this.short(this.stripPrefixTip(selection.tip).toUpperCase(), 32));
        const odd = this.escape(this.formatOdd(selection.odd));
        const confidence = selection.confidence
          ? this.escape(String(selection.confidence).includes("%") ? String(selection.confidence) : `${selection.confidence}%`)
          : "IA";

        return `
          <rect x="80" y="${y}" width="560" height="58" rx="18" fill="#ffffff" stroke="#ead7a2" stroke-width="2"/>
          <circle cx="112" cy="${y + 29}" r="20" fill="url(#gold)"/>
          <text x="112" y="${y + 37}" text-anchor="middle" class="heavy" font-size="22" fill="#111827">${index + 1}</text>
          <text x="146" y="${y + 23}" class="heavy" font-size="17" fill="#111827">${game}</text>
          <text x="146" y="${y + 47}" class="small" font-size="16" fill="#92400e">${tip}</text>
          <text x="562" y="${y + 22}" text-anchor="middle" class="small" font-size="13" fill="#6b21a8">${confidence}</text>
          <rect x="578" y="${y + 10}" width="48" height="38" rx="12" fill="url(#green)"/>
          <text x="602" y="${y + 35}" text-anchor="middle" class="heavy" font-size="16" fill="#ffffff">${odd}</text>
        `;
      })
      .join("");

    const rightShade = hasPlayer ? "rgba(0,0,0,.10)" : "rgba(0,0,0,.26)";

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ticket" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fffaf0"/><stop offset="100%" stop-color="#f4e7c3"/></linearGradient>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#ff7a18"/><stop offset="100%" stop-color="#facc15"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#047857"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".72"/></filter>
          <style>.impact{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:.8px}.heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}.small{font-family:Arial,sans-serif;font-weight:700}.text{font-family:Arial,sans-serif;font-weight:800}</style>
        </defs>

        <g filter="url(#shadow)">
          <rect x="42" y="34" width="690" height="447" rx="28" fill="url(#ticket)"/>
          <circle cx="42" cy="258" r="18" fill="#17062d"/>
          <circle cx="732" cy="258" r="18" fill="#1d0735"/>
          <path d="M650 56 L650 458" stroke="#b79a55" stroke-width="3" stroke-dasharray="10 10" opacity=".72"/>
        </g>

        <rect x="60" y="52" width="570" height="54" rx="18" fill="#111827"/>
        <text x="82" y="87" class="impact" font-size="30" fill="url(#gold)">${title}</text>
        <text x="522" y="83" class="small" font-size="14" fill="#fef3c7">${code}</text>
        <text x="82" y="124" class="small" font-size="17" fill="#4b5563">Bilhete premium filtrado pela Inteligência Artificial</text>

        ${rows}

        <rect x="80" y="426" width="260" height="42" rx="17" fill="#111827"/>
        <text x="210" y="453" text-anchor="middle" class="small" font-size="15" fill="#fff7ad">18+ Jogue com responsabilidade</text>

        <rect x="372" y="418" width="258" height="54" rx="20" fill="url(#gold)"/>
        <text x="460" y="451" text-anchor="middle" class="small" font-size="16" fill="#1f1300">ODD TOTAL</text>
        <text x="560" y="455" text-anchor="middle" class="impact" font-size="34" fill="#ffffff">${oddTotal}</text>

        <rect x="662" y="62" width="54" height="386" rx="18" fill="#111827"/>
        <text x="690" y="106" text-anchor="middle" class="impact" font-size="23" fill="#facc15" transform="rotate(90 690 106)">ESTRELABET</text>
        <text x="690" y="296" text-anchor="middle" class="small" font-size="13" fill="#fff7ad" transform="rotate(90 690 296)">PARCEIRO ODDIX</text>

        <rect x="724" y="0" width="292" height="515" fill="${rightShade}"/>
        <ellipse cx="854" cy="456" rx="140" ry="28" fill="#000" opacity=".46"/>
      </svg>
    `);
  }

  async createVipMultipleCard(input: OddixVipMultipleCardInput): Promise<string | null> {
    try {
      this.logger.log("ODDIX VIP MULTIPLE BET SLIP com jogador ativo");

      const outputPath = path.join(this.outputDir(), `vip-multiple-betslip-player-${Date.now()}.png`);
      const background = await this.createBetSlipBackground();
      const player = await this.oddixPlayerBuffer(300, 410);
      const overlay = this.multipleBetSlipOverlaySvg(input, !!player);

      const composites: sharp.OverlayOptions[] = [];

      if (player) {
        composites.push({ input: player, left: 718, top: 74 });
      }

      composites.push({ input: overlay, left: 0, top: 0 });

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite(composites)
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar bilhete múltipla VIP Oddix: ${error?.message || "erro desconhecido"}`);
      return null;
    }
  }
}
