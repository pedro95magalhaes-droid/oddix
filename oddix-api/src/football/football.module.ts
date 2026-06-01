import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { FootballController } from './football.controller';
import { FootballService } from './football.service';

import { AllScoresService } from './allscores.service';
import { Bet365DataService } from './bet365data.service';
import { OddsPapiService } from './oddspapi.service';
import { FlashScoreService } from './flashscore.service';
import { SportScoreService } from './sportscore.service';
import { SportScore6Service } from './sportscore6.service';

@Module({
  imports: [PrismaModule],

  controllers: [FootballController],

  providers: [
    FootballService,

    SportScoreService,
    SportScore6Service,

    AllScoresService,
    FlashScoreService,

    Bet365DataService,
    OddsPapiService,
  ],

  exports: [
    FootballService,

    SportScoreService,
    SportScore6Service,

    AllScoresService,
    FlashScoreService,

    Bet365DataService,
    OddsPapiService,
  ],
})
export class FootballModule {}