import { Module } from '@nestjs/common';
import { BioinputsController } from './bioinputs.controller';
import { BioinputsService } from './bioinputs.service';

@Module({
  controllers: [BioinputsController],
  providers: [BioinputsService],
})
export class BioinputsModule {}
