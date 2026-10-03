import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecommendationDto, CreateSoilAnalysisDto, SoilParameterDto } from './dto/soil.dto';

@Injectable()
export class SoilService {
  constructor(private readonly prisma: PrismaService) {}

  createAnalysis(dto: CreateSoilAnalysisDto) {
    return this.prisma.soilAnalysis.create({
      data: {
        farmId: dto.farmId,
        lotId: dto.lotId,
        date: dto.date,
        laboratory: dto.laboratory,
        parameters: dto.parameters as never,
        observations: dto.observations,
        diagnostics: { create: dto.parameters.map((parameter) => this.toDiagnosis(parameter)) },
      },
      include: { diagnostics: true },
    });
  }

  createRecommendation(dto: CreateRecommendationDto) {
    return this.prisma.recommendation.create({ data: dto });
  }

  findByFarm(farmId: string) {
    return this.prisma.soilAnalysis.findMany({
      where: { farmId },
      orderBy: { date: 'desc' },
      include: { diagnostics: true, recommendations: true },
    });
  }

  async findOne(id: string) {
    const analysis = await this.prisma.soilAnalysis.findUnique({
      where: { id },
      include: { farm: true, lot: true, diagnostics: true, recommendations: true },
    });
    if (!analysis) throw new NotFoundException('Analisis de suelo no encontrado');
    return analysis;
  }

  private toDiagnosis(parameter: SoilParameterDto) {
    let status = 'SIN_RANGO';
    if (typeof parameter.min === 'number' && parameter.value < parameter.min) status = 'BAJO';
    if (typeof parameter.max === 'number' && parameter.value > parameter.max) status = 'ALTO';
    if (
      typeof parameter.min === 'number' &&
      typeof parameter.max === 'number' &&
      parameter.value >= parameter.min &&
      parameter.value <= parameter.max
    ) {
      status = 'OPTIMO';
    }

    return { parameter: parameter.name, status };
  }
}
