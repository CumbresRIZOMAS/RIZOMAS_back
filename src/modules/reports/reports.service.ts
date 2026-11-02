import { ForbiddenException, Injectable } from '@nestjs/common';
import { AppRole } from '../../common/enums/app-role.enum';
import { FarmAccessService } from '../../common/services/farm-access.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly access: FarmAccessService) {}

  async generate(query: ReportQueryDto, user: RequestUser) {
    if (!query.farmId) throw new ForbiddenException('Selecciona una finca para generar el reporte');
    await this.access.assertAccess(user, query.farmId);
    if (query.type === 'commercial' && ![AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA].includes(user.role as AppRole)) {
      throw new ForbiddenException('Solo administradores pueden generar reportes comerciales');
    }

    const dates = this.dateRange(query.from, query.to);
    const range = (field: string) => dates ? { [field]: dates } : {};
    const base = { farmId: query.farmId };
    const generatedAt = new Date().toISOString();

    switch (query.type as ReportType) {
      case 'production': {
        const [labors, harvests] = await Promise.all([
          this.prisma.labor.findMany({ where: { ...base, ...range('startDate') }, orderBy: { startDate: 'asc' }, select: { id: true, type: true, name: true, startDate: true, endDate: true, durationMin: true, observations: true, harvest: true, lot: { select: { id: true, name: true } } } }),
          this.prisma.harvest.findMany({ where: { labor: { ...base, ...range('startDate') } }, orderBy: { labor: { startDate: 'asc' } }, include: { labor: { select: { id: true, name: true, startDate: true, lot: { select: { name: true } } } } } }),
        ]);
        const unitTotals = harvests.reduce<Record<string, number>>((totals, harvest) => {
          totals[harvest.unit] = (totals[harvest.unit] ?? 0) + Number(harvest.quantity);
          return totals;
        }, {});
        return { type: query.type, farmId: query.farmId, generatedAt, totals: { labors: labors.length, harvestEvents: harvests.length, harvestedQuantityByUnit: unitTotals }, labors, harvests };
      }
      case 'environmental': {
        const conditions = await this.prisma.environmentalCondition.findMany({ where: { ...base, ...range('observedAt') }, orderBy: { observedAt: 'asc' }, include: { lot: { select: { id: true, name: true } } } });
        return { type: query.type, farmId: query.farmId, generatedAt, totals: { observations: conditions.length }, conditions };
      }
      case 'technical': {
        const [labors, soilAnalyses, applications] = await Promise.all([
          this.prisma.labor.findMany({ where: { ...base, ...range('startDate') }, orderBy: { startDate: 'asc' }, select: { id: true, type: true, name: true, startDate: true, endDate: true, durationMin: true, observations: true, lot: { select: { id: true, name: true } }, management: true } }),
          this.prisma.soilAnalysis.findMany({ where: { ...base, ...range('date') }, orderBy: { date: 'asc' }, include: { lot: { select: { id: true, name: true } }, diagnostics: { orderBy: { parameter: 'asc' }, include: { recommendations: true } } } }),
          this.prisma.bioinputApplication.findMany({ where: { lot: { farmId: query.farmId }, ...range('appliedAt') }, orderBy: { appliedAt: 'asc' }, include: { bioinput: { select: { name: true } }, lot: { select: { name: true } } } }),
        ]);
        return { type: query.type, farmId: query.farmId, generatedAt, totals: { labors: labors.length, soilAnalyses: soilAnalyses.length, bioinputApplications: applications.length }, labors, soilAnalyses, bioinputApplications: applications };
      }
      case 'social': {
        const [workers, labors] = await Promise.all([
          this.prisma.worker.count({ where: { farmId: query.farmId } }),
          this.prisma.labor.findMany({ where: { ...base, workerId: { not: null }, ...range('startDate') }, orderBy: { startDate: 'asc' }, select: { id: true, type: true, name: true, startDate: true, endDate: true, durationMin: true, workerId: true } }),
        ]);
        const workersWithLabor = new Set(labors.map((labor) => labor.workerId)).size;
        return {
          type: query.type,
          farmId: query.farmId,
          generatedAt,
          totals: { registeredWorkers: workers, workersWithLabor, assignedLaborRecords: labors.length, laborMinutes: labors.reduce((sum, labor) => sum + (labor.durationMin ?? 0), 0) },
          labors: labors.map(({ id, type, name, startDate, endDate, durationMin }) => ({ id, type, name, startDate, endDate, durationMin })),
        };
      }
      case 'commercial': {
        const [purchases, sales] = await Promise.all([
          this.prisma.purchase.findMany({ where: { ...base, ...range('date') }, orderBy: { date: 'asc' }, include: { supplier: { select: { name: true } } } }),
          this.prisma.sale.findMany({ where: { ...base, ...range('date') }, orderBy: { date: 'asc' } }),
        ]);
        return { type: query.type, farmId: query.farmId, generatedAt, totals: { purchases: purchases.length, sales: sales.length, purchaseValue: purchases.reduce((sum, item) => sum + Number(item.value ?? 0), 0), saleValue: sales.reduce((sum, item) => sum + Number(item.value ?? 0), 0) }, purchases, sales };
      }
      case 'traceability': {
        const processes = await this.prisma.coffeeProcess.findMany({
          where: { ...base, ...(dates ? { OR: [{ startedAt: dates }, { events: { some: { recordedAt: dates } } }] } : {}) },
          orderBy: { startedAt: 'asc' },
          include: { lot: { select: { id: true, name: true } }, harvest: { select: { id: true, quantity: true, unit: true, quality: true } }, events: { where: dates ? { recordedAt: dates } : {}, orderBy: { recordedAt: 'asc' } }, products: { include: { certifications: true } } },
        });
        return { type: query.type, farmId: query.farmId, generatedAt, totals: { processes: processes.length, events: processes.reduce((sum, process) => sum + process.events.length, 0) }, processes };
      }
    }
  }

  private dateRange(from?: Date, to?: Date) {
    if (!from && !to) return undefined;
    const end = to ? new Date(to) : undefined;
    if (end) end.setUTCHours(23, 59, 59, 999);
    return { ...(from ? { gte: from } : {}), ...(end ? { lte: end } : {}) };
  }
}
