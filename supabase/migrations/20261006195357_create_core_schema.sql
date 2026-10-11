/*
# Create Core Database Schema — Mutadawel Academy LMS

## Overview
This migration creates the foundational PostgreSQL schema for a private trading education LMS.
It includes all core tables for user profiles, student authorization, courses, sections, lessons,
enrollments, progress tracking, watch sessions, audit logging, and platform settings.

## New Tables
1. profiles — User identity linked to Supabase Auth users. Stores role (super_admin/student),
   status (active/disabled), display name, username, avatar, and login tracking.
2. student_access — The authorized-email gate. Admins create records here before a student
   can authenticate. Controls whether an email is eligible for magic link login.
3. courses — Bilingual (Arabic/English) course records with thumbnail, status, and ordering.
4. course_sections — Sections within courses, bilingual, ordered.
5. lessons — Lessons within sections. Store video_provider/video_reference/video_url for
   provider-agnostic video playback. Bilingual titles independent from video filenames.
6. enrollments — Links students to courses with status and optional expiry.
7. lesson_progress — Per-student, per-lesson progress tracking (position, percentage, completed).
8. course_progress — Aggregate course completion derived from lesson_progress.
9. watch_sessions — Analytics: viewing session records with timing and metadata.
10. audit_logs — Administrative action logging (actor, action, target, metadata).
11. platform_settings — Key-value global configuration (brand name, thresholds, etc.).

## Enums
- user_role: super_admin, student
- profile_status: active, disabled
- access_status: authorized, revoked
- content_status: active, archived
- enrollment_status: active, revoked

## Security
- RLS is NOT enabled in this migration. A subsequent migration enables RLS and creates all policies.
- All tables use gen_random_uuid() for primary keys.
- Foreign keys use ON DELETE CASCADE for child tables to maintain referential integrity.
- Indexes added on all frequently queried columns.

## Important Notes
1. profiles links to auth.users via FK with ON DELETE CASCADE.
2. student_access is keyed by EMAIL (not user_id) because authorization happens BEFORE authentication.
3. The auto-profile trigger defaults role to student — only bootstrap or admin can elevate.
4. course_progress is maintained by a SECURITY DEFINER function, not direct client writes.
*/

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE access_status AS ENUM ('authorized', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE content_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  username text,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url text,
  status profile_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- ============================================================
-- STUDENT_ACCESS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS student_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status access_status NOT NULL DEFAULT 'authorized',
  authorized_at timestamptz NOT NULL DEFAULT now(),
  authorized_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_access_email ON student_access(email);
CREATE INDEX IF NOT EXISTS idx_student_access_status ON student_access(status);

-- ============================================================
-- COURSES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  thumbnail_url text,
  status content_status NOT NULL DEFAULT 'active',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_order ON courses(order_index);

-- ============================================================
-- COURSE_SECTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS course_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sections_course_id ON course_sections(course_id);
CREATE INDEX IF NOT EXISTS idx_sections_order ON course_sections(order_index);

-- ============================================================
-- LESSONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  video_provider text NOT NULL DEFAULT 'generic_embed',
  video_reference text,
  video_url text,
  duration_seconds integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  status content_status NOT NULL DEFAULT 'active',
  is_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lessons_section_id ON lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(order_index);

-- ============================================================
-- ENROLLMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'active',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

-- ============================================================
-- LESSON_PROGRESS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  progress_seconds integer NOT NULL DEFAULT 0,
  completion_percentage numeric(5,2) NOT NULL DEFAULT 0.00,
  completed boolean NOT NULL DEFAULT false,
  last_watched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_student_id ON lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_completed ON lesson_progress(completed);

-- ============================================================
-- COURSE_PROGRESS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_lessons integer NOT NULL DEFAULT 0,
  total_lessons integer NOT NULL DEFAULT 0,
  completion_percentage numeric(5,2) NOT NULL DEFAULT 0.00,
  last_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_student_id ON course_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_course_id ON course_progress(course_id);

-- ============================================================
-- WATCH_SESSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS watch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  watched_seconds integer NOT NULL DEFAULT 0,
  last_position_seconds integer NOT NULL DEFAULT 0,
  session_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_sessions_student_id ON watch_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_lesson_id ON watch_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_started_at ON watch_sessions(started_at);

-- ============================================================
-- AUDIT_LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- PLATFORM_SETTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AUTO-PROFILE TRIGGER
-- Creates/updates a profiles row when a user is created in auth.users.
-- Defaults role to student and status to active.
-- The role can only be elevated to super_admin through the bootstrap process
-- or an existing admin -- never through this trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, username, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    NEW.raw_user_meta_data ->> 'username',
    'student'::user_role,
    'active'::profile_status,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_student_access ON student_access;
CREATE TRIGGER set_updated_at_student_access
  BEFORE UPDATE ON student_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_courses ON courses;
CREATE TRIGGER set_updated_at_courses
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_course_sections ON course_sections;
CREATE TRIGGER set_updated_at_course_sections
  BEFORE UPDATE ON course_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_lessons ON lessons;
CREATE TRIGGER set_updated_at_lessons
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_enrollments ON enrollments;
CREATE TRIGGER set_updated_at_enrollments
  BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_lesson_progress ON lesson_progress;
CREATE TRIGGER set_updated_at_lesson_progress
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SEED: PLATFORM SETTINGS
-- ============================================================

INSERT INTO platform_settings (key, value) VALUES
  ('platform_name_en', '"Mutadawel Academy"'::jsonb),
  ('platform_name_ar', '"أكاديمية متداول"'::jsonb),
  ('social_handle', '"@mutadawel"'::jsonb),
  ('default_completion_threshold', '0.85'::jsonb),
  ('bootstrap_completed', 'false'::jsonb),
  ('default_language', '"ar"'::jsonb),
  ('default_theme', '"dark"'::jsonb)
ON CONFLICT (key) DO NOTHING;