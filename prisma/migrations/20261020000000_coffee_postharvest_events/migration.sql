ALTER TABLE "CoffeeProcess" ADD COLUMN "lotId" UUID;
ALTER TABLE "CoffeeProcess" ADD CONSTRAINT "CoffeeProcess_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CoffeeProcess_lotId_idx" ON "CoffeeProcess"("lotId");
UPDATE "CoffeeProcess" SET "currentStage" = 'Despulpado' WHERE lower("currentStage") = 'beneficio';
UPDATE "CoffeeProcess" SET "currentStage" = 'Tostión' WHERE lower("currentStage") = 'tostado';

CREATE TABLE "CoffeeProcessEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coffeeProcessId" UUID NOT NULL,
  "stage" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "inputKg" DECIMAL(12,2),
  "outputKg" DECIMAL(12,2),
  "waterLiters" DECIMAL(12,2),
  "wastewaterLiters" DECIMAL(12,2),
  "compostReuse" BOOLEAN NOT NULL DEFAULT false,
  "durationHours" DECIMAL(8,2),
  "method" TEXT,
  "brix" DECIMAL(6,2),
  "ph" DECIMAL(5,2),
  "moisturePercent" DECIMAL(5,2),
  "scaScore" DECIMAL(5,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoffeeProcessEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CoffeeProcessEvent_coffeeProcessId_fkey" FOREIGN KEY ("coffeeProcessId") REFERENCES "CoffeeProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CoffeeProcessEvent_coffeeProcessId_recordedAt_idx" ON "CoffeeProcessEvent"("coffeeProcessId", "recordedAt");
