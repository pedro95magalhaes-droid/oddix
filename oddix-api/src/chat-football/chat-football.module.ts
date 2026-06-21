import { Module } from '@nestjs/common';
import { ChatFootballController } from './chat-football.controller';
import { ChatFootballService } from './chat-football.service';
import { FootballModule } from '../football/football.module';

@Module({
  imports: [FootballModule],
  controllers: [ChatFootballController],
  providers: [ChatFootballService],
  exports: [ChatFootballService],
})
export class ChatFootballModule {}