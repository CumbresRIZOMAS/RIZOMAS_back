import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { BioinputsService } from './bioinputs.service';
import { ApplyBioinputDto, CreateBioinputDto } from './dto/bioinput.dto';

@Controller('bioinputs')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
export class BioinputsController {
  constructor(private readonly bioinputs: BioinputsService) {}

  @Post()
  create(@Body() dto: CreateBioinputDto) {
    return this.bioinputs.create(dto);
  }

  @Get()
  findAll() {
    return this.bioinputs.findAll();
  }

  @Post('applications')
  apply(@Body() dto: ApplyBioinputDto) {
    return this.bioinputs.apply(dto);
  }
}
