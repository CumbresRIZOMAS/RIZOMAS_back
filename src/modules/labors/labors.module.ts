import { Module } from '@nestjs/common';
import { LaborsController } from './labors.controller';
import { LaborsService } from './labors.service';

@Module({
  controllers: [LaborsController],
  providers: [LaborsService],
})
export class LaborsModule {}
