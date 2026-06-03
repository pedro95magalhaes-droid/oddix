import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WhatsappWebService } from '../whatsapp-web/whatsapp-web.service';
import { OddixVoiceService } from '../voice/oddix-voice.service';
import { OddixFlowManagerService } from './oddix-flow-manager.service';

type HypeMode = 'text' | 'audio';

@Injectable()
export class OddixHypeService {
  private readonly logger = new Logger(OddixHypeService.name);
  private lastHypeAt = 0;

  constructor(
    private readonly whatsappWebService: WhatsappWebService,
    private readonly oddixVoiceService: OddixVoiceService,
    private readonly flowManager: OddixFlowManagerService,
  ) {}

  private enabled() {
    return String(process.env.ODDIX_HYPE_ENABLED || 'true').toLowerCase() === 'true';
  }

  private minMinutesBetweenHype() {
    return Number(process.env.ODDIX_HYPE_MIN_MINUTES || 45);
  }

  private maxMinutesBetweenHype() {
    return Number(process.env.ODDIX_HYPE_MAX_MINUTES || 90);
  }

  private audioChance() {
    return Number(process.env.ODDIX_HYPE_AUDIO_CHANCE || 25);
  }

  private shouldSendNow() {
    if (!this.enabled()) return { ok: false, reason: 'hype desligado' };

    const minMs = this.minMinutesBetweenHype() * 60 * 1000;
    const maxMs = this.maxMinutesBetweenHype() * 60 * 1000;
    const elapsed = Date.now() - this.lastHypeAt;

    if (this.lastHypeAt && elapsed < minMs) {
      return {
        ok: false,
        reason: `cooldown mínimo ativo ${Math.ceil((minMs - elapsed) / 60000)}min`,
      };
    }

    if (this.lastHypeAt && elapsed >= maxMs) {
      return { ok: true, reason: 'tempo máximo atingido' };
    }

    const chance = Number(process.env.ODDIX_HYPE_CRON_CHANCE || 35);
    const roll = Math.floor(Math.random() * 100) + 1;

    if (roll > chance) {
      return { ok: false, reason: `sorteio não enviou ${roll}/${chance}` };
    }

    return { ok: true, reason: 'sorteio liberou' };
  }

  private pickMode(): HypeMode {
    const roll = Math.floor(Math.random() * 100) + 1;
    return roll <= this.audioChance() ? 'audio' : 'text';
  }

  private pickText() {
    const messages = [
      '👀 Família, estou monitorando alguns jogos interessantes para a próxima janela. Se aparecer valor, o VIP recebe primeiro.',

      '📊 Lembrete rápido: melhor perder uma entrada do que entrar em mercado sem valor. Disciplina acima da emoção.',

      '⚽ A rodada está movimentada hoje, mas nem todo jogo bom vira entrada. A IA só libera quando o cenário passa no filtro.',

      '🎯 O foco aqui não é quantidade. É selecionar melhor, proteger a banca e buscar consistência.',

      '🔥 Algumas linhas estão ficando interessantes. Assim que uma entrada ficar forte, ela aparece aqui no VIP.',

      '💵 Gestão sempre em primeiro lugar. Sem all-in, sem dobrar mão e sem tentar recuperar no impulso.',

      '🤖 Oddix segue analisando os principais mercados. Quando tiver oportunidade real, o grupo recebe.',

      '🧠 Às vezes a melhor decisão é não entrar. Entrada ruim evitada também protege a banca.',

      '🚀 VIP ligado. Estamos acompanhando os jogos e filtrando apenas o que faz sentido.',

      '📌 Mercado bom não é o mais chamativo. Mercado bom é o que tem valor e proteção.',

      '👀 Estou de olho nas linhas ao vivo. Se o jogo entregar o cenário certo, a IA libera a entrada.',

      '⚠️ Nada de emoção. A banca cresce com processo, não com pressa.',

      '🎯 O objetivo é simples: menos achismo, mais método.',

      '📊 Nem sempre odd alta é oportunidade. Às vezes é armadilha. A IA filtra isso antes de mandar.',

      '🔥 Rodada ativa, VIP atento. Vamos esperar o mercado certo aparecer.',

      '💎 Quem está no VIP recebe o sinal completo: entrada, gestão, card, voz e acompanhamento.',

      '🧠 Seguimos analisando escanteios, gols, finalizações e mercados protegidos.',

      '📌 Se não tiver valor, não tem entrada. Simples assim.',

      '⚽ A bola rola, o mercado muda e a IA recalcula. Vamos acompanhando.',

      '🚨 Fiquem atentos. Algumas partidas estão começando a entrar na zona de análise.',
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  private async sendTextHype() {
    if (!this.flowManager.canSendText()) {
      this.logger.log('⏭️ Hype texto bloqueado pelo Flow Manager');
      return false;
    }

    await this.flowManager.smartPause();

    const message = this.pickText();

    await this.whatsappWebService.sendText(message, 'vip');
    this.flowManager.markTextSent();
    this.lastHypeAt = Date.now();

    this.logger.log('✅ Hype texto enviado no VIP');
    return true;
  }

  private async sendAudioHype() {
    if (!this.flowManager.canSendAudio()) {
      this.logger.log('⏭️ Hype áudio bloqueado pelo Flow Manager');
      return false;
    }

    await this.flowManager.smartPause();

    const audio = await this.oddixVoiceService.createAudioFile({
      category: 'MOTIVATION',
      homeTeam: 'Oddix',
      awayTeam: 'VIP',
      market: 'gestão e valor',
    });

    if (!audio.filePath) {
      this.logger.warn('⚠️ Hype áudio falhou. Enviando texto fallback.');
      return this.sendTextHype();
    }

    await this.whatsappWebService.sendAudioFile({
      filePath: audio.filePath,
      target: 'vip',
      ptt: true,
    });

    this.flowManager.markAudioSent();
    this.lastHypeAt = Date.now();

    this.logger.log('✅ Hype áudio enviado no VIP');
    return true;
  }

  @Cron('*/15 * * * *', { timeZone: 'America/Fortaleza' })
  async sendHypeAutomatically() {
    const decision = this.shouldSendNow();

    if (!decision.ok) {
      this.logger.log(`⏭️ Hype não enviado: ${decision.reason}`);
      return;
    }

    const mode = this.pickMode();

    try {
      if (mode === 'audio') {
        const sent = await this.sendAudioHype();
        if (sent) return;
      }

      await this.sendTextHype();
    } catch (error: any) {
      this.logger.warn(`Erro no Hype Engine: ${error?.message || error}`);
    }
  }
}