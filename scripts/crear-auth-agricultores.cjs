/* Crea solo identidades telefónicas inequívocas y las liga al perfil local. */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const [, , inputPath] = process.argv;
const summary = { eligible: 0, created: 0, linkedExisting: 0, alreadyLinked: 0, skippedIdentity: 0, conflicts: 0, errors: 0 };

function digits(value) { return String(value ?? '').replace(/\D/g, ''); }
function normalizePhone(value) {
  const number = digits(value);
  if (/^3\d{9}$/.test(number)) return `+57${number}`;
  if (/^573\d{9}$/.test(number)) return `+${number}`;
  return null;
}
function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Falta configuración de Supabase Auth en el backend');
  return value;
}
async function authRequest(url, key, path, method = 'GET', body) {
  const response = await fetch(`${url}/auth/v1${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Supabase Auth rechazó la operación');
    error.status = response.status;
    throw error;
  }
  return data;
}
async function listUsers(url, key) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const response = await authRequest(url, key, `/admin/users?page=${page}&per_page=100`);
    const batch = Array.isArray(response.users) ? response.users : [];
    users.push(...batch);
    if (batch.length < 100) return users;
  }
}

async function main() {
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('No se recibió el archivo temporal de registros');
  const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const phoneCounts = new Map();
  for (const row of rows) {
    const phone = normalizePhone(row.phone);
    if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
  }
  const authUsers = await listUsers(url, key);
  const byPhone = new Map();
  const byId = new Map();
  for (const user of authUsers) {
    if (user.id) byId.set(user.id, user);
    const normalized = normalizePhone(user.phone);
    if (normalized) byPhone.set(normalized, [...(byPhone.get(normalized) ?? []), user]);
  }

  for (const row of rows) {
    const phone = normalizePhone(row.phone);
    const documentNumber = digits(row.documentNumber);
    if (!phone || phoneCounts.get(phone) !== 1 || documentNumber.length < 8) {
      summary.skippedIdentity += 1;
      continue;
    }
    summary.eligible += 1;
    const profile = await prisma.user.findUnique({ where: { documentNumber } });
    if (!profile) { summary.errors += 1; continue; }

    if (profile.authUserId) {
      const linkedUser = byId.get(profile.authUserId);
      if (normalizePhone(linkedUser?.phone) === phone && digits(linkedUser.user_metadata?.document_number) === documentNumber) {
        summary.alreadyLinked += 1;
      } else {
        summary.conflicts += 1;
      }
      continue;
    }

    const samePhone = byPhone.get(phone) ?? [];
    const samePerson = samePhone.find((user) => digits(user.user_metadata?.document_number) === documentNumber);
    if (samePerson) {
      try {
        await prisma.user.update({ where: { id: profile.id }, data: { authUserId: samePerson.id, active: true } });
        summary.linkedExisting += 1;
      } catch {
        summary.errors += 1;
      }
      continue;
    }
    if (samePhone.length) { summary.conflicts += 1; continue; }

    let createdId;
    try {
      const created = await authRequest(url, key, '/admin/users', 'POST', {
        phone,
        phone_confirm: true,
        password: documentNumber,
        user_metadata: {
          full_name: row.name.trim(),
          document_number: documentNumber,
          password_change_required: true,
        },
      });
      if (typeof created.id !== 'string') throw new Error('Supabase Auth no devolvió el identificador');
      createdId = created.id;
      await prisma.user.update({
        where: { id: profile.id },
        data: { authUserId: createdId, active: true, passwordChangeRequired: true },
      });
      byId.set(createdId, created);
      byPhone.set(phone, [created]);
      summary.created += 1;
    } catch {
      // Si PostgreSQL rechazó el vínculo, elimina la identidad recién creada
      // para no dejarla huérfana en Auth. Nunca se imprimen datos personales.
      if (createdId) await authRequest(url, key, `/admin/users/${createdId}`, 'DELETE').catch(() => undefined);
      summary.errors += 1;
    }
  }
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(`La creación de cuentas falló (${error?.name ?? 'Error'}${error?.code ? `/${error.code}` : ''}); no se imprimieron datos personales.`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
