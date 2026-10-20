import { BadRequestException } from '@nestjs/common';
import { CoffeeService } from './coffee.service';

function setup(harvestFarm = 'finca-1') {
  const proceso = { id: 'p1', farmId: 'finca-1', harvestId: 'h1', startedAt: new Date('2026-06-16'), products: [] };
  const prisma = {
    harvest: { findUnique: jest.fn(async () => ({ labor: { farmId: harvestFarm } })) },
    coffeeProcess: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: 'p1', ...data })),
      findUnique: jest.fn(async () => proceso),
      update: jest.fn(async ({ data }: { data: object }) => ({ ...proceso, ...data })),
    },
    productFinal: { create: jest.fn(async ({ data }: { data: object }) => ({ id: 'pf1', ...data })) },
  };
  const audit = { record: jest.fn() };
  const user = { sub: 'a', appUserId: 'u1' } as never;
  const access = { assertAccess: jest.fn(async () => undefined) };
  return { service: new CoffeeService(prisma as never, audit as never, access as never), prisma, audit, user };
}

describe('procesos de café', () => {
  it('no acepta una cosecha de otra finca (integridad, ASR-07)', async () => {
    const { service, user } = setup('otra-finca');
    await expect(service.create({ farmId: 'finca-1', harvestId: 'h1', currentStage: 'Beneficio', startedAt: new Date() }, user)).rejects.toThrow(BadRequestException);
  });

  it('avanzar de etapa queda en la auditoría con el antes y el después', async () => {
    const { service, audit, user } = setup();
    await service.update('p1', { currentStage: 'Secado' }, user);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: 'CoffeeProcess', action: 'UPDATE', after: expect.objectContaining({ currentStage: 'Secado' }) }));
  });

  it('no deja cerrar el proceso antes de su inicio', async () => {
    const { service, user } = setup();
    await expect(service.update('p1', { finishedAt: new Date('2026-06-01') }, user)).rejects.toThrow(BadRequestException);
  });

  it('el producto final hereda la cosecha del proceso (trazabilidad)', async () => {
    const { service, prisma, user } = setup();
    await service.addProduct('p1', { destination: 'Tostado 340 g' }, user);
    expect(prisma.productFinal.create).toHaveBeenCalledWith(expect.objectContaining({ data: { destination: 'Tostado 340 g', coffeeProcessId: 'p1', harvestId: 'h1' } }));
  });
});
