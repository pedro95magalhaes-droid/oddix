import { Module } from '@nestjs/common';
import { VirtualController } from './virtual.controller';
import { VirtualService } from './virtual.service';

@Module({
  controllers: [VirtualController],
  providers: [VirtualService],
  exports: [VirtualService],
})
export class VirtualModule {}