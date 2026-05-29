import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';
import { AllScoresService } from './allscores.service';

@Module({
  imports: [PrismaModule],
  controllers: [FootballController],
  providers: [FootballService, AllScoresService],
  exports: [FootballService, AllScoresService],
})
export class FootballModule {}
