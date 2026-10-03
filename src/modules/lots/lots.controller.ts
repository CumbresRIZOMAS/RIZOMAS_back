import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateLotDto } from './dto/lot.dto';
import { LotsService } from './lots.service';

@Controller()
export class LotsController {
  constructor(private readonly lots: LotsService) {}

  @Post('lots')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  create(@Body() dto: CreateLotDto) {
    return this.lots.create(dto);
  }

  @Get('farms/:farmId/lots')
  findByFarm(@Param('farmId') farmId: string) {
    return this.lots.findByFarm(farmId);
  }

  @Get('lots/:id')
  findOne(@Param('id') id: string) {
    return this.lots.findOne(id);
  }
}
