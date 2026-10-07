/**
 * Pruebas de integración de suelo y bioinsumos contra PostgreSQL real.
 * Se ejecutan solo si TEST_DATABASE_URL apunta a una base de prueba con las
 * migraciones aplicadas (ver README, sección "Pruebas"). Borran sus datos.
 */
import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { BioinputsModule } from '../bioinputs/bioinputs.module';
import { SoilModule } from './soil.module';

const TEST_DB = process.env.TEST_DATABASE_URL;

/** Simula el AuthGuard: el rol llega en el header x-test-role. */
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      sub: '00000000-0000-4000-8000-000000000001',
      role: req.headers['x-test-role'] ?? 'TECNICO',
    };
    return true;
  }
}

(TEST_DB ? describe : describe.skip)('suelo y bioinsumos (integración)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let farmId: string;
  let otherFarmId: string;
  let lotId: string;
  let otherLotId: string;

  const api = () => request(app.getHttpServer());
  const as = (role: string) => ({ 'x-test-role': role });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, SoilModule, BioinputsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Recommendation", "Diagnosis", "SoilAnalysis", "SoilReferenceRange", "BioinputApplication", "Bioinput", "Crop", "Lot", "Farm", "AuditLog" CASCADE',
    );
    const farm = await prisma.farm.create({ data: { name: 'El Porvenir' } });
    const other = await prisma.farm.create({ data: { name: 'Otra finca' } });
    farmId = farm.id;
    otherFarmId = other.id;
    const lot = await prisma.lot.create({
      data: {
        farmId,
        name: 'La Esperanza',
        crops: { create: { species: 'Café arábica' } },
      },
    });
    lotId = lot.id;
    otherLotId = (await prisma.lot.create({ data: { farmId: otherFarmId, name: 'Ajeno' } })).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function crearRango(body: Record<string, unknown>) {
    return api().post('/soil-reference-ranges').set(as('TECNICO')).send(body).expect(201);
  }

  describe('rangos de referencia', () => {
    it('crea, rechaza duplicados y exige al menos un límite', async () => {
      await crearRango({
        parameter: 'pH',
        crop: 'Café arábica',
        min: 5.8,
        max: 6.5,
      });
      await api().post('/soil-reference-ranges').set(as('TECNICO')).send({ parameter: 'PH ', crop: 'Café arábica', min: 5 }).expect(409);
      await api().post('/soil-reference-ranges').set(as('TECNICO')).send({ parameter: 'Fósforo' }).expect(400);
    });

    it('solo técnicos y administración de Cumbres editan el catálogo', async () => {
      await api().post('/soil-reference-ranges').set(as('AGRICULTOR')).send({ parameter: 'pH', min: 5 }).expect(403);
      await api().post('/soil-reference-ranges').set(as('ADMIN_FINCA')).send({ parameter: 'pH', min: 5 }).expect(403);
    });
  });

  describe('análisis de suelo', () => {
    it('diagnostica cada parámetro contra el catálogo y recomienda solo lo fuera de rango', async () => {
      await crearRango({
        parameter: 'pH',
        crop: 'Café arábica',
        min: 5.8,
        max: 6.5,
      });
      await crearRango({ parameter: 'pH', min: 5.0, max: 7.5 });
      await crearRango({
        parameter: 'Fósforo',
        unit: 'mg/kg',
        min: 20,
        max: 40,
      });

      const res = await api()
        .post('/soil-analyses')
        .set(as('TECNICO'))
        .send({
          farmId,
          lotId,
          date: '2026-09-05',
          laboratory: 'Lab Agrosavia',
          parameters: [
            { name: 'pH', value: 5.5 },
            { name: 'fosforo', value: 18, unit: 'mg/kg' },
            { name: 'Calcio', value: 5.2, unit: 'cmol/kg' },
          ],
        })
        .expect(201);

      const byParam = Object.fromEntries(res.body.diagnostics.map((d: { parameter: string }) => [d.parameter, d]));
      // El rango del cultivo (5.8–6.5) gana sobre el general (5.0–7.5).
      expect(byParam.pH.status).toBe('BAJO');
      expect(Number(byParam.pH.referenceMin)).toBe(5.8);
      expect(byParam.fosforo.status).toBe('BAJO');
      expect(byParam.Calcio.status).toBe('SIN_REFERENCIA');
      expect(byParam.Calcio.recommendations).toHaveLength(0);
      expect(byParam.fosforo.recommendations[0]).toMatchObject({
        type: 'PRACTICA',
        automatic: true,
      });

      expect(
        await prisma.auditLog.count({
          where: { entity: 'SoilAnalysis', action: 'CREATE' },
        }),
      ).toBe(1);
    });

    it('rechaza un lote de otra finca sin guardar nada', async () => {
      await api()
        .post('/soil-analyses')
        .set(as('TECNICO'))
        .send({
          farmId,
          lotId: otherLotId,
          date: '2026-09-05',
          parameters: [{ name: 'pH', value: 6 }],
        })
        .expect(400);
      expect(await prisma.soilAnalysis.count()).toBe(0);
      expect(await prisma.diagnosis.count()).toBe(0);
    });

    it('valida el cuerpo: sin parámetros, valores no numéricos o repetidos', async () => {
      const base = { farmId, date: '2026-09-05' };
      await api()
        .post('/soil-analyses')
        .set(as('TECNICO'))
        .send({ ...base, parameters: [] })
        .expect(400);
      await api()
        .post('/soil-analyses')
        .set(as('TECNICO'))
        .send({ ...base, parameters: [{ name: 'pH', value: 'alto' }] })
        .expect(400);
      await api()
        .post('/soil-analyses')
        .set(as('TECNICO'))
        .send({
          ...base,
          parameters: [
            { name: 'pH', value: 6 },
            { name: 'PH', value: 6.1 },
          ],
        })
        .expect(400);
    });

    it('el agricultor consulta pero no registra análisis', async () => {
      await api()
        .post('/soil-analyses')
        .set(as('AGRICULTOR'))
        .send({
          farmId,
          date: '2026-09-05',
          parameters: [{ name: 'pH', value: 6 }],
        })
        .expect(403);
      await api().get(`/farms/${farmId}/soil-analyses`).set(as('AGRICULTOR')).expect(200);
    });
  });

  describe('recomendaciones', () => {
    async function diagnosticoDePh() {
      const res = await api()
        .post('/soil-analyses')
        .set(as('TECNICO'))
        .send({
          farmId,
          lotId,
          date: '2026-09-05',
          parameters: [{ name: 'pH', value: 5.2 }],
        })
        .expect(201);
      return res.body.diagnostics[0].id as string;
    }

    it('liga una recomendación de bioinsumo de la misma finca', async () => {
      const diagnosisId = await diagnosticoDePh();
      const bio = await prisma.bioinput.create({
        data: { farmId, name: 'Cal dolomita fermentada' },
      });

      const res = await api()
        .post('/recommendations')
        .set(as('TECNICO'))
        .send({
          diagnosisId,
          type: 'BIOINSUMO',
          description: 'Aplicar 2 t/ha antes de las lluvias',
          bioinputId: bio.id,
        })
        .expect(201);
      expect(res.body.bioinput.name).toBe('Cal dolomita fermentada');
      expect(res.body.automatic).toBe(false);
    });

    it('rechaza un bioinsumo de otra finca o un BIOINSUMO sin bioinsumo', async () => {
      const diagnosisId = await diagnosticoDePh();
      const ajeno = await prisma.bioinput.create({
        data: { farmId: otherFarmId, name: 'Ajeno' },
      });

      await api()
        .post('/recommendations')
        .set(as('TECNICO'))
        .send({
          diagnosisId,
          type: 'BIOINSUMO',
          description: 'x',
          bioinputId: ajeno.id,
        })
        .expect(400);
      await api().post('/recommendations').set(as('TECNICO')).send({ diagnosisId, type: 'BIOINSUMO', description: 'x' }).expect(400);
    });
  });

  describe('bioinsumos', () => {
    it('registra composición, aplica en un lote de la finca y muestra la trazabilidad', async () => {
      const created = await api()
        .post('/bioinputs')
        .set(as('AGRICULTOR'))
        .send({
          farmId,
          name: 'Bocashi',
          ingredients: [
            { name: 'Gallinaza', quantity: 50, unit: 'kg' },
            { name: 'Melaza', quantity: 4, unit: 'l' },
          ],
          producedAt: '2026-09-01',
        })
        .expect(201);

      await api()
        .post('/bioinputs/applications')
        .set(as('AGRICULTOR'))
        .send({
          bioinputId: created.body.id,
          lotId,
          appliedAt: '2026-09-10',
          quantity: 20,
          unit: 'kg',
        })
        .expect(201);

      const detalle = await api().get(`/bioinputs/${created.body.id}`).set(as('AGRICULTOR')).expect(200);
      expect(detalle.body.ingredients).toHaveLength(2);
      expect(detalle.body.applications[0].lot.name).toBe('La Esperanza');

      const deFinca = await api().get(`/farms/${farmId}/bioinputs`).set(as('AGRICULTOR')).expect(200);
      expect(deFinca.body).toHaveLength(1);
      expect(deFinca.body[0]._count.applications).toBe(1);
    });

    it('no aplica un bioinsumo en un lote de otra finca', async () => {
      const bio = await prisma.bioinput.create({
        data: { farmId, name: 'Bocashi' },
      });
      await api()
        .post('/bioinputs/applications')
        .set(as('AGRICULTOR'))
        .send({
          bioinputId: bio.id,
          lotId: otherLotId,
          appliedAt: '2026-09-10',
        })
        .expect(400);
      expect(await prisma.bioinputApplication.count()).toBe(0);
    });

    it('el listado global es solo para administración de Cumbres', async () => {
      await api().get('/bioinputs').set(as('AGRICULTOR')).expect(403);
      await api().get('/bioinputs').set(as('ADMIN_CUMBRES')).expect(200);
    });
  });
});
