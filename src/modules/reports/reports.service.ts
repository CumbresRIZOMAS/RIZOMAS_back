import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async production(query: ReportQueryDto) {
    const dateFilter = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
    const [labors, harvests, purchases, sales] = await Promise.all([
      this.prisma.labor.count({ where: { farmId: query.farmId, ...(query.from || query.to ? { startDate: dateFilter } : {}) } }),
      this.prisma.harvest.findMany({
        where: { labor: { farmId: query.farmId, ...(query.from || query.to ? { startDate: dateFilter } : {}) } },
        include: { labor: true },
      }),
      this.prisma.purchase.findMany({ where: { farmId: query.farmId } }),
      this.prisma.sale.findMany({ where: { farmId: query.farmId } }),
    ]);

    return {
      type: 'production',
      farmId: query.farmId,
      totals: {
        labors,
        harvestEvents: harvests.length,
        harvestedQuantity: harvests.reduce((sum, item) => sum + Number(item.quantity), 0),
        purchaseValue: purchases.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
        saleValue: sales.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
      },
    };
  }
}
