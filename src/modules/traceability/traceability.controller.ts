import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { TraceabilityService } from './traceability.service';

@Controller('traceability')
@Roles(
  AppRole.ADMIN_CUMBRES,
  AppRole.ADMIN_FINCA,
  AppRole.TECNICO,
  AppRole.AGRICULTOR,
  AppRole.COMPRADOR_CERTIFICADORA,
  AppRole.CLIENTE,
)
export class TraceabilityController {
  constructor(private readonly traceability: TraceabilityService) {}

  @Get('farms/:farmId')
  byFarm(@Param('farmId') farmId: string) {
    return this.traceability.byFarm(farmId);
  }

  @Get('harvests/:harvestId')
  byHarvest(@Param('harvestId') harvestId: string) {
    return this.traceability.byHarvest(harvestId);
  }
}
