import { Module } from "@nestjs/common";
import { VirtualController } from "./virtual.controller";
import { VirtualService } from "./virtual.service";
import { VirtualAiService } from "./virtual-ai.service";
import { VirtualBet365Provider } from "./providers/virtual-bet365.provider";

@Module({
  controllers: [VirtualController],
  providers: [VirtualService, VirtualAiService, VirtualBet365Provider],
  exports: [VirtualService, VirtualAiService],
})
export class VirtualModule {}
