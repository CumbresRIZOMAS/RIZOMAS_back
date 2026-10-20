import { LaborsModule } from '../labors/labors.module';
import { SoilModule } from '../soil/soil.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { CommercialModule } from '../commercial/commercial.module';
import { CoffeeModule } from '../coffee/coffee.module';
import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [LaborsModule, SoilModule, EvidenceModule, CommercialModule, CoffeeModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
