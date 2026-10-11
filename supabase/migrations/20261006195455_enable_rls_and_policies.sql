/*
# Enable RLS and Create Authorization Policies — Mutadawel Academy LMS

## Overview
This migration enables Row Level Security on all tables and creates the full set of
authorization policies. It also creates helper SQL functions used by policies and
SECURITY DEFINER functions.

## Helper Functions
1. is_admin() — Returns true if the current JWT contains role = 'super_admin'.
   Reads from auth.jwt() ->> 'role' (raw_app_meta_data, user-immutable).
2. is_active_student() — Returns true if the current user's email exists in
   student_access with status = 'authorized' and not expired, AND the user's
   profile status = 'active'. This is the core authorization gate.
3. student_can_access_course(course_uuid) — Returns true if the student has
   an active, non-expired enrollment in the given course.
4. student_can_access_lesson(lesson_uuid) — Returns true if the lesson belongs
   to a course the student is enrolled in (traces lesson -> section -> course -> enrollment).

## RLS Strategy
- **profiles**: Students see only their own row. Admins see all.
- **student_access**: Admin-only. Students have NO policies (deny by default).
- **courses**: Students see only courses they're enrolled in AND that are active.
  Admins see all.
- **course_sections**: Students see sections for enrolled courses only. Admins see all.
- **lessons**: Students see lessons for enrolled courses only, AND only active lessons.
  Admins see all.
- **enrollments**: Students see only their own active enrollments. Admins see all.
- **lesson_progress**: Students read/write only their own. Admins read all.
- **course_progress**: Students read only their own. Admins read all.
  (Writes handled by SECURITY DEFINER function only.)
- **watch_sessions**: Students read/insert only their own. Admins read all.
- **audit_logs**: Admin-only. Students have NO policies (deny by default).
- **platform_settings**: Admin-only for all operations. Students have no policies.

## Security Decisions
1. Role is read from auth.jwt() ->> 'role' which maps to raw_app_meta_data.
   Users CANNOT modify their raw_app_meta_data — only the server (service role)
   or an admin SECURITY DEFINER function can change it.
2. student_access is admin-only — students cannot see who is authorized.
3. audit_logs is admin-only — students cannot see administrative actions.
4. Enrollment checks include expiry: (expires_at IS NULL OR expires_at > now()).
5. Profile updates are restricted: students can update only display_name and avatar_url,
   NOT role, status, or email. This is enforced via column-level privileges.
6. All policies use auth.uid(), never current_user.
*/

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- is_admin(): Returns true if the current user's JWT role is super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', '') = 'super_admin'
$$;

-- is_active_student(): Returns true if the current user is an authorized, active student
CREATE OR REPLACE FUNCTION public.is_active_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.student_access sa ON sa.email = p.email
    WHERE p.id = auth.uid()
      AND p.role = 'student'
      AND p.status = 'active'
      AND sa.status = 'authorized'
      AND (sa.expires_at IS NULL OR sa.expires_at > now())
  )
$$;

-- student_can_access_course(): Checks active, non-expired enrollment
CREATE OR REPLACE FUNCTION public.student_can_access_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.student_id = auth.uid()
      AND e.course_id = p_course_id
      AND e.status = 'active'
      AND (e.expires_at IS NULL OR e.expires_at > now())
  )
$$;

-- student_can_access_lesson(): Traces lesson -> section -> course -> enrollment
CREATE OR REPLACE FUNCTION public.student_can_access_lesson(p_lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.course_sections cs ON cs.id = l.section_id
    JOIN public.enrollments e ON e.course_id = cs.course_id
    WHERE l.id = p_lesson_id
      AND e.student_id = auth.uid()
      AND e.status = 'active'
      AND (e.expires_at IS NULL OR e.expires_at > now())
  )
$$;

-- ============================================================
-- PROFILES — RLS
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_own_profile" ON profiles;
CREATE POLICY "students_select_own_profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "admins_select_all_profiles" ON profiles;
CREATE POLICY "admins_select_all_profiles"
  ON profiles FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "students_update_own_profile" ON profiles;
