import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { MarketingImageService } from '../marketing/marketing-image.service';

type SimpleCardInput = {
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  market?: string;
  tip?: string;
  odd?: number | string;
  confidence?: number | string;
  risk?: string;
  stake?: string;
  homeLogo?: string;
  awayLogo?: string;
};

type MultipleSelection = {
  game?: string;
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  market?: string;
  tip?: string;
  odd?: number | string;
  confidence?: number | string;
  risk?: string;
  homeLogo?: string;
  awayLogo?: string;
};

type MultipleCardInput = {
  selections?: MultipleSelection[];
  combinedOdd?: number | string;
  confidence?: number | string;
  risk?: string;
  stake?: string;
};

@Injectable()
export class OddixImageService {
  private readonly logger = new Logger(OddixImageService.name);
  private readonly outputDir = path.join(process.cwd(), 'generated');

  constructor(private readonly marketingImageService: MarketingImageService) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async createVipCard(data: SimpleCardInput): Promise<string | null> {
    try {
      const width = 1062;
      const height = 515;
      const variation = this.randomVariation(4);

      const home = data.homeTeam || 'Time Casa';
      const away = data.awayTeam || 'Time Fora';
      const league = data.league || 'ODDIX IA';
      const market = data.market || 'Mercado';
      const tip = data.tip || 'Entrada ao vivo';
      const odd = data.odd || '1.50';
      const confidence = data.confidence || 75;
      const risk = data.risk || 'Médio';
      const stake = data.stake || '0.25 a 0.50 unidade';

      const bgPath = await this.marketingImageService.generateSimpleBackground({
        homeTeam: home,
        awayTeam: away,
        league,
        variation,
      });

      const background = bgPath
        ? sharp(bgPath).resize(width, height).png()
        : sharp(Buffer.from(this.fallbackSimpleBackgroundSvg(width, height, variation))).png();

      const homeLogo = await this.logoToBuffer(data.homeLogo, home, 76);
      const awayLogo = await this.logoToBuffer(data.awayLogo, away, 76);

      const overlay = Buffer.from(
        this.simpleOverlaySvg({
          width,
          height,
          variation,
          home,
          away,
          league,
          market,
          tip,
          odd,
          confidence,
          risk,
          stake,
        }),
      );

      const logo = this.simpleLogoPosition(variation);

      const filePath = path.join(this.outputDir, `oddix-simple-${Date.now()}.png`);

      await background
        .composite([
          { input: homeLogo, left: logo.homeLeft, top: logo.top },
          { input: awayLogo, left: logo.awayLeft, top: logo.top },
          { input: overlay, left: 0, top: 0 },
        ])
        .png()
        .toFile(filePath);

      return filePath;
    } catch (error) {
      this.logger.error('Erro createVipCard', error);
      return null;
    }
  }

  async createMultipleCard(data: MultipleCardInput): Promise<string | null> {
    try {
      const width = 1080;
      const height = 1350;
      const variation = this.randomVariation(4);
      const selections = (data.selections || []).slice(0, 4);

      const bgPath = await this.marketingImageService.generateMultipleBackground({
        variation,
      });

      const background = bgPath
        ? sharp(bgPath).resize(width, height).png()
        : sharp(Buffer.from(this.fallbackMultipleBackgroundSvg(width, height, variation))).png();

      const composites: sharp.OverlayOptions[] = [];
      let rows = '';

      const rowConfig = this.multipleRowConfig(variation);

      for (let index = 0; index < selections.length; index++) {
        const item = selections[index];
        const y = rowConfig.startY + index * rowConfig.gap;

        const home =
          item.homeTeam ||
          item.game?.split(' x ')?.[0] ||
          item.game?.split(' vs ')?.[0] ||
          'Casa';

        const away =
          item.awayTeam ||
          item.game?.split(' x ')?.[1] ||
          item.game?.split(' vs ')?.[1] ||
          'Fora';

        const tip = item.tip || 'Entrada ao vivo';
        const odd = item.odd || '1.50';

        const homeLogo = await this.logoToBuffer(item.homeLogo, home, rowConfig.logoSize);
        const awayLogo = await this.logoToBuffer(item.awayLogo, away, rowConfig.logoSize);

        composites.push({ input: homeLogo, left: rowConfig.homeLogoLeft, top: y + rowConfig.logoTop });
        composites.push({ input: awayLogo, left: rowConfig.awayLogoLeft, top: y + rowConfig.logoTop });

        rows += this.multipleRowSvg({
          index,
          y,
          home,
          away,
          tip,
          odd,
          variation,
          rowConfig,
        });
      }

      const combinedOdd = data.combinedOdd || '2.50';
      const confidence = data.confidence || 75;
      const risk = data.risk || 'Médio';

      const overlay = Buffer.from(
        this.multipleOverlaySvg({
          width,
          height,
          variation,
          rows,
          combinedOdd,
          confidence,
          risk,
        }),
      );

      composites.unshift({ input: overlay, left: 0, top: 0 });

      const filePath = path.join(this.outputDir, `oddix-multiple-${Date.now()}.png`);

      await background.composite(composites).png().toFile(filePath);

      return filePath;
    } catch (error) {
      this.logger.error('Erro createMultipleCard', error);
      return null;
    }
  }

