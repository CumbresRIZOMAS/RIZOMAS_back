import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { BioinputsService } from './bioinputs.service';
import { ApplyBioinputDto, CreateBioinputDto } from './dto/bioinput.dto';

const EN_FINCA = [AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR];

@Controller()
export class BioinputsController {
  constructor(private readonly bioinputs: BioinputsService) {}

  @Post('bioinputs')
  @Roles(...EN_FINCA)
  create(@Body() dto: CreateBioinputDto, @CurrentUser() user: RequestUser) {
    return this.bioinputs.create(dto, user);
  }

  /** Todas las fincas: solo administración de Cumbres (ASR-01). */
  @Get('bioinputs')
  @Roles(AppRole.ADMIN_CUMBRES)
  findAll() {
    return this.bioinputs.findAll();
  }

  @Get('farms/:farmId/bioinputs')
  @Roles(...EN_FINCA)
  findByFarm(@Param('farmId', ParseUUIDPipe) farmId: string) {
    return this.bioinputs.findByFarm(farmId);
  }

  @Get('bioinputs/:id')
  @Roles(...EN_FINCA)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bioinputs.findOne(id);
  }

  @Post('bioinputs/applications')
  @Roles(...EN_FINCA)
  apply(@Body() dto: ApplyBioinputDto, @CurrentUser() user: RequestUser) {
    return this.bioinputs.apply(dto, user);
  }
}
