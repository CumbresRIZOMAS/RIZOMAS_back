require('dotenv').config();
const { PrismaClient, Role, FarmType, LaborType } = require('@prisma/client');

const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.port = '5432';
dbUrl.search = '?sslmode=require&connect_timeout=15';
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl.toString() } } });
const DEMO_EMAIL = 'demo@rizomas.test';
const DEMO_IDENTIFIER = 'DEMO-RIZOMAS-001';

async function main() {
  const existing = await prisma.farm.findFirst({ where: { identifier: DEMO_IDENTIFIER } });
  if (existing) {
    const [users, farms, lots, crops, labors, harvests, soilAnalyses, diagnoses, recommendations, bioinputs, applications, conditions, indicatorValues] = await Promise.all([
      prisma.user.count({ where: { email: DEMO_EMAIL } }),
      prisma.farm.count({ where: { identifier: DEMO_IDENTIFIER } }),
      prisma.lot.count({ where: { farmId: existing.id } }),
      prisma.crop.count({ where: { lot: { farmId: existing.id } } }),
      prisma.labor.count({ where: { farmId: existing.id } }),
      prisma.harvest.count({ where: { labor: { farmId: existing.id } } }),
      prisma.soilAnalysis.count({ where: { farmId: existing.id } }),
      prisma.diagnosis.count({ where: { soilAnalysis: { farmId: existing.id } } }),
      prisma.recommendation.count({ where: { soilAnalysis: { farmId: existing.id } } }),
      prisma.bioinput.count({ where: { farmId: existing.id } }),
      prisma.bioinputApplication.count({ where: { lot: { farmId: existing.id } } }),
      prisma.environmentalCondition.count({ where: { farmId: existing.id } }),
      prisma.indicatorValue.count({ where: { farmId: existing.id } }),
    ]);
    console.log(`Demo data already exists; no records added. Counts: ${JSON.stringify({ users, farms, lots, crops, labors, harvests, soilAnalyses, diagnoses, recommendations, bioinputs, applications, conditions, indicatorValues })}`);
    return;
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {},
      create: {
        name: 'Agricultora de demostración',
        email: DEMO_EMAIL,
        role: Role.AGRICULTOR,
      },
    });

    const farm = await tx.farm.create({
      data: {
        ownerId: user.id,
        name: 'Finca La Esperanza (DEMO)',
        identifier: DEMO_IDENTIFIER,
        municipality: 'Pitalito',
        region: 'Huila',
        areaHa: 8.5,
        climate: 'Templado húmedo de montaña',
        farmType: FarmType.REGENERATIVA,
        members: { create: { userId: user.id, role: Role.ADMIN_FINCA } },
      },
    });

    const loteAlto = await tx.lot.create({
      data: { farmId: farm.id, name: 'Lote El Alto', identifier: 'DEMO-LOTE-01', areaHa: 3.2 },
    });
    const cafe = await tx.crop.create({
      data: {
        lotId: loteAlto.id,
        species: 'Café arábica',
        variety: 'Castillo',
        plantingDate: new Date('2022-04-15T12:00:00Z'),
        status: 'EN_PRODUCCION',
      },
    });
    await tx.cropCycle.create({
      data: {
        cropId: cafe.id,
        plantingDate: new Date('2022-04-15T12:00:00Z'),
        productionStart: new Date('2024-10-01T12:00:00Z'),
        harvestFrequency: 'Dos cosechas al año',
        notes: 'Ciclo demostrativo; datos ficticios.',
      },
    });
    const loteBajo = await tx.lot.create({
      data: { farmId: farm.id, name: 'Lote La Quebrada', identifier: 'DEMO-LOTE-02', areaHa: 2.1 },
    });
    await tx.crop.create({
      data: {
        lotId: loteBajo.id,
        species: 'Plátano',
        variety: 'Dominico hartón',
        plantingDate: new Date('2023-08-10T12:00:00Z'),
        status: 'EN_PRODUCCION',
      },
    });

    const worker = await tx.worker.create({
      data: { farmId: farm.id, name: 'Trabajador de demostración', contact: 'demo@rizomas.test' },
    });
    const labor = await tx.labor.create({
      data: {
        farmId: farm.id,
        cropId: cafe.id,
        workerId: worker.id,
        type: LaborType.COSECHA,
        name: 'Cosecha principal (DEMO)',
        startDate: new Date('2026-06-12T12:00:00Z'),
        endDate: new Date('2026-06-12T17:00:00Z'),
        durationMin: 300,
        observations: 'Registro de ejemplo; producción ficticia.',
        harvest: {
          create: {
            cropId: cafe.id,
            quantity: 185,
            unit: 'kg cereza',
            quality: 'Maduración alta',
            destination: 'Beneficio húmedo de la finca',
          },
        },
      },
      include: { harvest: true },
    });

    const analysis = await tx.soilAnalysis.create({
      data: {
        farmId: farm.id,
        lotId: loteAlto.id,
        date: new Date('2026-05-20T12:00:00Z'),
        laboratory: 'Laboratorio de demostración',
        parameters: {
          ph: { value: 5.4, unit: 'pH' },
          materia_organica: { value: 4.2, unit: '%' },
          fosforo: { value: 12, unit: 'mg/kg' },
        },
        observations: 'Resultados ficticios para probar el módulo de suelos.',
        diagnostics: {
          create: [
            { parameter: 'pH', value: 5.4, unit: 'pH', referenceMin: 5.5, referenceMax: 6.5, status: 'BAJO' },
            { parameter: 'Materia orgánica', value: 4.2, unit: '%', referenceMin: 3, referenceMax: 6, status: 'OPTIMO' },
            { parameter: 'Fósforo', value: 12, unit: 'mg/kg', referenceMin: 15, referenceMax: 40, status: 'BAJO' },
          ],
        },
        recommendations: {
          create: [
            { type: 'PRACTICA', description: 'Verificar pH con un nuevo muestreo y consultar asistencia técnica.', automatic: true },
            { type: 'PRACTICA', description: 'Evaluar fuentes orgánicas de fósforo según recomendación técnica.', automatic: true },
          ],
        },
      },
    });

    const bioinput = await tx.bioinput.create({
      data: {
        farmId: farm.id,
        name: 'Compost maduro (DEMO)',
        ingredients: [{ name: 'Pulpa de café', proportion: '40%' }, { name: 'Hojarasca', proportion: '40%' }, { name: 'Estiércol compostado', proportion: '20%' }],
        preparation: 'Mezcla compostada por aproximadamente 90 días; fórmula demostrativa.',
        producedAt: new Date('2026-03-01T12:00:00Z'),
        quantity: 250,
        unit: 'kg',
      },
    });
    await tx.bioinputApplication.create({
      data: {
        bioinputId: bioinput.id,
        lotId: loteAlto.id,
        appliedAt: new Date('2026-04-10T12:00:00Z'),
        quantity: 25,
        unit: 'kg',
        observations: 'Aplicación de ejemplo en el plato del cafeto.',
      },
    });
    await tx.environmentalCondition.createMany({
      data: [
        { farmId: farm.id, lotId: loteAlto.id, observedAt: new Date('2026-06-11T12:00:00Z'), type: 'TEMPERATURA', value: 19.5, unit: '°C', observations: 'Dato climático ficticio.' },
        { farmId: farm.id, lotId: loteAlto.id, observedAt: new Date('2026-06-11T12:00:00Z'), type: 'HUMEDAD_RELATIVA', value: 78, unit: '%', observations: 'Dato climático ficticio.' },
        { farmId: farm.id, lotId: loteBajo.id, observedAt: new Date('2026-06-11T12:00:00Z'), type: 'PRECIPITACION', value: 8.2, unit: 'mm', observations: 'Dato climático ficticio.' },
      ],
    });
    const indicator = await tx.indicatorDefinition.upsert({
      where: { name: 'Producción de café por hectárea (DEMO)' },
      update: {},
      create: { name: 'Producción de café por hectárea (DEMO)', category: 'PRODUCCION', description: 'Indicador ilustrativo de rendimiento', unit: 'kg/ha' },
    });
    await tx.indicatorValue.create({
      data: {
        definitionId: indicator.id,
        farmId: farm.id,
        lotId: loteAlto.id,
        periodStart: new Date('2026-01-01T12:00:00Z'),
        periodEnd: new Date('2026-06-30T12:00:00Z'),
        value: 1156.25,
        metadata: { source: 'DEMO', note: 'Valor ficticio para visualización.' },
      },
    });

    return { farmId: farm.id, userId: user.id, lots: 2, crops: 2, harvestId: labor.harvest.id, analysisId: analysis.id };
  });

  console.log(`Demo data inserted successfully: ${JSON.stringify(created)}`);
}

main().catch((error) => {
  console.error(`Demo seed failed: ${error.code || error.name} ${error.message}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