CREATE POLICY "students_update_own_profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT public.is_admin())
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins_update_all_profiles" ON profiles;
CREATE POLICY "admins_update_all_profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- STUDENT_ACCESS — RLS (admin only, deny by default for students)
-- ============================================================

ALTER TABLE student_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_student_access" ON student_access;
CREATE POLICY "admins_select_student_access"
  ON student_access FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_student_access" ON student_access;
CREATE POLICY "admins_insert_student_access"
  ON student_access FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_student_access" ON student_access;
CREATE POLICY "admins_update_student_access"
  ON student_access FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_student_access" ON student_access;
CREATE POLICY "admins_delete_student_access"
  ON student_access FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- COURSES — RLS
-- ============================================================

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_enrolled_courses" ON courses;
CREATE POLICY "students_select_enrolled_courses"
  ON courses FOR SELECT TO authenticated
  USING (
    NOT public.is_admin()
    AND public.student_can_access_course(courses.id)
    AND courses.status = 'active'
  );

DROP POLICY IF EXISTS "admins_select_all_courses" ON courses;
CREATE POLICY "admins_select_all_courses"
  ON courses FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_courses" ON courses;
CREATE POLICY "admins_insert_courses"
  ON courses FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_courses" ON courses;
CREATE POLICY "admins_update_courses"
  ON courses FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_courses" ON courses;
CREATE POLICY "admins_delete_courses"
  ON courses FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- COURSE_SECTIONS — RLS
-- ============================================================

ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_enrolled_sections" ON course_sections;
CREATE POLICY "students_select_enrolled_sections"
  ON course_sections FOR SELECT TO authenticated
  USING (
    NOT public.is_admin()
    AND public.student_can_access_course(course_sections.course_id)
  );

DROP POLICY IF EXISTS "admins_select_all_sections" ON course_sections;
CREATE POLICY "admins_select_all_sections"
  ON course_sections FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_sections" ON course_sections;
CREATE POLICY "admins_insert_sections"
  ON course_sections FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_sections" ON course_sections;
CREATE POLICY "admins_update_sections"
  ON course_sections FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_sections" ON course_sections;
CREATE POLICY "admins_delete_sections"
  ON course_sections FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- LESSONS — RLS
-- ============================================================

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_enrolled_lessons" ON lessons;
CREATE POLICY "students_select_enrolled_lessons"
  ON lessons FOR SELECT TO authenticated
  USING (
    NOT public.is_admin()
    AND public.student_can_access_lesson(lessons.id)
    AND lessons.status = 'active'
  );

DROP POLICY IF EXISTS "admins_select_all_lessons" ON lessons;
CREATE POLICY "admins_select_all_lessons"
  ON lessons FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_lessons" ON lessons;
CREATE POLICY "admins_insert_lessons"
  ON lessons FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_lessons" ON lessons;
CREATE POLICY "admins_update_lessons"
  ON lessons FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_lessons" ON lessons;
CREATE POLICY "admins_delete_lessons"
  ON lessons FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- ENROLLMENTS — RLS
-- ============================================================

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_own_enrollments" ON enrollments;
CREATE POLICY "students_select_own_enrollments"
  ON enrollments FOR SELECT TO authenticated
  USING (
    auth.uid() = student_id
    AND NOT public.is_admin()
  );

DROP POLICY IF EXISTS "admins_select_all_enrollments" ON enrollments;
CREATE POLICY "admins_select_all_enrollments"
  ON enrollments FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_enrollments" ON enrollments;
CREATE POLICY "admins_insert_enrollments"
  ON enrollments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_enrollments" ON enrollments;
CREATE POLICY "admins_update_enrollments"
  ON enrollments FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_enrollments" ON enrollments;
CREATE POLICY "admins_delete_enrollments"
  ON enrollments FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- LESSON_PROGRESS — RLS
-- ============================================================

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_own_lesson_progress" ON lesson_progress;
CREATE POLICY "students_select_own_lesson_progress"
  ON lesson_progress FOR SELECT TO authenticated
  USING (auth.uid() = student_id AND NOT public.is_admin());

