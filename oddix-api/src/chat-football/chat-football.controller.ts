import { Body, Controller, Post } from '@nestjs/common';
import { ChatFootballService } from './chat-football.service';
import type { ChatFootballRequest } from './chat-football.types';

@Controller('chat-football')
export class ChatFootballController {
  constructor(private readonly chatFootballService: ChatFootballService) {}

  @Post('message')
  handleMessage(@Body() body: ChatFootballRequest) {
    return this.chatFootballService.handleMessage(body);
  }
}