import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import P from 'pino';

@Injectable()
export class WhatsappWebService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappWebService.name);
  private sock: WASocket | null = null;
  private connecting = false;
  private lastQr: string | null = null;

  async onModuleInit() {
    if (this.enabled()) {
      await this.connect();
    }
  }

  private enabled() {
    return String(process.env.WHATSAPP_WEB_ENABLED || process.env.WHATSAPP_ENABLED || 'true').toLowerCase() === 'true';
  }

  private sessionDir() {
    return process.env.WHATSAPP_WEB_SESSION_DIR || path.join(process.cwd(), 'whatsapp-session');
  }

  private resetSessionDir() {
    const dir = this.sessionDir();

    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }

      fs.mkdirSync(dir, { recursive: true });
      this.lastQr = null;

      this.logger.warn(`Sessão WhatsApp limpa em: ${dir}`);
    } catch (error: any) {
      this.logger.error(`Erro ao limpar sessão WhatsApp: ${error?.message || error}`);
    }
  }

  private vipGroupJid() {
    return process.env.WHATSAPP_WEB_GROUP_VIP || process.env.ODDIX_VIP_GROUP_ID || '';
  }

  private freeGroupJid() {
    return process.env.WHATSAPP_WEB_GROUP_FREE || process.env.ODDIX_FREE_GROUP_ID || '';
  }

  private getTarget(type: 'vip' | 'free' = 'vip') {
    return type === 'free' ? this.freeGroupJid() : this.vipGroupJid();
  }

  private cleanText(value: any) {
    return String(value ?? '')
      .replace(/<b>/g, '*')
      .replace(/<\/b>/g, '*')
      .replace(/<s>/g, '~')
      .replace(/<\/s>/g, '~')
      .replace(/<[^>]+>/g, '');
  }

  private async ensureConnected() {
    if (!this.enabled()) return false;
    if (this.sock) return true;

    await this.connect();
    return !!this.sock;
  }

  async connect() {
    if (this.connecting) return;
    this.connecting = true;

    try {
      const dir = this.sessionDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(dir);

      const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Oddix Bot', 'Chrome', '1.0.0'],
      });

      this.sock = sock;
      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.lastQr = qr;
          this.logger.log('Escaneie o QR Code abaixo com o WhatsApp:');
          this.logger.log('QR também disponível em /whatsapp-web/qr-page');
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
          this.lastQr = null;
          this.logger.log('WhatsApp Web conectado com sucesso.');
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(
            `WhatsApp Web desconectado. status=${statusCode} reconnect=${shouldReconnect}`,
          );

          this.sock = null;

          if (shouldReconnect) {
            setTimeout(() => this.connect(), 5000);
            return;
          }

          this.logger.warn(
            'Sessão do WhatsApp foi deslogada. Limpando whatsapp-session e gerando novo QR Code...',
          );

          this.resetSessionDir();

          setTimeout(() => {
            this.connect();
          }, 3000);
        }
      });
    } catch (error: any) {
      this.logger.error(`Erro ao conectar WhatsApp Web: ${error?.message}`);
      this.sock = null;
    } finally {
      this.connecting = false;
    }
  }

  getQr() {
    return {
      connected: !!this.sock && !this.lastQr,
      qr: this.lastQr,
      sessionDir: this.sessionDir(),
    };
  }

  async sendText(message: string, target: 'vip' | 'free' = 'vip') {
    if (!(await this.ensureConnected())) {
      return { ok: false, skipped: true, reason: 'WhatsApp Web não conectado' };
    }

    const jid = this.getTarget(target);

    if (!jid) {
      this.logger.warn(`JID do grupo ${target.toUpperCase()} não configurado.`);
      return { ok: false, skipped: true, reason: `Grupo ${target} não configurado` };
    }

    try {
      await this.sock!.sendMessage(jid, { text: this.cleanText(message) });
      return { ok: true, target, jid };
    } catch (error: any) {
      this.logger.warn(`Erro ao enviar texto WhatsApp Web: ${error?.message}`);
      return { ok: false, error: error?.message };
    }
  }

  async sendButtonText(params: {
    text: string;
    buttonText?: string;
    url?: string;
    target?: 'vip' | 'free';
  }) {
    const target = params.target || 'vip';
    const text = this.cleanText(params.text);
    const buttonText = params.buttonText || 'QUERO SER VIP';
    const url = params.url || process.env.ODDIX_VIP_LINK || '';

    return this.sendText(
      [text, '', `🔥 *${buttonText}*`, url ? url : ''].filter(Boolean).join('\n'),
      target,
    );
  }

  async sendImageFile(params: { filePath: string; caption?: string; target?: 'vip' | 'free' }) {
    if (!(await this.ensureConnected())) {
      return { ok: false, skipped: true, reason: 'WhatsApp Web não conectado' };
    }

    const jid = this.getTarget(params.target || 'vip');

    if (!jid) {
      return { ok: false, skipped: true, reason: 'Grupo não configurado' };
    }

    if (!fs.existsSync(params.filePath)) {
      return this.sendText(params.caption || 'Imagem Oddix VIP', params.target || 'vip');
    }

    try {
      await this.sock!.sendMessage(jid, {
        image: fs.readFileSync(params.filePath),
        caption: this.cleanText(params.caption || ''),
      });

      return { ok: true, target: params.target || 'vip', jid };
    } catch (error: any) {
      return { ok: false, error: error?.message };
    }
  }



  async sendAudioFile(params: {
    filePath: string;
    target?: 'vip' | 'free';
    ptt?: boolean;
  }) {
    if (!(await this.ensureConnected())) {
      return { ok: false, skipped: true, reason: 'WhatsApp Web não conectado' };
    }

    const jid = this.getTarget(params.target || 'vip');

    if (!jid) {
      return { ok: false, skipped: true, reason: 'Grupo não configurado' };
    }

    if (!fs.existsSync(params.filePath)) {
      return { ok: false, skipped: true, reason: 'Arquivo de áudio não encontrado' };
    }

    try {
      await this.sock!.sendMessage(jid, {
        audio: fs.readFileSync(params.filePath),
        mimetype: 'audio/mpeg',
        ptt: params.ptt ?? true,
      });

      return { ok: true, target: params.target || 'vip', jid };
    } catch (error: any) {
      this.logger.warn(`Erro ao enviar áudio WhatsApp Web: ${error?.message}`);
      return { ok: false, error: error?.message };
    }
  }

  async listGroups() {
    if (!(await this.ensureConnected())) return [];

    const groups = await this.sock!.groupFetchAllParticipating();

    return Object.values(groups).map((group: any) => ({
      id: group.id,
      name: group.subject,
      participants: group.participants?.length || 0,
    }));
  }

  async sendVipIntro(total: number, intervalMinutes: number, target: 'vip' | 'free' = 'vip') {
    return this.sendText(
      [
        '🚀🔥 *ODDIX VIP ATIVADO*',
        '',
        'A IA encontrou oportunidades com valor nas odds.',
        'Entradas chegando abaixo 👇',
        '',
        `📦 Total de sinais: *${total}*`,
        `⏱️ Intervalo entre envios: *${intervalMinutes} min*`,
      ].join('\n'),
      target,
    );
  }

  async sendFreeIntro() {
    return this.sendButtonText({
      target: 'free',
      buttonText: 'QUERO SER VIP',
      url: process.env.ODDIX_VIP_LINK || '',
      text: [
        '🚀🔥 *ODDIX FREE*',
        '',
        'Amostra grátis de palpite da IA.',
        'Para receber o pacote completo, entre no VIP.',
      ].join('\n'),
    });
  }

  async sendVipSimpleText(params: any, target: 'vip' | 'free' = 'vip') {
    if (target === 'free') {
      return this.sendButtonText({
        target: 'free',
        buttonText: 'QUERO SER VIP',
        url: process.env.ODDIX_VIP_LINK || '',
        text: [
          '🚀🔥 *ODDIX FREE | AMOSTRA*',
          '',
          `⚽ *${params.homeTeam} x ${params.awayTeam}*`,
          params.league ? `🏆 ${params.league}` : '',
          '',
          `✅ Palpite: *${params.tip}*`,
          `💰 Odd: *${params.odd || '-'}*`,
          '',
          '🔒 No VIP tem análise completa, confiança, risco e mais entradas.',
        ].filter(Boolean).join('\n'),
      });
    }

    return this.sendText(
      [
        '🚀🔥 *ODDIX VIP | ENTRADA SIMPLES*',
        '',
        `⚽ *${params.homeTeam} x ${params.awayTeam}*`,
        params.league ? `🏆 ${params.league}` : '',
        '',
        `✅ Palpite: *${params.tip}*`,
        `💰 Odd: *${params.odd || '-'}*`,
        `🧠 Confiança: *${params.confidence || '-'}%*`,
        `⚠️ Risco: *${params.risk || 'Médio'}*`,
        '',
        '🔥 Menos achismo. Mais estratégia.',
      ].filter(Boolean).join('\n'),
      target,
    );
  }

  async sendVipMultipleText(params: any, target: 'vip' | 'free' = 'vip') {
    return this.sendText(
      [
        '🚀🔥 *ODDIX VIP | MÚLTIPLA*',
        '',
        `🎯 *${params.name || 'Múltipla IA'}*`,
        `💰 Odd combinada: *${params.combinedOdd || params.totalOdd || '-'}*`,
        '',
        '📊 Entradas selecionadas pela IA',
        '⚽ Jogos com valor nas odds',
        '🧠 Análise automática com foco no green',
        '',
        `🛡️ Confiança: *${params.confidence || '-'}%*`,
        `⚠️ Risco: *${params.risk || 'Médio'}*`,
        '',
        '🔥 Menos achismo. Mais método.',
      ].join('\n'),
      target,
    );
  }
}