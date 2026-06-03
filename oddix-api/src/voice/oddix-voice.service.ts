import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import {
  OddixAudioCategory,
  OddixAudioEngineService,
  OddixAudioInput,
} from './oddix-audio-engine.service';

@Injectable()
export class OddixVoiceService {
  private readonly logger = new Logger(OddixVoiceService.name);

  constructor(private readonly audioEngine: OddixAudioEngineService) {}

  async createVoiceText(input: OddixAudioInput) {
    return this.audioEngine.pick(input);
  }

  async createAudioFile(input: OddixAudioInput): Promise<{
    text: string;
    filePath: string | null;
    category: OddixAudioCategory;
  }> {
    const selected = await this.audioEngine.pick(input);
    const filePath = await this.generateWithOddixTts(selected.text, selected.key);

    return {
      text: selected.text,
      filePath,
      category: selected.category,
    };
  }

  private outputDir() {
    const dir = path.join(process.cwd(), 'tmp', 'oddix-voice');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private enabled() {
    return String(process.env.ODDIX_VOICE_ENABLED || 'false').toLowerCase() === 'true';
  }

  private ttsUrl() {
    const raw = process.env.ODDIX_TTS_URL || 'http://localhost:5050/v1/audio/speech';
    const clean = raw.replace(/\/$/, '');

    if (clean.endsWith('/v1/audio/speech') || clean.endsWith('/audio/speech')) {
      return clean;
    }

    return `${clean}/v1/audio/speech`;
  }

  private ttsApiKey() {
    return process.env.ODDIX_TTS_API_KEY || process.env.ODDIX_VOICE_API_KEY || 'oddix_voice_key';
  }

  private voice() {
    return process.env.ODDIX_TTS_VOICE || 'pt-BR-AntonioNeural';
  }

  private speed() {
    const speed = Number(process.env.ODDIX_TTS_SPEED || 1.08);
    if (Number.isNaN(speed)) return 1.08;
    return Math.max(0.75, Math.min(speed, 1.35));
  }

  private async generateWithOddixTts(text: string, key: string): Promise<string | null> {
    if (!this.enabled()) return null;

    try {
      const response = await axios.post(
        this.ttsUrl(),
        {
          model: 'tts-1',
          input: text,
          voice: this.voice(),
          response_format: 'mp3',
          speed: this.speed(),
        },
        {
          responseType: 'arraybuffer',
          timeout: 90000,
          headers: {
            Authorization: `Bearer ${this.ttsApiKey()}`,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
        },
      );

      const contentType = String(response.headers?.['content-type'] || '');
      if (contentType && !contentType.includes('audio')) {
        this.logger.warn(`Oddix TTS não retornou áudio. Content-Type=${contentType}`);
        return null;
      }

      const filePath = path.join(this.outputDir(), `${key}-${Date.now()}.mp3`);
      fs.writeFileSync(filePath, Buffer.from(response.data));
      return filePath;
    } catch (error: any) {
      const details = error?.response?.data
        ? Buffer.isBuffer(error.response.data)
          ? error.response.data.toString('utf8')
          : JSON.stringify(error.response.data)
        : error?.message;

      this.logger.warn(`Erro ao gerar áudio no Oddix TTS: ${details}`);
      return null;
    }
  }
}
