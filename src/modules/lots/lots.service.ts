import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLotDto } from './dto/lot.dto';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class LotsService {
  constructor(private readonly prisma: PrismaService, private readonly access: FarmAccessService) {}

  async create(dto: CreateLotDto, user: RequestUser) {
    await this.access.assertAccess(user, dto.farmId);
    return this.prisma.lot.create({ data: dto as never });
  }

  async findByFarm(farmId: string, user: RequestUser) {
    await this.access.assertAccess(user, farmId);
    return this.prisma.lot.findMany({ where: { farmId }, include: { crops: true } });
  }

  async findOne(id: string, user: RequestUser) {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: { farm: true, crops: true, labors: true, soilAnalyses: true, evidences: true },
    });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    await this.access.assertAccess(user, lot.farmId);
    return lot;
  }
}
