import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFarmDto, UpdateFarmDto } from './dto/farm.dto';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService, private readonly access: FarmAccessService) {}

  create(dto: CreateFarmDto, user: RequestUser) {
    const ownerId = user.role === 'ADMIN_CUMBRES' ? dto.ownerId ?? user.appUserId : user.appUserId;
    return this.prisma.farm.create({ data: { ...dto, ownerId } as never });
  }

  findAll(user: RequestUser) {
    return this.access.accessibleFarmIds(user).then((ids) => this.prisma.farm.findMany({
      ...(ids === null ? {} : { where: { id: { in: ids } } }),
      orderBy: { createdAt: 'desc' },
      include: { owner: true, lots: true },
    }));
  }

  async update(id: string, dto: UpdateFarmDto, user: RequestUser) {
    await this.ensureExists(id);
    await this.access.assertAccess(user, id);
    if (user.role !== 'ADMIN_CUMBRES' && dto.ownerId && dto.ownerId !== user.appUserId) delete dto.ownerId;
    return this.prisma.farm.update({ where: { id }, data: dto as never });
  }

  async findOne(id: string, user: RequestUser) {
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
    await this.access.assertAccess(user, id);
    return farm;
  }

  private async ensureExists(id: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id } });
    if (!farm) throw new NotFoundException('Finca no encontrada');
  }
}
