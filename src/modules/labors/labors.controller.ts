import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateAgronomicManagementDto, CreateHarvestDto, CreateLaborDto } from './dto/labor.dto';
import { LaborsService } from './labors.service';

@Controller()
export class LaborsController {
  constructor(private readonly labors: LaborsService) {}

  @Post('labors')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  create(@Body() dto: CreateLaborDto) {
    return this.labors.create(dto);
  }

  @Post('harvests')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  createHarvest(@Body() dto: CreateHarvestDto) {
    return this.labors.createHarvest(dto);
  }

  @Post('agronomic-management')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  createAgronomicManagement(@Body() dto: CreateAgronomicManagementDto) {
    return this.labors.createAgronomicManagement(dto);
  }

  @Get('farms/:farmId/labors')
  findByFarm(@Param('farmId') farmId: string) {
    return this.labors.findByFarm(farmId);
  }

  @Get('labors/:id')
  findOne(@Param('id') id: string) {
    return this.labors.findOne(id);
  }
}
