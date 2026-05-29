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
  confidence: string | number;
  risk: string;
  stake?: string;
  homeLogo?: string;
  awayLogo?: string;
  status?: string;
  elapsed?: string | number | null;
  source?: string;
};

@Injectable()
export class OddixImageService {
  private readonly logger = new Logger(OddixImageService.name);
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

  private normalizeRisk(risk: any) {
    const value = String(risk || '').toLowerCase();
    if (value.includes('baixo')) return 'BAIXO';
    if (value.includes('alto')) return 'ALTO';
    return 'MÉDIO';
  }

  private riskColor(risk: any) {
    const value = this.normalizeRisk(risk);
    if (value === 'BAIXO') return '#22c55e';
    if (value === 'ALTO') return '#ef4444';
    return '#facc15';
  }

  private confidenceNumber(confidence: any) {
    const value = Number(String(confidence ?? '').replace('%', '').replace(',', '.'));
    if (Number.isNaN(value)) return 75;
    return Math.max(1, Math.min(99, Math.round(value)));
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

  private async roundedLogo(buffer: Buffer, size: number) {
    const circle = Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
      </svg>
    `);

    return sharp(buffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .composite([{ input: circle, blend: 'dest-in' }])
      .toBuffer();
  }

  private initials(name: string) {
    return String(name || 'OD')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  private logoFallbackSvg(name: string, size: number, color = '#22c55e') {
    const initials = this.escape(this.initials(name));
    return Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stop-color="${color}" stop-opacity=".95"/>
            <stop offset="55%" stop-color="#020617" stop-opacity=".92"/>
            <stop offset="100%" stop-color="#000000"/>
          </radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 5}" fill="url(#g)" stroke="${color}" stroke-width="5"/>
        <text x="50%" y="55%" text-anchor="middle" font-family="Arial Black, Arial" font-size="${Math.round(size * 0.32)}" fill="#fff" filter="url(#glow)">${initials}</text>
      </svg>
    `);
  }

  private async createPollinationsBackground(input: OddixVipCardInput): Promise<Buffer> {
    const seed = this.seedFromText(`${input.homeTeam}-${input.awayTeam}-${input.league}-${input.tip}`);
    const prompt = [
      'vertical 1080x1350 ultra premium sports betting card background',
      'dark cyber gamer football stadium at night',
      'black metallic glass UI luxury betting dashboard',
      'neon green electric blue gold glow red accents',
      'cinematic smoke particles energy lines futuristic HUD',
      'large empty center space for overlay text',
      'esports thumbnail style high contrast sharp details',
      'premium VIP football analytics interface',
      'no readable text no letters no numbers no logos no real players no watermarks',
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
      return this.createFallbackBackground(input);
    }
  }

