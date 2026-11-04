/* Sincroniza perfiles y fincas desde REGISTROS SOFTWARE.xlsx. */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const [, , inputPath] = process.argv;
const summary = {
  profiles: 0, farmsCreated: 0, farmsUpdated: 0,
  farmMemberships: 0, pendingFarm: 0,
  conflictingFarmGroups: 0, ambiguousFarmNames: 0,
  profileFieldsUpdated: 0, conflictingEmails: 0,
};

function digits(value) { return String(value ?? '').replace(/\D/g, ''); }
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
}
function farmName(value) {
  return String(value ?? '').trim();
}
function farmNameKey(value) { return normalize(farmName(value)); }
function farmKey(row) {
  const hasFarmCoordinates = row.farmLatitude != null || row.farmLongitude != null;
  const coordinate = coordinateKey(row, hasFarmCoordinates ? 'farm' : '');
  return [farmNameKey(row.farmName), coordinate ?? '', normalize(row.region), normalize(row.municipality)].join('|');
}
function coordinateKey(row, prefix = '') {
  const rawLatitude = prefix ? row.farmLatitude : row.latitude;
  const rawLongitude = prefix ? row.farmLongitude : row.longitude;
  if (rawLatitude == null || rawLongitude == null) return null;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
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
function normalizedPhone(value) {
  const number = digits(value);
  if (/^3\d{9}$/.test(number)) return `57${number}`;
  if (/^573\d{9}$/.test(number)) return number;
  return undefined;
}

async function main() {
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('No se recibió el archivo temporal de registros');
  const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const farmGroups = new Map();
  for (const row of rows) {
    const key = farmKey(row);
    if (!farmNameKey(row.farmName)) continue;
    farmGroups.set(key, [...(farmGroups.get(key) ?? []), row]);
  }

  const existingFarms = await prisma.farm.findMany({ select: {
    id: true, name: true, region: true, municipality: true, latitude: true, longitude: true,
  } });
  const farmsByName = new Map();
  for (const farm of existingFarms) {
    const key = farmKey(farm);
    farmsByName.set(key, [...(farmsByName.get(key) ?? []), farm.id]);
  }

  await prisma.$transaction(async (tx) => {
    const farmIdByKey = new Map();
    for (const [key, group] of farmGroups) {
      const representative = group[0];
      const locations = new Set(group.map((row) => [row.region, row.municipality, row.village].map(normalize).join('|')));
      const farmCoordinates = new Map();
      for (const row of group) {
        const coordinate = coordinateKey(row, 'farm');
        if (coordinate) farmCoordinates.set(coordinate, row);
      }
      if (locations.size !== 1 || farmCoordinates.size > 1) {
        summary.conflictingFarmGroups += 1;
        continue;
      }
      const coordinateRow = farmCoordinates.size === 1 ? [...farmCoordinates.values()][0] : null;
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
        latitude: coordinateRow?.farmLatitude ?? null,
        longitude: coordinateRow?.farmLongitude ?? null,
      };
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
      farmIdByKey.set(key, farmId);
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
        phone: normalizedPhone(row.phone) ?? profile.phone,
        documentNumber: digits(row.documentNumber) || profile.documentNumber,
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
      const farmId = farmIdByKey.get(farmKey(row));
      if (!farmId) { summary.pendingFarm += 1; continue; }
      await tx.farmUser.upsert({
        where: { farmId_userId: { farmId, userId: profile.id } },
        create: { farmId, userId: profile.id, role: 'AGRICULTOR' },
        update: { role: 'AGRICULTOR' },
      });
      summary.farmMemberships += 1;
    }
  }, { maxWait: 15000, timeout: 120000 });

  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(`La vinculación de fincas y lotes falló (${error?.name ?? 'Error'}${error?.code ? `/${error.code}` : ''}); no se imprimieron datos personales.`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
