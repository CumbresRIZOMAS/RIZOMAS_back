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
    events: { stage: string; recordedAt: Date; inputKg: string | null; outputKg: string | null }[];
    products: { finalizedAt: Date | null; destination: string | null; certifications: { certifier: string; status: string }[] }[];
  }[];
};

export type PublicFarmTraceability = {
  origin: { region: string | null; farmType: string | null };
  processes: PublicTraceability['processes'];
};

/** Campos de proceso autorizados para la vista pública; omite notas, lote y finca. */
export const publicCoffeeProcessSelect = {
  currentStage: true,
  startedAt: true,
  finishedAt: true,
  events: {
    orderBy: { recordedAt: 'asc' as const },
    select: { stage: true, recordedAt: true, inputKg: true, outputKg: true },
  },
  products: {
    select: {
      finalizedAt: true,
      destination: true,
      certifications: { select: { certifier: true, status: true } },
    },
  },
} satisfies Prisma.CoffeeProcessSelect;

export const publicationForTraceability = {
  select: {
    id: true,
    title: true,
    region: true,
    quantity: true,
    unit: true,
    publishedAt: true,
    farm: {
      select: {
        region: true,
        farmType: true,
        coffeeProcesses: {
          orderBy: { startedAt: 'asc' as const },
          select: publicCoffeeProcessSelect,
        },
      },
    },
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
          select: publicCoffeeProcessSelect,
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
    // La app móvil puede asociar el proceso al lote sin enlazarlo a una
    // cosecha. La proyección por finca permite mostrar ambos casos.
    processes: (row.farm.coffeeProcesses ?? harvest?.coffeeProcesses ?? []).map((p) => ({
      stage: p.currentStage,
      startedAt: p.startedAt,
      finishedAt: p.finishedAt,
      events: (p.events ?? []).map((event) => ({
        stage: event.stage,
        recordedAt: event.recordedAt,
        inputKg: event.inputKg?.toString() ?? null,
        outputKg: event.outputKg?.toString() ?? null,
      })),
      products: p.products,
    })),
  };
}

export function toPublicFarmTraceability(row: {
  region: string | null;
  farmType: string | null;
  coffeeProcesses: Prisma.CoffeeProcessGetPayload<{ select: typeof publicCoffeeProcessSelect }>[];
}): PublicFarmTraceability {
  return {
    origin: { region: row.region, farmType: row.farmType },
    processes: row.coffeeProcesses.map((p) => ({
      stage: p.currentStage,
      startedAt: p.startedAt,
      finishedAt: p.finishedAt,
      events: p.events.map((event) => ({
        stage: event.stage,
        recordedAt: event.recordedAt,
        inputKg: event.inputKg?.toString() ?? null,
        outputKg: event.outputKg?.toString() ?? null,
      })),
      products: p.products,
    })),
  };
}
