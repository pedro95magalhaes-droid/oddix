import { Module } from '@nestjs/common';
import { ChatFootballController } from './chat-football.controller';
import { ChatFootballService } from './chat-football.service';
import { FootballAgentsService } from './football-agents.service';
import { FootballResearchService } from './football-research.service';
import { OddixLlmService } from './oddix-llm.service';
import { OddixResponseBuilderService } from './oddix-response-builder.service';
import { FootballModule } from '../football/football.module';
import { OddixIntentService } from './oddix-intent.service';
import { OddixMemoryService } from './oddix-memory.service';

@Module({
  imports: [FootballModule],
  controllers: [ChatFootballController],
  providers: [
    ChatFootballService,
    FootballAgentsService,
    FootballResearchService,
    OddixLlmService,
    OddixResponseBuilderService,
	ChatFootballService,
    OddixIntentService,
    OddixMemoryService,
  ],
  exports: [
    ChatFootballService,
    FootballAgentsService,
    OddixMemoryService,
    OddixLlmService,
    OddixResponseBuilderService,
  ],
})
export class ChatFootballModule {}
