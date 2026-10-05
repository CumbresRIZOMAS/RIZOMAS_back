import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/services/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { automaticRecommendation, diagnose, parameterKey } from './diagnosis';
import { CreateRecommendationDto, CreateSoilAnalysisDto } from './dto/soil.dto';
import { ReferenceRangesService } from './reference-ranges.service';

const analysisInclude = {
  lot: { select: { id: true, name: true } },
  diagnostics: {
    orderBy: { parameter: 'asc' as const },
    include: {
      recommendations: {
        include: { bioinput: { select: { id: true, name: true } } },
      },
    },
  },
};

@Injectable()
export class SoilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranges: ReferenceRangesService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Registra un análisis y genera, en la misma transacción, un diagnóstico por
   * parámetro (RF-11) y una recomendación automática para cada valor fuera de
   * rango (RF-12). O se guarda todo o nada.
   */
  async createAnalysis(dto: CreateSoilAnalysisDto, user: RequestUser) {
    const keys = dto.parameters.map((p) => parameterKey(p.name));
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Hay parámetros repetidos en el análisis');
    }

    const analysis = await this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.findUnique({
        where: { id: dto.farmId },
        select: { id: true },
      });
      if (!farm) throw new NotFoundException('Finca no encontrada');

      let crop: string | null = null;
      if (dto.lotId) {
        const lot = await tx.lot.findUnique({
          where: { id: dto.lotId },
          select: {
            farmId: true,
            crops: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { species: true },
            },
          },
        });
        if (!lot) throw new NotFoundException('Lote no encontrado');
        if (lot.farmId !== dto.farmId) throw new BadRequestException('El lote no pertenece a la finca del análisis');
        crop = lot.crops[0]?.species ?? null;
      }

      const ranges = await this.ranges.forDiagnosis(keys, crop, tx);
      const created = await tx.soilAnalysis.create({
        data: {
          farmId: dto.farmId,
          lotId: dto.lotId,
          date: dto.date,
          laboratory: dto.laboratory,
          observations: dto.observations,
          parameters: dto.parameters.map((p) => ({
            name: p.name,
            value: p.value,
            unit: p.unit ?? null,
          })),
          userId: user.appUserId,
          createdById: user.appUserId,
        },
      });

      for (const [i, p] of dto.parameters.entries()) {
        const range = ranges.get(keys[i]);
        const status = diagnose(p.value, range);
        const recomendacion = range ? automaticRecommendation(p.name, p.value, status, range) : null;
        await tx.diagnosis.create({
          data: {
            soilAnalysisId: created.id,
            parameter: p.name,
            value: p.value,
            unit: p.unit ?? range?.unit ?? null,
            referenceMin: range?.min ?? null,
            referenceMax: range?.max ?? null,
            status,
            ...(recomendacion && {
              recommendations: {
                create: {
                  soilAnalysisId: created.id,
                  type: 'PRACTICA',
                  description: recomendacion,
                  automatic: true,
                },
              },
            }),
          },
        });
      }

      return tx.soilAnalysis.findUniqueOrThrow({
        where: { id: created.id },
        include: analysisInclude,
      });
    });

    await this.audit.record({
      userId: user.appUserId ?? user.sub,
      entity: 'SoilAnalysis',
      entityId: analysis.id,
      action: 'CREATE',
      after: analysis,
    });
    return analysis;
  }

  async createRecommendation(dto: CreateRecommendationDto, user: RequestUser) {
    const diagnosis = await this.prisma.diagnosis.findUnique({
      where: { id: dto.diagnosisId },
      select: {
        soilAnalysisId: true,
        soilAnalysis: { select: { farmId: true } },
      },
    });
    if (!diagnosis) throw new NotFoundException('Diagnóstico no encontrado');

    if (dto.bioinputId) {
      const bioinput = await this.prisma.bioinput.findUnique({
        where: { id: dto.bioinputId },
        select: { farmId: true },
      });
      if (!bioinput) throw new NotFoundException('Bioinsumo no encontrado');
      if (bioinput.farmId !== diagnosis.soilAnalysis.farmId) {
        throw new BadRequestException('El bioinsumo no pertenece a la finca del análisis');
      }
    }

    const recommendation = await this.prisma.recommendation.create({
      data: {
        diagnosisId: dto.diagnosisId,
        soilAnalysisId: diagnosis.soilAnalysisId,
        bioinputId: dto.bioinputId,
        type: dto.type,
        description: dto.description.trim(),
      },
      include: { bioinput: { select: { id: true, name: true } } },
    });
    await this.audit.record({
      userId: user.appUserId ?? user.sub,
      entity: 'Recommendation',
      entityId: recommendation.id,
      action: 'CREATE',
      after: recommendation,
    });
    return recommendation;
  }

  findByFarm(farmId: string) {
    return this.prisma.soilAnalysis.findMany({
      where: { farmId },
      orderBy: { date: 'desc' },
      include: analysisInclude,
    });
  }

  findByLot(lotId: string) {
    return this.prisma.soilAnalysis.findMany({
      where: { lotId },
      orderBy: { date: 'desc' },
      include: analysisInclude,
    });
  }

  async findOne(id: string) {
    const analysis = await this.prisma.soilAnalysis.findUnique({
      where: { id },
      include: {
        ...analysisInclude,
        farm: { select: { id: true, name: true } },
      },
    });
    if (!analysis) throw new NotFoundException('Análisis de suelo no encontrado');
    return analysis;
  }
}
