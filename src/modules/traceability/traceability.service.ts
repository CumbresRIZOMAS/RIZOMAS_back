import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async byHarvest(harvestId: string) {
    const harvest = await this.prisma.harvest.findUnique({
      where: { id: harvestId },
      include: {
        crop: { include: { lot: { include: { farm: true } } } },
        labor: { include: { lot: true, farm: true, evidences: true } },
        coffeeProcesses: { include: { products: { include: { certifications: true } } } },
      },
    });
    if (!harvest) throw new NotFoundException('Cosecha no encontrada');
    return harvest;
  }

  async byFarm(farmId: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        lots: { include: { crops: { include: { harvests: true } }, soilAnalyses: { include: { diagnostics: true } } } },
        labors: { include: { harvest: true, management: true, evidences: true }, orderBy: { startDate: 'desc' } },
        coffeeProcesses: { include: { harvest: true, products: { include: { certifications: true } } } },
      },
    });
    if (!farm) throw new NotFoundException('Finca no encontrada');
    return farm;
  }
}
