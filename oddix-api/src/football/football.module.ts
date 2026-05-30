import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';
import { AllScoresService } from './allscores.service';
import { Bet365DataService } from './bet365data.service';
import { OddsPapiService } from './oddspapi.service';
import { FlashScoreService } from './flashscore.service';

@Module({
  imports: [PrismaModule],
  controllers: [FootballController],
  providers: [
    FootballService,
    AllScoresService,
    Bet365DataService,
    OddsPapiService,
    FlashScoreService,
  ],
  exports: [
    FootballService,
    AllScoresService,
    Bet365DataService,
    OddsPapiService,
    FlashScoreService,
  ],
})
export class FootballModule {}
