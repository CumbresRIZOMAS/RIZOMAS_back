import { Injectable, NotFoundException } from '@nestjs/common';
import { LaborType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgronomicManagementDto, CreateHarvestDto, CreateLaborDto } from './dto/labor.dto';

@Injectable()
export class LaborsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLaborDto) {
    return this.prisma.labor.create({ data: dto as never });
  }

  createHarvest(dto: CreateHarvestDto) {
    const { harvestCropId, quantity, unit, quality, destination, ...labor } = dto;
    return this.prisma.labor.create({
      data: {
        ...labor,
        type: LaborType.COSECHA,
        harvest: {
          create: {
            cropId: harvestCropId ?? dto.cropId,
            quantity,
            unit,
            quality,
            destination,
          },
        },
      } as never,
      include: { harvest: true },
    });
  }

  createAgronomicManagement(dto: CreateAgronomicManagementDto) {
    const { managementType, quantity, ...labor } = dto;
    return this.prisma.labor.create({
      data: {
        ...labor,
        type: LaborType.MANEJO_AGRONOMICO,
        management: { create: { type: managementType, quantity } },
      } as never,
      include: { management: true },
    });
  }

  findByFarm(farmId: string) {
    return this.prisma.labor.findMany({
      where: { farmId },
      orderBy: { startDate: 'desc' },
      include: { lot: true, crop: true, worker: true, harvest: true, management: true },
    });
  }

  async findOne(id: string) {
    const labor = await this.prisma.labor.findUnique({
      where: { id },
      include: { farm: true, lot: true, crop: true, worker: true, harvest: true, management: true, evidences: true },
    });
    if (!labor) throw new NotFoundException('Labor no encontrada');
    return labor;
  }
}
