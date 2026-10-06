-- Configuración del Custom Access Token Hook de Supabase.
-- En Supabase Dashboard: Authentication > Hooks > Custom Access Token,
-- seleccionar public.rizomas_custom_access_token_hook.

CREATE OR REPLACE FUNCTION public.rizomas_custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  app_user_role text;
BEGIN
  SELECT u."role"::text
    INTO app_user_role
  FROM public."User" AS u
  WHERE u."authUserId" = (event ->> 'user_id')
     OR lower(u."email") = lower(event -> 'claims' ->> 'email')
  LIMIT 1;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{user_role}',
    to_jsonb(COALESCE(app_user_role, 'PUBLICO')),
    true
  );
  claims := jsonb_set(
    claims,
    '{app_metadata,user_role}',
    to_jsonb(COALESCE(app_user_role, 'PUBLICO')),
    true
  );

  RETURN jsonb_set(event, '{claims}', claims, true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rizomas_custom_access_token_hook(jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rizomas_custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

