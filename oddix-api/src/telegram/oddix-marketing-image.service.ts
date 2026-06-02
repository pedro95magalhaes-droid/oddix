import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export type OddixMarketingImageInput = {
  theme?: 'green' | 'red' | 'vip' | 'free' | 'story';
  title?: string;
  headline?: string;
  subheadline?: string;
  callToAction?: string;
  footer?: string;
  backgroundPrompt?: string;
};

@Injectable()
export class OddixMarketingImageService {
  private readonly logger = new Logger(OddixMarketingImageService.name);
  private readonly width = 1080;
  private readonly height = 1920;

  private outputDir() {
    const dir = path.join(process.cwd(), 'tmp', 'oddix-marketing');
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

  private clean(value: any) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private short(value: any, max = 42) {
    const text = this.clean(value);
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

  createMarketingCopy(theme: OddixMarketingImageInput['theme'] = 'green') {
    if (theme === 'green') {
      return {
        title: 'ODDIX GREEN',
        headline: 'HOJE A IA CRAVOU',
        subheadline: 'Entradas filtradas com gestão, odds e leitura de jogo.',
        callToAction: 'ENTRE NO VIP',
        footer: 'Sem all-in. Método, banca e consistência.',
      };
    }

    if (theme === 'red') {
      return {
        title: 'ODDIX GESTÃO',
        headline: 'RED FAZ PARTE DO JOGO',
        subheadline: 'O segredo é gestão, filtro e longo prazo.',
        callToAction: 'APRENDA COM A IA',
        footer: 'Sem emoção. Sem desespero. Próxima entrada com método.',
      };
    }

    if (theme === 'vip') {
      return {
        title: 'ODDIX VIP',
        headline: 'ENTRADAS ANTES DO MERCADO MEXER',
        subheadline: 'Grupo VIP com IA, análise, odds e gestão de banca.',
        callToAction: 'QUERO SER VIP',
        footer: 'Palpites com filtro. Não é promessa, é estratégia.',
      };
    }

    return {
      title: 'ODDIX TIPSTER IA',
      headline: 'PALPITES COM IA E GESTÃO',
      subheadline: 'Jogos ao vivo, odds inteligentes e análise premium.',
      callToAction: 'ACESSAR ODDIX',
      footer: 'Jogue com responsabilidade.',
    };
  }

  private promptForTheme(input: OddixMarketingImageInput) {
    const theme = input.theme || 'green';

    if (input.backgroundPrompt) return input.backgroundPrompt;

    const base = [
      'vertical 1080x1920 ultra premium football betting promotional poster',
      'professional soccer player kicking the ball',
      'player wearing a fictional purple black gold ODDIX inspired uniform',
      'cinematic stadium lights',
      'luxury sportsbook tipster style',
      'high contrast',
      'no readable text no real logos no watermark',
    ];

    if (theme === 'green') {
      base.push('green glow celebration confetti energy winning atmosphere');
    } else if (theme === 'red') {
      base.push('dark dramatic atmosphere red warning glow serious bankroll management');
    } else {
      base.push('purple and gold vip neon smoke particles premium club atmosphere');
    }

    return base.join(', ');
  }

  private async createAiBackground(input: OddixMarketingImageInput): Promise<Buffer | null> {
    const enabled = String(process.env.ODDIX_USE_POLLINATIONS_MARKETING || process.env.ODDIX_USE_POLLINATIONS_BG || 'false').toLowerCase() === 'true';

    if (!enabled) return null;

    const prompt = this.promptForTheme(input);
    const seed = this.seedFromText(`${input.theme}-${input.title}-${input.headline}`);

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
        timeout: 60000,
        headers: { 'User-Agent': 'Oddix/1.0' },
      });

      return sharp(Buffer.from(response.data))
        .resize(this.width, this.height, { fit: 'cover' })
        .png()
        .toBuffer();
    } catch (error: any) {
      this.logger.warn(`Imagem marketing IA falhou. Usando fallback local: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }

  private async createFallbackBackground(input: OddixMarketingImageInput): Promise<Buffer> {
    const theme = input.theme || 'green';
    const isGreen = theme === 'green';
    const isRed = theme === 'red';

    const primary = isRed ? '#ef4444' : isGreen ? '#22c55e' : '#facc15';
    const secondary = isRed ? '#7f1d1d' : isGreen ? '#052e16' : '#4c1d95';
    const seed = this.seedFromText(`${input.theme}-${input.title}-${input.headline}`);

    const particles = Array.from({ length: 95 })
      .map((_, i) => {
        const x = (seed + i * 127) % this.width;
        const y = (seed + i * 191) % this.height;
        const r = 2 + (i % 5);
        const o = 0.05 + (i % 4) * 0.04;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${primary}" opacity="${o}"/>`;
      })
      .join('');

