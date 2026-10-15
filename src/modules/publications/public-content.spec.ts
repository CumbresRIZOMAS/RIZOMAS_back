import { EvidenceService } from '../evidence/evidence.service';
import { PUBLIC_EVIDENCE_SELECT } from '../evidence/public-evidence';
import { PublicationsService } from './publications.service';

/** Campos que nunca pueden salir en endpoints públicos (ASR-15). */
const PRIVADOS = ['geolocation', 'objectKey', 'moderation', 'reviewedById', 'farmId', 'lotId', 'laborId'];

describe('contenido público sin datos privados', () => {
  it('la selección pública de evidencias no incluye coordenadas ni claves de R2', () => {
    for (const campo of PRIVADOS) expect(PUBLIC_EVIDENCE_SELECT).not.toHaveProperty(campo);
  });

  it('GET /evidence/public usa la selección pública', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new EvidenceService({ evidence: { findMany } } as never, {} as never);
    await service.findPublic();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select: PUBLIC_EVIDENCE_SELECT }));
  });

  it('las publicaciones solo anidan la selección pública de sus evidencias', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findFirst = jest.fn().mockResolvedValue({ id: 'p1' });
    const service = new PublicationsService({ publication: { findMany, findFirst } } as never);

    await service.findPublished();
    await service.findOne('p1');

    for (const call of [findMany.mock.calls[0][0], findFirst.mock.calls[0][0]]) {
      expect(call.select.evidences.select).toEqual({ evidence: { select: PUBLIC_EVIDENCE_SELECT } });
      expect(call.select.evidences).not.toHaveProperty('include');
    }
  });
});
