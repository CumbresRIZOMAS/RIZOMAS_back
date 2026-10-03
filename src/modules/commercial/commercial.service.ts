import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseDto, CreateSaleDto } from './dto/commercial.dto';

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  createPurchase(dto: CreatePurchaseDto) {
    return this.prisma.purchase.create({ data: dto as never });
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
