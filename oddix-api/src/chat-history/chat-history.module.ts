import { Module } from '@nestjs/common';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryService } from './chat-history.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ChatHistoryController],
  providers: [ChatHistoryService, PrismaService],
  exports: [ChatHistoryService],
})
export class ChatHistoryModule {}