import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateFarmDto, UpdateFarmDto } from './dto/farm.dto';
import { FarmsService } from './farms.service';

@Controller('farms')
export class FarmsController {
  constructor(private readonly farms: FarmsService) {}

  @Post()
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  create(@Body() dto: CreateFarmDto) {
    return this.farms.create(dto);
  }

  @Get()
  findAll() {
    return this.farms.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.farms.findOne(id);
  }

  @Patch(':id')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA)
  update(@Param('id') id: string, @Body() dto: UpdateFarmDto) {
    return this.farms.update(id, dto);
  }
}
