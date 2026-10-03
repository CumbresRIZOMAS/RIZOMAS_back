import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { CreateCycleDto, UpdateCycleDto } from './dto/cycle.dto';

@Controller('cycles')
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Post()
  create(@Body() dto: CreateCycleDto) {
    return this.cycles.create(dto);
  }

  @Get('crops/:cropId')
  findByCrop(@Param('cropId') cropId: string) {
    return this.cycles.findByCrop(cropId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCycleDto) {
    return this.cycles.update(id, dto);
  }
}
