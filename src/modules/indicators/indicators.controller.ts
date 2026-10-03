import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { CreateIndicatorDto, CreateIndicatorValueDto } from './dto/indicator.dto';

@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicators: IndicatorsService) {}

  @Post('definitions')
  createDefinition(@Body() dto: CreateIndicatorDto) {
    return this.indicators.createDefinition(dto);
  }

  @Post('values')
  createValue(@Body() dto: CreateIndicatorValueDto) {
    return this.indicators.createValue(dto);
  }

  @Get('farms/:farmId')
  findByFarm(@Param('farmId') farmId: string) {
    return this.indicators.findByFarm(farmId);
  }
}
