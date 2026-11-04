ALTER TABLE "User"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "sourceRowKey" TEXT,
  ADD COLUMN "associationCode" TEXT,
  ADD COLUMN "associationName" TEXT,
  ADD COLUMN "secondLevelGroup" TEXT,
  ADD COLUMN "village" TEXT,
  ADD COLUMN "sex" TEXT,
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "specialGroup" TEXT,
  ADD COLUMN "educationLevel" TEXT,
  ADD COLUMN "propertyName" TEXT;
ALTER TABLE "User"
  ADD COLUMN "propertyLatitudeText" TEXT,
  ADD COLUMN "propertyLongitudeText" TEXT;

ALTER TABLE "Farm"
  ADD COLUMN "village" TEXT,
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7);

CREATE INDEX "User_phone_idx" ON "User"("phone");
CREATE UNIQUE INDEX "User_documentNumber_key" ON "User"("documentNumber");
CREATE UNIQUE INDEX "User_sourceRowKey_key" ON "User"("sourceRowKey");
