import { EvidenceStatus } from '@prisma/client';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { decodeRgb, resizeRgb } = require('./nsfwjs.child.js');
import { ImageModerationAdapter } from './moderation.port';
import { decideStatus, ModerationService } from './moderation.service';
import { NsfwjsAdapter } from './nsfwjs.adapter';

function adapter(name: string, score: number, enabled = true): jest.Mocked<ImageModerationAdapter> {
  return { name, isEnabled: jest.fn(() => enabled), classify: jest.fn(async () => ({ score, labels: { x: score } })) } as never;
}

function setup(opts: { status?: EvidenceStatus; primary?: number; secondary?: number; secondaryEnabled?: boolean; r2Fails?: boolean; updated?: number }) {
  const prisma = {
    evidence: {
      findUnique: jest.fn(async () => ({ id: 'e1', status: opts.status ?? EvidenceStatus.PENDIENTE, objectKey: 'farms/f/evidence/a.jpg' })),
      updateMany: jest.fn(async () => ({ count: opts.updated ?? 1 })),
    },
  };
  const storage = {
    getObject: jest.fn(async () => {
      if (opts.r2Fails) throw new Error('NoSuchKey');
      return { body: Buffer.from('img') };
    }),
  };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn(() => undefined) };
  const primary = adapter('NSFWJS', opts.primary ?? 0.05);
  const secondary = adapter('GOOGLE_VISION', opts.secondary ?? 0, opts.secondaryEnabled ?? false);
  const service = new ModerationService(prisma as never, storage as never, audit as never, config as never, primary, secondary);
  return { service, prisma, primary, secondary, audit };
}

describe('moderación automática de evidencias', () => {
  it('nunca aprueba sola: lo limpio queda EN_REVISION y lo sospechoso en CUARENTENA', () => {
    const t = { quarantine: 0.7, ambiguous: 0.3 };
    expect(decideStatus(0.01, t)).toBe(EvidenceStatus.EN_REVISION);
    expect(decideStatus(0.69, t)).toBe(EvidenceStatus.EN_REVISION);
    expect(decideStatus(0.7, t)).toBe(EvidenceStatus.CUARENTENA);
  });

  it('una foto limpia pasa a revisión manual sin consultar a Google Vision', async () => {
    const { service, prisma, secondary, audit } = setup({ primary: 0.05, secondaryEnabled: true });
    await expect(service.process('e1')).resolves.toMatchObject({ status: EvidenceStatus.EN_REVISION });
    expect(secondary.classify).not.toHaveBeenCalled();
    expect(prisma.evidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1', status: EvidenceStatus.PENDIENTE },
        data: expect.objectContaining({ status: EvidenceStatus.EN_REVISION, moderationEngine: 'NSFWJS', moderationScore: 0.05 }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_MODERATE_EN_REVISION' }));
  });

  it('en la zona dudosa consulta el motor secundario y toma el puntaje más alto', async () => {
    const { service, prisma, secondary } = setup({ primary: 0.4, secondary: 0.9, secondaryEnabled: true });
    await expect(service.process('e1')).resolves.toMatchObject({ status: EvidenceStatus.CUARENTENA, score: 0.9 });
    expect(secondary.classify).toHaveBeenCalled();
    expect(prisma.evidence.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ moderationEngine: 'NSFWJS+GOOGLE_VISION' }) }));
  });

  it('sin API key de Google Vision decide solo con NSFWJS', async () => {
    const { service, secondary } = setup({ primary: 0.4, secondaryEnabled: false });
    await expect(service.process('e1')).resolves.toMatchObject({ status: EvidenceStatus.EN_REVISION });
    expect(secondary.classify).not.toHaveBeenCalled();
  });

  it('no toca evidencias que ya salieron de PENDIENTE', async () => {
    const { service, primary } = setup({ status: EvidenceStatus.APROBADA });
    await expect(service.process('e1')).resolves.toBeNull();
    expect(primary.classify).not.toHaveBeenCalled();
  });

  it('si no puede leer la foto la deja PENDIENTE con el error', async () => {
    const { service, prisma } = setup({ r2Fails: true });
    await expect(service.process('e1')).resolves.toBeNull();
    const data = (prisma.evidence.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).not.toHaveProperty('status');
    expect(data.moderation).toMatchObject({ error: 'NoSuchKey' });
  });

  it('no pisa una decisión manual tomada mientras corría el modelo', async () => {
    const { service, audit } = setup({ updated: 0 });
    await expect(service.process('e1')).resolves.toBeNull();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('decodificación de imágenes', () => {
  const w = 4;
  const h = 3;
  const rgba = Buffer.alloc(w * h * 4, 200);

  it('decodifica JPG y PNG a RGB', () => {
    const fromJpeg = decodeRgb(jpeg.encode({ data: rgba, width: w, height: h }, 90).data);
    expect(fromJpeg).toMatchObject({ width: w, height: h });
    expect(fromJpeg.data).toHaveLength(w * h * 3);

    const png = new PNG({ width: w, height: h });
    rgba.copy(png.data);
    const fromPng = decodeRgb(PNG.sync.write(png));
    expect(fromPng.data).toHaveLength(w * h * 3);
  });

  it('rechaza formatos que no son imagen', () => {
    expect(() => decodeRgb(Buffer.from('%PDF-1.7'))).toThrow('Formato de imagen no soportado');
  });
});

describe('NsfwjsAdapter (modelo real)', () => {
  it('clasifica en un proceso aparte y lo cierra al quedar inactivo', async () => {
    const w = 640;
    const data = Buffer.alloc(w * w * 4);
    for (let i = 0; i < w * w; i++) data.set([40, 140, 60, 255], i * 4);
    const adapter = new NsfwjsAdapter({ get: () => '300' } as never);
    try {
      const result = await adapter.classify(jpeg.encode({ data, width: w, height: w }, 90).data);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(Object.keys(result.labels)).toEqual(expect.arrayContaining(['Porn', 'Neutral', 'Drawing', 'Hentai', 'Sexy']));
      expect(adapter.running).toBe(true);

      await new Promise((r) => setTimeout(r, 1000));
      expect(adapter.running).toBe(false);
    } finally {
      adapter.stop();
    }
  }, 60_000);

  it('rechaza un archivo que no es imagen sin tumbar el proceso', async () => {
    const adapter = new NsfwjsAdapter({ get: () => '300' } as never);
    try {
      await expect(adapter.classify(Buffer.from('%PDF-1.7 no es una foto'))).rejects.toThrow('Formato de imagen no soportado');
    } finally {
      adapter.stop();
    }
  }, 60_000);
});

describe('reducción de imagen', () => {
  it('reduce a 224×224 promediando', () => {
    const grande = { data: new Uint8Array(448 * 448 * 3).fill(100), width: 448, height: 448 };
    const chica = resizeRgb(grande);
    expect(chica).toMatchObject({ width: 224, height: 224 });
    expect(chica.data).toHaveLength(224 * 224 * 3);
    expect(chica.data[0]).toBe(100);
  });
});
