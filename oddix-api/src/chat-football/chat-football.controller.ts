import { Body, Controller, Post } from '@nestjs/common';
import { ChatFootballService } from './chat-football.service';
import { OddixCopilotService } from './oddix-copilot.service';
import { StreamingService } from './streaming.service';
import type { ChatFootballRequest } from './chat-football.types';

@Controller('chat-football')
export class ChatFootballController {
  constructor(
    private readonly chatFootballService: ChatFootballService,
    private readonly copilotService: OddixCopilotService,
    private readonly streamingService: StreamingService,
  ) {}

  @Post('message')
  async handleMessage(@Body() body: ChatFootballRequest) {
    const response = await this.chatFootballService.handleMessage(body);
    return this.copilotService.enhanceResponse(body, response);
  }

  @Post('stream')
  async handleStream(@Body() body: ChatFootballRequest) {
    const response = await this.handleMessage({
      ...body,
      stream: true,
    });

    return this.streamingService.buildPseudoStreamResponse(response.answer, response.data || {});
  }

  @Post('v14/message')
  async handleV14Message(@Body() body: ChatFootballRequest) {
    return this.handleMessage(body);
  }

  @Post('v15/message')
  async handleV15Message(@Body() body: ChatFootballRequest) {
    return this.handleMessage({
      ...body,
      version: 'v15',
    } as any);
  }

  @Post('v15/stream')
  async handleV15Stream(@Body() body: ChatFootballRequest) {
    return this.handleStream({
      ...body,
      version: 'v15',
      stream: true,
    } as any);
  }
}
