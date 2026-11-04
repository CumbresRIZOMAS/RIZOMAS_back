ALTER TABLE "Farm"
  ADD COLUMN "publicDescription" TEXT,
  ADD COLUMN "publicContactEmail" TEXT,
  ADD COLUMN "publicContactPhone" TEXT,
  ADD COLUMN "publicWebsite" TEXT,
  ADD COLUMN "publicInstagram" TEXT,
  ADD COLUMN "publicFacebook" TEXT,
  ADD COLUMN "publicWhatsapp" TEXT,
  ADD COLUMN "publicImageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
