import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LaborType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateAgronomicManagementDto, CreateHarvestDto, CreateLaborDto } from './dto/labor.dto';

@Injectable()
export class LaborsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateLaborDto, user: RequestUser) {
    await this.validateScope(dto.farmId, dto.lotId, dto.cropId, dto.workerId);
    const labor = await this.prisma.labor.create({ data: dto as never });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Labor', entityId: labor.id, action: 'CREATE', after: labor });
    return labor;
  }

  async createHarvest(dto: CreateHarvestDto, user: RequestUser) {
    const { harvestCropId, quantity, unit, quality, destination, ...labor } = dto;
    const cropId = harvestCropId ?? dto.cropId;
    if (!cropId) throw new BadRequestException('La cosecha requiere un cultivo');
    await this.validateScope(dto.farmId, dto.lotId, cropId, dto.workerId);
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.labor.create({
        data: {
          ...labor,
          lotId: undefined,
          cropId,
          type: LaborType.COSECHA,
          harvest: { create: { cropId, quantity, unit, quality, destination } },
        } as never,
        include: { harvest: true },
      });
      return created;
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Labor', entityId: result.id, action: 'CREATE_HARVEST', after: result });
    return result;
  }

  async createAgronomicManagement(dto: CreateAgronomicManagementDto, user: RequestUser) {
    const { managementType, quantity, ...labor } = dto;
    await this.validateScope(dto.farmId, dto.lotId, dto.cropId, dto.workerId);
    const result = await this.prisma.labor.create({
      data: {
        ...labor,
        type: LaborType.MANEJO_AGRONOMICO,
        management: { create: { type: managementType, quantity } },
      } as never,
      include: { management: true },
    });
    await this.audit.record({ userId: user.appUserId ?? user.sub, entity: 'Labor', entityId: result.id, action: 'CREATE_AGRONOMIC_MANAGEMENT', after: result });
    return result;
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

  private async validateScope(farmId: string, lotId?: string, cropId?: string, workerId?: string) {
    if ((lotId ? 1 : 0) + (cropId ? 1 : 0) !== 1) {
      throw new BadRequestException('Una labor debe asociarse exactamente a un lote o a un cultivo');
    }
    if (lotId) {
      const lot = await this.prisma.lot.findUnique({ where: { id: lotId }, select: { farmId: true } });
      if (!lot || lot.farmId !== farmId) throw new BadRequestException('El lote no pertenece a la finca');
    }
    if (cropId) {
      const crop = await this.prisma.crop.findUnique({ where: { id: cropId }, select: { lot: { select: { farmId: true } } } });
      if (!crop || crop.lot.farmId !== farmId) throw new BadRequestException('El cultivo no pertenece a la finca');
    }
    if (workerId) {
      const worker = await this.prisma.worker.findUnique({ where: { id: workerId }, select: { farmId: true } });
      if (!worker || worker.farmId !== farmId) throw new BadRequestException('El trabajador no pertenece a la finca');
    }
  }
}
