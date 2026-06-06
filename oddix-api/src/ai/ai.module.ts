import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OddixConfidenceEngineService } from './oddix-confidence-engine.service';
import { MarketsModule } from '../markets/markets.module';
import { OddsModule } from '../odds/odds.module';

@Module({
  imports: [MarketsModule, OddsModule],

  controllers: [AiController],

  providers: [
    AiService,
    OddixConfidenceEngineService,
  ],

  exports: [
    AiService,
    OddixConfidenceEngineService,
  ],
})
export class AiModule {}