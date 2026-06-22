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
import { OddixRouterService } from './oddix-router.service';
import { OddixGlobalAiService } from './oddix-global-ai.service';
import { OddixIntentParserService } from './oddix-intent-parser.service';
import { OddixBrainService } from './oddix-brain.service';
import { OddixEntityExtractorService } from './oddix-entity-extractor.service';
import { OddixContextMemoryService } from './oddix-context-memory.service';

@Module({
  imports: [FootballModule],
  controllers: [ChatFootballController],
  providers: [
    ChatFootballService,
    FootballAgentsService,
    FootballResearchService,
    OddixLlmService,
    OddixResponseBuilderService,
    OddixIntentService,
    OddixMemoryService,
    OddixRouterService,
    OddixGlobalAiService,
    OddixIntentParserService,
    OddixBrainService,
    OddixEntityExtractorService,
    OddixContextMemoryService,
  ],
  exports: [
    ChatFootballService,
    FootballAgentsService,
    OddixMemoryService,
    OddixLlmService,
    OddixResponseBuilderService,
    OddixGlobalAiService,
    OddixIntentParserService,
    OddixBrainService,
    OddixEntityExtractorService,
    OddixContextMemoryService,
  ],
})
export class ChatFootballModule {}
