# Changelog

## [Phase 1] — Security Foundation (2026-10-06 to 2026-10-07)

### Added
- Core database schema: 11 tables (profiles, student_access, courses, course_sections,
  lessons, enrollments, lesson_progress, course_progress, watch_sessions, audit_logs,
  platform_settings) with 5 enums, indexes, foreign keys, and auto-profile trigger
- Row Level Security enabled on all tables with per-verb policies
- SECURITY DEFINER functions for all privileged operations:
  - Admin: create_student, update_student_status, assign_course, revoke_enrollment, log_action
  - Student: upsert_lesson_progress (with enrollment verification + auto-completion)
  - System: recalculate_course_progress, check_student_authorization
- `bootstrap-admin` Edge Function — token-protected, idempotent Super Admin initialization
- `request-magic-link` Edge Function — authorized-email gate with anti-enumeration design
- Supabase client singleton (anon key only, no service role in frontend)
- TypeScript types for all database entities
- AuthContext with session management, profile loading, and server-side authorization check
- Login page with magic link flow
- Route guards (ProtectedRoute) with role-based redirect
- Dashboard, Admin, and NotAuthorized page placeholders

### Security
- RLS enabled on all 11 tables; deny-by-default on student_access, audit_logs, platform_settings
- Column-level privileges restrict students to updating only display_name, username, avatar_url
- Role stored in JWT (raw_app_meta_data) — user-immutable, only server can change
- All admin functions verify is_admin() internally before executing
- EXECUTE on SECURITY DEFINER functions revoked from PUBLIC and anon; granted only to authenticated
- set_updated_at() function search_path locked to public
- Service role key used only in Edge Functions, never in client bundle
- Bootstrap token verified server-side, never returned in responses
- Magic link flow returns identical response for authorized and unauthorized emails

### Fixed
- Column-level privileges on profiles: broad GRANT UPDATE was overriding restricted grant,
  allowing students to update role/status/email — fixed by revoking broad grant
- EXECUTE on SECURITY DEFINER functions was granted to PUBLIC by default — revoked and
  explicitly granted only to authenticated
- set_updated_at() missing SET search_path — added
