import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCropDto } from './dto/crop.dto';

@Injectable()
export class CropsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCropDto) {
    return this.prisma.crop.create({ data: dto });
  }

  findByLot(lotId: string) {
    return this.prisma.crop.findMany({ where: { lotId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { lot: { include: { farm: true } }, labors: true, harvests: true },
    });
    if (!crop) throw new NotFoundException('Cultivo no encontrado');
    return crop;
  }
}
