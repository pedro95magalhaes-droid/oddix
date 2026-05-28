import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ResultMessagePayload = {
  result: 'won' | 'lost' | 'open';
  homeTeam: string;
  awayTeam: string;
  tip: string;
  score: string;
  provider?: string;
};

type SyncSummaryPayload = {
  checked: number;
  updatedWon: number;
  updatedLost: number;
  stillOpen: number;
  source?: string;
};

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {}

  private isEnabled() {
    const enabled =
      this.config.get<string>('TELEGRAM_ENABLED') ??
      process.env.TELEGRAM_ENABLED ??
      'false';

    return enabled === 'true';
  }

  private getToken() {
    return (
      this.config.get<string>('TELEGRAM_BOT_TOKEN') ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    );
  }

  private getChatId() {
    return (
      this.config.get<string>('TELEGRAM_CHAT_ID') ||
      process.env.TELEGRAM_CHAT_ID ||
      ''
    );
  }

  private canSend() {
    if (!this.isEnabled()) {
      return false;
    }

    const token = this.getToken();
    const chatId = this.getChatId();

    if (!token || !chatId || token === 'disabled' || chatId === 'disabled') {
      this.logger.warn(
        'Telegram ativado, mas TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurado.',
      );
      return false;
    }

    return true;
  }

  async sendMessage(text: string) {
    if (!this.canSend()) {
      return {
        ok: false,
        skipped: true,
        reason: 'Telegram desativado ou não configurado',
      };
    }

    const token = this.getToken();
    const chatId = this.getChatId();

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        },
      );

      const data = await response.json();

      if (!data?.ok) {
        this.logger.warn(`Falha ao enviar Telegram: ${JSON.stringify(data)}`);
      }

      return data;
    } catch (error: any) {
      this.logger.warn(
        `Erro ao enviar Telegram: ${error?.message || 'erro desconhecido'}`,
      );

      return {
        ok: false,
        error: error?.message || 'erro desconhecido',
      };
    }
  }

  async sendResultMessage(payload: ResultMessagePayload) {
    if (payload.result === 'open') {
      return {
        ok: false,
        skipped: true,
        reason: 'Resultado ainda aberto',
      };
    }

    const isGreen = payload.result === 'won';

    const text = [
      isGreen ? '✅ <b>GREEN ODDIX</b>' : '❌ <b>RED ODDIX</b>',
      '',
      `⚽ <b>${payload.homeTeam} x ${payload.awayTeam}</b>`,
      `📌 Entrada: <b>${payload.tip}</b>`,
      `📊 Placar: <b>${payload.score}</b>`,
      payload.provider ? `🔎 Fonte: <b>${payload.provider}</b>` : '',
      '',
      isGreen
        ? '🚀 Gestão batendo. Método acima de emoção.'
        : '⚠️ Red faz parte. Gestão protege a banca.',
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendMessage(text);
  }

  async sendSyncSummary(payload: SyncSummaryPayload) {
    const text = [
      '🔄 <b>Resumo GREEN/RED Oddix</b>',
      '',
      `📌 Origem: <b>${payload.source || 'manual'}</b>`,
      `🔎 Verificadas: <b>${payload.checked}</b>`,
      `✅ Greens: <b>${payload.updatedWon}</b>`,
      `❌ Reds: <b>${payload.updatedLost}</b>`,
      `⏳ Abertas: <b>${payload.stillOpen}</b>`,
    ].join('\n');

    return this.sendMessage(text);
  }

  async sendBetMessage(payload: any) {
    const text = [
      '🔥 <b>ODDIX IA - PALPITE DO JOGO</b>',
      '',
      `⚽ <b>${payload.homeTeam} x ${payload.awayTeam}</b>`,
      payload.league ? `🏆 ${payload.league}` : '',
      '',
      `✅ Entrada sugerida: <b>${payload.tip}</b>`,
      payload.odd ? `📈 Odd alvo: <b>${payload.odd}</b>` : '',
      payload.confidence ? `🧠 Confiança: <b>${payload.confidence}%</b>` : '',
      payload.risk ? `⚠️ Risco: <b>${payload.risk}</b>` : '',
      '',
      payload.analysis ? `📌 ${payload.analysis}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendMessage(text);
  }

  async sendMultipleMessage(payload: any) {
    const selections = payload?.selections || [];

    const lines = selections.map((item: any, index: number) => {
      return [
        `${index + 1}. ⚽ <b>${item.game || item.homeTeam + ' x ' + item.awayTeam}</b>`,
        `   📌 ${item.tip}`,
        item.odd ? `   📈 Odd: ${item.odd}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    });

    const text = [
      '🔥 <b>ODDIX BOOST - MÚLTIPLA</b>',
      '',
      ...lines,
      '',
      payload.combinedOdd
        ? `💰 Odd combinada: <b>${payload.combinedOdd}</b>`
        : '',
      payload.confidence
        ? `🧠 Confiança: <b>${payload.confidence}%</b>`
        : '',
      payload.risk ? `⚠️ Risco: <b>${payload.risk}</b>` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendMessage(text);
  }
}