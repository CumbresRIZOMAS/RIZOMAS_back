import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFarmDto, UpdateFarmDto } from './dto/farm.dto';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateFarmDto) {
    return this.prisma.farm.create({ data: dto as never });
  }

  findAll() {
    return this.prisma.farm.findMany({
      orderBy: { createdAt: 'desc' },
      include: { owner: true, lots: true },
    });
  }

  async update(id: string, dto: UpdateFarmDto) {
    await this.ensureExists(id);
    return this.prisma.farm.update({ where: { id }, data: dto as never });
  }

  async findOne(id: string) {
    const farm = await this.prisma.farm.findUnique({
      where: { id },
      include: {
        owner: true,
        members: { include: { user: true } },
        lots: { include: { crops: true } },
        labors: { orderBy: { startDate: 'desc' }, take: 20 },
        soilAnalyses: { orderBy: { date: 'desc' }, take: 10 },
      },
    });
    if (!farm) throw new NotFoundException('Finca no encontrada');
    return farm;
  }

  private async ensureExists(id: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id } });
    if (!farm) throw new NotFoundException('Finca no encontrada');
  }
}
