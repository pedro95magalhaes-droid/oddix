import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { FootballController } from './football.controller';
import { FootballService } from './football.service';

import { AllScoresService } from './allscores.service';
import { Bet365DataService } from './bet365data.service';
import { BroadageService } from './broadage.service';
import { FlashScoreService } from './flashscore.service';
import { OddsPapiService } from './oddspapi.service';
import { SportScoreService } from './sportscore.service';
import { SportScore6Service } from './sportscore6.service';
import { FotmobService } from './fotmob.service';
import { SoccerFootballInfoService } from './soccer-football-info.service';

@Module({
  imports: [PrismaModule],

  controllers: [FootballController],

  providers: [
    FootballService,
    FotmobService,
    SoccerFootballInfoService,

    SportScoreService,
    SportScore6Service,

    AllScoresService,
    FlashScoreService,
    BroadageService,

    Bet365DataService,
    OddsPapiService,
  ],

  exports: [
    FootballService,
    FotmobService,
    SoccerFootballInfoService,

    SportScoreService,
    SportScore6Service,

    AllScoresService,
    FlashScoreService,
    BroadageService,

    Bet365DataService,
    OddsPapiService,
  ],
})
export class FootballModule {}