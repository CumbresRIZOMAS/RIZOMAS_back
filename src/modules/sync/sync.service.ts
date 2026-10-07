import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { SyncBatchDto, SyncOperationDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async applyBatch(dto: SyncBatchDto, requestUser: RequestUser) {
    const userId = await this.resolveUserId(requestUser, dto.userId);
    const results: Array<
      | { clientUuid: string; status: 'duplicate'; appliedAt: Date }
      | { clientUuid: string; status: 'applied'; data: unknown }
    > = [];
    for (const operation of dto.operations) {
      const existing = await this.prisma.syncOperation.findUnique({ where: { clientUuid: operation.clientUuid } });
      if (existing) {
        results.push({ clientUuid: operation.clientUuid, status: 'duplicate', appliedAt: existing.appliedAt });
        continue;
      }

      const data = await this.applyOperation(operation, userId);
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

  private applyOperation(operation: SyncOperationDto, userId: string) {
    if (operation.operation !== 'create') {
      return { skipped: true, reason: 'Solo create esta habilitado en el MVP de sincronizacion' };
    }

    if (operation.entity === 'farm') {
      return this.prisma.farm.create({
        data: { ...operation.payload, ownerId: userId } as never,
      });
    }
    if (operation.entity === 'lot') return this.prisma.lot.create({ data: operation.payload as never });
    if (operation.entity === 'crop') return this.prisma.crop.create({ data: operation.payload as never });
    if (operation.entity === 'labor') return this.prisma.labor.create({ data: operation.payload as never });
    if (operation.entity === 'evidence') return this.prisma.evidence.create({ data: operation.payload as never });

    return { skipped: true, reason: `Entidad no soportada: ${operation.entity}` };
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
