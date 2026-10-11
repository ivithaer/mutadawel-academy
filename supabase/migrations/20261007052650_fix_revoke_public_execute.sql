/*
# Fix: Revoke EXECUTE from PUBLIC on SECURITY DEFINER functions

## Issue
PostgreSQL grants EXECUTE on all functions to PUBLIC by default.
The previous REVOKE FROM anon didn't work because anon inherits from PUBLIC.

## Fix
REVOKE EXECUTE FROM PUBLIC on all SECURITY DEFINER functions,
then GRANT EXECUTE only to authenticated where needed.
*/

-- Revoke from PUBLIC
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_student() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.student_can_access_course(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.student_can_access_lesson(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_student_authorization() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_lesson_progress(uuid, integer, numeric, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_course_progress(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_student(text, text, text, uuid[], timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_student_status(text, access_status) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_assign_course(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_enrollment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

-- Grant only to authenticated (not anon)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_lesson(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_student_authorization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_lesson_progress(uuid, integer, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_course_progress(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_student(text, text, text, uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_student_status(text, access_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_course(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) TO authenticated;