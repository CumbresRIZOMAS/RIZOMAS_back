import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/services/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplyBioinputDto, CreateBioinputDto } from './dto/bioinput.dto';

/** Bioinsumos: elaboración, composición, aplicación y trazabilidad (RF-13). */
@Injectable()
export class BioinputsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateBioinputDto, user: RequestUser) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId },
      select: { id: true },
    });
    if (!farm) throw new NotFoundException('Finca no encontrada');

    const bioinput = await this.prisma.bioinput.create({
      data: {
        farmId: dto.farmId,
        name: dto.name.trim(),
        recipe: dto.recipe as never,
        ingredients: dto.ingredients as never,
        preparation: dto.preparation,
        producedAt: dto.producedAt,
        quantity: dto.quantity,
        unit: dto.unit,
      },
    });
    await this.audit.record({
      userId: user.appUserId ?? user.sub,
      entity: 'Bioinput',
      entityId: bioinput.id,
      action: 'CREATE',
      after: bioinput,
    });
    return bioinput;
  }

  /** Solo para administración de Cumbres: devuelve bioinsumos de todas las fincas. */
  findAll() {
    return this.prisma.bioinput.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  findByFarm(farmId: string) {
    return this.prisma.bioinput.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  /** Detalle con su trazabilidad: dónde, cuándo y en qué labor se aplicó. */
  async findOne(id: string) {
    const bioinput = await this.prisma.bioinput.findUnique({
      where: { id },
      include: {
        applications: {
          orderBy: { appliedAt: 'desc' },
          include: {
            lot: { select: { id: true, name: true } },
            labor: { select: { id: true, name: true, startDate: true } },
          },
        },
        recommendations: {
          select: {
            id: true,
            description: true,
            diagnosisId: true,
            soilAnalysisId: true,
          },
        },
      },
    });
    if (!bioinput) throw new NotFoundException('Bioinsumo no encontrado');
    return bioinput;
  }

  async apply(dto: ApplyBioinputDto, user: RequestUser) {
    const [bioinput, lot, labor] = await Promise.all([
      this.prisma.bioinput.findUnique({
        where: { id: dto.bioinputId },
        select: { farmId: true },
      }),
      this.prisma.lot.findUnique({
        where: { id: dto.lotId },
        select: { farmId: true },
      }),
      dto.laborId
        ? this.prisma.labor.findUnique({
            where: { id: dto.laborId },
            select: { farmId: true },
          })
        : null,
    ]);
    if (!bioinput) throw new NotFoundException('Bioinsumo no encontrado');
    if (!lot) throw new NotFoundException('Lote no encontrado');
    if (lot.farmId !== bioinput.farmId) throw new BadRequestException('El lote no pertenece a la finca del bioinsumo');
    if (dto.laborId) {
      if (!labor) throw new NotFoundException('Labor no encontrada');
      if (labor.farmId !== bioinput.farmId) throw new BadRequestException('La labor no pertenece a la finca del bioinsumo');
    }

    const application = await this.prisma.bioinputApplication.create({
      data: dto,
      include: {
        bioinput: { select: { id: true, name: true } },
        lot: { select: { id: true, name: true } },
      },
    });
    await this.audit.record({
      userId: user.appUserId ?? user.sub,
      entity: 'BioinputApplication',
      entityId: application.id,
      action: 'CREATE',
      after: application,
    });
    return application;
  }
}
