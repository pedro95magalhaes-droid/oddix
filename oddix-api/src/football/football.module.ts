import { Module } from '@nestjs/common';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [FootballController],
  providers: [FootballService, PrismaService],
  exports: [FootballService],
})
export class FootballModule {}