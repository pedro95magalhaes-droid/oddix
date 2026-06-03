import { Injectable, Logger } from '@nestjs/common';

type FlowType = 'text' | 'audio' | 'image';

@Injectable()
export class OddixFlowManagerService {
  private readonly logger = new Logger(OddixFlowManagerService.name);

  private lastTextAt = 0;
  private lastAudioAt = 0;
  private lastImageAt = 0;

  private lastGreenAt = 0;
  private lastRedAt = 0;
  private lastAlmostGreenAt = 0;

  private readonly TEXT_COOLDOWN =
    Number(process.env.ODDIX_TEXT_COOLDOWN_SECONDS || 30) * 1000;

  private readonly AUDIO_COOLDOWN =
    Number(process.env.ODDIX_AUDIO_COOLDOWN_SECONDS || 120) * 1000;

  private readonly IMAGE_COOLDOWN =
    Number(process.env.ODDIX_IMAGE_COOLDOWN_SECONDS || 60) * 1000;

  canSendText(): boolean {
    return Date.now() - this.lastTextAt > this.TEXT_COOLDOWN;
  }

  canSendAudio(): boolean {
    return Date.now() - this.lastAudioAt > this.AUDIO_COOLDOWN;
  }

  canSendImage(): boolean {
    return Date.now() - this.lastImageAt > this.IMAGE_COOLDOWN;
  }

  markTextSent() {
    this.lastTextAt = Date.now();
  }

  markAudioSent() {
    this.lastAudioAt = Date.now();
  }

  markImageSent() {
    this.lastImageAt = Date.now();
  }

  markGreenSent() {
    this.lastGreenAt = Date.now();
  }

  markRedSent() {
    this.lastRedAt = Date.now();
  }

  markAlmostGreenSent() {
    this.lastAlmostGreenAt = Date.now();
  }

  canSendAlmostGreen(): boolean {
    const cooldown =
      Number(process.env.ODDIX_ALMOST_GREEN_COOLDOWN_MINUTES || 20) *
      60 *
      1000;

    return Date.now() - this.lastAlmostGreenAt > cooldown;
  }

  canSendGreen(): boolean {
    return Date.now() - this.lastGreenAt > 15000;
  }

  canSendRed(): boolean {
    return Date.now() - this.lastRedAt > 15000;
  }

  async waitBeforeImage() {
    const wait =
      Number(process.env.ODDIX_WAIT_BEFORE_IMAGE_SECONDS || 20) * 1000;

    await this.sleep(wait);
  }

  async waitBeforeAudio() {
    const wait =
      Number(process.env.ODDIX_WAIT_BEFORE_AUDIO_SECONDS || 45) * 1000;

    await this.sleep(wait);
  }

  async waitAfterAudio() {
    const wait =
      Number(process.env.ODDIX_WAIT_AFTER_AUDIO_SECONDS || 20) * 1000;

    await this.sleep(wait);
  }

  async waitBeforeText() {
    const wait =
      Number(process.env.ODDIX_WAIT_BEFORE_TEXT_SECONDS || 15) * 1000;

    await this.sleep(wait);
  }

  shouldPauseFlow(): boolean {
    const lastEvent = Math.max(
      this.lastTextAt,
      this.lastAudioAt,
      this.lastImageAt,
    );

    const minimumGap =
      Number(process.env.ODDIX_MIN_FLOW_GAP_SECONDS || 25) * 1000;

    return Date.now() - lastEvent < minimumGap;
  }

  async smartPause() {
    if (!this.shouldPauseFlow()) return;

    const lastEvent = Math.max(
      this.lastTextAt,
      this.lastAudioAt,
      this.lastImageAt,
    );

    const minimumGap =
      Number(process.env.ODDIX_MIN_FLOW_GAP_SECONDS || 25) * 1000;

    const remaining =
      minimumGap - (Date.now() - lastEvent);

    if (remaining > 0) {
      this.logger.log(
        `⏳ Flow Manager aguardando ${Math.ceil(
          remaining / 1000,
        )}s para evitar spam`,
      );

      await this.sleep(remaining);
    }
  }

  getHumanFlowSuggestion() {
    return {
      step1: 'Mensagem humana',
      wait1: '20-40s',

      step2: 'Card VIP',
      wait2: '60-120s',

      step3: 'Silêncio',

      step4: 'Áudio Almost Green',

      step5: 'Áudio Green/Red',

      step6: 'Resumo final',
    };
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}