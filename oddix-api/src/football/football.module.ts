import { Module } from '@nestjs/common';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FootballController],
  providers: [FootballService],
  exports: [FootballService],
})
export class FootballModule {}
