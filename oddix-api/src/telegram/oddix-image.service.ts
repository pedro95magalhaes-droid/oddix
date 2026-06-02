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

  // Card horizontal oficial do WhatsApp VIP.
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

  private cleanText(value: any) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private short(value: any, max = 32) {
    const text = this.cleanText(value);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  private wrapText(value: any, maxCharsPerLine = 18, maxLines = 2) {
    const words = this.cleanText(value).split(' ').filter(Boolean);
    const lines: string[] = [];
    let current = '';

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
          <radialGradient id="g" cx="50%" cy="35%" r="72%">
            <stop offset="0%" stop-color="#facc15"/>
            <stop offset="50%" stop-color="#7c3aed"/>
            <stop offset="100%" stop-color="#111827"/>
          </radialGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity=".85"/></filter>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="url(#g)" stroke="#facc15" stroke-width="5" filter="url(#shadow)"/>
        <text x="50%" y="58%" text-anchor="middle" font-family="Arial Black,Arial" font-size="${Math.round(size * 0.28)}" fill="#fff">${initials}</text>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async createBackground(inputText: string): Promise<Buffer> {
    const usePollinations = String(process.env.ODDIX_USE_POLLINATIONS_BG || 'false').toLowerCase() === 'true';

    if (usePollinations) {
      const seed = this.seedFromText(inputText);
      const prompt = [
        'horizontal 1016x515 premium football betting card background',
        'purple black gold luxury sportsbook style',
        'cinematic night stadium smoke particles',
        'dark clean center space for overlay text',
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
        return sharp(Buffer.from(response.data)).resize(this.width, this.height, { fit: 'cover' }).png().toBuffer();
      } catch (error: any) {
        this.logger.warn(`Pollinations falhou. Usando fundo local: ${error?.message || 'erro desconhecido'}`);
      }
    }

    return this.createFallbackBackground(inputText);
  }

  private async createFallbackBackground(inputText: string): Promise<Buffer> {
    const seed = this.seedFromText(inputText);
    const lines = Array.from({ length: 22 })
      .map((_, i) => {
        const x = (i * 79 + seed) % this.width;
        const opacity = 0.035 + (i % 4) * 0.018;
        return `<line x1="${x}" y1="0" x2="${x - 160}" y2="${this.height}" stroke="#facc15" stroke-width="2" opacity="${opacity}"/>`;
      })
      .join('');

    const dots = Array.from({ length: 44 })
      .map((_, i) => {
        const x = (seed + i * 137) % this.width;
        const y = (seed + i * 211) % this.height;
        const r = 1 + (i % 3);
        const o = 0.05 + (i % 4) * 0.03;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="#facc15" opacity="${o}"/>`;
      })
      .join('');

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#06000f"/>
            <stop offset="42%" stop-color="#1e0b46"/>
            <stop offset="76%" stop-color="#4c1d95"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
          <radialGradient id="gold" cx="50%" cy="0%" r="82%">
            <stop offset="0%" stop-color="#facc15" stop-opacity=".36"/>
            <stop offset="55%" stop-color="#a855f7" stop-opacity=".16"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="20"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#gold)"/>
        <g>${lines}</g>
        <g>${dots}</g>
        <ellipse cx="508" cy="500" rx="540" ry="80" fill="#22c55e" opacity=".10" filter="url(#blur)"/>
        <ellipse cx="508" cy="40" rx="620" ry="90" fill="#facc15" opacity=".12" filter="url(#blur)"/>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.20)"/>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private singleOverlaySvg(input: OddixVipCardInput) {
    const home = this.escape(this.short(input.homeTeam, 17));
    const away = this.escape(this.short(input.awayTeam, 17));
    const league = this.escape(this.short(input.league, 38));
    const market = this.escape(this.short(input.market || 'Entrada Oddix', 24).toUpperCase());
    const odd = this.escape(String(input.odd ?? '-'));
    const confidence = this.escape(String(input.confidence ?? '-'));
    const risk = this.escape(this.short(input.risk || 'Médio', 12));
    const stake = this.escape(this.short(input.stake || '0.5 a 1 unidade', 24));
    const tipLines = this.wrapText(input.tip, 18, 2)
      .map((line, index) => `<text x="508" y="${268 + index * 54}" text-anchor="middle" class="mainTip" font-size="48" fill="#ffffff">${this.escape(line.toUpperCase())}</text>`)
      .join('');

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#facc15"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>
          <linearGradient id="purple" x1="0" x2="1"><stop offset="0%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".82"/></filter>
          <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#facc15" flood-opacity=".60"/></filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
            .mainTip{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px}
            .small{font-family:Arial,sans-serif;font-weight:700}
          </style>
        </defs>

        <rect x="18" y="18" width="980" height="479" rx="34" fill="rgba(0,0,0,.50)" stroke="url(#gold)" stroke-width="4" filter="url(#shadow)"/>
        <rect x="38" y="38" width="940" height="439" rx="28" fill="rgba(8,8,14,.62)" stroke="rgba(250,204,21,.22)" stroke-width="2"/>

        <text x="110" y="90" text-anchor="start" class="title" font-size="48" fill="#ffffff">ODDIX</text>
        <text x="282" y="90" text-anchor="start" class="title" font-size="48" fill="url(#gold)" filter="url(#glow)">VIP</text>
        <text x="508" y="92" text-anchor="middle" class="small" font-size="22" fill="#c4b5fd">${league}</text>
        <rect x="736" y="55" width="202" height="52" rx="18" fill="url(#purple)" stroke="rgba(255,255,255,.16)"/>
        <text x="837" y="89" text-anchor="middle" class="small" font-size="21" fill="#facc15">${market}</text>

        <rect x="70" y="135" width="202" height="186" rx="28" fill="rgba(255,255,255,.08)" stroke="rgba(250,204,21,.22)" stroke-width="2"/>
        <rect x="744" y="135" width="202" height="186" rx="28" fill="rgba(255,255,255,.08)" stroke="rgba(250,204,21,.22)" stroke-width="2"/>
        <text x="171" y="303" text-anchor="middle" class="heavy" font-size="24" fill="#ffffff">${home}</text>
        <text x="845" y="303" text-anchor="middle" class="heavy" font-size="24" fill="#ffffff">${away}</text>

        <circle cx="508" cy="178" r="42" fill="rgba(250,204,21,.13)" stroke="url(#gold)" stroke-width="4"/>
        <text x="508" y="194" text-anchor="middle" class="title" font-size="36" fill="#ffffff">VS</text>

        <rect x="308" y="225" width="400" height="130" rx="28" fill="rgba(0,0,0,.46)" stroke="rgba(250,204,21,.34)" stroke-width="2"/>
        ${tipLines}

        <g filter="url(#shadow)">
          <rect x="82" y="356" width="210" height="84" rx="22" fill="url(#gold)"/>
          <text x="187" y="388" text-anchor="middle" class="text" font-size="21" fill="#1f1300">ODD</text>
          <text x="187" y="427" text-anchor="middle" class="heavy" font-size="42" fill="#ffffff">${odd}</text>

          <rect x="322" y="356" width="230" height="84" rx="22" fill="url(#green)"/>
          <text x="437" y="388" text-anchor="middle" class="text" font-size="21" fill="#052e16">CONFIANÇA</text>
          <text x="437" y="427" text-anchor="middle" class="heavy" font-size="42" fill="#ffffff">${confidence}%</text>

          <rect x="582" y="356" width="170" height="84" rx="22" fill="rgba(255,255,255,.10)" stroke="rgba(250,204,21,.34)" stroke-width="2"/>
          <text x="667" y="388" text-anchor="middle" class="text" font-size="21" fill="#facc15">RISCO</text>
          <text x="667" y="424" text-anchor="middle" class="heavy" font-size="30" fill="#ffffff">${risk}</text>

          <rect x="780" y="356" width="156" height="84" rx="22" fill="rgba(0,0,0,.40)" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
          <text x="858" y="389" text-anchor="middle" class="text" font-size="18" fill="#ffffff">GESTÃO</text>
          <text x="858" y="423" text-anchor="middle" class="small" font-size="20" fill="#c4b5fd">${stake}</text>
        </g>

        <text x="508" y="468" text-anchor="middle" class="small" font-size="19" fill="#facc15">ODDIX TIPSTER IA • Entrada validada pela IA • Sem all-in</text>
      </svg>
    `);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      const outputPath = path.join(this.outputDir(), `vip-card-${Date.now()}.png`);
      const background = await this.createBackground(`${input.homeTeam}-${input.awayTeam}-${input.tip}`);
      const overlay = this.singleOverlaySvg(input);
      const homeLogo = await this.logoBuffer(input.homeLogo, input.homeTeam, 104);
      const awayLogo = await this.logoBuffer(input.awayLogo, input.awayTeam, 104);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([
          { input: homeLogo, left: 119, top: 157 },
          { input: awayLogo, left: 793, top: 157 },
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
        const y = 122 + index * 76;
        const game = this.escape(this.short(`${selection.homeTeam} x ${selection.awayTeam}`, 34));
        const tip = this.escape(this.short(selection.tip, 28).toUpperCase());
        const odd = this.escape(String(selection.odd ?? '-'));
        const confidence = this.escape(String(selection.confidence ?? ''));

        return `
          <rect x="54" y="${y}" width="732" height="62" rx="18" fill="rgba(0,0,0,.46)" stroke="rgba(250,204,21,.26)" stroke-width="2"/>
          <circle cx="88" cy="${y + 31}" r="21" fill="url(#gold)" filter="url(#shadow)"/>
          <text x="88" y="${y + 40}" text-anchor="middle" class="heavy" font-size="23" fill="#111827">${index + 1}</text>
          <text x="126" y="${y + 25}" class="heavy" font-size="20" fill="#ffffff">${game}</text>
          <text x="126" y="${y + 51}" class="text" font-size="20" fill="#facc15">${tip}</text>
          <text x="652" y="${y + 51}" text-anchor="end" class="small" font-size="16" fill="#c4b5fd">${confidence ? `${confidence}%` : 'Oddix IA'}</text>
          <rect x="806" y="${y}" width="146" height="62" rx="18" fill="url(#green)" filter="url(#shadow)"/>
          <text x="879" y="${y + 25}" text-anchor="middle" class="text" font-size="16" fill="#052e16">ODD</text>
          <text x="879" y="${y + 52}" text-anchor="middle" class="heavy" font-size="30" fill="#ffffff">${odd}</text>
        `;
      })
      .join('');

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#facc15"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".75"/></filter>
          <style>.title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}.heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}.text{font-family:Arial,sans-serif;font-weight:800}.small{font-family:Arial,sans-serif;font-weight:700}</style>
        </defs>
        <rect x="18" y="18" width="980" height="479" rx="34" fill="rgba(0,0,0,.50)" stroke="url(#gold)" stroke-width="4" filter="url(#shadow)"/>
        <rect x="38" y="38" width="940" height="439" rx="28" fill="rgba(8,8,14,.62)" stroke="rgba(250,204,21,.22)" stroke-width="2"/>
        <text x="508" y="78" text-anchor="middle" class="title" font-size="48" fill="#ffffff">${title}</text>
        <text x="508" y="110" text-anchor="middle" class="text" font-size="20" fill="#facc15">Múltipla premium filtrada pela IA</text>
        ${rows}
        <rect x="308" y="438" width="400" height="48" rx="18" fill="url(#gold)" filter="url(#shadow)"/>
        <text x="428" y="469" text-anchor="middle" class="text" font-size="20" fill="#1f1300">ODD COMBINADA</text>
        <text x="598" y="473" text-anchor="middle" class="heavy" font-size="34" fill="#ffffff">${oddTotal}</text>
      </svg>
    `);
  }

  async createVipMultipleCard(input: OddixVipMultipleCardInput): Promise<string | null> {
    try {
      const outputPath = path.join(this.outputDir(), `vip-multiple-card-${Date.now()}.png`);
      const background = await this.createBackground(`${input.title}-${input.oddTotal}`);
      const overlay = this.multipleOverlaySvg(input);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([{ input: overlay, left: 0, top: 0 }])
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card múltipla VIP: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }
}
