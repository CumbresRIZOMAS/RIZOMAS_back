/* Sincroniza User desde Excel, finca desde KML/Excel y lote desde P/Q/R. */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const [, , inputPath] = process.argv;
const summary = {
  profiles: 0, farmsCreated: 0, farmsUpdated: 0, lotsCreated: 0, lotsUpdated: 0,
  farmMemberships: 0, lotMemberships: 0, pendingFarm: 0, pendingLot: 0,
  conflictingFarmGroups: 0, conflictingLotCoordinates: 0, ambiguousFarmNames: 0,
  profileFieldsUpdated: 0, conflictingEmails: 0,
};

function digits(value) { return String(value ?? '').replace(/\D/g, ''); }
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
}
function farmName(value) {
  const separator = String(value ?? '').indexOf(' - ');
  return separator >= 0 ? String(value).slice(separator + 3).trim() : String(value ?? '').trim();
}
function farmNameKey(value) { return normalize(farmName(value)); }
function coordinateKey(row, prefix = '') {
  const latitude = prefix ? row.farmLatitude : row.latitude;
  const longitude = prefix ? row.farmLongitude : row.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
}
function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || undefined;
}
function optionalAge(value) {
  const age = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(age) && age >= 0 && age <= 130 ? age : undefined;
}

async function main() {
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('No se recibió el archivo temporal de registros');
  const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const farmGroups = new Map();
  for (const row of rows) {
    const key = farmNameKey(row.farmName);
    if (!key) continue;
    farmGroups.set(key, [...(farmGroups.get(key) ?? []), row]);
  }

  const [existingFarms, existingUsers] = await Promise.all([
    prisma.farm.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const usersByName = new Map(existingUsers.map((user) => [normalize(user.name), user.id]));
  const farmsByName = new Map();
  for (const farm of existingFarms) {
    const key = farmNameKey(farm.name);
    farmsByName.set(key, [...(farmsByName.get(key) ?? []), farm.id]);
  }

  await prisma.$transaction(async (tx) => {
    const farmIdByName = new Map();
    for (const [key, group] of farmGroups) {
      const representative = group[0];
      const locations = new Set(group.map((row) => [row.region, row.municipality, row.village].map(normalize).join('|')));
      const farmCoordinates = new Map();
      for (const row of group) {
        const coordinate = coordinateKey(row, 'farm');
        if (coordinate) farmCoordinates.set(coordinate, row);
      }
      if (locations.size !== 1 || farmCoordinates.size !== 1) {
        summary.conflictingFarmGroups += 1;
        continue;
      }
      const coordinateRow = [...farmCoordinates.values()][0];
      const candidates = farmsByName.get(key) ?? [];
      if (candidates.length > 1) {
        summary.ambiguousFarmNames += 1;
        continue;
      }
      const data = {
        name: farmName(representative.farmName),
        region: representative.region || null,
        municipality: representative.municipality || null,
        village: representative.village || null,
        latitude: coordinateRow.farmLatitude,
        longitude: coordinateRow.farmLongitude,
      };
      const ownerCandidates = new Set(
        group
          .map((row) => usersByName.get(normalize(row.name)))
          .filter(Boolean),
      );
      if (ownerCandidates.size === 1) data.ownerId = [...ownerCandidates][0];
      let farmId = candidates[0] ?? null;
      if (!farmId) {
        const created = await tx.farm.create({ data, select: { id: true } });
        farmId = created.id;
        farmsByName.set(key, [farmId]);
        summary.farmsCreated += 1;
      } else {
        await tx.farm.update({ where: { id: farmId }, data });
        summary.farmsUpdated += 1;
      }
      farmIdByName.set(key, farmId);
    }

    const existingLots = await tx.lot.findMany({ select: { id: true, farmId: true, name: true } });
    const lotsByKey = new Map();
    for (const lot of existingLots) {
      const key = `${lot.farmId}|${normalize(lot.name)}`;
      lotsByKey.set(key, [...(lotsByKey.get(key) ?? []), lot.id]);
    }
    const lotIdByKey = new Map();
    const lotGroups = new Map();
    for (const row of rows) {
      const farmId = farmIdByName.get(farmNameKey(row.farmName));
      const lotName = String(row.propertyName ?? '').trim();
      if (!farmId || !lotName) continue;
      const key = `${farmId}|${normalize(lotName)}`;
      lotGroups.set(key, [...(lotGroups.get(key) ?? []), { ...row, farmId, lotName }]);
    }
    for (const [key, group] of lotGroups) {
      const candidates = lotsByKey.get(key) ?? [];
      if (candidates.length > 1) continue;
      const coordinates = new Map();
      for (const row of group) {
        const coordinate = coordinateKey(row);
        if (coordinate) coordinates.set(coordinate, row);
      }
      if (coordinates.size > 1) summary.conflictingLotCoordinates += 1;
      const selectedCoordinate = coordinates.size === 1 ? [...coordinates.values()][0] : null;
      const representative = group[0];
      const data = selectedCoordinate
        ? { latitude: selectedCoordinate.latitude, longitude: selectedCoordinate.longitude }
        : {};
      let lotId = candidates[0] ?? null;
      if (!lotId) {
        const created = await tx.lot.create({
          data: { farmId: representative.farmId, name: representative.lotName, ...data },
          select: { id: true },
        });
        lotId = created.id;
        lotsByKey.set(key, [lotId]);
        summary.lotsCreated += 1;
      } else {
        if (Object.keys(data).length) await tx.lot.update({ where: { id: lotId }, data });
        summary.lotsUpdated += 1;
      }
      lotIdByKey.set(key, lotId);
    }

    for (const row of rows) {
      const documentNumber = digits(row.documentNumber) || null;
      const sourceRowKey = `REGISTRO_SOFTWARE:${row.rowNumber}`;
      const profile = (documentNumber && await tx.user.findUnique({ where: { documentNumber } })) ??
        await tx.user.findUnique({ where: { sourceRowKey } });
      if (!profile) continue;
      summary.profiles += 1;
      const profileData = {
        name: optionalText(row.name) ?? profile.name,
        phone: optionalText(row.phone) ?? profile.phone,
        email: optionalText(row.email) ?? profile.email,
        associationCode: optionalText(row.associationCode) ?? profile.associationCode,
        associationName: optionalText(row.associationName) ?? profile.associationName,
        secondLevelGroup: optionalText(row.secondLevelGroup) ?? profile.secondLevelGroup,
        sex: optionalText(row.sex) ?? profile.sex,
        age: optionalAge(row.age) ?? profile.age,
        specialGroup: optionalText(row.specialGroup) ?? profile.specialGroup,
        educationLevel: optionalText(row.educationLevel) ?? profile.educationLevel,
        sourceRowKey,
      };
      if (profileData.email && profileData.email !== profile.email) {
        const emailOwner = await tx.user.findUnique({ where: { email: profileData.email }, select: { id: true } });
        if (emailOwner && emailOwner.id !== profile.id) {
          delete profileData.email;
          summary.conflictingEmails += 1;
        }
      }
      const changed = Object.entries(profileData).some(([field, value]) => value !== profile[field]);
      if (changed) {
        await tx.user.update({ where: { id: profile.id }, data: profileData });
        summary.profileFieldsUpdated += 1;
      }
      const farmId = farmIdByName.get(farmNameKey(row.farmName));
      if (!farmId) { summary.pendingFarm += 1; continue; }
      await tx.farmUser.upsert({
        where: { farmId_userId: { farmId, userId: profile.id } },
        create: { farmId, userId: profile.id, role: 'AGRICULTOR' },
        update: { role: 'AGRICULTOR' },
      });
      summary.farmMemberships += 1;
      const lotName = String(row.propertyName ?? '').trim();
      if (!lotName) { summary.pendingLot += 1; continue; }
      const lotId = lotIdByKey.get(`${farmId}|${normalize(lotName)}`);
      if (!lotId) { summary.pendingLot += 1; continue; }
      await tx.lotUser.upsert({
        where: { lotId_userId: { lotId, userId: profile.id } },
        create: { lotId, userId: profile.id },
        update: {},
      });
      summary.lotMemberships += 1;
    }
  }, { maxWait: 15000, timeout: 120000 });

  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(`La vinculación de fincas y lotes falló (${error?.name ?? 'Error'}${error?.code ? `/${error.code}` : ''}); no se imprimieron datos personales.`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
