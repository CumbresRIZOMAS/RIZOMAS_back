import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateReferenceRangeDto, UpdateReferenceRangeDto } from './dto/reference-range.dto';
import { CreateRecommendationDto, CreateSoilAnalysisDto } from './dto/soil.dto';
import { ReferenceRangesService } from './reference-ranges.service';
import { SoilService } from './soil.service';

/** Quienes ven análisis de suelo. Datos técnicos, no comerciales. */
const LECTORES = [AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO, AppRole.AGRICULTOR];
/** Quienes registran análisis y recomiendan. */
const TECNICOS = [AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA, AppRole.TECNICO];

@Controller()
export class SoilController {
  constructor(
    private readonly soil: SoilService,
    private readonly ranges: ReferenceRangesService,
  ) {}

  @Post('soil-analyses')
  @Roles(...TECNICOS)
  createAnalysis(@Body() dto: CreateSoilAnalysisDto, @CurrentUser() user: RequestUser) {
    return this.soil.createAnalysis(dto, user);
  }

  @Get('soil-analyses/:id')
  @Roles(...LECTORES)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.soil.findOne(id);
  }

  @Get('farms/:farmId/soil-analyses')
  @Roles(...LECTORES)
  findByFarm(@Param('farmId', ParseUUIDPipe) farmId: string) {
    return this.soil.findByFarm(farmId);
  }

  @Get('lots/:lotId/soil-analyses')
  @Roles(...LECTORES)
  findByLot(@Param('lotId', ParseUUIDPipe) lotId: string) {
    return this.soil.findByLot(lotId);
  }

  @Post('recommendations')
  @Roles(...TECNICOS)
  createRecommendation(@Body() dto: CreateRecommendationDto, @CurrentUser() user: RequestUser) {
    return this.soil.createRecommendation(dto, user);
  }

  // Catálogo de rangos de referencia (RF-11). Lo editan técnicos de Cumbres.

  @Get('soil-reference-ranges')
  @Roles(...TECNICOS)
  findRanges(@Query('crop') crop?: string) {
    return this.ranges.findAll(crop);
  }

  @Post('soil-reference-ranges')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.TECNICO)
  createRange(@Body() dto: CreateReferenceRangeDto, @CurrentUser() user: RequestUser) {
    return this.ranges.create(dto, user);
  }

  @Patch('soil-reference-ranges/:id')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.TECNICO)
  updateRange(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReferenceRangeDto, @CurrentUser() user: RequestUser) {
    return this.ranges.update(id, dto, user);
  }

  @Delete('soil-reference-ranges/:id')
  @Roles(AppRole.ADMIN_CUMBRES, AppRole.TECNICO)
  removeRange(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.ranges.remove(id, user);
  }
}
