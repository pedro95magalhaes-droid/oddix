import { Module } from '@nestjs/common';
import { ChatFootballController } from './chat-football.controller';
import { ChatFootballService } from './chat-football.service';
import { FootballResearchService } from './football-research.service';
import { FootballAgentsService } from './football-agents.service';
import { FootballModule } from '../football/football.module';

@Module({
  imports: [FootballModule],
  controllers: [ChatFootballController],
  providers: [
    ChatFootballService,
    FootballResearchService,
    FootballAgentsService,
  ],
  exports: [
    ChatFootballService,
    FootballResearchService,
    FootballAgentsService,
  ],
})
export class ChatFootballModule {}