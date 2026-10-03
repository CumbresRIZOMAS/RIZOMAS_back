import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CoffeeService } from './coffee.service';
import { CreateCoffeeProcessDto } from './dto/coffee.dto';

@Controller('coffee-processes')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR)
export class CoffeeController {
  constructor(private readonly coffee: CoffeeService) {}

  @Post()
  create(@Body() dto: CreateCoffeeProcessDto) {
    return this.coffee.create(dto);
  }

  @Get('farms/:farmId')
  findByFarm(@Param('farmId') farmId: string) {
    return this.coffee.findByFarm(farmId);
  }
}
