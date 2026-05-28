import { Module } from '@nestjs/common';
import { MarketingImageService } from './marketing-image.service';

@Module({
  providers: [MarketingImageService],
  exports: [MarketingImageService],
})
export class MarketingModule {}