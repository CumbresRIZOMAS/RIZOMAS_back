ALTER TABLE "Lot"
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7);

CREATE TABLE "LotUser" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lotId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LotUser_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LotUser_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LotUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LotUser_lotId_userId_key" ON "LotUser"("lotId", "userId");
CREATE INDEX "LotUser_userId_idx" ON "LotUser"("userId");
