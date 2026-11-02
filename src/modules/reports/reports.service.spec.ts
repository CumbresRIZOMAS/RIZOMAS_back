import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { ReportsService } from './reports.service';

const FARM = 'a628e8ef-a243-4c41-93fb-f7c78f8868ab';
const ADMIN: RequestUser = { sub: 'auth-admin', appUserId: 'user-1', role: AppRole.ADMIN_FINCA };

function setup() {
  const prisma = {
    labor: { findMany: jest.fn().mockResolvedValue([]) },
    harvest: { findMany: jest.fn().mockResolvedValue([]) },
    environmentalCondition: { findMany: jest.fn().mockResolvedValue([]) },
    soilAnalysis: { findMany: jest.fn().mockResolvedValue([]) },
    bioinputApplication: { findMany: jest.fn().mockResolvedValue([]) },
    worker: { count: jest.fn().mockResolvedValue(0) },
    purchase: { findMany: jest.fn().mockResolvedValue([]) },
    sale: { findMany: jest.fn().mockResolvedValue([]) },
    coffeeProcess: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const access = { assertAccess: jest.fn().mockResolvedValue(undefined) };
  return { service: new ReportsService(prisma as never, access as never), prisma, access };
}

describe('ReportsService', () => {
  it.each(['production', 'environmental', 'technical', 'social', 'commercial', 'traceability'] as const)(
    'genera reporte %s para la finca y el rango solicitados', async (type) => {
      const { service, access } = setup();
      const from = new Date('2026-04-01T00:00:00.000Z');
      const to = new Date('2026-04-30T00:00:00.000Z');

      const report = await service.generate({ farmId: FARM, type, from, to }, ADMIN);

      expect(report).toMatchObject({ type, farmId: FARM, totals: expect.any(Object) });
      expect(access.assertAccess).toHaveBeenCalledWith(ADMIN, FARM);
    },
  );

  it('deniega valores comerciales a técnicos', async () => {
    const { service } = setup();
    await expect(service.generate({ farmId: FARM, type: 'commercial' }, { ...ADMIN, role: AppRole.TECNICO })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no genera un reporte sin finca', async () => {
    const { service } = setup();
    await expect(service.generate({ type: 'production' } as never, ADMIN)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limita las compras del reporte comercial al rango elegido', async () => {
    const { service, prisma } = setup();
    const from = new Date('2026-04-01T00:00:00.000Z');
    const to = new Date('2026-04-30T00:00:00.000Z');
    await service.generate({ farmId: FARM, type: 'commercial', from, to }, ADMIN);

    expect(prisma.purchase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { farmId: FARM, date: { gte: from, lte: new Date('2026-04-30T23:59:59.999Z') } },
    }));
    expect(prisma.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { farmId: FARM, date: { gte: from, lte: new Date('2026-04-30T23:59:59.999Z') } },
    }));
  });
});
