require('dotenv').config();
const { PrismaClient, Role, FarmType, LaborType, AgronomicManagementType } = require('@prisma/client');

const url = new URL(process.env.DATABASE_URL);
url.port = '5432';
url.search = '?sslmode=require&connect_timeout=15';
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

function displayName(user) {
  const metadata = user.raw_user_meta_data || {};
  return metadata.full_name || metadata.name || metadata.display_name || `Usuario de prueba (${user.email.split('@')[0]})`;
}

async function seedUser(authUser) {
  const user = await prisma.$transaction(async (tx) => {
    const found = await tx.user.findFirst({
      where: { OR: [{ authUserId: authUser.id }, { email: { equals: authUser.email, mode: 'insensitive' } }] },
    });
    const localUser = found
      ? await tx.user.update({ where: { id: found.id }, data: { authUserId: authUser.id, email: authUser.email } })
      : await tx.user.create({
          data: {
            authUserId: authUser.id,
            email: authUser.email,
            name: displayName(authUser),
            role: Role.AGRICULTOR,
          },
        });

    const identifier = `DEMO-AUTH-${authUser.id.slice(0, 8).toUpperCase()}`;
    let farm = await tx.farm.findFirst({ where: { identifier } });
    if (farm) return { id: localUser.id, email: localUser.email, farmId: farm.id, created: false };

    farm = await tx.farm.create({
      data: {
        ownerId: localUser.id,
        name: `Finca de prueba - ${authUser.email.split('@')[0]}`,
        identifier,
        municipality: 'Pitalito',
        region: 'Huila',
        areaHa: 6.3,
        climate: 'Templado húmedo de montaña',
        farmType: FarmType.REGENERATIVA,
      },
    });

    const loteUno = await tx.lot.create({
      data: { farmId: farm.id, name: 'Lote Cafetal', identifier: `${identifier}-L1`, areaHa: 2.5 },
    });
    const cafe = await tx.crop.create({
      data: {
        lotId: loteUno.id,
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
        notes: 'Ciclo productivo sintético para pruebas móviles.',
      },
    });
    const loteDos = await tx.lot.create({
      data: { farmId: farm.id, name: 'Lote Platanera', identifier: `${identifier}-L2`, areaHa: 1.7 },
    });
    await tx.crop.create({
      data: {
        lotId: loteDos.id,
        species: 'Plátano',
        variety: 'Dominico hartón',
        plantingDate: new Date('2023-08-10T12:00:00Z'),
        status: 'EN_PRODUCCION',
      },
    });
    const worker = await tx.worker.create({
      data: { farmId: farm.id, name: 'Trabajador de prueba', contact: authUser.email },
    });
    const cosecha = await tx.labor.create({
      data: {
        farmId: farm.id,
        cropId: cafe.id,
        workerId: worker.id,
        type: LaborType.COSECHA,
        name: 'Recolección de café (prueba)',
        startDate: new Date('2026-09-18T12:00:00Z'),
        endDate: new Date('2026-09-18T17:00:00Z'),
        durationMin: 300,
        observations: 'Registro sintético para validar sincronización móvil.',
        harvest: {
          create: {
            cropId: cafe.id,
            quantity: 142.5,
            unit: 'kg cereza',
            quality: 'Maduración alta',
            destination: 'Beneficio húmedo de la finca',
          },
        },
      },
      include: { harvest: true },
    });
    await tx.labor.create({
      data: {
        farmId: farm.id,
        lotId: loteUno.id,
        type: LaborType.MANEJO_AGRONOMICO,
        name: 'Poda de mantenimiento (prueba)',
        startDate: new Date('2026-08-20T12:00:00Z'),
        durationMin: 120,
        observations: 'Registro sintético para pruebas móviles.',
        management: { create: { type: AgronomicManagementType.PODA, quantity: 35 } },
      },
    });
    await tx.labor.create({
      data: {
        farmId: farm.id,
        lotId: loteDos.id,
        type: LaborType.MANEJO_AGRONOMICO,
        name: 'Limpieza del lote (prueba)',
        startDate: new Date('2026-07-30T12:00:00Z'),
        durationMin: 90,
        observations: 'Registro sintético para pruebas móviles.',
        management: { create: { type: AgronomicManagementType.LIMPIEZA, quantity: 1 } },
      },
    });

    await tx.soilAnalysis.create({
      data: {
        farmId: farm.id,
        lotId: loteUno.id,
        date: new Date('2026-06-15T12:00:00Z'),
        laboratory: 'Laboratorio de prueba',
        parameters: {
          ph: { value: 5.4, unit: 'pH' },
          materia_organica: { value: 4.2, unit: '%' },
          fosforo: { value: 12, unit: 'mg/kg' },
        },
        observations: 'Valores ficticios para probar análisis de suelo en móvil.',
        diagnostics: {
          create: [
            { parameter: 'pH', value: 5.4, unit: 'pH', referenceMin: 5.5, referenceMax: 6.5, status: 'BAJO' },
            { parameter: 'Materia orgánica', value: 4.2, unit: '%', referenceMin: 3, referenceMax: 6, status: 'OPTIMO' },
            { parameter: 'Fósforo', value: 12, unit: 'mg/kg', referenceMin: 15, referenceMax: 40, status: 'BAJO' },
          ],
        },
      },
    });
    await tx.coffeeProcess.create({
      data: {
        farmId: farm.id,
        harvestId: cosecha.harvest.id,
        currentStage: 'SECADO',
        startedAt: new Date('2026-09-18T17:00:00Z'),
        notes: 'Proceso de prueba asociado a una cosecha de demostración.',
        products: {
          create: {
            harvestId: cosecha.harvest.id,
            finalizedAt: new Date('2026-09-22T12:00:00Z'),
            destination: 'Mercado local de prueba',
            certifications: { create: { certifier: 'Certificadora de prueba', status: 'PENDIENTE' } },
          },
        },
      },
    });

    return { id: localUser.id, email: localUser.email, farmId: farm.id, created: true };
  });
  return user;
}

async function main() {
  const authUsers = await prisma.$queryRaw`
    SELECT id, email, raw_user_meta_data
    FROM auth.users
    WHERE email IS NOT NULL AND (banned_until IS NULL OR banned_until <= NOW())
    ORDER BY created_at
  `;
  const results = [];
  for (const authUser of authUsers) results.push(await seedUser(authUser));
  const summary = await Promise.all(results.map(async (entry) => {
    const [lots, crops, labors, harvests, soilAnalyses, coffeeProcesses] = await Promise.all([
      prisma.lot.count({ where: { farmId: entry.farmId } }),
      prisma.crop.count({ where: { lot: { farmId: entry.farmId } } }),
      prisma.labor.count({ where: { farmId: entry.farmId } }),
      prisma.harvest.count({ where: { labor: { farmId: entry.farmId } } }),
      prisma.soilAnalysis.count({ where: { farmId: entry.farmId } }),
      prisma.coffeeProcess.count({ where: { farmId: entry.farmId } }),
    ]);
    return { email: entry.email, localUserId: entry.id, farmId: entry.farmId, createdThisRun: entry.created, lots, crops, labors, harvests, soilAnalyses, coffeeProcesses };
  }));
  console.log(JSON.stringify({ authUsersFound: authUsers.length, users: summary }, null, 2));
}

main().catch((error) => {
  console.error(`Auth demo seed failed: ${error.code || error.name} ${error.message}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
