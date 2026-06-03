import { Module } from '@nestjs/common';
import { OddixAudioEngineService } from './oddix-audio-engine.service';
import { OddixVoiceService } from './oddix-voice.service';

@Module({
  providers: [OddixAudioEngineService, OddixVoiceService],
  exports: [OddixAudioEngineService, OddixVoiceService],
})
export class VoiceModule {}
