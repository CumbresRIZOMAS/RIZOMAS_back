import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateFarmDto, UpdateFarmDto } from './dto/farm.dto';
import { FarmsService } from './farms.service';

@Controller('farms')
export class FarmsController {
  constructor(private readonly farms: FarmsService) {}

  @Post()
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  create(@Body() dto: CreateFarmDto, @CurrentUser() user: RequestUser) {
    return this.farms.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.farms.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.farms.findOne(id, user);
  }

  @Patch(':id')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA)
  update(@Param('id') id: string, @Body() dto: UpdateFarmDto, @CurrentUser() user: RequestUser) {
    return this.farms.update(id, dto, user);
  }
}
