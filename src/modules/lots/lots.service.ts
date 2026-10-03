import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLotDto } from './dto/lot.dto';

@Injectable()
export class LotsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLotDto) {
    return this.prisma.lot.create({ data: dto as never });
  }

  findByFarm(farmId: string) {
    return this.prisma.lot.findMany({ where: { farmId }, include: { crops: true } });
  }

  async findOne(id: string) {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: { farm: true, crops: true, labors: true, soilAnalyses: true, evidences: true },
    });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    return lot;
  }
}
