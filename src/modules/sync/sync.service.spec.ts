import { BadRequestException } from '@nestjs/common';
import { AppRole } from '../../common/enums/app-role.enum';
import { SyncService } from './sync.service';

const FARM = '6f0c8a7e-1b2c-4d3e-8f9a-0b1c2d3e4f50';
const LOT = '7a1d9b8f-2c3d-4e5f-9a0b-1c2d3e4f5061';
const LABOR = '8b2e0c9a-3d4e-4f60-8b1c-2d3e4f506172';

function setup(role = AppRole.AGRICULTOR) {
  const prisma = {
    user: { findUnique: jest.fn(async () => ({ id: 'user-1', name: 'Carlos', email: 'c@x.co', role })) },
    farm: { findMany: jest.fn(async () => []) },
    syncOperation: {
      findUnique: jest.fn(async ({ where }: { where: { clientUuid: string } }) => (where.clientUuid === 'ya' ? { appliedAt: new Date('2026-01-01') } : null)),
      create: jest.fn(),
    },
  };
  const labors = {
    create: jest.fn(async (dto: unknown) => dto),
    createHarvest: jest.fn(async (dto: unknown) => dto),
    createAgronomicManagement: jest.fn(),
  };
  const soil = { createAnalysis: jest.fn() };
  const evidence = { create: jest.fn() };
  const commercial = { createPurchase: jest.fn(), createSale: jest.fn() };
  const coffee = { create: jest.fn(), addEvent: jest.fn() };
  const farmAccess = { assertAccess: jest.fn(async () => undefined) };
  const service = new SyncService(prisma as never, labors as never, soil as never, evidence as never, commercial as never, coffee as never, farmAccess as never);
  const user = { sub: 'auth-1', role, appUserId: 'user-1' } as never;
  return { service, prisma, labors, soil, commercial, coffee, farmAccess, user };
}

const labor = { id: LABOR, farmId: FARM, lotId: LOT, type: 'MANEJO_AGRONOMICO', name: 'Limpieza', startDate: '2026-06-18T00:00:00Z' };

describe('sincronización offline-first', () => {
  it('aplica una labor por el servicio de dominio y conserva el id del teléfono', async () => {
    const { service, labors, prisma, user } = setup();
    const { results } = await service.applyBatch({ userId: 'user-1', operations: [{ clientUuid: 'op-1', entity: 'labor', operation: 'create', payload: labor }] }, user);

    expect(results[0]).toMatchObject({ clientUuid: 'op-1', status: 'applied' });
    expect(labors.create).toHaveBeenCalledWith(expect.objectContaining({ id: LABOR, farmId: FARM, lotId: LOT }), user);
    expect(prisma.syncOperation.create).toHaveBeenCalledTimes(1);
  });

  it('un reintento con el mismo clientUuid no duplica el registro', async () => {
    const { service, labors, user } = setup();
    const { results } = await service.applyBatch({ userId: 'user-1', operations: [{ clientUuid: 'ya', entity: 'labor', operation: 'create', payload: labor }] }, user);
    expect(results[0].status).toBe('duplicate');
    expect(labors.create).not.toHaveBeenCalled();
  });

  it('rechaza un payload inválido sin tumbar el resto del lote', async () => {
    const { service, labors, prisma, user } = setup();
    const { results } = await service.applyBatch(
      {
        userId: 'user-1',
        operations: [
          { clientUuid: 'malo', entity: 'labor', operation: 'create', payload: { ...labor, startDate: 'ayer', extra: 1 } },
          { clientUuid: 'bueno', entity: 'labor', operation: 'create', payload: labor },
        ],
      },
      user,
    );
    expect(results[0]).toMatchObject({ clientUuid: 'malo', status: 'rejected' });
    expect(results[1]).toMatchObject({ clientUuid: 'bueno', status: 'applied' });
    expect(labors.create).toHaveBeenCalledTimes(1);
    expect(prisma.syncOperation.create).toHaveBeenCalledTimes(1);
  });

  it('las validaciones de dominio (regla xor) llegan como rechazo', async () => {
    const { service, labors, user } = setup();
    labors.create.mockRejectedValueOnce(new BadRequestException('Una labor debe asociarse exactamente a un lote o a un cultivo'));
    const { results } = await service.applyBatch({ userId: 'user-1', operations: [{ clientUuid: 'op', entity: 'labor', operation: 'create', payload: labor }] }, user);
    expect(results[0]).toEqual({ clientUuid: 'op', status: 'rejected', message: 'Una labor debe asociarse exactamente a un lote o a un cultivo' });
  });

  it('una falla temporal queda como error para reintentar', async () => {
    const { service, labors, prisma, user } = setup();
    labors.create.mockRejectedValueOnce(new Error('connection reset'));
    const { results } = await service.applyBatch({ userId: 'user-1', operations: [{ clientUuid: 'op', entity: 'labor', operation: 'create', payload: labor }] }, user);
    expect(results[0]).toMatchObject({ status: 'error' });
    expect(prisma.syncOperation.create).not.toHaveBeenCalled();
  });

  it('un agricultor no registra compras ni análisis de suelo desde la app', async () => {
    const { service, commercial, soil, user } = setup(AppRole.AGRICULTOR);
    const { results } = await service.applyBatch(
      {
        userId: 'user-1',
        operations: [
          { clientUuid: 'c', entity: 'purchase', operation: 'create', payload: { farmId: FARM, date: '2026-06-18', itemName: 'Melaza', quantity: 8 } },
          { clientUuid: 's', entity: 'soil_analysis', operation: 'create', payload: { farmId: FARM, date: '2026-06-18', parameters: [{ name: 'pH', value: 5.4 }] } },
        ],
      },
      user,
    );
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(commercial.createPurchase).not.toHaveBeenCalled();
    expect(soil.createAnalysis).not.toHaveBeenCalled();
  });

  it('una cosecha sincronizada pasa por createHarvest', async () => {
    const { service, labors, user } = setup();
    const harvest = { farmId: FARM, cropId: LOT, type: 'COSECHA', name: 'Recolección', startDate: '2026-06-16T00:00:00Z', quantity: 680, unit: 'kg' };
    const { results } = await service.applyBatch({ userId: 'user-1', operations: [{ clientUuid: 'h', entity: 'harvest', operation: 'create', payload: harvest }] }, user);
    expect(results[0].status).toBe('applied');
    expect(labors.createHarvest).toHaveBeenCalledWith(expect.objectContaining({ quantity: 680, unit: 'kg' }), user);
  });

  it('el pull trae el perfil y solo incluye compras y ventas para roles autorizados', async () => {
    const agricultor = setup(AppRole.AGRICULTOR);
    const respuesta = await agricultor.service.pull(undefined, agricultor.user);
    expect(respuesta.user).toMatchObject({ name: 'Carlos' });
    const include = (agricultor.prisma.farm.findMany.mock.calls[0] as unknown as [{ include: Record<string, unknown> }])[0].include;
    expect(include).not.toHaveProperty('purchases');
    expect(include).toHaveProperty('soilAnalyses');

    const admin = setup(AppRole.ADMIN_FINCA);
    await admin.service.pull(undefined, admin.user);
    const includeAdmin = (admin.prisma.farm.findMany.mock.calls[0] as unknown as [{ include: Record<string, unknown> }])[0].include;
    expect(includeAdmin).toMatchObject({ purchases: { include: { supplier: { select: { name: true } } } }, sales: true });
  });
});
