import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCycleDto, UpdateCycleDto } from './dto/cycle.dto';

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCycleDto) {
    return this.prisma.cropCycle.create({ data: dto });
  }

  findByCrop(cropId: string) {
    return this.prisma.cropCycle.findMany({
      where: { cropId },
      orderBy: { plantingDate: 'desc' },
      include: { harvests: true },
    });
  }

  async update(id: string, dto: UpdateCycleDto) {
    const cycle = await this.prisma.cropCycle.findUnique({ where: { id } });
    if (!cycle) throw new NotFoundException('Ciclo productivo no encontrado');
    return this.prisma.cropCycle.update({ where: { id }, data: dto });
  }
}
