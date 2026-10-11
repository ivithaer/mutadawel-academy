-- Fix is_admin() to read role from app_metadata instead of top-level JWT 'role'
--
-- Root cause: Supabase JWTs use the top-level 'role' field for the Postgres
-- role ('authenticated' or 'anon'), which shadows any 'role' key set in
-- raw_app_meta_data. So auth.jwt() ->> 'role' always returns 'authenticated'
-- for logged-in users, never 'super_admin', causing all admin operations to fail.
--
-- Fix: Read from auth.jwt() -> 'app_metadata' ->> 'role' which preserves
-- the value set by bootstrap-admin via updateUserById.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super_admin'
$$;