    const playerSilhouette = `
      <g opacity=".34" transform="translate(135 525)">
        <circle cx="390" cy="105" r="66" fill="rgba(255,255,255,.75)"/>
        <path d="M326 178 C380 130, 468 143, 520 204 L628 330 L560 386 L485 292 L450 515 L337 515 L365 305 L248 410 L185 344 Z" fill="rgba(255,255,255,.68)"/>
        <path d="M382 510 L288 760 L194 728 L296 505 Z" fill="rgba(255,255,255,.55)"/>
        <path d="M447 510 L617 705 L535 777 L389 550 Z" fill="rgba(255,255,255,.55)"/>
        <circle cx="710" cy="685" r="78" fill="none" stroke="${primary}" stroke-width="12"/>
      </g>
    `;

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#030712"/>
            <stop offset="45%" stop-color="${secondary}"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
          <radialGradient id="glowTop" cx="50%" cy="10%" r="78%">
            <stop offset="0%" stop-color="${primary}" stop-opacity=".40"/>
            <stop offset="58%" stop-color="${primary}" stop-opacity=".08"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="glowBottom" cx="50%" cy="100%" r="75%">
            <stop offset="0%" stop-color="${primary}" stop-opacity=".34"/>
            <stop offset="58%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="32"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#glowTop)"/>
        <rect width="100%" height="100%" fill="url(#glowBottom)"/>
        ${particles}
        ${playerSilhouette}
        <ellipse cx="540" cy="1760" rx="580" ry="150" fill="${primary}" opacity=".16" filter="url(#blur)"/>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.18)"/>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private overlaySvg(input: Required<Pick<OddixMarketingImageInput, 'title' | 'headline' | 'subheadline' | 'callToAction' | 'footer'>>) {
    const title = this.escape(this.short(input.title, 26));
    const headline = this.escape(this.short(input.headline, 28));
    const sub = this.escape(this.short(input.subheadline, 70));
    const cta = this.escape(this.short(input.callToAction, 24));
    const footer = this.escape(this.short(input.footer, 64));

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
            <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#000" flood-opacity=".78"/>
          </filter>
          <style>
            .title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}
            .heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}
            .text{font-family:Arial,sans-serif;font-weight:800}
          </style>
        </defs>

        <rect x="44" y="48" width="992" height="1824" rx="48" fill="rgba(0,0,0,.30)" stroke="rgba(250,204,21,.42)" stroke-width="4"/>
        <text x="540" y="148" text-anchor="middle" class="title" font-size="62" fill="#ffffff">ODDIX</text>
        <text x="540" y="204" text-anchor="middle" class="text" font-size="28" fill="#facc15">TIPSTER IA</text>

        <rect x="92" y="1120" width="896" height="410" rx="44" fill="rgba(0,0,0,.56)" stroke="rgba(255,255,255,.12)" stroke-width="2" filter="url(#shadow)"/>
        <text x="540" y="1218" text-anchor="middle" class="text" font-size="34" fill="#facc15">${title}</text>
        <text x="540" y="1316" text-anchor="middle" class="title" font-size="66" fill="#ffffff">${headline}</text>
        <text x="540" y="1382" text-anchor="middle" class="text" font-size="30" fill="#e5e7eb">${sub}</text>

        <rect x="230" y="1458" width="620" height="96" rx="30" fill="url(#green)" filter="url(#shadow)"/>
        <text x="540" y="1522" text-anchor="middle" class="heavy" font-size="42" fill="#052e16">${cta}</text>

        <rect x="108" y="1640" width="864" height="110" rx="34" fill="rgba(255,255,255,.09)" stroke="rgba(250,204,21,.25)" stroke-width="2"/>
        <text x="540" y="1707" text-anchor="middle" class="text" font-size="28" fill="#ffffff">${footer}</text>

        <text x="540" y="1826" text-anchor="middle" class="text" font-size="25" fill="#c4b5fd">Jogue com responsabilidade • Gestão acima de emoção</text>
      </svg>
    `);
  }

  async createMarketingImage(input: OddixMarketingImageInput = {}) {
    try {
      const copy = {
        ...this.createMarketingCopy(input.theme || 'green'),
        ...input,
      } as Required<Pick<OddixMarketingImageInput, 'title' | 'headline' | 'subheadline' | 'callToAction' | 'footer'>>;

      const outputPath = path.join(this.outputDir(), `oddix-marketing-${input.theme || 'story'}-${Date.now()}.png`);
      const aiBackground = await this.createAiBackground(input);
      const background = aiBackground || (await this.createFallbackBackground(input));
      const overlay = this.overlaySvg(copy);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([{ input: overlay, left: 0, top: 0 }])
        .png()
        .toFile(outputPath);

      return {
        ok: true,
        filePath: outputPath,
        copy,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao criar imagem marketing Oddix: ${error?.message || 'erro desconhecido'}`);
      return {
        ok: false,
        filePath: null,
        copy: this.createMarketingCopy(input.theme || 'green'),
        error: error?.message || 'erro desconhecido',
      };
    }
  }
}
