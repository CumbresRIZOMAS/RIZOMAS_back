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
import { CreateCoffeeProcessDto, CreateCoffeeProcessEventDto } from '../coffee/dto/coffee.dto';
import { CoffeeService } from '../coffee/coffee.service';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { CreateLotDto } from '../lots/dto/lot.dto';
import { CreateCropDto } from '../crops/dto/crop.dto';
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
    private readonly coffee: CoffeeService,
    private readonly farmAccess: FarmAccessService,
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

  /**
   * Foto completa de las fincas del usuario para la app (offline-first). Se
   * manda completa en cada pull: los cambios en lotes, labores o análisis no
   * tocan farm.updatedAt, así que filtrar por fecha de la finca perdía datos.
   * El volumen por agricultor es pequeño (1-2 fincas).
   */
  async pull(_since: string | undefined, requestUser: RequestUser) {
    const userId = await this.resolveUserId(requestUser);
    const accessibleFarmIds = await this.farmAccess.accessibleFarmIds(requestUser);
    const verComercial = [AppRole.ADMIN_FINCA, AppRole.ADMIN_CUMBRES].includes(requestUser.role as AppRole);
    const [user, farms] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } }),
      this.prisma.farm.findMany({
        // Usa la misma regla de alcance que los demás endpoints: Cumbres ve
        // todas las fincas; los demás, solo las que poseen o integran.
        ...(accessibleFarmIds === null ? {} : { where: { id: { in: accessibleFarmIds } } }),
        omit: { exactLocation: true },
        include: {
          lots: { include: { crops: true } },
          labors: { include: { harvest: true, management: true } },
          soilAnalyses: {
            orderBy: { date: 'desc' },
            include: { diagnostics: { include: { recommendations: { include: { bioinput: { select: { name: true } } } } } } },
          },
          coffeeProcesses: { include: { lot: { include: { crops: true } }, events: { orderBy: { recordedAt: 'asc' } }, products: { include: { certifications: true } } } },
          // Compras y ventas solo para quien puede verlas (ASR-14).
          ...(verComercial ? { purchases: { include: { supplier: { select: { name: true } } } }, sales: true } : {}),
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { serverTime: new Date().toISOString(), user, farms };
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
      case 'lot': {
        const dto = await validated(CreateLotDto, payload);
        await this.farmAccess.assertAccess(user, dto.farmId);
        return this.prisma.lot.create({ data: dto as never });
      }
      case 'crop': {
        const dto = await validated(CreateCropDto, payload);
        const lot = await this.prisma.lot.findUnique({ where: { id: dto.lotId }, select: { farmId: true } });
        if (!lot) throw new BadRequestException('El lote del cultivo no existe');
        await this.farmAccess.assertAccess(user, lot.farmId);
        return this.prisma.crop.create({ data: dto as never });
      }
      case 'labor': {
        const dto = await validated(CreateLaborDto, payload);
        await this.farmAccess.assertAccess(user, dto.farmId);
        return this.labors.create(dto, user);
      }
      case 'harvest': {
        const dto = await validated(CreateHarvestDto, payload);
        await this.farmAccess.assertAccess(user, dto.farmId);
        return this.labors.createHarvest(dto, user);
      }
      case 'agronomic_management': {
        const dto = await validated(CreateAgronomicManagementDto, payload);
        await this.farmAccess.assertAccess(user, dto.farmId);
        return this.labors.createAgronomicManagement(dto, user);
      }
      case 'soil_analysis': {
        requireRole(user, [AppRole.ADMIN_FINCA, AppRole.TECNICO], 'análisis de suelo');
        const dto = await validated(CreateSoilAnalysisDto, payload);
        await this.farmAccess.assertAccess(user, dto.farmId);
        return this.soil.createAnalysis(dto, user);
      }
      case 'evidence': {
        return this.evidence.create(await validated(CreateEvidenceDto, payload), user);
      }
      case 'purchase': {
        requireRole(user, [AppRole.ADMIN_FINCA], 'compras');
        const dto = await validated(CreatePurchaseDto, payload);
        await this.farmAccess.assertAccess(user, dto.farmId);
        return this.commercial.createPurchase(dto, user);
      }
      case 'sale': {
        requireRole(user, [AppRole.ADMIN_FINCA], 'ventas');
        const dto = await validated(CreateSaleDto, payload);
        await this.farmAccess.assertAccess(user, dto.farmId);
        return this.commercial.createSale(dto, user);
      }
      case 'coffee_process':
        requireRole(user, [AppRole.ADMIN_FINCA, AppRole.ADMIN_CUMBRES, AppRole.TECNICO, AppRole.AGRICULTOR], 'proceso de café');
        return this.coffee.create(await validated(CreateCoffeeProcessDto, payload), user);
      case 'coffee_process_event': {
        requireRole(user, [AppRole.ADMIN_FINCA, AppRole.ADMIN_CUMBRES, AppRole.TECNICO, AppRole.AGRICULTOR], 'etapa de café');
        const coffeeProcessId = payload.coffeeProcessId;
        if (typeof coffeeProcessId !== 'string') throw new BadRequestException('coffeeProcessId es obligatorio');
        const { coffeeProcessId: _processId, ...eventPayload } = payload;
        const dto = await validated(CreateCoffeeProcessEventDto, eventPayload);
        return this.coffee.addEvent(coffeeProcessId, dto, user);
      }
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
