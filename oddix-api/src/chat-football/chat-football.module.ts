import { Module } from '@nestjs/common';
import { ChatFootballController } from './chat-football.controller';
import { ChatFootballService } from './chat-football.service';

@Module({
  controllers: [ChatFootballController],
  providers: [ChatFootballService],
  exports: [ChatFootballService],
})
export class ChatFootballModule {}