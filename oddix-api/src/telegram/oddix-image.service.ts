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

export type OddixVipPlayerPropCardInput = {
  playerName: string;
  playerPhoto?: string | null;
  playerTeam?: string;
  playerRole?: string;
  playerNumber?: string | number | null;
  playerId?: string;
  playerUrl?: string;

  market?: string;
  marketName?: string;
  tip: string;
  selection?: string;
  odd: string | number;
  confidence?: string | number;
  risk?: string;

  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  opponentTeam?: string;
  homeLogo?: string;
  awayLogo?: string;
  teamLogo?: string;

  fixtureId?: string | number;
  source?: string;
  valueLabel?: string;
  status?: string;
  elapsed?: string | number | null;
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
    return String(value ?? "").replace(/\s+/g, " ").trim();
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

  private splitTipForTicket(value: any) {
    const tip = this.stripPrefixTip(value).toUpperCase();
    const match = tip.match(/^(OVER|UNDER|MAIS DE|MENOS DE)\s*([0-9]+(?:[.,][0-9]+)?)(.*)$/i);

    if (match) {
      return {
        main: `${match[1].toUpperCase()} ${match[2].replace(".", ",")}`,
        secondary: this.cleanText(match[3] || "ENTRADA ODDIX").replace(/^DE\s+/i, "") || "ENTRADA ODDIX",
      };
    }

    const lines = this.wrapText(tip, 20, 2);
    return {
      main: lines[0] || tip,
      secondary: lines.slice(1).join(" ") || "ENTRADA ODDIX",
    };
  }

  private splitPlayerPropLine(input: OddixVipPlayerPropCardInput) {
    const playerName = this.cleanText(input.playerName);
    const rawTip = this.stripPrefixTip(input.selection || input.tip || "");
    const cleaned = rawTip
      .replace(new RegExp(playerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "")
      .replace(/\s+/g, " ")
      .trim();

    const source = cleaned || rawTip;
    const normalized = this.normalize(source);

    if (
      normalized.includes("chute no gol") ||
      normalized.includes("shots on target") ||
      normalized.includes("sot")
    ) {
      const match = source.match(/(?:over|mais de|\+)?\s*([0-9]+(?:[.,][0-9]+)?)/i);
      return {
        main: `${match?.[1]?.replace(".", ",") || "0,5"}+ SOT`,
        secondary: "CHUTES NO GOL",
      };
    }

    if (
      normalized.includes("finaliz") ||
      normalized.includes("chutes") ||
      normalized.includes("shots")
    ) {
      const match = source.match(/(?:over|mais de|\+)?\s*([0-9]+(?:[.,][0-9]+)?)/i);
      return {
        main: `${match?.[1]?.replace(".", ",") || "1,5"}+`,
        secondary: "FINALIZAÇÕES",
      };
    }

    if (normalized.includes("assist")) {
      return {
        main: "0,5+",
        secondary: "ASSISTÊNCIA",
      };
    }

    if (normalized.includes("participa") || normalized.includes("gol")) {
      return {
        main: "1+",
        secondary: "PARTICIPAÇÃO EM GOL",
      };
    }

    const lines = this.wrapText(source, 18, 2);
    return {
      main: lines[0]?.toUpperCase() || "PLAYER PROP",
      secondary: lines.slice(1).join(" ").toUpperCase() || "MERCADO DE JOGADOR",
    };
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

  private confidenceNumber(value: any) {
    const parsed = Number(String(value ?? "").replace("%", "").replace(",", "."));
    if (!Number.isFinite(parsed)) return 85;
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }

  private formatConfidence(value: any, label?: any) {
    if (label) return this.cleanText(label);
    if (value === null || value === undefined || value === "") return "ALTA";
    const text = String(value);
    if (text.includes("%")) return text;
    const number = Number(text);
    if (Number.isFinite(number)) {
      if (number >= 85) return "ALTA";
      if (number >= 75) return "FORTE";
      return `${number}%`;
    }
    return text.toUpperCase();
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
      const safeUrl = String(url).replace(/\s+/g, "");
      const response = await axios.get(safeUrl, {
        responseType: "arraybuffer",
        timeout: 12000,
        headers: { "User-Agent": "Oddix/2.0" },
      });
      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  private async logoBuffer(url: string | undefined | null, teamName: string, size: number): Promise<Buffer> {
    const downloaded = await this.downloadImage(url || undefined);

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
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="45%" stop-color="#d1d5db"/>
            <stop offset="100%" stop-color="#111827"/>
          </linearGradient>
          <filter id="s"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#000" flood-opacity=".8"/></filter>
        </defs>
        <path d="M${size / 2} 6 L${size - 10} ${size * 0.26} L${size - 30} ${size - 14} L${size / 2} ${size - 4} L30 ${size - 14} L10 ${size * 0.26} Z" fill="url(#g)" stroke="#ffffff" stroke-width="4" filter="url(#s)"/>
        <text x="50%" y="58%" text-anchor="middle" font-family="Impact,Arial Black,Arial" font-size="${Math.round(size * 0.28)}" fill="#111827">${initials}</text>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async playerPhotoBuffer(url?: string | null, width = 330, height = 430): Promise<Buffer | null> {
    const downloaded = await this.downloadImage(url || undefined);

    if (!downloaded) return null;

    try {
      return await sharp(downloaded)
        .resize(width, height, {
          fit: "cover",
          position: "top",
        })
        .png()
        .toBuffer();
    } catch (error: any) {
      this.logger.warn(`Falha ao tratar foto real do jogador: ${error?.message || error}`);
      return null;
    }
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

  private async oddixPlayerBuffer(width = 360, height = 500): Promise<Buffer | null> {
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

  private async createPremiumBackground(): Promise<Buffer> {
    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#020005"/>
            <stop offset="38%" stop-color="#06040d"/>
            <stop offset="70%" stop-color="#1b0738"/>
            <stop offset="100%" stop-color="#050006"/>
          </linearGradient>
          <radialGradient id="gold" cx="26%" cy="0%" r="72%">
            <stop offset="0%" stop-color="#facc15" stop-opacity=".35"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="purple" cx="88%" cy="38%" r="58%">
            <stop offset="0%" stop-color="#8b5cf6" stop-opacity=".7"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#gold)"/>
        <rect width="100%" height="100%" fill="url(#purple)"/>
        <ellipse cx="846" cy="255" rx="155" ry="245" fill="#3b0764" opacity=".42" filter="url(#blur)"/>
        <ellipse cx="868" cy="458" rx="148" ry="28" fill="#000" opacity=".55"/>
        <path d="M0 430 C210 390 342 410 508 426 C680 442 812 410 1016 370 L1016 515 L0 515 Z" fill="#000" opacity=".32"/>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private barcodeSvg(x: number, y: number, width: number, height: number, code: string) {
    const seed = code.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let cursor = x + 24;
    const lines: string[] = [];

    for (let i = 0; i < 70 && cursor < x + width - 24; i++) {
      const stroke = 1 + ((seed + i * 7) % 4);
      const gap = 2 + ((seed + i * 11) % 4);
      const h = height - 14 - ((seed + i * 5) % 10);
      lines.push(`<line x1="${cursor}" y1="${y + 8}" x2="${cursor}" y2="${y + 8 + h}" stroke="#050505" stroke-width="${stroke}"/>`);
      cursor += stroke + gap;
    }

    return `
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#fffaf0" stroke="#e5d6ae" stroke-width="2"/>
      ${lines.join("")}
      <text x="${x + width / 2}" y="${y + height - 8}" text-anchor="middle" class="impact" font-size="20" fill="#111827">★ ${this.escape(code)} ★</text>
    `;
  }

  private betSlipOverlaySvg(input: OddixVipCardInput, hasPlayer = true) {
    const home = this.escape(this.short(input.homeTeam, 20).toUpperCase());
    const away = this.escape(this.short(input.awayTeam, 20).toUpperCase());
    const league = this.escape(this.short(input.league, 34).toUpperCase());
    const market = this.escape(this.short(input.market || "MERCADO", 22).toUpperCase());
    const tip = this.splitTipForTicket(input.tip);
    const mainTip = this.escape(this.short(tip.main, 15));
    const secondaryTip = this.escape(this.short(tip.secondary, 24));
    const odd = this.escape(this.formatOdd(input.odd));
    const confidence = this.escape(this.formatConfidence(input.confidence, input.confidenceLabel));
    const risk = this.escape(this.short(input.risk || "Baixo", 14).toUpperCase());
    const stake = this.escape(this.short(input.stake || "0.5 a 1 unidade", 18));
    const stage = this.escape(this.stageLabel(input));
    const code = this.escape(this.ticketCode(`${input.homeTeam}-${input.awayTeam}-${input.tip}-${input.odd}`));
    const valueLabel = this.escape(input.valueLabel || "VALOR MUITO ALTO");
    const playerShade = hasPlayer ? "rgba(0,0,0,.05)" : "rgba(0,0,0,.35)";

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#ff8a00"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#fff7ad"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#05a344"/><stop offset="100%" stop-color="#4ade80"/></linearGradient>
          <linearGradient id="purple" x1="0" x2="1"><stop offset="0%" stop-color="#6d28d9"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>
          <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#050505"/><stop offset="56%" stop-color="#080b14"/><stop offset="100%" stop-color="#120524"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="13" flood-color="#000" flood-opacity=".75"/></filter>
          <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#facc15" flood-opacity=".75"/></filter>
          <filter id="purpleGlow"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#a855f7" flood-opacity=".75"/></filter>
          <style>
            .impact{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
            .small{font-family:Arial,sans-serif;font-weight:700}
            .regular{font-family:Arial,sans-serif;font-weight:600}
          </style>
        </defs>

        <rect x="22" y="24" width="730" height="468" rx="24" fill="url(#panel)" stroke="#facc15" stroke-width="3" filter="url(#shadow)"/>
        <rect x="42" y="42" width="610" height="66" rx="18" fill="rgba(0,0,0,.78)" stroke="rgba(168,85,247,.35)"/>
        <text x="62" y="86" class="impact" font-size="44" fill="url(#gold)" filter="url(#glow)">ODDIX <tspan fill="#ffffff">VIP BET SLIP</tspan></text>
        <rect x="656" y="42" width="84" height="66" rx="16" fill="rgba(0,0,0,.62)" stroke="rgba(250,204,21,.42)"/>
        <text x="698" y="68" text-anchor="middle" class="small" font-size="13" fill="#facc15">${code}</text>
        <text x="698" y="91" text-anchor="middle" class="small" font-size="13" fill="#ffffff">ODDIX IA</text>

        <rect x="48" y="126" width="205" height="38" rx="13" fill="url(#gold)" filter="url(#glow)"/>
        <text x="150" y="151" text-anchor="middle" class="heavy" font-size="18" fill="#120a00">♛ ${stage}</text>
        <rect x="265" y="126" width="240" height="38" rx="13" fill="rgba(0,0,0,.72)" stroke="rgba(250,204,21,.38)"/>
        <text x="385" y="151" text-anchor="middle" class="small" font-size="17" fill="#ffffff">🇧🇷 ${league}</text>
        <rect x="518" y="126" width="214" height="38" rx="13" fill="rgba(0,0,0,.72)" stroke="rgba(250,204,21,.38)"/>
        <text x="625" y="151" text-anchor="middle" class="small" font-size="17" fill="#facc15">AO VIVO <tspan fill="#ef4444">●</tspan></text>

        <rect x="48" y="176" width="684" height="104" rx="16" fill="rgba(0,0,0,.62)" stroke="rgba(250,204,21,.45)"/>
        <text x="154" y="252" text-anchor="middle" class="heavy" font-size="25" fill="#ffffff">${home}</text>
        <text x="390" y="238" text-anchor="middle" class="impact" font-size="42" fill="#ffffff" filter="url(#purpleGlow)">VS</text>
        <text x="626" y="252" text-anchor="middle" class="heavy" font-size="25" fill="#ffffff">${away}</text>
        <rect x="350" y="238" width="80" height="32" rx="10" fill="rgba(0,0,0,.72)" stroke="#facc15"/>
        <text x="390" y="261" text-anchor="middle" class="heavy" font-size="19" fill="#facc15">${market}</text>

        <rect x="48" y="294" width="684" height="106" rx="18" fill="rgba(0,0,0,.82)" stroke="#facc15" stroke-width="2" filter="url(#glow)"/>
        <text x="88" y="327" class="heavy" font-size="22" fill="#facc15">🎯 PALPITE VIP</text>
        <text x="88" y="373" class="impact" font-size="55" fill="#ffffff" stroke="#000" stroke-width="2" paint-order="stroke">${mainTip}</text>
        <text x="92" y="395" class="heavy" font-size="26" fill="#ffffff">${secondaryTip}</text>
        <path d="M500 374 C560 332 604 330 696 318" stroke="#facc15" stroke-width="4" opacity=".38"/>
        <circle cx="612" cy="348" r="26" fill="#fff" opacity=".92"/>
        <text x="612" y="357" text-anchor="middle" font-size="31">⚽</text>

        <rect x="48" y="416" width="214" height="62" rx="18" fill="rgba(0,0,0,.78)" stroke="#22c55e" stroke-width="2" filter="url(#shadow)"/>
        <text x="155" y="439" text-anchor="middle" class="small" font-size="16" fill="#4ade80">ODD</text>
        <text x="155" y="472" text-anchor="middle" class="impact" font-size="42" fill="#4ade80">${odd}</text>

        <rect x="278" y="416" width="214" height="62" rx="18" fill="rgba(0,0,0,.78)" stroke="#facc15" stroke-width="2" filter="url(#shadow)"/>
        <text x="385" y="439" text-anchor="middle" class="small" font-size="16" fill="#facc15">CONFIANÇA</text>
        <text x="385" y="468" text-anchor="middle" class="heavy" font-size="29" fill="#ffffff">${confidence}</text>
        <text x="385" y="487" text-anchor="middle" class="small" font-size="13" fill="#facc15">RISCO ${risk}</text>

        <rect x="508" y="416" width="224" height="62" rx="18" fill="rgba(0,0,0,.78)" stroke="#a855f7" stroke-width="2" filter="url(#shadow)"/>
        <text x="620" y="439" text-anchor="middle" class="small" font-size="16" fill="#d946ef">STAKE</text>
        <text x="620" y="468" text-anchor="middle" class="heavy" font-size="27" fill="#ffffff">${stake}</text>
        <text x="620" y="487" text-anchor="middle" class="small" font-size="13" fill="#d946ef">GESTÃO INTELIGENTE</text>

        <rect x="772" y="18" width="222" height="479" rx="20" fill="rgba(8,5,20,.76)" stroke="#a855f7" stroke-width="2"/>
        <rect x="772" y="18" width="222" height="479" rx="20" fill="${playerShade}"/>
        <text x="883" y="58" text-anchor="middle" class="impact" font-size="30" fill="#ffffff">ESTRELA<tspan fill="#facc15">BET</tspan></text>
        <line x1="802" y1="74" x2="964" y2="74" stroke="#a855f7" opacity=".45"/>
        <text x="883" y="102" text-anchor="middle" class="small" font-size="15" fill="#ffffff">PARCEIRO OFICIAL</text>
        <text x="883" y="126" text-anchor="middle" class="impact" font-size="26" fill="#facc15">ODDIX</text>

        <rect x="790" y="304" width="186" height="96" rx="15" fill="rgba(0,0,0,.72)" stroke="rgba(250,204,21,.34)"/>
        <text x="812" y="330" class="small" font-size="14" fill="#ffffff">DESEMPENHO</text>
        <text x="812" y="354" class="small" font-size="13" fill="#22c55e">GREEN</text>
        <text x="948" y="354" text-anchor="end" class="heavy" font-size="17" fill="#22c55e">79</text>
        <text x="812" y="377" class="small" font-size="13" fill="#ef4444">REDS</text>
        <text x="948" y="377" text-anchor="end" class="heavy" font-size="17" fill="#ef4444">45</text>
        <text x="812" y="392" class="small" font-size="12" fill="#a3e635">WIN RATE 63.7%</text>

        <text x="883" y="432" text-anchor="middle" class="small" font-size="16" fill="#ffffff">JOGUE • CONECTE • DOMINE</text>
        <text x="883" y="458" text-anchor="middle" class="impact" font-size="24" fill="#ffffff">SEJA <tspan fill="#a3e635">ODDIX</tspan></text>
        <rect x="808" y="468" width="150" height="22" rx="7" fill="rgba(0,0,0,.72)" stroke="rgba(255,255,255,.22)"/>
        <text x="883" y="484" text-anchor="middle" class="small" font-size="12" fill="#ffffff">ACESSO VIA WEB APP</text>
      </svg>
    `);
  }

  private playerPropOverlaySvg(input: OddixVipPlayerPropCardInput, hasPlayerPhoto = true) {
    const playerName = this.escape(this.short(input.playerName, 28).toUpperCase());
    const team = this.escape(this.short(input.playerTeam, 28).toUpperCase());
    const opponent = this.escape(this.short(input.opponentTeam || "", 24).toUpperCase());
    const league = this.escape(this.short(input.league || "PLAYER PROPS", 32).toUpperCase());
    const market = this.escape(this.short(input.marketName || input.market || "PLAYER PROP", 24).toUpperCase());
    const role = this.escape(this.short(input.playerRole || "Atacante", 16).toUpperCase());
    const number = this.escape(input.playerNumber ? `#${input.playerNumber}` : "#ODX");
    const line = this.splitPlayerPropLine(input);
    const mainLine = this.escape(this.short(line.main, 15).toUpperCase());
    const secondaryLine = this.escape(this.short(line.secondary, 28).toUpperCase());
    const odd = this.escape(this.formatOdd(input.odd));
    const confidenceValue = this.confidenceNumber(input.confidence);
    const confidence = this.escape(`${confidenceValue}%`);
    const risk = this.escape(this.short(input.risk || "Baixo", 14).toUpperCase());
    const source = this.escape(this.short(input.source || "FLASHScore Lineups", 24).toUpperCase());
    const code = this.escape(this.ticketCode(`${input.fixtureId || ""}-${input.playerName}-${input.tip}-${input.odd}`));
    const valueLabel = this.escape(input.valueLabel || "ESCALAÇÃO REAL");
    const barWidth = Math.max(12, Math.round((confidenceValue / 100) * 214));
    const photoShade = hasPlayerPhoto ? "rgba(0,0,0,.05)" : "rgba(0,0,0,.55)";

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#ff8a00"/><stop offset="50%" stop-color="#facc15"/><stop offset="100%" stop-color="#fff7ad"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#05a344"/><stop offset="100%" stop-color="#4ade80"/></linearGradient>
          <linearGradient id="purple" x1="0" x2="1"><stop offset="0%" stop-color="#6d28d9"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>
          <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#050505"/><stop offset="54%" stop-color="#080b14"/><stop offset="100%" stop-color="#17072a"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="13" flood-color="#000" flood-opacity=".75"/></filter>
          <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#facc15" flood-opacity=".75"/></filter>
          <filter id="purpleGlow"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#a855f7" flood-opacity=".75"/></filter>
          <clipPath id="photoClip"><rect x="656" y="75" width="302" height="392" rx="26"/></clipPath>
          <style>
            .impact{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .small{font-family:Arial,sans-serif;font-weight:700}
            .regular{font-family:Arial,sans-serif;font-weight:600}
          </style>
        </defs>

        <rect x="22" y="24" width="970" height="468" rx="28" fill="url(#panel)" stroke="#facc15" stroke-width="3" filter="url(#shadow)"/>
        <rect x="42" y="42" width="590" height="64" rx="18" fill="rgba(0,0,0,.78)" stroke="rgba(168,85,247,.35)"/>
        <text x="62" y="83" class="impact" font-size="42" fill="url(#gold)" filter="url(#glow)">ODDIX <tspan fill="#ffffff">PLAYER PROP</tspan></text>
        <rect x="502" y="55" width="112" height="34" rx="12" fill="rgba(250,204,21,.16)" stroke="rgba(250,204,21,.55)"/>
        <text x="558" y="78" text-anchor="middle" class="small" font-size="14" fill="#facc15">${valueLabel}</text>

        <rect x="42" y="122" width="215" height="38" rx="13" fill="url(#gold)" filter="url(#glow)"/>
        <text x="150" y="147" text-anchor="middle" class="heavy" font-size="18" fill="#120a00">♛ TOP PROP VIP</text>
        <rect x="268" y="122" width="174" height="38" rx="13" fill="rgba(0,0,0,.72)" stroke="rgba(250,204,21,.38)"/>
        <text x="355" y="147" text-anchor="middle" class="small" font-size="16" fill="#ffffff">${market}</text>
        <rect x="454" y="122" width="178" height="38" rx="13" fill="rgba(0,0,0,.72)" stroke="rgba(168,85,247,.45)"/>
        <text x="543" y="147" text-anchor="middle" class="small" font-size="16" fill="#d8b4fe">${source}</text>

        <rect x="48" y="178" width="560" height="96" rx="18" fill="rgba(0,0,0,.64)" stroke="rgba(250,204,21,.34)"/>
        <text x="74" y="211" class="small" font-size="15" fill="#facc15">JOGADOR</text>
        <text x="74" y="249" class="impact" font-size="43" fill="#ffffff" stroke="#000" stroke-width="1" paint-order="stroke">${playerName}</text>
        <rect x="424" y="195" width="76" height="58" rx="15" fill="rgba(250,204,21,.14)" stroke="rgba(250,204,21,.52)"/>
        <text x="462" y="233" text-anchor="middle" class="impact" font-size="34" fill="#facc15">${number}</text>
        <rect x="510" y="195" width="76" height="58" rx="15" fill="rgba(168,85,247,.14)" stroke="rgba(168,85,247,.52)"/>
        <text x="548" y="218" text-anchor="middle" class="small" font-size="12" fill="#d8b4fe">FUNÇÃO</text>
        <text x="548" y="241" text-anchor="middle" class="heavy" font-size="15" fill="#ffffff">${role}</text>

        <rect x="48" y="288" width="560" height="100" rx="20" fill="rgba(0,0,0,.84)" stroke="#facc15" stroke-width="2" filter="url(#glow)"/>
        <text x="76" y="320" class="small" font-size="16" fill="#facc15">🎯 ENTRADA ODDIX</text>
        <text x="76" y="363" class="impact" font-size="51" fill="#ffffff" stroke="#000" stroke-width="2" paint-order="stroke">${mainLine}</text>
        <text x="282" y="361" class="heavy" font-size="25" fill="#facc15">${secondaryLine}</text>

        <rect x="48" y="404" width="168" height="62" rx="18" fill="rgba(0,0,0,.80)" stroke="#22c55e" stroke-width="2"/>
        <text x="132" y="427" text-anchor="middle" class="small" font-size="15" fill="#4ade80">ODD</text>
        <text x="132" y="460" text-anchor="middle" class="impact" font-size="40" fill="#4ade80">${odd}</text>

        <rect x="232" y="404" width="222" height="62" rx="18" fill="rgba(0,0,0,.80)" stroke="#facc15" stroke-width="2"/>
        <text x="343" y="427" text-anchor="middle" class="small" font-size="15" fill="#facc15">CONFIANÇA</text>
        <rect x="276" y="440" width="134" height="10" rx="5" fill="rgba(255,255,255,.15)"/>
        <rect x="276" y="440" width="${Math.round((confidenceValue / 100) * 134)}" height="10" rx="5" fill="url(#green)"/>
        <text x="343" y="465" text-anchor="middle" class="heavy" font-size="22" fill="#ffffff">${confidence}</text>

        <rect x="470" y="404" width="138" height="62" rx="18" fill="rgba(0,0,0,.80)" stroke="#a855f7" stroke-width="2"/>
        <text x="539" y="427" text-anchor="middle" class="small" font-size="15" fill="#d8b4fe">RISCO</text>
        <text x="539" y="459" text-anchor="middle" class="heavy" font-size="24" fill="#ffffff">${risk}</text>

        <rect x="656" y="75" width="302" height="392" rx="26" fill="rgba(0,0,0,.74)" stroke="#a855f7" stroke-width="2" filter="url(#shadow)"/>
        <rect x="656" y="75" width="302" height="392" rx="26" fill="${photoShade}"/>
        <rect x="676" y="92" width="262" height="38" rx="13" fill="rgba(0,0,0,.72)" stroke="rgba(250,204,21,.38)"/>
        <text x="807" y="117" text-anchor="middle" class="heavy" font-size="18" fill="#facc15">${team}</text>

        <rect x="681" y="378" width="252" height="70" rx="18" fill="rgba(0,0,0,.78)" stroke="rgba(250,204,21,.35)"/>
        <text x="807" y="405" text-anchor="middle" class="small" font-size="14" fill="#ffffff">${league}</text>
        <text x="807" y="431" text-anchor="middle" class="heavy" font-size="18" fill="#facc15">${opponent ? `VS ${opponent}` : code}</text>

        <rect x="672" y="470" width="270" height="18" rx="7" fill="rgba(0,0,0,.78)" stroke="rgba(255,255,255,.16)"/>
        <text x="807" y="484" text-anchor="middle" class="small" font-size="11" fill="#ffffff">ESCALAÇÃO REAL • SEM JOGADOR GENÉRICO</text>
      </svg>
    `);
  }

  async createVipPlayerPropCard(input: OddixVipPlayerPropCardInput): Promise<string | null> {
    try {
      this.logger.log("ODDIX PLAYER PROP VIP card com foto real ativo");

      if (!input.playerPhoto) {
        this.logger.warn(`Player Prop sem foto real ignorado: ${input.playerName}`);
        return null;
      }

      const outputPath = path.join(this.outputDir(), `vip-player-prop-${Date.now()}.png`);
      const background = await this.createPremiumBackground();
      const playerPhoto = await this.playerPhotoBuffer(input.playerPhoto, 330, 430);
      const teamLogo = await this.logoBuffer(
        input.teamLogo || input.homeLogo || input.awayLogo || "",
        input.playerTeam || input.homeTeam || input.awayTeam || "Oddix",
        74,
      );
      const overlay = this.playerPropOverlaySvg(input, !!playerPhoto);

      if (!playerPhoto) {
        this.logger.warn(`Não foi possível baixar a foto real do jogador: ${input.playerName}`);
        return null;
      }

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite([
          { input: playerPhoto, left: 642, top: 72 },
          { input: teamLogo, left: 915, top: 91 },
          { input: overlay, left: 0, top: 0 },
        ])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card Player Prop VIP Oddix: ${error?.message || "erro desconhecido"}`);
      return null;
    }
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      this.logger.log("ODDIX VIP BET SLIP premium EstrelaBet layout ativo");

      const outputPath = path.join(this.outputDir(), `vip-betslip-premium-${Date.now()}.png`);
      const background = await this.createPremiumBackground();
      const player = await this.oddixPlayerBuffer(390, 520);
      const overlay = this.betSlipOverlaySvg(input, !!player);
      const homeLogo = await this.logoBuffer(input.homeLogo, input.homeTeam, 96);
      const awayLogo = await this.logoBuffer(input.awayLogo, input.awayTeam, 96);

      const composites: any[] = [];

      if (player) {
        composites.push({ input: player, left: 650, top: 0 });
      }

      composites.push(
        { input: homeLogo, left: 104, top: 174 },
        { input: awayLogo, left: 578, top: 174 },
        { input: overlay, left: 0, top: 0 },
      );

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite(composites)
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar bilhete VIP Oddix premium: ${error?.message || "erro desconhecido"}`);
      return null;
    }
  }

  private multipleBetSlipOverlaySvg(input: OddixVipMultipleCardInput, hasPlayer = true) {
    const title = this.escape(this.short(input.title || "ODDIX MÚLTIPLA VIP", 28).toUpperCase());
    const oddTotal = this.escape(this.formatOdd(input.oddTotal));
    const selections = input.selections.slice(0, 4);
    const code = this.escape(this.ticketCode(`${title}-${oddTotal}-${selections.map((s) => s.tip).join("|")}`));
    const playerShade = hasPlayer ? "rgba(0,0,0,.05)" : "rgba(0,0,0,.35)";

    const rows = selections
      .map((selection, index) => {
        const y = 148 + index * 66;
        const game = this.escape(this.short(`${selection.homeTeam} x ${selection.awayTeam}`, 31).toUpperCase());
        const tip = this.escape(this.short(this.stripPrefixTip(selection.tip).toUpperCase(), 30));
        const odd = this.escape(this.formatOdd(selection.odd));
        const confidence = selection.confidence
          ? this.escape(String(selection.confidence).includes("%") ? String(selection.confidence) : `${selection.confidence}%`)
          : "IA";

        return `
          <rect x="58" y="${y}" width="670" height="56" rx="15" fill="rgba(0,0,0,.72)" stroke="rgba(250,204,21,.42)"/>
          <circle cx="88" cy="${y + 28}" r="18" fill="url(#gold)"/>
          <text x="88" y="${y + 36}" text-anchor="middle" class="heavy" font-size="20" fill="#111827">${index + 1}</text>
          <text x="118" y="${y + 24}" class="heavy" font-size="16" fill="#ffffff">${game}</text>
          <text x="118" y="${y + 47}" class="small" font-size="15" fill="#facc15">${tip}</text>
          <text x="614" y="${y + 24}" text-anchor="middle" class="small" font-size="13" fill="#d8b4fe">${confidence}</text>
          <rect x="644" y="${y + 9}" width="68" height="38" rx="11" fill="url(#green)"/>
          <text x="678" y="${y + 34}" text-anchor="middle" class="heavy" font-size="17" fill="#ffffff">${odd}</text>
        `;
      })
      .join("");

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#ff8a00"/><stop offset="100%" stop-color="#facc15"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#05a344"/><stop offset="100%" stop-color="#4ade80"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="13" flood-color="#000" flood-opacity=".75"/></filter>
          <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#facc15" flood-opacity=".75"/></filter>
          <style>.impact{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px}.heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}.small{font-family:Arial,sans-serif;font-weight:700}.text{font-family:Arial,sans-serif;font-weight:800}</style>
        </defs>

        <rect x="22" y="24" width="730" height="468" rx="24" fill="#07070c" stroke="#facc15" stroke-width="3" filter="url(#shadow)"/>
        <rect x="42" y="42" width="610" height="66" rx="18" fill="rgba(0,0,0,.78)" stroke="rgba(168,85,247,.35)"/>
        <text x="62" y="86" class="impact" font-size="42" fill="url(#gold)" filter="url(#glow)">${title}</text>
        <rect x="656" y="42" width="84" height="66" rx="16" fill="rgba(0,0,0,.62)" stroke="rgba(250,204,21,.42)"/>
        <text x="698" y="68" text-anchor="middle" class="small" font-size="13" fill="#facc15">${code}</text>
        <text x="698" y="91" text-anchor="middle" class="small" font-size="13" fill="#ffffff">MÚLTIPLA</text>
        <text x="62" y="126" class="small" font-size="17" fill="#ffffff">Bilhete premium filtrado pela Inteligência Artificial</text>

        ${rows}

        <rect x="58" y="425" width="328" height="50" rx="16" fill="rgba(0,0,0,.76)" stroke="rgba(250,204,21,.42)"/>
        <text x="222" y="456" text-anchor="middle" class="small" font-size="17" fill="#fff7ad">18+ JOGUE COM RESPONSABILIDADE</text>
        <rect x="408" y="416" width="320" height="60" rx="18" fill="url(#gold)" filter="url(#glow)"/>
        <text x="528" y="452" text-anchor="middle" class="small" font-size="18" fill="#1f1300">ODD TOTAL</text>
        <text x="642" y="459" text-anchor="middle" class="impact" font-size="38" fill="#ffffff">${oddTotal}</text>

        <rect x="772" y="18" width="222" height="479" rx="20" fill="rgba(8,5,20,.76)" stroke="#a855f7" stroke-width="2"/>
        <rect x="772" y="18" width="222" height="479" rx="20" fill="${playerShade}"/>
        <text x="883" y="58" text-anchor="middle" class="impact" font-size="30" fill="#ffffff">ESTRELA<tspan fill="#facc15">BET</tspan></text>
        <text x="883" y="104" text-anchor="middle" class="small" font-size="15" fill="#ffffff">PARCEIRO OFICIAL</text>
        <text x="883" y="128" text-anchor="middle" class="impact" font-size="26" fill="#facc15">ODDIX</text>
        <text x="883" y="432" text-anchor="middle" class="small" font-size="16" fill="#ffffff">JOGUE • CONECTE • DOMINE</text>
        <text x="883" y="458" text-anchor="middle" class="impact" font-size="24" fill="#ffffff">SEJA <tspan fill="#a3e635">ODDIX</tspan></text>
      </svg>
    `);
  }

  async createVipMultipleCard(input: OddixVipMultipleCardInput): Promise<string | null> {
    try {
      this.logger.log("ODDIX VIP MULTIPLE premium EstrelaBet layout ativo");

      const outputPath = path.join(this.outputDir(), `vip-multiple-premium-${Date.now()}.png`);
      const background = await this.createPremiumBackground();
      const player = await this.oddixPlayerBuffer(390, 520);
      const overlay = this.multipleBetSlipOverlaySvg(input, !!player);

      const composites: any[] = [];

      if (player) {
        composites.push({ input: player, left: 650, top: 0 });
      }

      composites.push({ input: overlay, left: 0, top: 0 });

      await sharp(background)
        .resize(this.width, this.height, { fit: "cover" })
        .composite(composites)
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar bilhete múltipla VIP Oddix premium: ${error?.message || "erro desconhecido"}`);
      return null;
    }
  }
}
