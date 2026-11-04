import { EvidenceService } from '../evidence/evidence.service';
import { PUBLIC_EVIDENCE_SELECT } from '../evidence/public-evidence';
import { PublicationsService } from './publications.service';
import { publicFarmName } from './public-farm-name';
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
    const service = new PublicationsService({ publication: { findMany, findFirst } } as never, {} as never, {} as never, {} as never);

    await service.findPublished();
    await service.findOne('p1');

    for (const call of [findMany.mock.calls[0][0], findFirst.mock.calls[0][0]]) {
      expect(call.select.evidences.select).toEqual({ evidence: { select: PUBLIC_EVIDENCE_SELECT } });
      expect(call.select.evidences).not.toHaveProperty('include');
    }
  });

  it('incluye fincas con municipio o departamento aunque aún no tengan una publicación activa', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const farms = jest.fn().mockResolvedValue([{ id: 'f1', name: 'El Rosal', municipality: 'Pitalito', region: 'Huila' }]);
    const service = new PublicationsService({ publication: { findMany }, farm: { findMany: farms } } as never, {} as never, {} as never, {} as never);

    const origins = await service.findPublishedOrigins();

    expect(farms).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ municipality: { not: null } }, { region: { not: null } }] },
      select: { id: true, name: true, municipality: true, region: true, farmType: true },
    }));
    expect(origins).toEqual([expect.objectContaining({ id: 'farm:f1', farmName: 'El Rosal', title: 'El Rosal', municipality: 'Pitalito', region: 'Huila', isPublished: false })]);
    expect(JSON.stringify(origins)).not.toContain('exactLocation');
  });

  it('prioriza la publicación vigente y devuelve solo una entrada por finca', async () => {
    const publication = (id: string) => ({ id, farmId: 'f1', farm: { name: 'El Rosal', municipality: 'Pitalito', region: 'Huila' }, title: `Café ${id}`, description: null, region: null, quantity: null, unit: null, publicLocation: null, publishedAt: new Date(), evidences: [] });
    const findMany = jest.fn().mockResolvedValue([publication('p2'), publication('p1')]);
    const farms = jest.fn().mockResolvedValue([{ id: 'f1', name: 'El Rosal', municipality: 'Pitalito', region: 'Huila' }, { id: 'f2', name: 'La Esperanza', municipality: null, region: 'Cauca' }]);
    const service = new PublicationsService({ publication: { findMany }, farm: { findMany: farms } } as never, {} as never, {} as never, {} as never);

    const origins = await service.findPublishedOrigins();

    expect(origins).toHaveLength(2);
    expect(origins[0]).toMatchObject({ id: 'p2', farmName: 'El Rosal', isPublished: true });
    expect(origins[1]).toMatchObject({ id: 'farm:f2', isPublished: false });
  });
});

describe('nombre público de la finca', () => {
  it('quita el nombre del propietario que trae el registro de agricultores', () => {
    expect(publicFarmName('ALBA LUZ PROANOS - ESPERANZA')).toBe('ESPERANZA');
    expect(publicFarmName('ALBA NOR BUESAQUILLO/ROBERT RIVERA - VILLA VISTA')).toBe('VILLA VISTA');
    expect(publicFarmName('ALEXANDER OME VELEZ -  VIDA ALEJANDRA')).toBe('VIDA ALEJANDRA');
  });

  it('deja igual los nombres sin propietario', () => {
    expect(publicFarmName('El Rosal')).toBe('El Rosal');
    expect(publicFarmName('Finca La-Esperanza')).toBe('Finca La-Esperanza');
  });

  it('el portal público nunca recibe el nombre del propietario', async () => {
    const publication = { id: 'p1', farmId: 'f1', farm: { name: 'ANA PEREZ - EL ROSAL', municipality: 'Pitalito', region: 'Huila' }, title: 'Café', description: null, region: null, quantity: null, unit: null, publicLocation: null, publishedAt: new Date(), evidences: [] };
    const findMany = jest.fn().mockResolvedValue([publication]);
    const farms = jest.fn().mockResolvedValue([{ id: 'f2', name: 'JUAN GOMEZ - LA ESPERANZA', municipality: 'Pitalito', region: 'Huila' }]);
    const service = new PublicationsService({ publication: { findMany }, farm: { findMany: farms } } as never, {} as never, {} as never, {} as never);

    const origins = await service.findPublishedOrigins();

    expect(origins.map((o) => o.farmName)).toEqual(['EL ROSAL', 'LA ESPERANZA']);
    expect(JSON.stringify(origins)).not.toMatch(/ANA PEREZ|JUAN GOMEZ/);
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
    expect(resultado.practices).toEqual({ laborsByType: { MANEJO_AGRONOMICO: 2, COSECHA: 1 }, soilAnalyses: 2, bioinputApplications: 3, recommendations: 0 });
    expect(resultado.crop).toEqual({ species: 'Café', variety: 'Castillo' });
    expect(resultado.processes[0].stage).toBe('Secado');
  });
});
