const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
}

function splitFarmName(name) {
  const separator = String(name).indexOf(' - ');
  if (separator <= 0 || separator + 3 >= String(name).length) return null;
  return {
    ownerLabel: String(name).slice(0, separator).trim(),
    farmName: String(name).slice(separator + 3).trim(),
  };
}

function ownerLabels(value) {
  return normalize(value)
    .split('/')
    .map((label) => label.trim())
    .filter(Boolean);
}

function candidateUsers(ownerLabel, users) {
  const labels = ownerLabels(ownerLabel);
  return users.filter((user) => {
    const userName = normalize(user.name);
    return labels.some((label) => label === userName || label.includes(userName) || userName.includes(label));
  });
}

async function main() {
  const [farms, users] = await Promise.all([
    prisma.farm.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
        members: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const summary = {
    inspected: farms.length,
    renamed: 0,
    ownersAssigned: 0,
    ownersAlreadySet: 0,
    ambiguous: 0,
    withoutOwnerMatch: 0,
  };

  await prisma.$transaction(async (tx) => {
    for (const farm of farms) {
      const parts = splitFarmName(farm.name);
      if (!parts) {
        if (!farm.ownerId && farm.members.length === 1) {
          await tx.farm.update({ where: { id: farm.id }, data: { ownerId: farm.members[0].userId } });
          summary.ownersAssigned += 1;
        }
        continue;
      }

      const candidates = candidateUsers(parts.ownerLabel, users);
      const memberCandidates = candidates.filter((user) => farm.members.some((member) => member.userId === user.id));
      const ownerCandidates = memberCandidates.length === 1 ? memberCandidates : candidates;

      let ownerId = null;
      if (ownerCandidates.length === 1) ownerId = ownerCandidates[0].id;
      else if (ownerCandidates.length > 1) {
        summary.ambiguous += 1;
        continue;
      } else {
        summary.withoutOwnerMatch += 1;
      }

      const data = { name: parts.farmName };
      if (ownerId && farm.ownerId !== ownerId) {
        data.ownerId = ownerId;
        summary.ownersAssigned += 1;
      } else if (farm.ownerId) {
        summary.ownersAlreadySet += 1;
      }

      if (farm.name !== parts.farmName) summary.renamed += 1;
      await tx.farm.update({ where: { id: farm.id }, data });
    }
  }, { maxWait: 15000, timeout: 120000 });

  console.log(JSON.stringify(summary));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      name: error?.name,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
