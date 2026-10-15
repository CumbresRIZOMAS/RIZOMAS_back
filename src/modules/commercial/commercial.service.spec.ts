import { CommercialService } from './commercial.service';

function setup(existing: { id: string } | null) {
  const prisma = {
    supplier: {
      findFirst: jest.fn(async () => existing),
      create: jest.fn(async () => ({ id: 'nuevo' })),
    },
    purchase: { create: jest.fn(async ({ data }: { data: object }) => data) },
  };
  return { service: new CommercialService(prisma as never), prisma };
}

const compra = { farmId: 'f1', date: new Date('2026-09-10'), itemName: 'Cal dolomita', quantity: 1 };

describe('proveedor de las compras', () => {
  it('usa el proveedor existente con el mismo nombre (sin distinguir mayúsculas)', async () => {
    const { service, prisma } = setup({ id: 'coop' });
    await service.createPurchase({ ...compra, supplierName: '  cooperativa   del sur ' });
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { equals: 'cooperativa del sur', mode: 'insensitive' } } }),
    );
    expect(prisma.supplier.create).not.toHaveBeenCalled();
    expect(prisma.purchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supplierId: 'coop' }) }));
  });

  it('crea el proveedor si no existe y no guarda supplierName en la compra', async () => {
    const { service, prisma } = setup(null);
    await service.createPurchase({ ...compra, supplierName: 'Agroinsumos', isBioinput: true });
    expect(prisma.supplier.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Agroinsumos', inputType: 'BIOINSUMO' } }));
    const data = (prisma.purchase.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.supplierId).toBe('nuevo');
    expect(data).not.toHaveProperty('supplierName');
  });

  it('sin proveedor la compra queda sin supplierId', async () => {
    const { service, prisma } = setup(null);
    await service.createPurchase(compra);
    expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
  });
});
