-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN_CUMBRES', 'ADMIN_FINCA', 'TECNICO', 'AGRICULTOR', 'PROVEEDOR', 'COMPRADOR_CERTIFICADORA', 'CLIENTE', 'PUBLICO');

-- CreateEnum
CREATE TYPE "FarmType" AS ENUM ('CONVENCIONAL', 'EN_TRANSICION', 'REGENERATIVA');

-- CreateEnum
CREATE TYPE "AgronomicManagementType" AS ENUM ('LIMPIEZA', 'PODA', 'ABONO', 'REVISION', 'RIEGO', 'FERTILIZACION', 'CONTROL_PLAGAS', 'OTRO');

-- CreateEnum
CREATE TYPE "LaborType" AS ENUM ('SIEMBRA', 'COSECHA', 'COMPRA', 'VENTA', 'MANEJO_AGRONOMICO', 'APLICACION_BIOINSUMO', 'PROCESO_CAFE', 'OTRO');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CUARENTENA');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVADA', 'FINCA', 'ORGANIZACION', 'PUBLICA');

-- CreateTable
CREATE TABLE "CropCycle" (
    "id" UUID NOT NULL,
    "cropId" UUID NOT NULL,
    "plantingDate" TIMESTAMP(3),
    "productionStart" TIMESTAMP(3),
    "productionEnd" TIMESTAMP(3),
    "harvestFrequency" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalCondition" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "lotId" UUID,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(14,4),
    "unit" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "authUserId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGRICULTOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmUser" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" UUID NOT NULL,
    "ownerId" UUID,
    "name" TEXT NOT NULL,
    "identifier" TEXT,
    "municipality" TEXT,
    "region" TEXT,
    "areaHa" DECIMAL(12,2),
    "climate" TEXT,
    "farmType" "FarmType" NOT NULL DEFAULT 'EN_TRANSICION',
    "exactLocation" JSONB,
    "publicLocation" JSONB,
    "locationVisibility" "Visibility" NOT NULL DEFAULT 'PRIVADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT,
    "areaHa" DECIMAL(12,2),
    "location" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "species" TEXT NOT NULL,
    "variety" TEXT,
    "plantingDate" TIMESTAMP(3),
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" UUID NOT NULL,
    "farmId" UUID,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Labor" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "lotId" UUID,
    "cropId" UUID,
    "cycleId" UUID,
    "workerId" UUID,
    "type" "LaborType" NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "durationMin" INTEGER,
    "observations" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Labor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Harvest" (
    "id" UUID NOT NULL,
    "laborId" UUID NOT NULL,
    "cropId" UUID,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "quality" TEXT,
    "destination" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cropCycleId" UUID,

    CONSTRAINT "Harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "laborId" UUID,
    "supplierId" UUID,
    "date" TIMESTAMP(3) NOT NULL,
    "itemName" TEXT NOT NULL,
    "isBioinput" BOOLEAN NOT NULL DEFAULT false,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT,
    "value" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "laborId" UUID,
    "date" TIMESTAMP(3) NOT NULL,
    "productName" TEXT NOT NULL,
    "buyer" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT,
    "value" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "inputType" TEXT,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilAnalysis" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "lotId" UUID,
    "date" TIMESTAMP(3) NOT NULL,
    "laboratory" TEXT,
    "parameters" JSONB NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "SoilAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" UUID NOT NULL,
    "soilAnalysisId" UUID NOT NULL,
    "parameter" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "referenceMin" DECIMAL(14,4),
    "referenceMax" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" UUID NOT NULL,
    "soilAnalysisId" UUID,
    "diagnosisId" UUID,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bioinput" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "recipe" JSONB,
    "ingredients" JSONB,
    "preparation" TEXT,
    "producedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "appliedLotId" UUID,
    "quantity" DECIMAL(12,2),
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bioinput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BioinputApplication" (
    "id" UUID NOT NULL,
    "bioinputId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "laborId" UUID,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(12,2),
    "unit" TEXT,
    "observations" TEXT,

    CONSTRAINT "BioinputApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgronomicManagement" (
    "id" UUID NOT NULL,
    "laborId" UUID NOT NULL,
    "type" "AgronomicManagementType" NOT NULL,
    "quantity" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgronomicManagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoffeeProcess" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "harvestId" UUID,
    "currentStage" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoffeeProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFinal" (
    "id" UUID NOT NULL,
    "harvestId" UUID,
    "coffeeProcessId" UUID,
    "finalizedAt" TIMESTAMP(3),
    "destination" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFinal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" UUID NOT NULL,
    "productFinalId" UUID NOT NULL,
    "certifier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "farmId" UUID,
    "lotId" UUID,
    "laborId" UUID,
    "harvestId" UUID,
    "coffeeProcessId" UUID,
    "productFinalId" UUID,
    "objectKey" TEXT NOT NULL,
    "url" TEXT,
    "capturedAt" TIMESTAMP(3),
    "geolocation" JSONB,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVADA',
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDIENTE',
    "moderation" JSONB,
    "moderationScore" DECIMAL(5,4),
    "moderationEngine" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "farmId" UUID,
    "type" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "totalCosts" DECIMAL(14,2),
    "information" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "harvestId" UUID,
    "title" TEXT NOT NULL,
    "region" TEXT,
    "quantity" DECIMAL(12,2),
    "unit" TEXT,
    "publicLocation" JSONB,
    "publishedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationEvidence" (
    "publicationId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,

    CONSTRAINT "PublicationEvidence_pkey" PRIMARY KEY ("publicationId","evidenceId")
);

-- CreateTable
CREATE TABLE "IndicatorDefinition" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorValue" (
    "id" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "lotId" UUID,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "value" DECIMAL(14,4) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" UUID NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "userId" UUID,
    "entity" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CropCycle_cropId_idx" ON "CropCycle"("cropId");

-- CreateIndex
CREATE INDEX "EnvironmentalCondition_farmId_observedAt_idx" ON "EnvironmentalCondition"("farmId", "observedAt");

-- CreateIndex
CREATE INDEX "EnvironmentalCondition_lotId_observedAt_idx" ON "EnvironmentalCondition"("lotId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FarmUser_userId_idx" ON "FarmUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmUser_farmId_userId_key" ON "FarmUser"("farmId", "userId");

-- CreateIndex
CREATE INDEX "Lot_farmId_idx" ON "Lot"("farmId");

-- CreateIndex
CREATE INDEX "Crop_lotId_idx" ON "Crop"("lotId");

-- CreateIndex
CREATE INDEX "Labor_farmId_startDate_idx" ON "Labor"("farmId", "startDate");

-- CreateIndex
CREATE INDEX "Labor_lotId_idx" ON "Labor"("lotId");

-- CreateIndex
CREATE INDEX "Labor_cropId_idx" ON "Labor"("cropId");

-- CreateIndex
CREATE UNIQUE INDEX "Harvest_laborId_key" ON "Harvest"("laborId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_laborId_key" ON "Purchase"("laborId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_laborId_key" ON "Sale"("laborId");

-- CreateIndex
CREATE INDEX "BioinputApplication_lotId_appliedAt_idx" ON "BioinputApplication"("lotId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgronomicManagement_laborId_key" ON "AgronomicManagement"("laborId");

-- CreateIndex
CREATE INDEX "Evidence_harvestId_idx" ON "Evidence"("harvestId");

-- CreateIndex
CREATE INDEX "Evidence_coffeeProcessId_idx" ON "Evidence"("coffeeProcessId");

-- CreateIndex
CREATE INDEX "Evidence_productFinalId_idx" ON "Evidence"("productFinalId");

-- CreateIndex
CREATE INDEX "Publication_farmId_active_idx" ON "Publication"("farmId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorDefinition_name_key" ON "IndicatorDefinition"("name");

-- CreateIndex
CREATE INDEX "IndicatorValue_farmId_periodStart_idx" ON "IndicatorValue"("farmId", "periodStart");

-- CreateIndex
CREATE INDEX "IndicatorValue_lotId_periodStart_idx" ON "IndicatorValue"("lotId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_clientUuid_key" ON "SyncOperation"("clientUuid");

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalCondition" ADD CONSTRAINT "EnvironmentalCondition_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalCondition" ADD CONSTRAINT "EnvironmentalCondition_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmUser" ADD CONSTRAINT "FarmUser_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmUser" ADD CONSTRAINT "FarmUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crop" ADD CONSTRAINT "Crop_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labor" ADD CONSTRAINT "Labor_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labor" ADD CONSTRAINT "Labor_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labor" ADD CONSTRAINT "Labor_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labor" ADD CONSTRAINT "Labor_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labor" ADD CONSTRAINT "Labor_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "Labor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "Labor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "Labor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_soilAnalysisId_fkey" FOREIGN KEY ("soilAnalysisId") REFERENCES "SoilAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_soilAnalysisId_fkey" FOREIGN KEY ("soilAnalysisId") REFERENCES "SoilAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioinput" ADD CONSTRAINT "Bioinput_appliedLotId_fkey" FOREIGN KEY ("appliedLotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioinputApplication" ADD CONSTRAINT "BioinputApplication_bioinputId_fkey" FOREIGN KEY ("bioinputId") REFERENCES "Bioinput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioinputApplication" ADD CONSTRAINT "BioinputApplication_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioinputApplication" ADD CONSTRAINT "BioinputApplication_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "Labor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgronomicManagement" ADD CONSTRAINT "AgronomicManagement_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "Labor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeProcess" ADD CONSTRAINT "CoffeeProcess_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeProcess" ADD CONSTRAINT "CoffeeProcess_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFinal" ADD CONSTRAINT "ProductFinal_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFinal" ADD CONSTRAINT "ProductFinal_coffeeProcessId_fkey" FOREIGN KEY ("coffeeProcessId") REFERENCES "CoffeeProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_productFinalId_fkey" FOREIGN KEY ("productFinalId") REFERENCES "ProductFinal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_laborId_fkey" FOREIGN KEY ("laborId") REFERENCES "Labor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_coffeeProcessId_fkey" FOREIGN KEY ("coffeeProcessId") REFERENCES "CoffeeProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_productFinalId_fkey" FOREIGN KEY ("productFinalId") REFERENCES "ProductFinal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationEvidence" ADD CONSTRAINT "PublicationEvidence_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationEvidence" ADD CONSTRAINT "PublicationEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorValue" ADD CONSTRAINT "IndicatorValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "IndicatorDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorValue" ADD CONSTRAINT "IndicatorValue_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorValue" ADD CONSTRAINT "IndicatorValue_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Labor" ADD CONSTRAINT "Labor_exactly_one_scope_check" CHECK (("lotId" IS NOT NULL)::int + ("cropId" IS NOT NULL)::int = 1);
