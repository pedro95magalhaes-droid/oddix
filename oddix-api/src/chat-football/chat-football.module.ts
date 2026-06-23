import { Module } from '@nestjs/common';
import { FootballModule } from '../football/football.module';
import { ChatFootballController } from './chat-football.controller';
import { ChatFootballService } from './chat-football.service';
import { FootballResearchService } from './football-research.service';
import { FootballAgentsService } from './football-agents.service';
import { OddixMemoryService } from './oddix-memory.service';
import { OddixResponseBuilderService } from './oddix-response-builder.service';
import { OddixRouterService } from './oddix-router.service';
import { OddixGlobalAiService } from './oddix-global-ai.service';
import { OddixIntentParserService } from './oddix-intent-parser.service';
import { OddixIntentService } from './oddix-intent.service';
import { OddixBrainService } from './oddix-brain.service';
import { OddixEntityExtractorService } from './oddix-entity-extractor.service';
import { OddixContextMemoryService } from './oddix-context-memory.service';
import { OddixLlmService } from './oddix-llm.service';
import { OddixDataOrchestratorService } from './oddix-data-orchestrator.service';

@Module({
  imports: [FootballModule],
  controllers: [ChatFootballController],
  providers: [
    ChatFootballService,
    FootballResearchService,
    FootballAgentsService,
    OddixMemoryService,
    OddixResponseBuilderService,
    OddixRouterService,
    OddixGlobalAiService,
    OddixIntentParserService,
    OddixIntentService,
    OddixBrainService,
    OddixEntityExtractorService,
    OddixContextMemoryService,
    OddixLlmService,
    OddixDataOrchestratorService,
  ],
  exports: [
    ChatFootballService,
    FootballResearchService,
    FootballAgentsService,
    OddixMemoryService,
    OddixResponseBuilderService,
    OddixRouterService,
    OddixGlobalAiService,
    OddixIntentParserService,
    OddixIntentService,
    OddixBrainService,
    OddixEntityExtractorService,
    OddixContextMemoryService,
    OddixLlmService,
    OddixDataOrchestratorService,
  ],
})
export class ChatFootballModule {}
