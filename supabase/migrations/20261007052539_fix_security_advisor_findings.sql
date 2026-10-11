/*
# Fix Security Advisor Findings

## Issues Fixed
1. function_search_path_mutable: set_updated_at() missing SET search_path
2. anon_security_definer_function_executable: All SECURITY DEFINER functions
   were executable by the anon role via REST RPC.

## Changes
1. Add SET search_path = public to set_updated_at()
2. REVOKE EXECUTE on all SECURITY DEFINER functions from anon role
3. GRANT EXECUTE only to authenticated on functions that should be callable via RPC
4. Handle_new_auth_user (trigger function) — revoke from both anon and authenticated
   (it's only called by the trigger, never via RPC)
*/

-- Fix 1: Add search_path to set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix 2: Revoke EXECUTE from anon on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_student() FROM anon;
REVOKE EXECUTE ON FUNCTION public.student_can_access_course(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.student_can_access_lesson(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_student_authorization() FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_lesson_progress(uuid, integer, numeric, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_course_progress(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_student(text, text, text, uuid[], timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_student_status(text, access_status) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_assign_course(uuid, uuid, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_enrollment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) FROM anon;

-- handle_new_auth_user is a trigger function — never callable via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;