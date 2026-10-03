import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { CreateEnvironmentalConditionDto } from './dto/environment.dto';

@Controller('environment')
export class EnvironmentController {
  constructor(private readonly environment: EnvironmentService) {}

  @Post('conditions')
  create(@Body() dto: CreateEnvironmentalConditionDto) {
    return this.environment.create(dto);
  }

  @Get('farms/:farmId/conditions')
  findByFarm(@Param('farmId') farmId: string, @Query('lotId') lotId?: string) {
    return this.environment.findByFarm(farmId, lotId);
  }
}