  private simpleOverlaySvg(params: {
    width: number;
    height: number;
    variation: number;
    home: string;
    away: string;
    league: string;
    market: string;
    tip: string;
    odd: number | string;
    confidence: number | string;
    risk: string;
    stake: string;
  }) {
    const {
      width,
      height,
      variation,
      home,
      away,
      league,
      market,
      tip,
      odd,
      confidence,
      risk,
      stake,
    } = params;

    const configs = [
      {
        titleA: 'AUMENTADA',
        titleB: 'NA FINAL',
        titleY: 58,
        panel: { x: 280, y: 255, w: 560, h: 170 },
        confidence: { x: 78, y: 205 },
        risk: { x: 840, y: 205 },
        accent: '#f59e0b',
        border: '#ec4899',
        footer: 'ODDIX BOOST',
      },
      {
        titleA: 'VIP',
        titleB: 'SIGNAL',
        titleY: 62,
        panel: { x: 245, y: 245, w: 610, h: 182 },
        confidence: { x: 65, y: 325 },
        risk: { x: 852, y: 325 },
        accent: '#d4af37',
        border: '#2563eb',
        footer: 'ENTRADA PREMIUM',
      },
      {
        titleA: 'ODDIX',
        titleB: 'BOOST',
        titleY: 60,
        panel: { x: 330, y: 238, w: 430, h: 190 },
        confidence: { x: 80, y: 190 },
        risk: { x: 840, y: 190 },
        accent: '#facc15',
        border: '#7c3aed',
        footer: 'SINAL INTELIGENTE',
      },
      {
        titleA: 'ENTRADA',
        titleB: 'PREMIUM',
        titleY: 60,
        panel: { x: 270, y: 235, w: 585, h: 188 },
        confidence: { x: 70, y: 200 },
        risk: { x: 847, y: 200 },
        accent: '#eab308',
        border: '#0ea5e9',
        footer: 'GREEN É MÉTODO',
      },
    ];

    const cfg = configs[variation - 1];
    const p = cfg.panel;

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000000" flood-opacity="0.92"/>
          </filter>
          <filter id="accentGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${cfg.accent}" flood-opacity="0.75"/>
          </filter>
          <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#151515" stop-opacity="0.90"/>
            <stop offset="100%" stop-color="#05070d" stop-opacity="0.96"/>
          </linearGradient>
          <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${cfg.accent}"/>
            <stop offset="100%" stop-color="${cfg.border}"/>
          </linearGradient>
        </defs>

        <rect width="${width}" height="${height}" fill="#000000" opacity="0.10"/>

        <text x="531" y="${cfg.titleY}" text-anchor="middle" font-family="Impact, Arial Black, Arial" font-size="50" font-weight="900" fill="#f8fafc" filter="url(#shadow)">
          ${cfg.titleA} <tspan fill="${cfg.accent}">${cfg.titleB}</tspan>
        </text>

        <path d="M335 82 C455 65 605 65 735 82" stroke="${cfg.accent}" stroke-width="4" fill="none" opacity="0.85"/>

        <rect x="${cfg.confidence.x}" y="${cfg.confidence.y}" width="145" height="86" rx="14" fill="#111827" opacity="0.82" stroke="${cfg.accent}" stroke-width="2"/>
        <text x="${cfg.confidence.x + 72}" y="${cfg.confidence.y + 31}" text-anchor="middle" font-family="Arial Black, Arial" font-size="17" fill="${cfg.accent}">CONFIANÇA</text>
        <text x="${cfg.confidence.x + 72}" y="${cfg.confidence.y + 72}" text-anchor="middle" font-family="Arial Black, Arial" font-size="39" fill="#ffffff">${this.escapeXml(String(confidence))}%</text>

        <rect x="${cfg.risk.x}" y="${cfg.risk.y}" width="145" height="86" rx="14" fill="#111827" opacity="0.82" stroke="#ef4444" stroke-width="2"/>
        <text x="${cfg.risk.x + 72}" y="${cfg.risk.y + 31}" text-anchor="middle" font-family="Arial Black, Arial" font-size="17" fill="#ef4444">RISCO</text>
        <text x="${cfg.risk.x + 72}" y="${cfg.risk.y + 71}" text-anchor="middle" font-family="Arial Black, Arial" font-size="31" fill="#ffffff">${this.escapeXml(String(risk).toUpperCase())}</text>

        <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="18" fill="url(#panel)" stroke="url(#line)" stroke-width="2.2" filter="url(#shadow)"/>

        <circle cx="${p.x + 35}" cy="${p.y + 28}" r="10" fill="${cfg.accent}"/>
        <rect x="${p.x + 57}" y="${p.y + 14}" width="42" height="28" rx="8" fill="${cfg.accent}"/>
        <text x="${p.x + 78}" y="${p.y + 34}" text-anchor="middle" font-family="Arial Black, Arial" font-size="17" fill="#111827">CA</text>

        <text x="${p.x + 115}" y="${p.y + 34}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#ffffff">
          ${this.escapeXml(this.truncate(league, 25))}
        </text>

        <text x="${p.x + 65}" y="${p.y + 79}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#ffffff">
          ${this.escapeXml(this.truncate(home, 17))}
        </text>

        <text x="${p.x + 225}" y="${p.y + 79}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#ffffff">x</text>

        <text x="${p.x + 255}" y="${p.y + 79}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#ffffff">
          ${this.escapeXml(this.truncate(away, 17))}
        </text>

        <rect x="${p.x + p.w - 160}" y="${p.y + 17}" width="105" height="60" rx="10" fill="#111827" stroke="${cfg.accent}" stroke-width="2" filter="url(#accentGlow)"/>
        <text x="${p.x + p.w - 107}" y="${p.y + 41}" text-anchor="middle" font-family="Arial Black, Arial" font-size="18" fill="${cfg.accent}">ODD</text>
        <text x="${p.x + p.w - 107}" y="${p.y + 71}" text-anchor="middle" font-family="Arial Black, Arial" font-size="33" fill="${cfg.accent}">
          ${this.escapeXml(String(odd))}
        </text>

        <circle cx="${p.x + 35}" cy="${p.y + 120}" r="8" fill="${cfg.accent}"/>
        <line x1="${p.x + 35}" y1="${p.y + 120}" x2="${p.x + 35}" y2="${p.y + 158}" stroke="${cfg.accent}" stroke-width="4"/>
        <circle cx="${p.x + 35}" cy="${p.y + 158}" r="8" fill="${cfg.accent}"/>

        <text x="${p.x + 65}" y="${p.y + 125}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#ffffff">
          ${this.escapeXml(this.truncate(market, 30))}
        </text>

        <text x="${p.x + 65}" y="${p.y + 161}" font-family="Arial Black, Arial" font-size="22" fill="#ffffff">
          ${this.escapeXml(this.truncate(tip, 31))}
        </text>

        <text x="531" y="492" text-anchor="middle" font-family="Arial Black, Arial" font-size="17" fill="#f8fafc">
          ${cfg.footer} • ${this.escapeXml(String(stake).toUpperCase())}
        </text>
      </svg>
    `;
  }

  private simpleLogoPosition(variation: number) {
    const positions = [
      { homeLeft: 390, awayLeft: 585, top: 155 },
      { homeLeft: 365, awayLeft: 620, top: 150 },
      { homeLeft: 420, awayLeft: 560, top: 155 },
      { homeLeft: 385, awayLeft: 600, top: 145 },
    ];

    return positions[variation - 1];
  }

  private multipleRowConfig(variation: number) {
    const configs = [
      {
        startY: 315,
        gap: 175,
        logoSize: 92,
        homeLogoLeft: 170,
        awayLogoLeft: 285,
        logoTop: 26,
        textX: 410,
        oddX: 860,
        oddTextX: 922,
        rowW: 970,
      },
      {
        startY: 330,
        gap: 165,
        logoSize: 82,
        homeLogoLeft: 165,
        awayLogoLeft: 275,
        logoTop: 30,
        textX: 395,
        oddX: 850,
        oddTextX: 912,
        rowW: 970,
      },
      {
        startY: 300,
        gap: 185,
        logoSize: 96,
        homeLogoLeft: 175,
        awayLogoLeft: 292,
        logoTop: 24,
        textX: 420,
        oddX: 865,
        oddTextX: 927,
        rowW: 960,
      },
      {
        startY: 320,
        gap: 172,
        logoSize: 88,
        homeLogoLeft: 168,
        awayLogoLeft: 280,
        logoTop: 28,
        textX: 405,
        oddX: 855,
        oddTextX: 917,
        rowW: 970,
      },
    ];

    return configs[variation - 1];
  }

  private multipleRowSvg(params: {
    index: number;
    y: number;
    home: string;
    away: string;
    tip: string;
    odd: number | string;
    variation: number;
    rowConfig: ReturnType<OddixImageService['multipleRowConfig']>;
  }) {
    const { index, y, home, away, tip, odd, variation, rowConfig } = params;

    const accents = ['#f59e0b', '#d4af37', '#f97316', '#eab308'];
    const borders = ['#f59e0b', '#2563eb', '#7c3aed', '#0ea5e9'];

    const accent = accents[variation - 1];
    const border = borders[variation - 1];

    const rowX = variation === 3 ? 65 : 55;

    return `
      <rect x="${rowX}" y="${y}" width="${rowConfig.rowW}" height="140" rx="26" fill="#030712" opacity="0.86" stroke="${border}" stroke-width="3"/>
      <rect x="${rowX}" y="${y}" width="16" height="140" rx="8" fill="${accent}"/>

      <circle cx="${rowX + 60}" cy="${y + 70}" r="34" fill="${accent}"/>
      <text x="${rowX + 60}" y="${y + 83}" text-anchor="middle" font-family="Arial Black, Arial" font-size="36" fill="#020617">${index + 1}</text>

      <text x="270" y="${y + 91}" text-anchor="middle" font-family="Arial Black, Arial" font-size="22" fill="#ffffff">X</text>

      <text x="${rowConfig.textX}" y="${y + 55}" font-family="Arial Black, Arial" font-size="${variation === 2 ? 27 : 29}" fill="#ffffff">
        ${this.escapeXml(this.truncate(`${home} x ${away}`.toUpperCase(), 21))}
      </text>

      <text x="${rowConfig.textX}" y="${y + 102}" font-family="Arial Black, Arial" font-size="${variation === 2 ? 22 : 24}" fill="${accent}">
        ${this.escapeXml(this.truncate(tip.toUpperCase(), 27))}
      </text>

      <rect x="${rowConfig.oddX}" y="${y + 36}" width="125" height="70" rx="18" fill="${accent}"/>
      <text x="${rowConfig.oddTextX}" y="${y + 64}" text-anchor="middle" font-family="Arial Black, Arial" font-size="20" fill="#020617">ODD</text>
      <text x="${rowConfig.oddTextX}" y="${y + 100}" text-anchor="middle" font-family="Arial Black, Arial" font-size="34" fill="#020617">${this.escapeXml(String(odd))}</text>
    `;
  }

  private multipleOverlaySvg(params: {
    width: number;
    height: number;
    variation: number;
    rows: string;
    combinedOdd: number | string;
    confidence: number | string;
    risk: string;
  }) {
    const { width, height, variation, rows, combinedOdd, confidence, risk } = params;

    const titles = [
      { a: 'MÚLTIPLA', b: 'VIP', sub: 'BILHETE AUTOMÁTICO DA IA', accent: '#f59e0b' },
      { a: 'COMBO', b: 'PREMIUM', sub: 'SELEÇÃO ESPECIAL ODDIX', accent: '#d4af37' },
      { a: 'PACOTE', b: 'VIP', sub: 'ENTRADAS FILTRADAS PELA IA', accent: '#f97316' },
      { a: 'BILHETE', b: 'IA', sub: 'MÚLTIPLA CONSERVADORA', accent: '#eab308' },
    ];

    const t = titles[variation - 1];

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.95"/>
          </filter>
        </defs>

        <text x="540" y="95" text-anchor="middle" font-family="Arial Black, Arial" font-size="40" fill="#ffffff" letter-spacing="3">
          ODDIX <tspan fill="${t.accent}">BOOST</tspan>
        </text>

        <text x="540" y="190" text-anchor="middle" font-family="Arial Black, Arial" font-size="80" fill="#ffffff" filter="url(#shadow)">
          ${t.a} <tspan fill="${t.accent}">${t.b}</tspan>
        </text>

        <text x="540" y="245" text-anchor="middle" font-family="Arial Black, Arial" font-size="29" fill="${t.accent}">
          ${t.sub}
        </text>

        ${rows}

        <rect x="55" y="1085" width="970" height="150" rx="28" fill="#030712" opacity="0.94" stroke="${t.accent}" stroke-width="4"/>

        <text x="232" y="1150" text-anchor="middle" font-family="Arial Black, Arial" font-size="23" fill="${t.accent}">ODD COMBINADA</text>
        <text x="232" y="1196" text-anchor="middle" font-family="Arial Black, Arial" font-size="47" fill="#ffffff">${this.escapeXml(String(combinedOdd))}</text>

        <text x="542" y="1150" text-anchor="middle" font-family="Arial Black, Arial" font-size="23" fill="${t.accent}">CONFIANÇA</text>
        <text x="542" y="1196" text-anchor="middle" font-family="Arial Black, Arial" font-size="47" fill="#ffffff">${this.escapeXml(String(confidence))}%</text>

        <text x="852" y="1150" text-anchor="middle" font-family="Arial Black, Arial" font-size="23" fill="#ef4444">RISCO</text>
        <text x="852" y="1196" text-anchor="middle" font-family="Arial Black, Arial" font-size="42" fill="#ef4444">${this.escapeXml(String(risk).toUpperCase())}</text>

        <text x="540" y="1285" text-anchor="middle" font-family="Arial Black, Arial" font-size="35" fill="#ffffff">
          GREEN É MÉTODO. <tspan fill="${t.accent}">NÃO É SORTE.</tspan>
        </text>
      </svg>
    `;
  }

