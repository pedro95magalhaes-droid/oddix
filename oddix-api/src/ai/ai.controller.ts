import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-bet')
  generateBet(@Body() body: any) {
    return this.aiService.generateBet(body);
  }

  @Post('generate-multiple')
  generateMultiple(@Body() body: any) {
    return this.aiService.generateBestMultipleFromGames(body.games || body || []);
  }
}