import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncBatchDto, SyncOperationDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async applyBatch(dto: SyncBatchDto) {
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

      const data = await this.applyOperation(operation);
      await this.prisma.syncOperation.create({
        data: {
          userId: dto.userId,
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

  private applyOperation(operation: SyncOperationDto) {
    if (operation.operation !== 'create') {
      return { skipped: true, reason: 'Solo create esta habilitado en el MVP de sincronizacion' };
    }

    if (operation.entity === 'farm') return this.prisma.farm.create({ data: operation.payload as never });
    if (operation.entity === 'lot') return this.prisma.lot.create({ data: operation.payload as never });
    if (operation.entity === 'crop') return this.prisma.crop.create({ data: operation.payload as never });
    if (operation.entity === 'labor') return this.prisma.labor.create({ data: operation.payload as never });
    if (operation.entity === 'evidence') return this.prisma.evidence.create({ data: operation.payload as never });

    return { skipped: true, reason: `Entidad no soportada: ${operation.entity}` };
  }
}