  private async createFallbackBackground(input: OddixVipCardInput): Promise<Buffer> {
    const seed = this.seedFromText(`${input.homeTeam}-${input.awayTeam}`);
    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="green" cx="15%" cy="20%" r="70%"><stop offset="0%" stop-color="#22c55e" stop-opacity=".42"/><stop offset="100%" stop-color="#020617" stop-opacity="0"/></radialGradient>
          <radialGradient id="blue" cx="88%" cy="35%" r="70%"><stop offset="0%" stop-color="#38bdf8" stop-opacity=".35"/><stop offset="100%" stop-color="#020617" stop-opacity="0"/></radialGradient>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#01040a"/><stop offset="48%" stop-color="#07111c"/><stop offset="100%" stop-color="#000000"/></linearGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#green)"/>
        <rect width="100%" height="100%" fill="url(#blue)"/>
        <g opacity=".15">
          ${Array.from({ length: 26 }).map((_, i) => {
            const x = (i * 47 + seed) % this.width;
            return `<line x1="${x}" y1="0" x2="${x + 280}" y2="${this.height}" stroke="#22c55e" stroke-width="1"/>`;
          }).join('')}
        </g>
        <circle cx="180" cy="1130" r="340" fill="#22c55e" opacity=".13" filter="url(#blur)"/>
        <circle cx="940" cy="1030" r="330" fill="#38bdf8" opacity=".16" filter="url(#blur)"/>
        <circle cx="560" cy="160" r="240" fill="#facc15" opacity=".10" filter="url(#blur)"/>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private overlaySvg(input: OddixVipCardInput) {
    const confidence = this.confidenceNumber(input.confidence);
    const risk = this.normalizeRisk(input.risk);
    const riskColor = this.riskColor(input.risk);
    const home = this.escape(this.short(input.homeTeam, 22));
    const away = this.escape(this.short(input.awayTeam, 22));
    const league = this.escape(this.short(input.league, 36));
    const market = this.escape(this.short(input.market || 'Entrada ao vivo', 28));
    const tip = this.escape(this.short(input.tip, 42));
    const odd = this.escape(String(input.odd ?? '-'));
    const stake = this.escape(input.stake || '0.5 A 1 UNIDADE');
    const status = this.escape(input.status || 'AO VIVO');
    const elapsed = input.elapsed ? `${this.escape(input.elapsed)}'` : '';

    return Buffer.from(`
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold" x1="0" x2="1"><stop offset="0%" stop-color="#facc15"/><stop offset="100%" stop-color="#f97316"/></linearGradient>
          <linearGradient id="green" x1="0" x2="1"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#a3e635"/></linearGradient>
          <linearGradient id="cardStroke" x1="0" x2="1"><stop offset="0%" stop-color="#facc15"/><stop offset="45%" stop-color="#22c55e"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient>
          <filter id="glowGold"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#000000" flood-opacity=".75"/></filter>
          <filter id="textGlow"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <style>.title{font-family:Impact,Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:2px}.heavy{font-family:Arial Black,Arial,sans-serif;font-weight:900}.text{font-family:Arial,sans-serif;font-weight:700}.small{font-family:Arial,sans-serif;font-weight:700;letter-spacing:.8px}</style>
        </defs>
        <rect x="0" y="0" width="1080" height="1350" fill="rgba(0,0,0,.30)"/>
        <text x="540" y="78" text-anchor="middle" class="title" font-size="58" fill="#ffffff" filter="url(#textGlow)">ENTRADA</text>
        <text x="744" y="78" text-anchor="middle" class="title" font-size="58" fill="url(#gold)" filter="url(#glowGold)">PREMIUM</text>
        <path d="M330 108 C455 82, 625 82, 755 108" stroke="#facc15" stroke-width="5" fill="none" opacity=".92"/>
        <rect x="38" y="126" width="1004" height="1110" rx="34" fill="rgba(2,6,23,.58)" stroke="url(#cardStroke)" stroke-width="3" filter="url(#shadow)"/>
        <rect x="64" y="164" width="182" height="300" rx="22" fill="rgba(0,0,0,.45)" stroke="#facc15" stroke-width="2"/>
        <text x="155" y="207" text-anchor="middle" class="small" font-size="20" fill="#facc15">CONFIANÇA</text>
        <text x="155" y="286" text-anchor="middle" class="heavy" font-size="58" fill="#ffffff">${confidence}%</text>
        <circle cx="155" cy="362" r="52" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="14"/>
        <text x="155" y="384" text-anchor="middle" class="heavy" font-size="42" fill="#facc15">✓</text>
        <text x="155" y="434" text-anchor="middle" class="small" font-size="18" fill="#a7f3d0">GREEN • MÉTODO</text>
        <rect x="834" y="164" width="182" height="300" rx="22" fill="rgba(0,0,0,.45)" stroke="${riskColor}" stroke-width="2"/>
        <text x="925" y="207" text-anchor="middle" class="small" font-size="20" fill="${riskColor}">RISCO</text>
        <text x="925" y="286" text-anchor="middle" class="heavy" font-size="44" fill="#ffffff">${risk}</text>
        <text x="925" y="347" text-anchor="middle" class="small" font-size="18" fill="#94a3b8">STAKE</text>
        <text x="925" y="382" text-anchor="middle" class="heavy" font-size="24" fill="#ffffff">${stake}</text>
        <rect x="866" y="411" width="118" height="24" rx="12" fill="${riskColor}" opacity=".28"/>
        <rect x="866" y="411" width="${risk === 'BAIXO' ? 42 : risk === 'MÉDIO' ? 78 : 118}" height="24" rx="12" fill="${riskColor}"/>
        <text x="540" y="178" text-anchor="middle" class="small" font-size="18" fill="#facc15">${status} ${elapsed}</text>
        <text x="540" y="226" text-anchor="middle" class="heavy" font-size="34" fill="#ffffff">${league}</text>
        <text x="540" y="276" text-anchor="middle" class="small" font-size="22" fill="#94a3b8">ODDIX INTELIGÊNCIA NAS ODDS</text>
        <text x="292" y="392" text-anchor="middle" class="heavy" font-size="32" fill="#ffffff">${home}</text>
        <text x="788" y="392" text-anchor="middle" class="heavy" font-size="32" fill="#ffffff">${away}</text>
        <text x="540" y="392" text-anchor="middle" class="title" font-size="44" fill="url(#gold)" filter="url(#glowGold)">VS</text>
        <rect x="274" y="454" width="532" height="268" rx="28" fill="rgba(0,0,0,.72)" stroke="url(#cardStroke)" stroke-width="3" filter="url(#shadow)"/>
        <rect x="302" y="483" width="78" height="42" rx="13" fill="#facc15"/>
        <text x="341" y="512" text-anchor="middle" class="heavy" font-size="21" fill="#111827">VIP</text>
        <text x="410" y="512" class="small" font-size="21" fill="#94a3b8">MERCADO SUGERIDO</text>
        <text x="410" y="572" class="title" font-size="42" fill="#ffffff" filter="url(#textGlow)">${market}</text>
        <text x="410" y="628" class="heavy" font-size="30" fill="#facc15">${tip}</text>
        <rect x="636" y="487" width="138" height="96" rx="18" fill="rgba(2,6,23,.92)" stroke="#facc15" stroke-width="3" filter="url(#glowGold)"/>
        <text x="705" y="517" text-anchor="middle" class="small" font-size="21" fill="#facc15">ODD</text>
        <text x="705" y="565" text-anchor="middle" class="heavy" font-size="44" fill="#facc15">${odd}</text>
        <line x1="325" y1="639" x2="325" y2="687" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
        <circle cx="325" cy="639" r="12" fill="#facc15"/><circle cx="325" cy="687" r="12" fill="#facc15"/>
        <text x="350" y="676" class="text" font-size="27" fill="#ffffff">Entrada validada por leitura Oddix</text>
        <rect x="64" y="760" width="456" height="220" rx="24" fill="rgba(0,0,0,.55)" stroke="rgba(34,197,94,.35)" stroke-width="2"/>
        <text x="96" y="812" class="heavy" font-size="25" fill="#22c55e">⚡ LEITURA RÁPIDA</text>
        <text x="96" y="858" class="text" font-size="22" fill="#ffffff">• Placar, tempo e status em tempo real</text>
        <text x="96" y="904" class="text" font-size="22" fill="#ffffff">• Mercado com proteção operacional</text>
        <text x="96" y="950" class="text" font-size="22" fill="#ffffff">• Gestão indicada: ${stake}</text>
        <rect x="560" y="760" width="456" height="220" rx="24" fill="rgba(0,0,0,.55)" stroke="rgba(56,189,248,.35)" stroke-width="2"/>
        <text x="592" y="812" class="heavy" font-size="25" fill="#38bdf8">📊 MÉTRICAS ODDIX</text>
        <text x="598" y="862" class="small" font-size="19" fill="#cbd5e1">CONFIANÇA</text>
        <rect x="730" y="847" width="230" height="16" rx="8" fill="rgba(255,255,255,.14)"/><rect x="730" y="847" width="${Math.round((confidence / 100) * 230)}" height="16" rx="8" fill="url(#green)"/>
        <text x="598" y="912" class="small" font-size="19" fill="#cbd5e1">VALUE</text>
        <rect x="730" y="897" width="230" height="16" rx="8" fill="rgba(255,255,255,.14)"/><rect x="730" y="897" width="${risk === 'BAIXO' ? 188 : risk === 'MÉDIO' ? 135 : 82}" height="16" rx="8" fill="url(#gold)"/>
        <text x="598" y="962" class="small" font-size="19" fill="#cbd5e1">RISCO</text>
        <rect x="730" y="947" width="230" height="16" rx="8" fill="rgba(255,255,255,.14)"/><rect x="730" y="947" width="${risk === 'BAIXO' ? 72 : risk === 'MÉDIO' ? 142 : 218}" height="16" rx="8" fill="${riskColor}"/>
        <rect x="64" y="1018" width="952" height="118" rx="24" fill="rgba(2,6,23,.72)" stroke="rgba(250,204,21,.40)" stroke-width="2"/>
        <text x="98" y="1074" class="heavy" font-size="30" fill="#facc15">⭐ RESUMO</text>
        <text x="240" y="1075" class="text" font-size="23" fill="#ffffff">Arte gamer, logos reais e overlay dinâmico Oddix.</text>
        <text x="540" y="1284" text-anchor="middle" class="small" font-size="22" fill="#facc15">Oddix</text>
        <text x="610" y="1284" class="small" font-size="22" fill="#e5e7eb">• Inteligência em cada entrada</text>
      </svg>
    `);
  }

  async createVipCard(input: OddixVipCardInput): Promise<string | null> {
    try {
      const output = path.join(this.outputDir(), `oddix-vip-${Date.now()}-${this.seedFromText(input.homeTeam + input.awayTeam)}.png`);
      const background = await this.createPollinationsBackground(input);
      const homeLogoRaw = await this.downloadImage(input.homeLogo);
      const awayLogoRaw = await this.downloadImage(input.awayLogo);
      const homeLogo = homeLogoRaw ? await this.roundedLogo(homeLogoRaw, 168) : this.logoFallbackSvg(input.homeTeam, 168, '#ef4444');
      const awayLogo = awayLogoRaw ? await this.roundedLogo(awayLogoRaw, 168) : this.logoFallbackSvg(input.awayTeam, 168, '#38bdf8');
      const overlay = this.overlaySvg(input);

      await sharp(background)
        .resize(this.width, this.height, { fit: 'cover' })
        .composite([
          { input: homeLogo, left: 208, top: 214 },
          { input: awayLogo, left: 704, top: 214 },
          { input: overlay, left: 0, top: 0 },
        ])
        .png({ quality: 95, compressionLevel: 8 })
        .toFile(output);

      return output;
    } catch (error: any) {
      this.logger.error(`Erro ao criar card VIP Oddix: ${error?.message || 'erro desconhecido'}`);
      return null;
    }
  }

  async createResultCard(input: {
    result: 'won' | 'lost' | string;
    homeTeam: string;
    awayTeam: string;
    tip: string;
    score: string;
    homeLogo?: string;
    awayLogo?: string;
  }): Promise<string | null> {
    const won = input.result === 'won';
    return this.createVipCard({
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      league: won ? 'GREEN CONFIRMADO' : 'RED CONFIRMADO',
      market: won ? 'Resultado validado' : 'Entrada encerrada',
      tip: input.tip,
      odd: input.score,
      confidence: won ? 100 : 0,
      risk: won ? 'Baixo' : 'Alto',
      stake: won ? 'GREEN' : 'RED',
      homeLogo: input.homeLogo,
      awayLogo: input.awayLogo,
      status: won ? 'GREEN ODDIX' : 'RED ODDIX',
    });
  }
}
