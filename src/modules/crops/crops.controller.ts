import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateCropDto } from './dto/crop.dto';
import { CropsService } from './crops.service';

@Controller()
export class CropsController {
  constructor(private readonly crops: CropsService) {}

  @Post('crops')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
  create(@Body() dto: CreateCropDto, @CurrentUser() user: RequestUser) {
    return this.crops.create(dto, user);
  }

  @Get('lots/:lotId/crops')
  findByLot(@Param('lotId') lotId: string, @CurrentUser() user: RequestUser) {
    return this.crops.findByLot(lotId, user);
  }

  @Get('crops/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.crops.findOne(id, user);
  }
}