  private fallbackSimpleBackgroundSvg(width: number, height: number, variation: number) {
    const colors = [
      { a: '#020617', b: '#0f172a', glow: '#f59e0b' },
      { a: '#05070d', b: '#111827', glow: '#2563eb' },
      { a: '#070707', b: '#1f2937', glow: '#7c3aed' },
      { a: '#020617', b: '#111111', glow: '#eab308' },
    ][variation - 1];

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${colors.a}"/>
            <stop offset="45%" stop-color="${colors.b}"/>
            <stop offset="100%" stop-color="${colors.a}"/>
          </linearGradient>
          <radialGradient id="glow" cx="65%" cy="22%" r="65%">
            <stop offset="0%" stop-color="${colors.glow}" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)"/>
        <rect width="${width}" height="${height}" fill="url(#glow)"/>
      </svg>
    `;
  }

  private fallbackMultipleBackgroundSvg(width: number, height: number, variation: number) {
    const glow = ['#f59e0b', '#2563eb', '#7c3aed', '#eab308'][variation - 1];

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow" cx="50%" cy="25%" r="70%">
            <stop offset="0%" stop-color="${glow}" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="#020617"/>
        <rect width="${width}" height="${height}" fill="url(#glow)"/>
      </svg>
    `;
  }

  private randomVariation(max: number): number {
    return Math.floor(Math.random() * max) + 1;
  }

  private async logoToBuffer(
    logoUrl?: string,
    fallbackName = 'Time',
    size = 130,
  ): Promise<Buffer> {
    try {
      if (!logoUrl) return this.avatarFallbackBuffer(fallbackName, size);

      const response = await fetch(logoUrl);
      if (!response.ok) return this.avatarFallbackBuffer(fallbackName, size);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return sharp(buffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch {
      return this.avatarFallbackBuffer(fallbackName, size);
    }
  }

  private async avatarFallbackBuffer(name: string, size: number): Promise<Buffer> {
    const initials = String(name || 'T')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join('');

    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#f59e0b"/>
        <text x="${size / 2}" y="${size * 0.60}" text-anchor="middle"
          font-family="Arial Black, Arial" font-size="${Math.round(size * 0.34)}" fill="#020617">
          ${this.escapeXml(initials || 'T')}
        </text>
      </svg>
    `;

    return Buffer.from(svg);
  }

  private truncate(text: any, max: number): string {
    const value = String(text || '');
    if (value.length <= max) return value;
    return `${value.slice(0, max - 3)}...`;
  }

  private escapeXml(value: any): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}