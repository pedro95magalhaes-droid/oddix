export class CreateChatMessageDto {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
}