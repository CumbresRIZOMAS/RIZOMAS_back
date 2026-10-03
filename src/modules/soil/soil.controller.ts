import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateRecommendationDto, CreateSoilAnalysisDto } from './dto/soil.dto';
import { SoilService } from './soil.service';

@Controller()
export class SoilController {
  constructor(private readonly soil: SoilService) {}

  @Post('soil-analyses')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  createAnalysis(@Body() dto: CreateSoilAnalysisDto) {
    return this.soil.createAnalysis(dto);
  }

  @Post('recommendations')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO)
  createRecommendation(@Body() dto: CreateRecommendationDto) {
    return this.soil.createRecommendation(dto);
  }

  @Get('farms/:farmId/soil-analyses')
  findByFarm(@Param('farmId') farmId: string) {
    return this.soil.findByFarm(farmId);
  }

  @Get('soil-analyses/:id')
  findOne(@Param('id') id: string) {
    return this.soil.findOne(id);
  }
}
