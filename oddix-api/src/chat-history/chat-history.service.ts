import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';

@Injectable()
export class ChatHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, dto: CreateChatSessionDto) {
    return this.prisma.chatSession.create({
      data: {
        userId,
        title: dto.title || 'Nova conversa',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async getSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Sessão de chat não encontrada.');
    }

    return session;
  }

  async deleteSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Sessão de chat não encontrada.');
    }

    await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });

    return {
      success: true,
      deletedId: sessionId,
    };
  }

  async createMessage(userId: string, dto: CreateChatMessageDto) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: dto.sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Sessão de chat não encontrada.');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        sessionId: dto.sessionId,
        role: dto.role,
        content: dto.content,
      },
    });

    await this.prisma.chatSession.update({
      where: { id: dto.sessionId },
      data: {
        updatedAt: new Date(),
        title:
          session.title && session.title !== 'Nova conversa'
            ? session.title
            : dto.role === 'user'
              ? dto.content.slice(0, 60)
              : session.title,
      },
    });

    return message;
  }

  async toggleFavorite(userId: string, messageId: string) {
    const message = await this.prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        session: {
          userId,
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Mensagem não encontrada.');
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isFavorite: !message.isFavorite,
      },
    });
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        session: {
          userId,
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Mensagem não encontrada.');
    }

    await this.prisma.chatMessage.delete({
      where: { id: messageId },
    });

    return {
      success: true,
      deletedId: messageId,
    };
  }
}