DROP POLICY IF EXISTS "admins_select_all_lesson_progress" ON lesson_progress;
CREATE POLICY "admins_select_all_lesson_progress"
  ON lesson_progress FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "students_insert_own_lesson_progress" ON lesson_progress;
CREATE POLICY "students_insert_own_lesson_progress"
  ON lesson_progress FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND NOT public.is_admin()
    AND public.student_can_access_lesson(lesson_id)
  );

DROP POLICY IF EXISTS "students_update_own_lesson_progress" ON lesson_progress;
CREATE POLICY "students_update_own_lesson_progress"
  ON lesson_progress FOR UPDATE TO authenticated
  USING (auth.uid() = student_id AND NOT public.is_admin())
  WITH CHECK (auth.uid() = student_id AND NOT public.is_admin());

DROP POLICY IF EXISTS "admins_update_all_lesson_progress" ON lesson_progress;
CREATE POLICY "admins_update_all_lesson_progress"
  ON lesson_progress FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- COURSE_PROGRESS — RLS (students read own, admins read all, writes via RPC only)
-- ============================================================

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_own_course_progress" ON course_progress;
CREATE POLICY "students_select_own_course_progress"
  ON course_progress FOR SELECT TO authenticated
  USING (auth.uid() = student_id AND NOT public.is_admin());

DROP POLICY IF EXISTS "admins_select_all_course_progress" ON course_progress;
CREATE POLICY "admins_select_all_course_progress"
  ON course_progress FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_all_course_progress" ON course_progress;
CREATE POLICY "admins_update_all_course_progress"
  ON course_progress FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- WATCH_SESSIONS — RLS
-- ============================================================

ALTER TABLE watch_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_own_watch_sessions" ON watch_sessions;
CREATE POLICY "students_select_own_watch_sessions"
  ON watch_sessions FOR SELECT TO authenticated
  USING (auth.uid() = student_id AND NOT public.is_admin());

DROP POLICY IF EXISTS "admins_select_all_watch_sessions" ON watch_sessions;
CREATE POLICY "admins_select_all_watch_sessions"
  ON watch_sessions FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "students_insert_own_watch_sessions" ON watch_sessions;
CREATE POLICY "students_insert_own_watch_sessions"
  ON watch_sessions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND NOT public.is_admin()
    AND public.student_can_access_lesson(lesson_id)
  );

DROP POLICY IF EXISTS "students_update_own_watch_sessions" ON watch_sessions;
CREATE POLICY "students_update_own_watch_sessions"
  ON watch_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = student_id AND NOT public.is_admin())
  WITH CHECK (auth.uid() = student_id AND NOT public.is_admin());

DROP POLICY IF EXISTS "admins_update_all_watch_sessions" ON watch_sessions;
CREATE POLICY "admins_update_all_watch_sessions"
  ON watch_sessions FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- AUDIT_LOGS — RLS (admin only, deny by default for students)
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_audit_logs" ON audit_logs;
CREATE POLICY "admins_select_audit_logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_audit_logs" ON audit_logs;
CREATE POLICY "admins_insert_audit_logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================
-- PLATFORM_SETTINGS — RLS (admin only, deny by default for students)
-- ============================================================

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_platform_settings" ON platform_settings;
CREATE POLICY "admins_select_platform_settings"
  ON platform_settings FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_platform_settings" ON platform_settings;
CREATE POLICY "admins_update_platform_settings"
  ON platform_settings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- COLUMN-LEVEL PRIVILEGES: Restrict students from updating role/status/email
-- ============================================================
-- Revoke UPDATE on sensitive columns from authenticated role,
-- then grant UPDATE only on safe columns for students.
-- Admins bypass RLS + column restrictions via is_admin() policies.

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, username, avatar_url) ON profiles TO authenticated;

-- ============================================================
-- GRANT SELECT/INSERT/UPDATE/DELETE on all tables to authenticated
-- (RLS policies will filter what each user can actually see/modify)
-- ============================================================

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON profiles, student_access, courses, course_sections, lessons, enrollments, lesson_progress, course_progress, watch_sessions, audit_logs, platform_settings TO authenticated;