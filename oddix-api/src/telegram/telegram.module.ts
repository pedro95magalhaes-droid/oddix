import { Module } from "@nestjs/common";

import { TelegramService } from "./telegram.service";
import { ResultsCronService } from "./results-cron.service.telegram";
import { OddixImageService } from "./oddix-image.service";
import { OddixHumanMessageService } from "./oddix-human-message.service";
import { ResultsCronController } from "./results-cron.controller";

import { PrismaModule } from "../prisma/prisma.module";
import { WhatsappWebModule } from "../whatsapp-web/whatsapp-web.module";
import { FootballModule } from "../football/football.module";
import { AiModule } from "../ai/ai.module";
import { MarketingModule } from "../marketing/marketing.module";
import { OddsModule } from "../odds/odds.module";

@Module({
  imports: [
    PrismaModule,
    WhatsappWebModule,
    FootballModule,
    AiModule,
    MarketingModule,
    OddsModule,
  ],
  controllers: [ResultsCronController],
  providers: [
    TelegramService,
    ResultsCronService,
    OddixImageService,
    OddixHumanMessageService,
  ],
  exports: [TelegramService, ResultsCronService],
})
export class TelegramModule {}
