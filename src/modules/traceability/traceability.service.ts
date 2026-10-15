import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Lo que aporta un lote a la trazabilidad: suelo, diagnósticos, recomendaciones y bioinsumos aplicados (RF-15). */
const lotChain = {
  soilAnalyses: {
    orderBy: { date: 'desc' as const },
    include: { diagnostics: { include: { recommendations: { include: { bioinput: { select: { id: true, name: true } } } } } } },
  },
  bioinputApplications: {
    orderBy: { appliedAt: 'desc' as const },
    include: { bioinput: { select: { id: true, name: true } } },
  },
};

/** La trazabilidad también la ven compradores y certificadoras: sin coordenadas exactas (ASR-15). */
const noExactLocation = { omit: { exactLocation: true } } as const;
const evidenceSummary = { select: { id: true, status: true, visibility: true, capturedAt: true, url: true } } as const;

@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async byHarvest(harvestId: string) {
    const harvest = await this.prisma.harvest.findUnique({
      where: { id: harvestId },
      include: {
        crop: { include: { lot: { omit: { location: true }, include: { farm: noExactLocation, ...lotChain } } } },
        labor: { include: { lot: { omit: { location: true } }, farm: noExactLocation, evidences: evidenceSummary } },
        coffeeProcesses: { include: { products: { include: { certifications: true } } } },
      },
    });
    if (!harvest) throw new NotFoundException('Cosecha no encontrada');
    return harvest;
  }

  async byFarm(farmId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      omit: { exactLocation: true },
      include: {
        lots: { omit: { location: true }, include: { crops: { include: { harvests: true } }, ...lotChain } },
        labors: { include: { harvest: true, management: true, evidences: evidenceSummary }, orderBy: { startDate: 'desc' } },
        coffeeProcesses: { include: { harvest: true, products: { include: { certifications: true } } }, orderBy: { startedAt: 'desc' } },
      },
    });
    if (!farm) throw new NotFoundException('Finca no encontrada');
    return farm;
  }
}
