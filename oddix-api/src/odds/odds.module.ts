import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OddsService } from './odds.service';

@Module({
  imports: [ConfigModule],
  providers: [OddsService],
  exports: [OddsService],
})
export class OddsModule {}