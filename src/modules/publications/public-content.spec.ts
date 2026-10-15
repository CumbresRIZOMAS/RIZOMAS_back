import { EvidenceService } from '../evidence/evidence.service';
import { PUBLIC_EVIDENCE_SELECT } from '../evidence/public-evidence';
import { PublicationsService } from './publications.service';
import { publicationForTraceability, toPublicTraceability } from './public-traceability';

/** Campos que nunca pueden salir en endpoints públicos (ASR-15). */
const PRIVADOS = ['geolocation', 'objectKey', 'moderation', 'reviewedById', 'farmId', 'lotId', 'laborId'];

describe('contenido público sin datos privados', () => {
  it('la selección pública de evidencias no incluye coordenadas ni claves de R2', () => {
    for (const campo of PRIVADOS) expect(PUBLIC_EVIDENCE_SELECT).not.toHaveProperty(campo);
  });

  it('GET /evidence/public usa la selección pública', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new EvidenceService({ evidence: { findMany } } as never, {} as never, {} as never, {} as never);
    await service.findPublic();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select: PUBLIC_EVIDENCE_SELECT }));
  });

  it('las publicaciones solo anidan la selección pública de sus evidencias', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findFirst = jest.fn().mockResolvedValue({ id: 'p1' });
    const service = new PublicationsService({ publication: { findMany, findFirst } } as never, {} as never);

    await service.findPublished();
    await service.findOne('p1');

    for (const call of [findMany.mock.calls[0][0], findFirst.mock.calls[0][0]]) {
      expect(call.select.evidences.select).toEqual({ evidence: { select: PUBLIC_EVIDENCE_SELECT } });
      expect(call.select.evidences).not.toHaveProperty('include');
    }
  });
});

describe('read model de trazabilidad pública', () => {
  const row = {
    id: 'p1',
    title: 'Castillo lavado',
    region: 'Huila',
    quantity: { toString: () => '680' },
    unit: 'kg',
    publishedAt: new Date('2026-07-01'),
    farm: { region: 'Huila', farmType: 'EN_TRANSICION' },
    harvest: {
      quantity: { toString: () => '680' },
      unit: 'kg',
      quality: 'Selectiva',
      labor: { startDate: new Date('2026-06-16') },
      crop: {
        species: 'Café',
        variety: 'Castillo',
        lot: {
          labors: [{ type: 'MANEJO_AGRONOMICO' }],
          crops: [{ labors: [{ type: 'MANEJO_AGRONOMICO' }, { type: 'COSECHA' }] }],
          _count: { soilAnalyses: 2, bioinputApplications: 3 },
        },
      },
      coffeeProcesses: [{ currentStage: 'Secado', startedAt: new Date('2026-06-16'), finishedAt: null, products: [] }],
    },
  };

  it('la consulta no pide nombres, coordenadas ni datos comerciales', () => {
    const consulta = JSON.stringify(publicationForTraceability);
    for (const campo of ['"name"', 'exactLocation', 'location', 'geolocation', 'purchases', 'sales', 'value', 'owner', 'email', 'ownerId']) {
      expect(consulta).not.toContain(campo);
    }
  });

  it('cuenta las prácticas del lote y de sus cultivos', () => {
    const resultado = toPublicTraceability(row as never);
    expect(resultado.practices).toEqual({ laborsByType: { MANEJO_AGRONOMICO: 2, COSECHA: 1 }, soilAnalyses: 2, bioinputApplications: 3 });
    expect(resultado.crop).toEqual({ species: 'Café', variety: 'Castillo' });
    expect(resultado.processes[0].stage).toBe('Secado');
  });
});
