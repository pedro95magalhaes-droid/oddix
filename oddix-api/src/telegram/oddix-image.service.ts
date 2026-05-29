import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

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
};

export type OddixVipMultipleCardInput = {
  legs: Array<{
    homeTeam: string;
    awayTeam: string;
    league?: string;
    tip: string;
    odd: string | number;
    homeLogo?: string;
    awayLogo?: string;
  }>;
  oddTotal: string | number;
};

@Injectable()
export class OddixImageService {
  private readonly logger = new Logger(OddixImageService.name);
  private readonly width = 1016;
  private readonly height = 515;

  private outputDir() {
    const dir = path.join(process.cwd(), 'tmp', 'oddix-cards');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private escape(value: any) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private short(value: any, max = 34) {
    const text = String(value ?? '').trim();
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  private seedFromText(text: string) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private async downloadImage(url?: string): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Oddix/1.0' },
      });
      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  private async logoBuffer(url: string | undefined, name: string, size: number) {
    const downloaded = await this.downloadImage(url);
    if (downloaded) {
      return sharp(downloaded)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    }

    const initials = this.escape(
      String(name || 'OD')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(''),
    );

    return Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#ff9f1c" stop-opacity=".95"/>
            <stop offset="70%" stop-color="#111827" stop-opacity=".98"/>
            <stop offset="100%" stop-color="#000000"/>
          </radialGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".65"/></filter>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 7}" fill="url(#g)" stroke="#ff8c00" stroke-width="5" filter="url(#shadow)"/>
        <text x="50%" y="58%" text-anchor="middle" font-family="Arial Black,Arial" font-size="${Math.round(size * 0.3)}" fill="#fff">${initials}</text>
      </svg>
    `);
  }

  private async createPollinationsBackground(input: OddixVipCardInput | OddixVipMultipleCardInput): Promise<Buffer> {
    const seed = this.seedFromText(JSON.stringify(input));
    const prompt = [
      'horizontal 1016x515 ultra premium football sports betting card background',
      'black and orange luxury sportsbook style',
      'cinematic football stadium at night',
      'orange lights, smoke, subtle fire particles',
      'dark clean empty center area for text overlay',
      'professional VIP tipster design',
      'high contrast, premium typography space',
      'no readable text, no numbers, no logos, no watermark, no neon green, no blue',
    ].join(', ');

    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=${this.width}` +
      `&height=${this.height}` +
      `&model=flux` +
      `&seed=${seed}` +
      `&nologo=true`;

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 65000,
        headers: { 'User-Agent': 'Oddix/1.0' },
      });
      return sharp(Buffer.from(response.data)).resize(this.width, this.height, { fit: 'cover' }).png().toBuffer();
    } catch (error: any) {
      this.logger.warn(`Pollinations falhou. Usando fundo fallback: ${error?.message || 'erro desconhecido'}`);
      return this.createFallbackBackground();
    }
  }

  private async createFallbackBackground(): Promise<Buffer> {
    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#030303"/>
            <stop offset="45%" stop-color="#111827"/>
            <stop offset="100%" stop-color="#000000"/>
          </linearGradient>
          <radialGradient id="orangeLeft" cx="0%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#ff8c00" stop-opacity=".45"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="orangeRight" cx="100%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#ff6a00" stop-opacity=".38"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#orangeLeft)"/>
        <rect width="100%" height="100%" fill="url(#orangeRight)"/>
        <g opacity=".18">
          <path d="M0 420 C200 310, 380 370, 560 300 S840 230, 1016 340" stroke="#ff8c00" stroke-width="3" fill="none"/>
          <path d="M0 455 C240 345, 460 405, 655 325 S900 270, 1016 370" stroke="#ffb000" stroke-width="2" fill="none"/>
          <circle cx="160" cy="390" r="170" fill="#ff8c00" opacity=".14" filter="url(#blur)"/>
          <circle cx="860" cy="110" r="180" fill="#ff6a00" opacity=".16" filter="url(#blur)"/>
        </g>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private overlaySingleSvg(input: OddixVipCardInput) {
    const home = this.escape(this.short(input.homeTeam, 18));
    const away = this.escape(this.short(input.awayTeam, 18));
    const league = this.escape(this.short(input.league, 38));
    const tip = this.escape(this.short(input.tip, 34).toUpperCase());
    const odd = this.escape(String(input.odd ?? '-'));
    const status = this.escape(input.status || 'ODDIX VIP');
    const elapsed = input.elapsed ? ` • ${this.escape(input.elapsed)}'` : '';

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="orange" x1="0" x2="1">
            <stop offset="0%" stop-color="#ff6a00"/>
            <stop offset="100%" stop-color="#ffb000"/>
          </linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity=".75"/></filter>
          <filter id="soft"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
          </style>
        </defs>
        <rect x="0" y="0" width="1016" height="515" fill="rgba(0,0,0,.34)"/>
        <rect x="22" y="20" width="972" height="475" rx="32" fill="rgba(0,0,0,.50)" stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"/>

        <text x="508" y="68" text-anchor="middle" class="title" font-size="40" fill="#ffffff">ODDIX</text>
        <text x="617" y="68" text-anchor="middle" class="title" font-size="40" fill="url(#orange)">VIP</text>
        <text x="508" y="101" text-anchor="middle" class="text" font-size="15" fill="#f8fafc" opacity=".78">${status}${elapsed} • ${league}</text>

        <rect x="58" y="122" width="900" height="252" rx="28" fill="rgba(17,24,39,.74)" stroke="rgba(255,140,0,.55)" stroke-width="2"/>
        <text x="252" y="288" text-anchor="middle" class="heavy" font-size="30" fill="#ffffff">${home}</text>
        <text x="764" y="288" text-anchor="middle" class="heavy" font-size="30" fill="#ffffff">${away}</text>
        <text x="508" y="256" text-anchor="middle" class="title" font-size="72" fill="url(#orange)" filter="url(#soft)">VS</text>

        <rect x="220" y="386" width="576" height="70" rx="22" fill="url(#orange)" filter="url(#shadow)"/>
        <text x="508" y="433" text-anchor="middle" class="heavy" font-size="32" fill="#09090b">🔥 ${tip}</text>

        <rect x="794" y="390" width="150" height="62" rx="18" fill="#050505" stroke="#ffb000" stroke-width="2"/>
        <text x="869" y="415" text-anchor="middle" class="text" font-size="17" fill="#ffb000">ODD</text>
        <text x="869" y="443" text-anchor="middle" class="heavy" font-size="28" fill="#ffffff">${odd}</text>

        <text x="508" y="482" text-anchor="middle" class="text" font-size="16" fill="#ffffff" opacity=".86">🤖 Entrada validada pela IA Oddix</text>
      </svg>
    `);
  }

  private overlayMultipleSvg(input: OddixVipMultipleCardInput) {
    const oddTotal = this.escape(String(input.oddTotal ?? '-'));
    const rows = input.legs.slice(0, 3).map((leg, index) => {
      const y = 148 + index * 92;
      const game = this.escape(`${this.short(leg.homeTeam, 18)} x ${this.short(leg.awayTeam, 18)}`);
      const tip = this.escape(this.short(leg.tip, 28).toUpperCase());
      const odd = this.escape(String(leg.odd ?? '-'));
      return `
        <rect x="70" y="${y}" width="708" height="70" rx="18" fill="rgba(17,24,39,.78)" stroke="rgba(255,140,0,.45)" stroke-width="2"/>
        <text x="100" y="${y + 29}" class="text" font-size="22" fill="#ffffff">${index + 1}. ${game}</text>
        <text x="100" y="${y + 56}" class="heavy" font-size="22" fill="#ffb000">${tip}</text>
        <rect x="800" y="${y}" width="145" height="70" rx="18" fill="#050505" stroke="#ffb000" stroke-width="2"/>
        <text x="872" y="${y + 28}" text-anchor="middle" class="text" font-size="16" fill="#ffb000">ODD</text>
        <text x="872" y="${y + 58}" text-anchor="middle" class="heavy" font-size="26" fill="#ffffff">${odd}</text>
      `;
    }).join('');

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="orange" x1="0" x2="1"><stop offset="0%" stop-color="#ff6a00"/><stop offset="100%" stop-color="#ffb000"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity=".75"/></filter>
          <style>.title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}.heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}.text{font-family:Arial,sans-serif;font-weight:800}</style>
        </defs>
        <rect width="1016" height="515" fill="rgba(0,0,0,.36)"/>
        <rect x="22" y="20" width="972" height="475" rx="32" fill="rgba(0,0,0,.52)" stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"/>
        <text x="508" y="70" text-anchor="middle" class="title" font-size="40" fill="#ffffff">ODDIX BOOST</text>
        <text x="508" y="106" text-anchor="middle" class="text" font-size="17" fill="#ffb000">MÚLTIPLA VIP VALIDADA PELA IA</text>
        ${rows}
        <rect x="330" y="423" width="356" height="58" rx="20" fill="url(#orange)"/>
        <text x="508" y="462" text-anchor="middle" class="heavy" font-size="30" fill="#09090b">🔥 ODD TOTAL ${oddTotal}</text>
      </svg>
    `);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      const background = await this.createPollinationsBackground(input);
      const homeLogo = await this.logoBuffer(input.homeLogo, input.homeTeam, 128);
      const awayLogo = await this.logoBuffer(input.awayLogo, input.awayTeam, 128);
      const overlay = this.overlaySingleSvg(input);

      const outputPath = path.join(
        this.outputDir(),
        `oddix-vip-${Date.now()}-${this.seedFromText(input.homeTeam + input.awayTeam)}.png`,
      );

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([
          { input: overlay, left: 0, top: 0 },
          { input: homeLogo, left: 188, top: 150 },
          { input: awayLogo, left: 700, top: 150 },
        ])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card Oddix VIP: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }

  async createVipMultipleCard(input: OddixVipMultipleCardInput): Promise<string | null> {
    try {
      const background = await this.createPollinationsBackground(input);
      const overlay = this.overlayMultipleSvg(input);
      const outputPath = path.join(this.outputDir(), `oddix-boost-vip-${Date.now()}.png`);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([{ input: overlay, left: 0, top: 0 }])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card múltipla Oddix VIP: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }
}
