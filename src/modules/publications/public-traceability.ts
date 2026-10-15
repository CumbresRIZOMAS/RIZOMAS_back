import { Prisma } from '@prisma/client';

/**
 * Read model de trazabilidad pública (RF-18). Es una proyección, no la tabla
 * interna: solo región, cultivo, conteos de prácticas, cosecha y procesamiento.
 * Nunca nombres de finca o personas, coordenadas, costos ni compras/ventas.
 */
export type PublicTraceability = {
  publication: { id: string; title: string; region: string | null; quantity: string | null; unit: string | null; publishedAt: Date | null };
  origin: { region: string | null; farmType: string | null };
  crop: { species: string; variety: string | null } | null;
  harvest: { date: Date; quantity: string; unit: string; quality: string | null } | null;
  practices: { laborsByType: Record<string, number>; soilAnalyses: number; bioinputApplications: number };
  processes: {
    stage: string;
    startedAt: Date;
    finishedAt: Date | null;
    products: { finalizedAt: Date | null; destination: string | null; certifications: { certifier: string; status: string }[] }[];
  }[];
};

export const publicationForTraceability = {
  select: {
    id: true,
    title: true,
    region: true,
    quantity: true,
    unit: true,
    publishedAt: true,
    farm: { select: { region: true, farmType: true } },
    harvest: {
      select: {
        quantity: true,
        unit: true,
        quality: true,
        labor: { select: { startDate: true } },
        crop: {
          select: {
            species: true,
            variety: true,
            lot: {
              select: {
                labors: { select: { type: true } },
                crops: { select: { labors: { select: { type: true } } } },
                _count: { select: { soilAnalyses: true, bioinputApplications: true } },
              },
            },
          },
        },
        coffeeProcesses: {
          orderBy: { startedAt: 'asc' as const },
          select: {
            currentStage: true,
            startedAt: true,
            finishedAt: true,
            products: { select: { finalizedAt: true, destination: true, certifications: { select: { certifier: true, status: true } } } },
          },
        },
      },
    },
  },
} satisfies Prisma.PublicationFindFirstArgs;

type Row = Prisma.PublicationGetPayload<typeof publicationForTraceability>;

export function toPublicTraceability(row: Row): PublicTraceability {
  const harvest = row.harvest;
  const lot = harvest?.crop?.lot;
  const laborsByType: Record<string, number> = {};
  // Labores del lote y de todos sus cultivos (regla xor: cuelgan de uno o de otro).
  for (const labor of [...(lot?.labors ?? []), ...(lot?.crops.flatMap((c) => c.labors) ?? [])]) {
    laborsByType[labor.type] = (laborsByType[labor.type] ?? 0) + 1;
  }
  return {
    publication: {
      id: row.id,
      title: row.title,
      region: row.region,
      quantity: row.quantity?.toString() ?? null,
      unit: row.unit,
      publishedAt: row.publishedAt,
    },
    origin: { region: row.region ?? row.farm.region, farmType: row.farm.farmType },
    crop: harvest?.crop ? { species: harvest.crop.species, variety: harvest.crop.variety } : null,
    harvest: harvest
      ? { date: harvest.labor.startDate, quantity: harvest.quantity.toString(), unit: harvest.unit, quality: harvest.quality }
      : null,
    practices: {
      laborsByType,
      soilAnalyses: lot?._count.soilAnalyses ?? 0,
      bioinputApplications: lot?._count.bioinputApplications ?? 0,
    },
    processes: (harvest?.coffeeProcesses ?? []).map((p) => ({
      stage: p.currentStage,
      startedAt: p.startedAt,
      finishedAt: p.finishedAt,
      products: p.products,
    })),
  };
}
