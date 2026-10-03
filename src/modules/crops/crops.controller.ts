import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateCropDto } from './dto/crop.dto';
import { CropsService } from './crops.service';

@Controller()
export class CropsController {
  constructor(private readonly crops: CropsService) {}

  @Post('crops')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  create(@Body() dto: CreateCropDto) {
    return this.crops.create(dto);
  }

  @Get('lots/:lotId/crops')
  findByLot(@Param('lotId') lotId: string) {
    return this.crops.findByLot(lotId);
  }

  @Get('crops/:id')
  findOne(@Param('id') id: string) {
    return this.crops.findOne(id);
  }
}
