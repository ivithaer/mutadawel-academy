# Mutadawel Academy LMS — Project Architecture

## Overview

A private, invitation-only trading education LMS with bilingual (Arabic/English) support.
Built with React + Vite + TypeScript on the frontend, Supabase (PostgreSQL) on the backend.

## Architecture Principles

1. **Server-side authorization is authoritative** — RLS policies and SECURITY DEFINER functions
   enforce all access control. The UI is a convenience, not a security boundary.
2. **No public registration** — Students can only join when an admin pre-authorizes their email
   in `student_access`. The magic link flow gates on this table.
3. **Email enumeration prevention** — The `request-magic-link` Edge Function returns the same
   generic response regardless of whether the email is authorized.
4. **Role immutability** — User roles are stored in `raw_app_meta_data` (JWT-embedded, user-immutable).
   Students cannot elevate themselves. Only the bootstrap process or an admin can set `super_admin`.
5. **Provider-agnostic video** — Lessons store `video_provider`, `video_reference`, and `video_url`
   independently of lesson titles, supporting any video platform.

## Database Schema (11 tables)

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User identity linked to auth.users | Students see own; admins see all |
| `student_access` | Authorized-email gate | Admin-only (deny by default) |
| `courses` | Bilingual course catalog | Students see enrolled; admins see all |
| `course_sections` | Sections within courses | Students see enrolled; admins see all |
| `lessons` | Lessons within sections | Students see enrolled + active; admins see all |
| `enrollments` | Student-course links | Students see own; admins see all |
| `lesson_progress` | Per-lesson progress tracking | Students read/write own; admins read all |
| `course_progress` | Aggregate course completion | Students read own; admins read all (writes via RPC only) |
| `watch_sessions` | Viewing analytics | Students read/insert own; admins read all |
| `audit_logs` | Admin action logging | Admin-only (deny by default) |
| `platform_settings` | Global configuration | Admin-only (deny by default) |

## Security Helper Functions

- `is_admin()` — Checks JWT `role = 'super_admin'`
- `is_active_student()` — Checks profile + student_access + expiry
- `student_can_access_course(course_id)` — Checks active, non-expired enrollment
- `student_can_access_lesson(lesson_id)` — Traces lesson -> section -> course -> enrollment
- `check_student_authorization()` — Server-side authorization check for frontend use

## SECURITY DEFINER Functions

### Admin-only (each verifies `is_admin()` internally)
- `admin_create_student(email, display_name, username, course_ids[], expires_at)`
- `admin_update_student_status(email, status)`
- `admin_assign_course(student_id, course_id, expires_at)`
- `admin_revoke_enrollment(enrollment_id)`
- `admin_log_action(action, target_type, target_id, metadata)`

### Student-facing
- `upsert_lesson_progress(lesson_id, progress_seconds, completion_percentage, completed)`
  - Verifies enrollment, auto-marks completed at threshold, recalculates course progress
- `recalculate_course_progress(course_id, student_id)`
  - Derives completion from actual lesson_progress data

## Edge Functions

### `bootstrap-admin` (verify_jwt = false)
One-time Super Admin initialization. Protected by `BOOTSTRAP_TOKEN` header.
Checks `platform_settings.bootstrap_completed` — if true, returns 403 permanently.
Creates auth user, sets `raw_app_meta_data.role = 'super_admin'`, creates profile,
then locks itself.

### `request-magic-link` (verify_jwt = false)
Authorized-email gate for passwordless login. Checks `student_access` using service role key.
Returns identical generic response for all emails (authorized or not) to prevent enumeration.
Only sends magic link if email is authorized, not expired, and not revoked.

## Frontend Structure

```
src/
  contexts/AuthContext.tsx   — Session management, profile loading, authorization check
  lib/supabase.ts            — Supabase client singleton (anon key only)
  types/database.ts          — TypeScript interfaces for all database entities
  components/ProtectedRoute  — Route guard with role-based redirect
  pages/
    LoginPage                — Magic link request form
    DashboardPage            — Student dashboard (Phase 4 placeholder)
    AdminPage                — Admin dashboard (Phase 2 placeholder)
    NotAuthorizedPage        — Shown when auth'd but not authorized
  App.tsx                    — Route definitions
  main.tsx                   — App with BrowserRouter + AuthProvider
```

## Migrations

1. `create_core_schema` — All 11 tables, enums, indexes, triggers, seed data
2. `enable_rls_and_policies` — RLS on all tables, helper functions, policies, column-level privileges
3. `create_security_definer_functions` — All admin and student RPC functions
4. `add_check_student_authorization` — Server-side authorization check RPC
5. `fix_security_advisor_findings` — Fixed search_path, revoked anon EXECUTE
6. `fix_profiles_column_privileges` — Restricted UPDATE to safe columns only
7. `fix_revoke_public_execute` — Revoked EXECUTE from PUBLIC, granted only to authenticated

## Phase Status

- **Phase 1 (Security Foundation)**: COMPLETE — schema, RLS, auth, edge functions, security tested
- **Phase 2 (Admin Dashboard)**: NOT STARTED
- **Phase 3 (Content Management)**: NOT STARTED
- **Phase 4 (Student Experience)**: NOT STARTED
- **Phase 5 (Progress & Analytics)**: NOT STARTED
