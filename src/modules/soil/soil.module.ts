import { Module } from '@nestjs/common';
import { ReferenceRangesService } from './reference-ranges.service';
import { SoilController } from './soil.controller';
import { SoilService } from './soil.service';

@Module({
  controllers: [SoilController],
  providers: [SoilService, ReferenceRangesService],
  exports: [SoilService],
})
export class SoilModule {}
