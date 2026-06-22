import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';

@Controller('chat-history')
export class ChatHistoryController {
  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  private getUserId(headers: Record<string, string | string[] | undefined>) {
    const headerUserId = headers['x-user-id'];

    if (Array.isArray(headerUserId)) {
      return headerUserId[0] || 'demo-user';
    }

    return headerUserId || 'demo-user';
  }

  @Post('sessions')
  createSession(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: CreateChatSessionDto,
  ) {
    return this.chatHistoryService.createSession(this.getUserId(headers), dto);
  }

  @Get('sessions')
  getSessions(@Headers() headers: Record<string, string | string[] | undefined>) {
    return this.chatHistoryService.getSessions(this.getUserId(headers));
  }

  @Get('sessions/:id')
  getSession(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
  ) {
    return this.chatHistoryService.getSession(this.getUserId(headers), id);
  }

  @Delete('sessions/:id')
  deleteSession(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
  ) {
    return this.chatHistoryService.deleteSession(this.getUserId(headers), id);
  }

  @Post('messages')
  createMessage(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: CreateChatMessageDto,
  ) {
    return this.chatHistoryService.createMessage(this.getUserId(headers), dto);
  }

  @Patch('messages/:id/favorite')
  toggleFavorite(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
  ) {
    return this.chatHistoryService.toggleFavorite(this.getUserId(headers), id);
  }

  @Delete('messages/:id')
  deleteMessage(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
  ) {
    return this.chatHistoryService.deleteMessage(this.getUserId(headers), id);
  }
}