import { Module } from '@nestjs/common';
import { MarketingImageService } from './marketing-image.service';
import { OddixCreativeService } from './oddix-creative.service';
import { OddixCopyService } from './oddix-copy.service';
import { OddixCardStyleService } from './oddix-card-style.service';

@Module({
  providers: [
    MarketingImageService,
    OddixCreativeService,
    OddixCopyService,
    OddixCardStyleService,
  ],
  exports: [
    MarketingImageService,
    OddixCreativeService,
    OddixCopyService,
    OddixCardStyleService,
  ],
})
export class MarketingModule {}