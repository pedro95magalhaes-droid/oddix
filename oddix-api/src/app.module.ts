import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';

import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { BetsModule } from './bets/bets.module';
import { FavoriteModule } from './favorite/favorite.module';

import { FootballModule } from './football/football.module';
import { AiModule } from './ai/ai.module';
import { MarketsModule } from './markets/markets.module';
import { TelegramModule } from './telegram/telegram.module';
import { WhatsappWebModule } from './whatsapp-web/whatsapp-web.module';
import { MarketingModule } from './marketing/marketing.module';
import { PaymentsModule } from './payments/payments.module';

import { VirtualModule } from './virtual/virtual.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    PrismaModule,

    AuthModule,
    AdminModule,
    BetsModule,
    FavoriteModule,

    FootballModule,
    AiModule,
    MarketsModule,
    TelegramModule,
    WhatsappWebModule,
    MarketingModule,
    PaymentsModule,

    VirtualModule,
  ],
})
export class AppModule {}