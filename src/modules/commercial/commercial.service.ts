import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseDto, CreateSaleDto } from './dto/commercial.dto';

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async createPurchase(dto: CreatePurchaseDto) {
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

  createSale(dto: CreateSaleDto) {
    return this.prisma.sale.create({ data: dto });
  }

  ledger(farmId: string) {
    return Promise.all([
      this.prisma.purchase.findMany({ where: { farmId }, orderBy: { date: 'desc' }, include: { supplier: true } }),
      this.prisma.sale.findMany({ where: { farmId }, orderBy: { date: 'desc' } }),
    ]).then(([purchases, sales]) => ({ purchases, sales }));
  }
}
