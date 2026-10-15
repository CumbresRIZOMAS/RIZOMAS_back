import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppRole } from '../enums/app-role.enum';
import { EvidenceService } from '../../modules/evidence/evidence.service';
import { FarmAccessService } from './farm-access.service';

const prisma = {
  farm: { findMany: jest.fn(async () => [{ id: 'finca-propia' }]) },
  evidence: {
    findFirst: jest.fn(async ({ where }: { where: { objectKey: string } }) =>
      where.objectKey.includes('ajena') ? { farmId: 'finca-ajena' } : where.objectKey.includes('propia') ? { farmId: 'finca-propia' } : null,
    ),
    findMany: jest.fn(async () => []),
  },
};
const access = new FarmAccessService(prisma as never);
const evidence = new EvidenceService(prisma as never, {} as never, {} as never, access);
const tecnico = { sub: 'a', role: AppRole.TECNICO, appUserId: 'u1' };

describe('acceso por finca a las evidencias (ASR-01)', () => {
  it('firma la descarga de una foto de una finca propia', async () => {
    await expect(evidence.assertCanDownload('farms/finca-propia/evidence/x.jpg', tecnico)).resolves.toBeUndefined();
  });

  it('no firma fotos de otra finca aunque se conozca la clave', async () => {
    await expect(evidence.assertCanDownload('farms/finca-ajena/evidence/x.jpg', tecnico)).rejects.toThrow(ForbiddenException);
  });

  it('no firma claves que no son de una evidencia registrada', async () => {
    await expect(evidence.assertCanDownload('farms/finca-propia/../otra/cosa.jpg'.replace('propia', 'x'), tecnico)).rejects.toThrow(NotFoundException);
  });

  it('no deja pedir URL de subida para otra finca', async () => {
    await expect(evidence.assertCanUpload('finca-ajena', tecnico)).rejects.toThrow(ForbiddenException);
  });

  it('la administración de Cumbres accede a todas las fincas', async () => {
    const admin = { sub: 'b', role: AppRole.ADMIN_CUMBRES };
    await expect(evidence.assertCanDownload('farms/finca-ajena/evidence/x.jpg', admin)).resolves.toBeUndefined();
    expect(await access.farmFilter(admin)).toEqual({});
  });

  it('la bandeja de moderación solo trae fotos de sus fincas', async () => {
    await evidence.queue(tecnico);
    expect(prisma.evidence.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ farmId: { in: ['finca-propia'] } }) }));
  });

  it('sin usuario local no ve ninguna finca', async () => {
    expect(await access.accessibleFarmIds({ sub: 'c', role: AppRole.TECNICO })).toEqual([]);
  });
});
