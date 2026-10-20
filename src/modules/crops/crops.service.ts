import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCropDto } from './dto/crop.dto';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class CropsService {
  constructor(private readonly prisma: PrismaService, private readonly access: FarmAccessService) {}

  async create(dto: CreateCropDto, user: RequestUser) {
    const lot = await this.prisma.lot.findUnique({ where: { id: dto.lotId }, select: { farmId: true } });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    await this.access.assertAccess(user, lot.farmId);
    return this.prisma.crop.create({ data: dto });
  }

  async findByLot(lotId: string, user: RequestUser) {
    const lot = await this.prisma.lot.findUnique({ where: { id: lotId }, select: { farmId: true } });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    await this.access.assertAccess(user, lot.farmId);
    return this.prisma.crop.findMany({ where: { lotId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, user: RequestUser) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { lot: { include: { farm: true } }, labors: true, harvests: true },
    });
    if (!crop) throw new NotFoundException('Cultivo no encontrado');
    await this.access.assertAccess(user, crop.lot.farmId);
    return crop;
  }
}
