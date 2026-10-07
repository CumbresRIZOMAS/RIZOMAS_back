-- Reconcilia la base con schema.prisma en las tablas de Persona B (el esquema
-- y la migración inicial habían quedado distintos) y agrega los rangos de
-- referencia de suelo (RF-11).
--
-- Report."farmId" pasa a ser obligatorio: falla si hay reportes sin finca.


-- DropForeignKey
ALTER TABLE "ProductFinal" DROP CONSTRAINT "ProductFinal_coffeeProcessId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_farmId_fkey";

-- AlterTable: Bioinput pasa a pertenecer a una finca; sus aplicaciones viven en
-- BioinputApplication. Si ya hay bioinsumos, la finca se toma del lote donde se aplicaron.
ALTER TABLE "Bioinput" ADD COLUMN "farmId" UUID;
UPDATE "Bioinput" b SET "farmId" = l."farmId" FROM "Lot" l WHERE l."id" = b."appliedLotId";
INSERT INTO "BioinputApplication" ("id", "bioinputId", "lotId", "appliedAt")
  SELECT gen_random_uuid(), b."id", b."appliedLotId", COALESCE(b."appliedAt", b."createdAt")
  FROM "Bioinput" b WHERE b."appliedLotId" IS NOT NULL;
ALTER TABLE "Bioinput" DROP CONSTRAINT "Bioinput_appliedLotId_fkey";
ALTER TABLE "Bioinput" DROP COLUMN "appliedAt", DROP COLUMN "appliedLotId";
ALTER TABLE "Bioinput" ALTER COLUMN "farmId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Diagnosis" ADD COLUMN     "unit" TEXT,
ADD COLUMN     "value" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "ProductFinal" ALTER COLUMN "coffeeProcessId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "automatic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bioinputId" UUID;

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "farmId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SoilAnalysis" ADD COLUMN     "userId" UUID;

-- CreateTable
CREATE TABLE "SoilReferenceRange" (
    "id" UUID NOT NULL,
    "parameterKey" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "crop" TEXT NOT NULL DEFAULT '',
    "unit" TEXT,
    "min" DECIMAL(14,4),
    "max" DECIMAL(14,4),
    "source" TEXT,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoilReferenceRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoilReferenceRange_parameterKey_crop_key" ON "SoilReferenceRange"("parameterKey", "crop");

-- CreateIndex
CREATE INDEX "Bioinput_farmId_idx" ON "Bioinput"("farmId");

-- CreateIndex
CREATE INDEX "Diagnosis_soilAnalysisId_idx" ON "Diagnosis"("soilAnalysisId");

-- CreateIndex
CREATE INDEX "Evidence_status_idx" ON "Evidence"("status");

-- CreateIndex
CREATE INDEX "Recommendation_diagnosisId_idx" ON "Recommendation"("diagnosisId");

-- CreateIndex
CREATE INDEX "Recommendation_soilAnalysisId_idx" ON "Recommendation"("soilAnalysisId");

-- CreateIndex
CREATE INDEX "Report_farmId_type_idx" ON "Report"("farmId", "type");

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_bioinputId_fkey" FOREIGN KEY ("bioinputId") REFERENCES "Bioinput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilReferenceRange" ADD CONSTRAINT "SoilReferenceRange_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioinput" ADD CONSTRAINT "Bioinput_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFinal" ADD CONSTRAINT "ProductFinal_coffeeProcessId_fkey" FOREIGN KEY ("coffeeProcessId") REFERENCES "CoffeeProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

