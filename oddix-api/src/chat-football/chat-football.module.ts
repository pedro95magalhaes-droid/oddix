import { Module } from '@nestjs/common';
import { ChatFootballService } from './chat-football.service';
import { OddixBrainService } from './oddix-brain.service';
import { OddixGlobalAiService } from './oddix-global-ai.service';
import { FootballModule } from '../football/football.module';

@Module({
  imports: [FootballModule],
  providers: [
    ChatFootballService,
    OddixBrainService,
    OddixGlobalAiService,
  ],
  exports: [
    ChatFootballService,
    OddixBrainService,
    OddixGlobalAiService,
  ],
})
export class ChatFootballModule {}