import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateAgronomicManagementDto, CreateHarvestDto, CreateLaborDto } from '../labors/dto/labor.dto';
import { LaborsService } from '../labors/labors.service';
import { CreateSoilAnalysisDto } from '../soil/dto/soil.dto';
import { SoilService } from '../soil/soil.service';
import { CreateEvidenceDto } from '../evidence/dto/evidence.dto';
import { EvidenceService } from '../evidence/evidence.service';
import { CreatePurchaseDto, CreateSaleDto } from '../commercial/dto/commercial.dto';
import { CommercialService } from '../commercial/commercial.service';
import { SyncBatchDto, SyncOperationDto } from './dto/sync.dto';

type SyncResult =
  | { clientUuid: string; status: 'duplicate'; appliedAt: Date }
  | { clientUuid: string; status: 'applied'; data: unknown }
  /** Inválida o sin permiso: reintentarla no sirve, la app debe mostrarla como fallida. */
  | { clientUuid: string; status: 'rejected'; message: string }
  /** Falla temporal (base de datos, red): la app la reintenta en la próxima sincronización. */
  | { clientUuid: string; status: 'error'; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida el payload igual que lo haría el ValidationPipe de un endpoint REST.
 * El `id` lo genera el teléfono (offline-first) y se conserva, para que el
 * registro tenga el mismo id local y en el servidor.
 */
async function validated<T extends object>(dtoClass: new () => T, payload: Record<string, unknown>): Promise<T & { id?: string }> {
  const { id, ...rest } = payload;
  if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) throw new BadRequestException('id debe ser un UUID');
  const dto = plainToInstance(dtoClass, rest);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints ?? {})).join('. ') || 'Datos inválidos');
  }
  return id === undefined ? dto : Object.assign(dto, { id });
}

function requireRole(user: RequestUser, roles: AppRole[], entity: string) {
  if (!roles.includes(user.role as AppRole)) throw new ForbiddenException(`Tu rol no puede registrar ${entity}`);
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly labors: LaborsService,
    private readonly soil: SoilService,
    private readonly evidence: EvidenceService,
    private readonly commercial: CommercialService,
  ) {}

  async applyBatch(dto: SyncBatchDto, requestUser: RequestUser) {
    const userId = await this.resolveUserId(requestUser, dto.userId);
    const results: SyncResult[] = [];
    for (const operation of dto.operations) {
      const existing = await this.prisma.syncOperation.findUnique({ where: { clientUuid: operation.clientUuid } });
      if (existing) {
        results.push({ clientUuid: operation.clientUuid, status: 'duplicate', appliedAt: existing.appliedAt });
        continue;
      }

      let data: unknown;
      try {
        data = await this.applyOperation(operation, userId, requestUser);
      } catch (error) {
        // Una operación mala no tumba el lote: las demás se siguen aplicando.
        const permanente = error instanceof HttpException && error.getStatus() < 500;
        const message = error instanceof Error ? error.message : 'Error desconocido';
        if (!permanente) this.logger.error(`Sync ${operation.entity} ${operation.clientUuid} falló`, error as Error);
        results.push({ clientUuid: operation.clientUuid, status: permanente ? 'rejected' : 'error', message });
        continue;
      }
      await this.prisma.syncOperation.create({
        data: {
          userId,
          clientUuid: operation.clientUuid,
          entity: operation.entity,
          operation: operation.operation,
          payload: operation.payload as never,
        },
      });
      results.push({ clientUuid: operation.clientUuid, status: 'applied', data });
    }
    return { results };
  }

  async pull(since: string | undefined, requestUser: RequestUser) {
    const userId = await this.resolveUserId(requestUser);
    const updatedAt = since ? new Date(since) : undefined;
    if (updatedAt && Number.isNaN(updatedAt.valueOf())) {
      return { serverTime: new Date().toISOString(), farms: [] };
    }

    const farms = await this.prisma.farm.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        ...(updatedAt ? { updatedAt: { gt: updatedAt } } : {}),
      },
      include: {
        lots: { include: { crops: true, labors: true } },
        labors: true,
      },
      orderBy: { updatedAt: 'asc' },
    });
    return { serverTime: new Date().toISOString(), farms };
  }

  /**
   * Cada entidad pasa por el mismo servicio de dominio que su endpoint REST, con
   * sus validaciones (regla xor de labores, integridad finca-lote-cultivo,
   * diagnóstico de suelo, moderación de evidencias) y su registro de auditoría.
   */
  private async applyOperation(operation: SyncOperationDto, userId: string, user: RequestUser) {
    if (operation.operation !== 'create') {
      throw new BadRequestException('Solo create está habilitado en la sincronización');
    }
    const payload = operation.payload;
    switch (operation.entity) {
      case 'farm':
        return this.prisma.farm.create({ data: { ...payload, ownerId: userId } as never });
      case 'lot':
        return this.prisma.lot.create({ data: payload as never });
      case 'crop':
        return this.prisma.crop.create({ data: payload as never });
      case 'labor':
        return this.labors.create(await validated(CreateLaborDto, payload), user);
      case 'harvest':
        return this.labors.createHarvest(await validated(CreateHarvestDto, payload), user);
      case 'agronomic_management':
        return this.labors.createAgronomicManagement(await validated(CreateAgronomicManagementDto, payload), user);
      case 'soil_analysis':
        requireRole(user, [AppRole.ADMIN_FINCA, AppRole.TECNICO], 'análisis de suelo');
        return this.soil.createAnalysis(await validated(CreateSoilAnalysisDto, payload), user);
      case 'evidence':
        return this.evidence.create(await validated(CreateEvidenceDto, payload), user);
      case 'purchase':
        requireRole(user, [AppRole.ADMIN_FINCA], 'compras');
        return this.commercial.createPurchase(await validated(CreatePurchaseDto, payload));
      case 'sale':
        requireRole(user, [AppRole.ADMIN_FINCA], 'ventas');
        return this.commercial.createSale(await validated(CreateSaleDto, payload));
      default:
        throw new BadRequestException(`Entidad no soportada: ${operation.entity}`);
    }
  }

  private async resolveUserId(requestUser: RequestUser, requestedId?: string) {
    if (requestUser.appUserId) return requestUser.appUserId;
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ authUserId: requestUser.sub }, ...(requestedId ? [{ id: requestedId }] : [])] },
      select: { id: true },
    });
    if (!user) throw new Error('Usuario local no encontrado');
    return user.id;
  }
}
