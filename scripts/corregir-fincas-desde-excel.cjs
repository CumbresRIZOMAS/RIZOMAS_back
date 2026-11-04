const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const inputPath = process.argv[2];
const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const normalize = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const digits = (value) => String(value ?? '').replace(/\D/g, '');
const coord = (lat, lon) => lat == null || lon == null
  ? '' : `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
const farmActivity = [
  'labors', 'soilAnalyses', 'purchases', 'sales', 'workers', 'coffeeProcesses',
  'evidences', 'environmentalConditions', 'publications', 'indicators', 'bioinputs', 'reports',
];
const lotActivity = [
  'crops', 'labors', 'soilAnalyses', 'evidences', 'environmentalConditions',
  'bioinputApplications', 'indicators', 'coffeeProcesses',
];
const hasActivity = (record, fields) => fields.some((field) => record._count[field] > 0);

async function main() {
  const rowsByDocument = new Map();
  for (const row of rows) {
    const document = digits(row.documentNumber);
    if (!document) continue;
    rowsByDocument.set(document, [...(rowsByDocument.get(document) ?? []), row]);
  }

  const farms = await prisma.farm.findMany({
    include: {
      members: { include: { user: { select: { documentNumber: true } } } },
      lots: {
        include: {
          lotMembers: true,
          _count: { select: {
            crops: true, labors: true, soilAnalyses: true, evidences: true,
            environmentalConditions: true, bioinputApplications: true,
            indicators: true, coffeeProcesses: true,
          } },
        },
      },
      _count: { select: {
        labors: true, soilAnalyses: true, purchases: true, sales: true, workers: true,
        coffeeProcesses: true, evidences: true, environmentalConditions: true,
        publications: true, indicators: true, bioinputs: true, reports: true,
      } },
    },
  });

  const groups = new Map();
  for (const farm of farms) {
    for (const member of farm.members) {
      const sourceRows = rowsByDocument.get(digits(member.user.documentNumber)) ?? [];
      const matches = sourceRows.filter((row) => row.farmName && coord(row.farmLatitude, row.farmLongitude) === coord(farm.latitude, farm.longitude));
      if (!matches.length) continue;
      const expectedNames = new Set(matches.map((row) => row.farmName.trim()));
      if (expectedNames.size !== 1) throw new Error('El Excel tiene nombres distintos para la misma persona y ubicación.');
      const row = matches[0];
      const key = `${member.userId}|${coord(row.farmLatitude, row.farmLongitude)}|${normalize(row.farmName)}`;
      const group = groups.get(key) ?? { userId: member.userId, row, farms: [] };
      if (!group.farms.some((item) => item.id === farm.id)) group.farms.push(farm);
      groups.set(key, group);
    }
  }

  const affected = [...groups.values()].filter((group) => group.farms.some((farm) => normalize(farm.name) !== normalize(group.row.farmName)));
  const plan = affected.map((group) => {
    const owned = group.farms.filter((farm) => farm.ownerId === group.userId);
    if (group.farms.length > 1 && owned.length !== 1) throw new Error('No se encontró una finca canónica única.');
    const canonical = owned[0] ?? group.farms[0];
    const sources = group.farms.filter((farm) => farm.id !== canonical.id);
    for (const source of sources) {
      if (hasActivity(source, farmActivity) || source.lots.some((lot) => hasActivity(lot, lotActivity))) {
        throw new Error(`La copia de ${group.row.farmName} contiene actividad; no se hará la consolidación.`);
      }
      if (source.ownerId && source.ownerId !== group.userId) throw new Error('Una copia pertenece a otro usuario.');
    }
    return { group, canonical, sources };
  });

  console.log(JSON.stringify({ phase: 'plan_ready', farms: farms.length, matchedGroups: groups.size, affectedGroups: plan.length, duplicatesToMerge: plan.reduce((n, item) => n + item.sources.length, 0) }));

  let merged = 0;
  await prisma.$transaction(async (tx) => {
    for (const { group, canonical, sources } of plan) {
      for (const source of sources) {
        for (const member of source.members) {
          await tx.farmUser.upsert({
            where: { farmId_userId: { farmId: canonical.id, userId: member.userId } },
            create: { farmId: canonical.id, userId: member.userId, role: member.role },
            update: {},
          });
        }
        for (const lot of source.lots) {
          const lotCopies = canonical.lots.filter((item) => normalize(item.name) === normalize(lot.name));
          if (lotCopies.length === 1) {
            const targetLot = lotCopies[0];
            for (const member of lot.lotMembers) {
              await tx.lotUser.upsert({
                where: { lotId_userId: { lotId: targetLot.id, userId: member.userId } },
                create: { lotId: targetLot.id, userId: member.userId },
                update: {},
              });
            }
            await tx.lot.delete({ where: { id: lot.id } });
          } else {
            await tx.lot.update({ where: { id: lot.id }, data: { farmId: canonical.id } });
          }
        }
        await tx.farm.delete({ where: { id: source.id } });
        merged += 1;
      }

      const row = group.row;
      await tx.farm.update({
        where: { id: canonical.id },
        data: {
          name: row.farmName.trim(),
          region: row.region || null,
          municipality: row.municipality || null,
          village: row.village || null,
          latitude: row.farmLatitude,
          longitude: row.farmLongitude,
        },
      });
    }
  }, { maxWait: 20000, timeout: 120000 });

  const canonicalIds = [...new Set(plan.map((item) => item.canonical.id))];
  const canonical = await prisma.farm.findMany({
    where: { id: { in: canonicalIds } },
    select: { name: true, latitude: true, longitude: true, region: true, municipality: true, village: true },
  });
  console.log(JSON.stringify({ phase: 'complete', updated: canonical.length, mergedDuplicates: merged, canonicalNames: canonical.map((farm) => farm.name) }));
}

main().catch((error) => {
  console.error(`FARM_FIX_FAILED ${error.name} ${error.code ?? ''} ${error.message?.split('\n')[0] ?? ''}`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
