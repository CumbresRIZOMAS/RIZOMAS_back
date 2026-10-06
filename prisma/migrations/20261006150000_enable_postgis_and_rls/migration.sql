-- Fase 1: extensiones geográficas y defensa de acceso a nivel de base de datos.
-- Las políticas usan los claims que Supabase expone en request.jwt.claims.
-- El backend NestJS mantiene además sus Guards y validaciones de pertenencia.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION public.rizomas_jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.rizomas_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u."id"
  FROM public."User" AS u
  WHERE u."authUserId" = NULLIF(public.rizomas_jwt_claims() ->> 'sub', '')
     OR u."email" = NULLIF(public.rizomas_jwt_claims() ->> 'email', '')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.rizomas_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.rizomas_jwt_claims() -> 'app_metadata' ->> 'user_role',
    public.rizomas_jwt_claims() ->> 'user_role',
    public.rizomas_jwt_claims() ->> 'role'
  );
$$;

CREATE OR REPLACE FUNCTION public.rizomas_can_access_farm(target_farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rizomas_current_role() = 'ADMIN_CUMBRES'
    OR EXISTS (
      SELECT 1
      FROM public."Farm" AS f
      WHERE f."id" = target_farm_id
        AND f."ownerId" = public.rizomas_current_user_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public."FarmUser" AS fu
      WHERE fu."farmId" = target_farm_id
        AND fu."userId" = public.rizomas_current_user_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.rizomas_can_manage_farm(target_farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rizomas_current_role() = 'ADMIN_CUMBRES'
    OR EXISTS (
      SELECT 1
      FROM public."Farm" AS f
      WHERE f."id" = target_farm_id
        AND f."ownerId" = public.rizomas_current_user_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public."FarmUser" AS fu
      WHERE fu."farmId" = target_farm_id
        AND fu."userId" = public.rizomas_current_user_id()
        AND fu."role" IN ('ADMIN_FINCA', 'TECNICO')
    );
$$;

-- RLS se habilita sobre las tablas sensibles. No se fuerza sobre el rol
-- propietario usado por Prisma; las políticas aplican a authenticated/anon y
-- NestJS continúa siendo la barrera de aplicación para sus consultas.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FarmUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Farm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Lot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Crop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CropCycle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Worker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Labor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Harvest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EnvironmentalCondition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Purchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SoilAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Diagnosis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Recommendation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Bioinput" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BioinputApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgronomicManagement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CoffeeProcess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductFinal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Certification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Publication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PublicationEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IndicatorValue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SyncOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rizomas_user_self"
  ON public."User" FOR SELECT TO authenticated
  USING ("id" = public.rizomas_current_user_id() OR public.rizomas_current_role() = 'ADMIN_CUMBRES');

CREATE POLICY "rizomas_farm_members"
  ON public."FarmUser" FOR SELECT TO authenticated
  USING (public.rizomas_can_access_farm("farmId"));

CREATE POLICY "rizomas_farm_access"
  ON public."Farm" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("id"))
  WITH CHECK (public.rizomas_can_manage_farm("id"));

CREATE POLICY "rizomas_lot_access"
  ON public."Lot" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_crop_access"
  ON public."Crop" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Lot" l
    WHERE l."id" = "Crop"."lotId"
      AND public.rizomas_can_access_farm(l."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Lot" l
    WHERE l."id" = "Crop"."lotId"
      AND public.rizomas_can_manage_farm(l."farmId")
  ));

CREATE POLICY "rizomas_worker_access"
  ON public."Worker" FOR ALL TO authenticated
  USING ("farmId" IS NOT NULL AND public.rizomas_can_access_farm("farmId"))
  WITH CHECK ("farmId" IS NOT NULL AND public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_crop_cycle_access"
  ON public."CropCycle" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public."Crop" c
    JOIN public."Lot" l ON l."id" = c."lotId"
    WHERE c."id" = "CropCycle"."cropId"
      AND public.rizomas_can_access_farm(l."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."Crop" c
    JOIN public."Lot" l ON l."id" = c."lotId"
    WHERE c."id" = "CropCycle"."cropId"
      AND public.rizomas_can_manage_farm(l."farmId")
  ));

CREATE POLICY "rizomas_labor_access"
  ON public."Labor" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_environment_access"
  ON public."EnvironmentalCondition" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_harvest_access"
  ON public."Harvest" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Labor" l
    WHERE l."id" = "Harvest"."laborId"
      AND public.rizomas_can_access_farm(l."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Labor" l
    WHERE l."id" = "Harvest"."laborId"
      AND public.rizomas_can_manage_farm(l."farmId")
  ));

CREATE POLICY "rizomas_purchase_access"
  ON public."Purchase" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_sale_access"
  ON public."Sale" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_soil_access"
  ON public."SoilAnalysis" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_diagnosis_access"
  ON public."Diagnosis" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."SoilAnalysis" s
    WHERE s."id" = "Diagnosis"."soilAnalysisId"
      AND public.rizomas_can_access_farm(s."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."SoilAnalysis" s
    WHERE s."id" = "Diagnosis"."soilAnalysisId"
      AND public.rizomas_can_manage_farm(s."farmId")
  ));

