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
    confidence?: string | number;
    risk?: string;
    homeLogo?: string;
    awayLogo?: string;
  }>;
};

@Injectable()
export class OddixImageService {
  private readonly logger = new Logger(OddixImageService.name);

  // Vertical premium, melhor para WhatsApp Status, Instagram Story e grupos.
  private readonly width = 1080;
  private readonly height = 1350;

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

  private cleanText(value: any) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private short(value: any, max = 32) {
    const text = this.cleanText(value);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  private wrapText(value: any, maxCharsPerLine = 22, maxLines = 3) {
    const words = this.cleanText(value).split(' ').filter(Boolean);
    const lines: string[] = [];
    let current = '';

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

    return lines.slice(0, maxLines).map((line, index) => {
      if (index === maxLines - 1 && words.join(' ').length > lines.join(' ').length) {
        return this.short(line, maxCharsPerLine);
      }
      return line;
    });
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
        .resize(size, size, {
          fit: 'contain',
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
            <stop offset="55%" stop-color="#7c3aed"/>
            <stop offset="100%" stop-color="#111827"/>
          </radialGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".8"/>
          </filter>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 8}" fill="url(#g)" stroke="#facc15" stroke-width="6" filter="url(#shadow)"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 18}" fill="rgba(0,0,0,.26)" stroke="rgba(255,255,255,.20)" stroke-width="2"/>
        <text x="50%" y="57%" text-anchor="middle" font-family="Arial Black,Arial" font-size="${Math.round(size * 0.31)}" fill="#fff">${initials}</text>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async createBackground(inputText: string): Promise<Buffer> {
    const usePollinations = String(process.env.ODDIX_USE_POLLINATIONS_BG || 'false').toLowerCase() === 'true';

    if (usePollinations) {
      const seed = this.seedFromText(inputText);
      const prompt = [
        'vertical 1080x1350 ultra premium football betting card background',
        'purple black gold neon luxury sportsbook style',
        'cinematic night stadium smoke particles',
        'professional tipster vip design',
        'dark center space for overlay text',
        'no readable text no letters no numbers no logos no watermark',
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

        return sharp(Buffer.from(response.data))
          .resize(this.width, this.height, { fit: 'cover' })
          .png()
          .toBuffer();
      } catch (error: any) {
        this.logger.warn(`Pollinations falhou. Usando fundo local: ${error?.message || 'erro desconhecido'}`);
      }
    }

    return this.createFallbackBackground(inputText);
  }

  private async createFallbackBackground(inputText: string): Promise<Buffer> {
    const seed = this.seedFromText(inputText);

    const lines = Array.from({ length: 34 })
      .map((_, i) => {
        const x = (i * 91 + seed) % this.width;
        const opacity = ((i % 5) + 1) * 0.022;
        return `<line x1="${x}" y1="0" x2="${x - 260}" y2="${this.height}" stroke="#facc15" stroke-width="2" opacity="${opacity}"/>`;
      })
      .join('');

    const dots = Array.from({ length: 80 })
      .map((_, i) => {
        const x = (seed + i * 137) % this.width;
        const y = (seed + i * 211) % this.height;
        const r = 1 + (i % 4);
        const o = 0.05 + (i % 4) * 0.03;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="#facc15" opacity="${o}"/>`;
      })
      .join('');

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#070014"/>
            <stop offset="42%" stop-color="#1e0b46"/>
            <stop offset="75%" stop-color="#4c1d95"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
          <radialGradient id="goldTop" cx="50%" cy="0%" r="82%">
            <stop offset="0%" stop-color="#facc15" stop-opacity=".42"/>
            <stop offset="48%" stop-color="#a855f7" stop-opacity=".18"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="greenBottom" cx="50%" cy="100%" r="72%">
            <stop offset="0%" stop-color="#22c55e" stop-opacity=".30"/>
            <stop offset="54%" stop-color="#7c3aed" stop-opacity=".13"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="darkCenter" cx="50%" cy="50%" r="58%">
            <stop offset="0%" stop-color="#111827" stop-opacity=".68"/>
            <stop offset="70%" stop-color="#050505" stop-opacity=".18"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="26"/></filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#goldTop)"/>
        <rect width="100%" height="100%" fill="url(#greenBottom)"/>
        <rect width="100%" height="100%" fill="url(#darkCenter)"/>
        <g>${lines}</g>
        <g>${dots}</g>
        <ellipse cx="540" cy="1270" rx="560" ry="92" fill="#22c55e" opacity=".12" filter="url(#blur)"/>
        <ellipse cx="540" cy="80" rx="620" ry="110" fill="#facc15" opacity=".12" filter="url(#blur)"/>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.18)"/>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private singleOverlaySvg(input: OddixVipCardInput) {
    const home = this.escape(this.short(input.homeTeam, 18));
    const away = this.escape(this.short(input.awayTeam, 18));
    const league = this.escape(this.short(input.league, 42));
    const market = this.escape(this.short(input.market || 'Entrada Oddix', 26).toUpperCase());
    const odd = this.escape(String(input.odd ?? '-'));
    const confidence = this.escape(String(input.confidence ?? '-'));
    const risk = this.escape(this.short(input.risk || 'Médio', 12));
    const stake = this.escape(this.short(input.stake || '0.5 a 1 unidade', 24));

    const tipLines = this.wrapText(input.tip, 20, 3)
      .map((line, index) => {
        const y = 682 + index * 66;
        return `<text x="540" y="${y}" text-anchor="middle" class="mainTip" font-size="58" fill="#ffffff">${this.escape(line.toUpperCase())}</text>`;
      })
      .join('');

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#facc15"/>
          </linearGradient>
          <linearGradient id="green" x1="0" x2="1">
            <stop offset="0%" stop-color="#16a34a"/>
            <stop offset="100%" stop-color="#22c55e"/>
          </linearGradient>
          <linearGradient id="purple" x1="0" x2="1">
            <stop offset="0%" stop-color="#4c1d95"/>
            <stop offset="100%" stop-color="#7c3aed"/>
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity=".82"/>
          </filter>
          <filter id="glow">
            <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#facc15" flood-opacity=".62"/>
          </filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:700}
            .mainTip{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px}
            .small{font-family:Arial,sans-serif;font-weight:800}
          </style>
        </defs>

        <rect x="38" y="34" width="1004" height="1282" rx="42" fill="rgba(0,0,0,.42)" stroke="url(#gold)" stroke-width="4" filter="url(#shadow)"/>
        <rect x="62" y="58" width="956" height="1234" rx="34" fill="rgba(8,8,14,.60)" stroke="rgba(250,204,21,.26)" stroke-width="2"/>

        <rect x="116" y="92" width="848" height="94" rx="28" fill="rgba(255,255,255,.08)" stroke="rgba(250,204,21,.24)" stroke-width="2"/>
        <text x="432" y="156" text-anchor="middle" class="title" font-size="64" fill="#ffffff">ODDIX</text>
        <text x="650" y="156" text-anchor="middle" class="title" font-size="64" fill="url(#gold)" filter="url(#glow)">VIP</text>

        <text x="540" y="230" text-anchor="middle" class="text" font-size="30" fill="#e5e7eb">${league}</text>

        <rect x="96" y="280" width="888" height="286" rx="34" fill="rgba(17,24,39,.62)" stroke="rgba(255,255,255,.13)" stroke-width="2"/>
        <circle cx="540" cy="416" r="58" fill="rgba(250,204,21,.12)" stroke="url(#gold)" stroke-width="5"/>
        <text x="540" y="438" text-anchor="middle" class="title" font-size="48" fill="#ffffff">VS</text>

        <text x="280" y="527" text-anchor="middle" class="heavy" font-size="34" fill="#ffffff">${home}</text>
        <text x="800" y="527" text-anchor="middle" class="heavy" font-size="34" fill="#ffffff">${away}</text>

        <rect x="128" y="598" width="824" height="272" rx="36" fill="rgba(0,0,0,.44)" stroke="rgba(250,204,21,.38)" stroke-width="2"/>
        <rect x="350" y="620" width="380" height="46" rx="23" fill="url(#purple)" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
        <text x="540" y="652" text-anchor="middle" class="small" font-size="22" fill="#facc15">${market}</text>
        ${tipLines}

        <g filter="url(#shadow)">
          <rect x="96" y="912" width="268" height="148" rx="28" fill="url(#gold)"/>
          <text x="230" y="962" text-anchor="middle" class="text" font-size="28" fill="#1f1300">ODD</text>
          <text x="230" y="1026" text-anchor="middle" class="heavy" font-size="64" fill="#ffffff">${odd}</text>

          <rect x="406" y="912" width="268" height="148" rx="28" fill="url(#green)"/>
          <text x="540" y="962" text-anchor="middle" class="text" font-size="28" fill="#052e16">CONFIANÇA</text>
          <text x="540" y="1026" text-anchor="middle" class="heavy" font-size="64" fill="#ffffff">${confidence}%</text>

          <rect x="716" y="912" width="268" height="148" rx="28" fill="rgba(255,255,255,.10)" stroke="rgba(250,204,21,.34)" stroke-width="2"/>
          <text x="850" y="962" text-anchor="middle" class="text" font-size="28" fill="#facc15">RISCO</text>
          <text x="850" y="1018" text-anchor="middle" class="heavy" font-size="42" fill="#ffffff">${risk}</text>
        </g>

        <rect x="128" y="1108" width="824" height="92" rx="28" fill="rgba(0,0,0,.38)" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
        <text x="540" y="1150" text-anchor="middle" class="text" font-size="28" fill="#ffffff">💵 Gestão: ${stake}</text>
        <text x="540" y="1184" text-anchor="middle" class="small" font-size="21" fill="#c4b5fd">Entrada validada pela IA Oddix • Sem all-in</text>

        <text x="540" y="1260" text-anchor="middle" class="heavy" font-size="26" fill="#facc15">ODDIX TIPSTER IA</text>
      </svg>
    `);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      const outputPath = path.join(this.outputDir(), `vip-card-${Date.now()}.png`);
      const background = await this.createBackground(`${input.homeTeam}-${input.awayTeam}-${input.tip}`);
      const overlay = this.singleOverlaySvg(input);
      const homeLogo = await this.logoBuffer(input.homeLogo, input.homeTeam, 188);
      const awayLogo = await this.logoBuffer(input.awayLogo, input.awayTeam, 188);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([
          { input: homeLogo, left: 186, top: 318 },
          { input: awayLogo, left: 706, top: 318 },
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
    const title = this.escape(this.short(input.title || 'ODDIX BOOST VIP', 24));
    const oddTotal = this.escape(String(input.oddTotal ?? '-'));
    const selections = input.selections.slice(0, 4);

    const rows = selections
      .map((selection, index) => {
        const y = 282 + index * 182;
        const game = this.escape(this.short(`${selection.homeTeam} x ${selection.awayTeam}`, 36));
        const tip = this.escape(this.short(selection.tip, 32).toUpperCase());
        const odd = this.escape(String(selection.odd ?? '-'));
        const confidence = this.escape(String(selection.confidence ?? ''));

        return `
          <rect x="90" y="${y}" width="900" height="146" rx="28" fill="rgba(0,0,0,.46)" stroke="rgba(250,204,21,.30)" stroke-width="2"/>
          <circle cx="144" cy="${y + 73}" r="36" fill="url(#gold)" filter="url(#shadow)"/>
          <text x="144" y="${y + 86}" text-anchor="middle" class="heavy" font-size="36" fill="#111827">${index + 1}</text>

          <text x="210" y="${y + 50}" class="heavy" font-size="29" fill="#ffffff">${game}</text>
          <text x="210" y="${y + 93}" class="text" font-size="28" fill="#facc15">${tip}</text>
          <text x="210" y="${y + 124}" class="small" font-size="20" fill="#c4b5fd">${confidence ? `Confiança ${confidence}%` : 'Seleção Oddix IA'}</text>

          <rect x="782" y="${y + 34}" width="164" height="78" rx="22" fill="url(#green)" filter="url(#shadow)"/>
          <text x="864" y="${y + 65}" text-anchor="middle" class="text" font-size="20" fill="#052e16">ODD</text>
          <text x="864" y="${y + 101}" text-anchor="middle" class="heavy" font-size="38" fill="#ffffff">${odd}</text>
        `;
      })
      .join('');

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#facc15"/>
          </linearGradient>
          <linearGradient id="green" x1="0" x2="1">
            <stop offset="0%" stop-color="#16a34a"/>
            <stop offset="100%" stop-color="#22c55e"/>
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity=".75"/>
          </filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
            .small{font-family:Arial,sans-serif;font-weight:700}
          </style>
        </defs>

        <rect x="38" y="34" width="1004" height="1282" rx="42" fill="rgba(0,0,0,.46)" stroke="url(#gold)" stroke-width="4" filter="url(#shadow)"/>
        <rect x="62" y="58" width="956" height="1234" rx="34" fill="rgba(8,8,14,.62)" stroke="rgba(250,204,21,.22)" stroke-width="2"/>

        <text x="540" y="136" text-anchor="middle" class="title" font-size="58" fill="#ffffff">${title}</text>
        <text x="540" y="188" text-anchor="middle" class="text" font-size="28" fill="#facc15">Múltipla premium filtrada pela IA</text>

        ${rows}

        <rect x="155" y="1110" width="770" height="120" rx="34" fill="url(#gold)" filter="url(#shadow)"/>
        <text x="540" y="1158" text-anchor="middle" class="text" font-size="28" fill="#1f1300">ODD COMBINADA</text>
        <text x="540" y="1210" text-anchor="middle" class="heavy" font-size="62" fill="#ffffff">${oddTotal}</text>

        <text x="540" y="1270" text-anchor="middle" class="small" font-size="22" fill="#c4b5fd">Gestão baixa • Múltipla é boost, não all-in</text>
      </svg>
    `);
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
