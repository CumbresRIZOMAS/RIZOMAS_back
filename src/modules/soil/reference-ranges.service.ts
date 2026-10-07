import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/services/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { parameterKey, ReferenceRange } from './diagnosis';
import { CreateReferenceRangeDto, UpdateReferenceRangeDto } from './dto/reference-range.dto';

/** Catálogo de rangos de referencia de suelo (RF-11), administrado por técnicos. */
@Injectable()
export class ReferenceRangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(crop?: string) {
    return this.prisma.soilReferenceRange.findMany({
      where: crop === undefined ? undefined : { crop: { in: ['', crop.trim()] } },
      orderBy: [{ parameter: 'asc' }, { crop: 'asc' }],
    });
  }

  async create(dto: CreateReferenceRangeDto, user: RequestUser) {
    try {
      const range = await this.prisma.soilReferenceRange.create({
        data: { ...this.toData(dto), createdById: user.appUserId },
      });
      await this.audit.record({
        userId: user.appUserId ?? user.sub,
        entity: 'SoilReferenceRange',
        entityId: range.id,
        action: 'CREATE',
        after: range,
      });
      return range;
    } catch (error) {
      throw this.duplicado(error);
    }
  }

  async update(id: string, dto: UpdateReferenceRangeDto, user: RequestUser) {
    const before = await this.ensureExists(id);
    const merged = {
      ...before,
      ...dto,
      min: dto.min !== undefined ? dto.min : before.min,
      max: dto.max !== undefined ? dto.max : before.max,
    };
    if (merged.min == null && merged.max == null) {
      throw new ConflictException('El rango necesita al menos un mínimo o un máximo');
    }
    try {
      const range = await this.prisma.soilReferenceRange.update({
        where: { id },
        data: this.toData(dto),
      });
      await this.audit.record({
        userId: user.appUserId ?? user.sub,
        entity: 'SoilReferenceRange',
        entityId: id,
        action: 'UPDATE',
        before,
        after: range,
      });
      return range;
    } catch (error) {
      throw this.duplicado(error);
    }
  }

  async remove(id: string, user: RequestUser) {
    const before = await this.ensureExists(id);
    await this.prisma.soilReferenceRange.delete({ where: { id } });
    await this.audit.record({
      userId: user.appUserId ?? user.sub,
      entity: 'SoilReferenceRange',
      entityId: id,
      action: 'DELETE',
      before,
    });
    return { id };
  }

  /**
   * Rangos para diagnosticar, por clave de parámetro. Si hay uno específico
   * para el cultivo, gana sobre el general.
   */
  async forDiagnosis(keys: string[], crop: string | null, db: Prisma.TransactionClient = this.prisma) {
    const ranges = await db.soilReferenceRange.findMany({
      where: {
        parameterKey: { in: keys },
        crop: { in: crop ? ['', crop] : [''] },
      },
    });
    const byKey = new Map<string, ReferenceRange>();
    for (const r of [...ranges].sort((a, b) => a.crop.length - b.crop.length)) {
      byKey.set(r.parameterKey, {
        min: r.min?.toNumber() ?? null,
        max: r.max?.toNumber() ?? null,
        unit: r.unit,
      });
    }
    return byKey;
  }

  private toData(dto: UpdateReferenceRangeDto) {
    return {
      ...(dto.parameter !== undefined && {
        parameter: dto.parameter.trim(),
        parameterKey: parameterKey(dto.parameter),
      }),
      ...(dto.crop !== undefined && { crop: dto.crop.trim() }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      ...(dto.min !== undefined && { min: dto.min }),
      ...(dto.max !== undefined && { max: dto.max }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    } as Prisma.SoilReferenceRangeUncheckedCreateInput;
  }

  private async ensureExists(id: string) {
    const range = await this.prisma.soilReferenceRange.findUnique({
      where: { id },
    });
    if (!range) throw new NotFoundException('Rango de referencia no encontrado');
    return range;
  }

  private duplicado(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Ya existe un rango para ese parámetro y cultivo');
    }
    return error;
  }
}