CREATE POLICY "rizomas_recommendation_access"
  ON public."Recommendation" FOR ALL TO authenticated
  USING (
    ("soilAnalysisId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM public."SoilAnalysis" s
      WHERE s."id" = "Recommendation"."soilAnalysisId"
        AND public.rizomas_can_access_farm(s."farmId")
    ))
    OR ("diagnosisId" IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public."Diagnosis" d
      JOIN public."SoilAnalysis" s ON s."id" = d."soilAnalysisId"
      WHERE d."id" = "Recommendation"."diagnosisId"
        AND public.rizomas_can_access_farm(s."farmId")
    ))
  )
  WITH CHECK (
    ("soilAnalysisId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM public."SoilAnalysis" s
      WHERE s."id" = "Recommendation"."soilAnalysisId"
        AND public.rizomas_can_manage_farm(s."farmId")
    ))
    OR ("diagnosisId" IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public."Diagnosis" d
      JOIN public."SoilAnalysis" s ON s."id" = d."soilAnalysisId"
      WHERE d."id" = "Recommendation"."diagnosisId"
        AND public.rizomas_can_manage_farm(s."farmId")
    ))
  );

CREATE POLICY "rizomas_bioinput_access"
  ON public."Bioinput" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_bioinput_application_access"
  ON public."BioinputApplication" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Lot" l
    WHERE l."id" = "BioinputApplication"."lotId"
      AND public.rizomas_can_access_farm(l."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Lot" l
    WHERE l."id" = "BioinputApplication"."lotId"
      AND public.rizomas_can_manage_farm(l."farmId")
  ));

CREATE POLICY "rizomas_management_access"
  ON public."AgronomicManagement" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Labor" l
    WHERE l."id" = "AgronomicManagement"."laborId"
      AND public.rizomas_can_access_farm(l."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Labor" l
    WHERE l."id" = "AgronomicManagement"."laborId"
      AND public.rizomas_can_manage_farm(l."farmId")
  ));

CREATE POLICY "rizomas_coffee_access"
  ON public."CoffeeProcess" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_product_access"
  ON public."ProductFinal" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."CoffeeProcess" cp
    WHERE cp."id" = "ProductFinal"."coffeeProcessId"
      AND public.rizomas_can_access_farm(cp."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."CoffeeProcess" cp
    WHERE cp."id" = "ProductFinal"."coffeeProcessId"
      AND public.rizomas_can_manage_farm(cp."farmId")
  ));

CREATE POLICY "rizomas_certification_access"
  ON public."Certification" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public."ProductFinal" pf
    JOIN public."CoffeeProcess" cp ON cp."id" = pf."coffeeProcessId"
    WHERE pf."id" = "Certification"."productFinalId"
      AND public.rizomas_can_access_farm(cp."farmId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."ProductFinal" pf
    JOIN public."CoffeeProcess" cp ON cp."id" = pf."coffeeProcessId"
    WHERE pf."id" = "Certification"."productFinalId"
      AND public.rizomas_can_manage_farm(cp."farmId")
  ));

CREATE POLICY "rizomas_evidence_access"
  ON public."Evidence" FOR ALL TO authenticated
  USING ("farmId" IS NOT NULL AND public.rizomas_can_access_farm("farmId"))
  WITH CHECK ("farmId" IS NOT NULL AND public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_report_access"
  ON public."Report" FOR ALL TO authenticated
  USING (public.rizomas_current_role() = 'ADMIN_CUMBRES');

CREATE POLICY "rizomas_publication_owner_access"
  ON public."Publication" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_publication_public_read"
  ON public."Publication" FOR SELECT TO anon, authenticated
  USING ("active" = true);

CREATE POLICY "rizomas_public_evidence_read"
  ON public."Evidence" FOR SELECT TO anon, authenticated
  USING ("visibility" = 'PUBLICA' AND "status" = 'APROBADA');

CREATE POLICY "rizomas_publication_evidence_access"
  ON public."PublicationEvidence" FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1
    FROM public."Publication" p
    JOIN public."Evidence" e ON e."id" = "PublicationEvidence"."evidenceId"
    WHERE p."id" = "PublicationEvidence"."publicationId"
      AND p."active" = true
      AND e."visibility" = 'PUBLICA'
      AND e."status" = 'APROBADA'
  ));

CREATE POLICY "rizomas_indicator_access"
  ON public."IndicatorValue" FOR ALL TO authenticated
  USING (public.rizomas_can_access_farm("farmId"))
  WITH CHECK (public.rizomas_can_manage_farm("farmId"));

CREATE POLICY "rizomas_sync_owner_access"
  ON public."SyncOperation" FOR ALL TO authenticated
  USING ("userId" = public.rizomas_current_user_id())
  WITH CHECK ("userId" = public.rizomas_current_user_id());

CREATE POLICY "rizomas_audit_admin_read"
  ON public."AuditLog" FOR SELECT TO authenticated
  USING (public.rizomas_current_role() IN ('ADMIN_CUMBRES', 'ADMIN_FINCA'));
