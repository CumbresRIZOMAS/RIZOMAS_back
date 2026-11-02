import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('normaliza fechas y valores decimales antes de guardarlos como JSON', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = new AuditService(prisma as never);

    await service.record({
      userId: 'auth-user-1',
      entity: 'CoffeeProcess',
      entityId: 'process-1',
      action: 'CREATE',
      after: {
        startedAt: new Date('2026-11-02T00:00:00.000Z'),
        harvest: { quantity: { toJSON: () => '680.00' } },
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: undefined,
        after: {
          startedAt: '2026-11-02T00:00:00.000Z',
          harvest: { quantity: '680.00' },
        },
        userId: 'user-1',
      }),
    });
  });
});
