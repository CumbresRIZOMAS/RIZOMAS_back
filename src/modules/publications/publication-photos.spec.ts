import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PublicationsService } from './publications.service';

function setup(opts: { validCount?: number; link?: object | null; access?: boolean } = {}) {
  const prisma = {
    publication: { findUnique: jest.fn(async () => ({ farmId: 'finca-1' })) },
    evidence: { count: jest.fn(async () => opts.validCount ?? 2), findMany: jest.fn(async () => []) },
    publicationEvidence: {
      findFirst: jest.fn(async () => (opts.link === undefined ? { evidence: { objectKey: 'farms/finca-1/evidence/a.jpg' } } : opts.link)),
      findMany: jest.fn(async () => []),
      deleteMany: jest.fn(() => 'delete'),
      createMany: jest.fn(() => 'create'),
    },
    $transaction: jest.fn(async () => []),
  };
  const access = {
    assertAccess: jest.fn(async () => {
      if (opts.access === false) throw new ForbiddenException();
    }),
  };
  const storage = { createDownloadUrl: jest.fn(async (key: string) => ({ url: `https://r2.test/${key}?firma` })) };
  const audit = { record: jest.fn() };
  const service = new PublicationsService(prisma as never, audit as never, access as never, storage as never);
  return { service, prisma, storage };
}

const user = { sub: 'a', appUserId: 'u1', role: 'TECNICO' } as never;

describe('fotos de las publicaciones', () => {
  it('asocia fotos aprobadas y públicas de la misma finca', async () => {
    const { service, prisma } = setup();
    await expect(service.setEvidences('p1', { evidenceIds: ['e1', 'e2', 'e1'] }, user)).resolves.toEqual({ evidenceIds: ['e1', 'e2'] });
    expect(prisma.evidence.count).toHaveBeenCalledWith({
      where: { id: { in: ['e1', 'e2'] }, farmId: 'finca-1', status: 'APROBADA', visibility: 'PUBLICA' },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rechaza fotos sin aprobar, privadas o de otra finca', async () => {
    const { service, prisma } = setup({ validCount: 1 });
    await expect(service.setEvidences('p1', { evidenceIds: ['e1', 'e2'] }, user)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('no deja gestionar publicaciones de otra finca', async () => {
    const { service } = setup({ access: false });
    await expect(service.photoCandidates('p1', user)).rejects.toThrow(ForbiddenException);
  });

  it('el portal recibe una URL firmada solo para fotos asociadas, aprobadas y de publicaciones activas', async () => {
    const { service, prisma } = setup();
    await expect(service.publicPhotoUrl('p1', 'e1')).resolves.toBe('https://r2.test/farms/finca-1/evidence/a.jpg?firma');
    expect(prisma.publicationEvidence.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publicationId: 'p1', evidenceId: 'e1', publication: { active: true }, evidence: { status: 'APROBADA', visibility: 'PUBLICA' } },
      }),
    );

    const sinFoto = setup({ link: null });
    await expect(sinFoto.service.publicPhotoUrl('p1', 'e9')).rejects.toThrow(NotFoundException);
    expect(sinFoto.storage.createDownloadUrl).not.toHaveBeenCalled();
  });
});
