import { BadRequestException, Injectable } from '@nestjs/common';
import { LaborType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseDto, CreateSaleDto } from './dto/commercial.dto';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService, private readonly access: FarmAccessService) {}

  async createPurchase(dto: CreatePurchaseDto, user: RequestUser) {
    await this.access.assertAccess(user, dto.farmId);
    const { supplierName, ...data } = dto;
    const supplierId = data.supplierId ?? (supplierName ? await this.supplierIdFor(supplierName, data.isBioinput) : undefined);
    return this.prisma.purchase.create({ data: { ...data, supplierId } as never, include: { supplier: true } });
  }

  /** Catálogo de proveedores (no inician sesión: son entidades externas). */
  suppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, inputType: true } });
  }

  /** Busca el proveedor por nombre (sin distinguir mayúsculas) o lo crea. */
  private async supplierIdFor(rawName: string, isBioinput?: boolean) {
    const name = rawName.trim().replace(/\s+/g, ' ');
    const existing = await this.prisma.supplier.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.supplier.create({ data: { name, inputType: isBioinput ? 'BIOINSUMO' : undefined }, select: { id: true } });
    return created.id;
  }

  async createSale(dto: CreateSaleDto, user: RequestUser) {
    await this.access.assertAccess(user, dto.farmId);
    if (!dto.laborId) return this.prisma.sale.create({ data: dto });
    return this.prisma.$transaction(async (tx) => {
      const labor = await tx.labor.findUnique({
        where: { id: dto.laborId },
        select: { farmId: true, type: true, harvest: { select: { id: true, quantity: true, unit: true } } },
      });
      if (!labor || labor.farmId !== dto.farmId || labor.type !== LaborType.COSECHA || !labor.harvest) {
        throw new BadRequestException('La venta debe apuntar a una cosecha de la misma finca');
      }
      if (dto.unit !== labor.harvest.unit) throw new BadRequestException('La unidad de venta debe coincidir con la unidad de la cosecha');
      const alreadySold = await tx.sale.aggregate({ where: { laborId: dto.laborId }, _sum: { quantity: true } });
      const available = Number(labor.harvest.quantity) - Number(alreadySold._sum.quantity ?? 0);
      if (Number(dto.quantity) <= 0 || Number(dto.quantity) > available) {
        throw new BadRequestException(`Cantidad no disponible; quedan ${Math.max(0, available)}`);
      }
      return tx.sale.create({ data: dto });
    }, { isolationLevel: 'Serializable' });
  }

  async ledger(farmId: string, user: RequestUser) {
    await this.access.assertAccess(user, farmId);
    return Promise.all([
      this.prisma.purchase.findMany({ where: { farmId }, orderBy: { date: 'desc' }, include: { supplier: true } }),
      this.prisma.sale.findMany({ where: { farmId }, orderBy: { date: 'desc' } }),
    ]).then(([purchases, sales]) => ({ purchases, sales }));
  }
}
