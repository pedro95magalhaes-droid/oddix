import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OddixAudioEngineService } from './oddix-audio-engine.service';
import { OddixVoiceService } from './oddix-voice.service';

@Module({
  imports: [PrismaModule],
  providers: [OddixAudioEngineService, OddixVoiceService],
  exports: [OddixAudioEngineService, OddixVoiceService],
})
export class VoiceModule {}