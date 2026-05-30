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
  title?: string;
  oddTotal: string | number;
  selections: Array<{
    homeTeam: string;
    awayTeam: string;
    league?: string;
    tip: string;
    odd: string | number;
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

  private short(value: any, max = 28) {
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

  private initials(name: string) {
    return String(name || 'OD')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  private async downloadImage(url?: string): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 12000,
        headers: { 'User-Agent': 'Oddix/1.0' },
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
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    }

    const initials = this.escape(this.initials(teamName));
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#ffb000"/>
            <stop offset="60%" stop-color="#1f1300"/>
            <stop offset="100%" stop-color="#000000"/>
          </radialGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".7"/></filter>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 7}" fill="url(#g)" stroke="#ff8c00" stroke-width="5" filter="url(#shadow)"/>
        <text x="50%" y="57%" text-anchor="middle" font-family="Arial Black,Arial" font-size="${Math.round(size * 0.34)}" fill="#fff">${initials}</text>
      </svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async createBackground(inputText: string): Promise<Buffer> {
    const usePollinations = String(process.env.ODDIX_USE_POLLINATIONS_BG || 'false').toLowerCase() === 'true';

    if (usePollinations) {
      const seed = this.seedFromText(inputText);
      const prompt = [
        'horizontal 1016x515 ultra premium sports betting card background',
        'black and orange luxury sportsbook style',
        'cinematic football stadium at night',
        'orange fire light smoke particles',
        'dark clean space for overlay text',
        'high contrast professional WhatsApp betting card',
        'no readable text no letters no numbers no logos no watermarks',
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
          timeout: 45000,
          headers: { 'User-Agent': 'Oddix/1.0' },
        });
        return sharp(Buffer.from(response.data)).resize(this.width, this.height, { fit: 'cover' }).png().toBuffer();
      } catch (error: any) {
        this.logger.warn(`Pollinations falhou. Usando fundo fallback: ${error?.message || 'erro desconhecido'}`);
      }
    }

    return this.createFallbackBackground(inputText);
  }

  private async createFallbackBackground(inputText: string): Promise<Buffer> {
    const seed = this.seedFromText(inputText);
    const lines = Array.from({ length: 22 })
      .map((_, i) => {
        const x = (i * 71 + seed) % this.width;
        const opacity = ((i % 4) + 1) * 0.025;
        return `<line x1="${x}" y1="0" x2="${x - 180}" y2="${this.height}" stroke="#ff8c00" stroke-width="2" opacity="${opacity}"/>`;
      })
      .join('');

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#050505"/>
            <stop offset="45%" stop-color="#15100a"/>
            <stop offset="100%" stop-color="#000000"/>
          </linearGradient>
          <radialGradient id="orangeLeft" cx="18%" cy="48%" r="55%">
            <stop offset="0%" stop-color="#ff8c00" stop-opacity=".44"/>
            <stop offset="60%" stop-color="#ff8c00" stop-opacity=".08"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="orangeRight" cx="82%" cy="42%" r="58%">
            <stop offset="0%" stop-color="#ffb000" stop-opacity=".34"/>
            <stop offset="65%" stop-color="#ff8c00" stop-opacity=".06"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#orangeLeft)"/>
        <rect width="100%" height="100%" fill="url(#orangeRight)"/>
        <g>${lines}</g>
        <ellipse cx="508" cy="465" rx="520" ry="70" fill="#ff8c00" opacity=".10" filter="url(#blur)"/>
        <ellipse cx="508" cy="58" rx="460" ry="68" fill="#ffb000" opacity=".09" filter="url(#blur)"/>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,.36)"/>
      </svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private singleOverlaySvg(input: OddixVipCardInput) {
    const home = this.escape(this.short(input.homeTeam, 20));
    const away = this.escape(this.short(input.awayTeam, 20));
    const league = this.escape(this.short(input.league, 35));
    const tip = this.escape(this.short(input.tip, 32).toUpperCase());
    const odd = this.escape(String(input.odd ?? '-'));

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="orange" x1="0" x2="1"><stop offset="0%" stop-color="#ff7a00"/><stop offset="100%" stop-color="#ffb000"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000" flood-opacity=".75"/></filter>
          <filter id="soft"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:700}
          </style>
        </defs>

        <rect x="24" y="22" width="968" height="471" rx="30" fill="rgba(0,0,0,.48)" stroke="#ff8c00" stroke-width="3" filter="url(#shadow)"/>
        <rect x="42" y="40" width="932" height="435" rx="24" fill="rgba(8,8,8,.54)" stroke="rgba(255,176,0,.35)" stroke-width="1"/>

        <text x="508" y="79" text-anchor="middle" class="title" font-size="46" fill="#ffffff">ODDIX</text>
        <text x="650" y="79" text-anchor="middle" class="title" font-size="46" fill="url(#orange)" filter="url(#soft)">VIP</text>
        <path d="M384 96 C452 82, 565 82, 632 96" stroke="#ff8c00" stroke-width="4" fill="none" opacity=".95"/>

        <text x="508" y="128" text-anchor="middle" class="text" font-size="22" fill="#d6d6d6">${league}</text>
        <text x="242" y="336" text-anchor="middle" class="heavy" font-size="28" fill="#ffffff">${home}</text>
        <text x="774" y="336" text-anchor="middle" class="heavy" font-size="28" fill="#ffffff">${away}</text>

        <circle cx="508" cy="242" r="48" fill="rgba(255,140,0,.13)" stroke="#ff8c00" stroke-width="3"/>
        <text x="508" y="258" text-anchor="middle" class="title" font-size="38" fill="#ffffff">VS</text>

        <rect x="308" y="154" width="400" height="104" rx="22" fill="rgba(255,140,0,.14)" stroke="#ff8c00" stroke-width="3"/>
        <text x="508" y="219" text-anchor="middle" class="heavy" font-size="38" fill="#ffffff">${tip}</text>

        <rect x="393" y="282" width="230" height="82" rx="20" fill="url(#orange)" filter="url(#shadow)"/>
        <text x="508" y="315" text-anchor="middle" class="text" font-size="21" fill="#1b0b00">ODD</text>
        <text x="508" y="350" text-anchor="middle" class="heavy" font-size="41" fill="#ffffff">${odd}</text>

        <text x="508" y="430" text-anchor="middle" class="text" font-size="23" fill="#ffffff">🤖 Entrada validada pela IA Oddix</text>
      </svg>`);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      const outputPath = path.join(this.outputDir(), `vip-card-${Date.now()}.png`);
      const background = await this.createBackground(`${input.homeTeam}-${input.awayTeam}-${input.tip}`);
      const overlay = this.singleOverlaySvg(input);
      const homeLogo = await this.logoBuffer(input.homeLogo, input.homeTeam, 132);
      const awayLogo = await this.logoBuffer(input.awayLogo, input.awayTeam, 132);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([
          { input: homeLogo, left: 176, top: 174 },
          { input: awayLogo, left: 708, top: 174 },
          { input: overlay, left: 0, top: 0 },
        ])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card VIP: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }

  private multipleOverlaySvg(input: OddixVipMultipleCardInput) {
    const title = this.escape(input.title || 'ODDIX BOOST VIP');
    const oddTotal = this.escape(String(input.oddTotal ?? '-'));
    const selections = input.selections.slice(0, 3);

    const rows = selections.map((selection, index) => {
      const y = 150 + index * 92;
      const game = this.escape(this.short(`${selection.homeTeam} x ${selection.awayTeam}`, 30));
      const tip = this.escape(this.short(selection.tip, 28).toUpperCase());
      const odd = this.escape(String(selection.odd ?? '-'));
      return `
        <rect x="70" y="${y}" width="700" height="72" rx="18" fill="rgba(0,0,0,.52)" stroke="rgba(255,140,0,.55)" stroke-width="2"/>
        <circle cx="106" cy="${y + 36}" r="22" fill="#ff8c00"/>
        <text x="106" y="${y + 45}" text-anchor="middle" class="heavy" font-size="24" fill="#fff">${index + 1}</text>
        <text x="150" y="${y + 30}" class="heavy" font-size="22" fill="#ffffff">${game}</text>
        <text x="150" y="${y + 58}" class="text" font-size="22" fill="#ffb000">${tip}</text>
        <rect x="790" y="${y}" width="154" height="72" rx="18" fill="url(#orange)"/>
        <text x="867" y="${y + 30}" text-anchor="middle" class="text" font-size="18" fill="#1b0b00">ODD</text>
        <text x="867" y="${y + 58}" text-anchor="middle" class="heavy" font-size="31" fill="#fff">${odd}</text>
      `;
    }).join('');

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="orange" x1="0" x2="1"><stop offset="0%" stop-color="#ff7a00"/><stop offset="100%" stop-color="#ffb000"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000" flood-opacity=".75"/></filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:700}
          </style>
        </defs>
        <rect x="24" y="22" width="968" height="471" rx="30" fill="rgba(0,0,0,.50)" stroke="#ff8c00" stroke-width="3" filter="url(#shadow)"/>
        <text x="508" y="82" text-anchor="middle" class="title" font-size="48" fill="#ffffff">${title}</text>
        <text x="508" y="120" text-anchor="middle" class="text" font-size="21" fill="#d6d6d6">Múltipla selecionada pela IA</text>
        ${rows}
        <rect x="328" y="422" width="360" height="54" rx="18" fill="url(#orange)"/>
        <text x="508" y="457" text-anchor="middle" class="heavy" font-size="30" fill="#ffffff">ODD TOTAL ${oddTotal}</text>
      </svg>`);
  }

  async createVipMultipleCard(input: OddixVipMultipleCardInput): Promise<string | null> {
    try {
      const outputPath = path.join(this.outputDir(), `vip-multiple-${Date.now()}.png`);
      const background = await this.createBackground(`multiple-${input.oddTotal}-${input.selections.map((s) => s.tip).join('-')}`);
      const overlay = this.multipleOverlaySvg(input);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([{ input: overlay, left: 0, top: 0 }])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card de múltipla VIP: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }
}
