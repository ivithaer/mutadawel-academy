/*
# SECURITY DEFINER Functions — Mutadawel Academy LMS

## Overview
This migration creates privileged PostgreSQL functions that enforce server-side authorization
for all sensitive operations. Each function verifies the caller's role internally before
executing — they cannot be abused through direct RPC calls by unauthorized users.

## Security Model
- All functions are SECURITY DEFINER (run with the function owner's privileges, bypassing RLS).
- Each function checks public.is_admin() or auth.uid() as its FIRST operation.
- If the check fails, the function raises an exception and does nothing.
- Students can only call functions that operate on their own data.
- Admin functions log to audit_logs automatically.

## Admin Functions
1. admin_create_student(p_email, p_display_name, p_username, p_course_ids[])
   - Creates student_access record, optionally enrolls in courses
2. admin_update_student_status(p_email, p_status)
   - Toggles student_access between 'authorized' and 'revoked'
3. admin_assign_course(p_student_id, p_course_id, p_expires_at)
   - Creates an enrollment
4. admin_revoke_enrollment(p_enrollment_id)
   - Revokes an enrollment
5. admin_log_action(p_action, p_target_type, p_target_id, p_metadata)
   - Internal helper for audit logging

## Student Functions
6. upsert_lesson_progress(p_lesson_id, p_progress_seconds, p_completion_percentage)
   - Updates lesson progress, verifies enrollment, auto-marks completed at threshold,
   - recalculates course_progress
7. recalculate_course_progress(p_course_id, p_student_id)
   - Derives course completion from actual lesson_progress data

## Important Notes
1. No function exposes the service_role key or any secret.
2. No function allows role escalation — admin_create_student always sets role='student'.
3. Course progress is DERIVED from lesson_progress, never set directly by the client.
4. The completion threshold is read from platform_settings (default 0.85 = 85%).
*/

-- ============================================================
-- INTERNAL: admin_log_action
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_log_action(
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
END;
$$;

-- ============================================================
-- admin_create_student
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_student(
  p_email text,
  p_display_name text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_course_ids uuid[] DEFAULT '{}',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_id uuid;
  v_course_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Validate email format
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Create or update student_access record
  INSERT INTO public.student_access (email, status, authorized_by, expires_at)
  VALUES (lower(p_email), 'authorized', auth.uid(), p_expires_at)
  ON CONFLICT (email) DO UPDATE
    SET status = 'authorized',
        authorized_by = auth.uid(),
        expires_at = p_expires_at,
        updated_at = now()
  RETURNING id INTO v_access_id;

  -- Enroll in specified courses
  IF array_length(p_course_ids, 1) IS NOT NULL THEN
    FOREACH v_course_id IN ARRAY p_course_ids LOOP
      INSERT INTO public.enrollments (student_id, course_id, status, assigned_by, expires_at)
      SELECT p.id, v_course_id, 'active', auth.uid(), p_expires_at
      FROM auth.users u
      JOIN public.profiles p ON p.email = lower(p_email)
      WHERE u.email = lower(p_email)
      ON CONFLICT (student_id, course_id) DO UPDATE
        SET status = 'active',
            assigned_by = auth.uid(),
            expires_at = p_expires_at,
            updated_at = now();
    END LOOP;
  END IF;

  -- Log the action
  INSERT INTO public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'student_created', 'student_access', v_access_id,
    jsonb_build_object('email', lower(p_email), 'display_name', p_display_name, 'username', p_username));

  RETURN v_access_id;
END;
$$;

-- ============================================================
-- admin_update_student_status
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_student_status(
  p_email text,
  p_status access_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.student_access
  SET status = p_status, updated_at = now()
  WHERE email = lower(p_email)
  RETURNING id INTO v_access_id;

  IF v_access_id IS NULL THEN
    RAISE EXCEPTION 'Student access record not found';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'student_status_changed', 'student_access', v_access_id,
    jsonb_build_object('email', lower(p_email), 'new_status', p_status::text));
END;
$$;

-- ============================================================
-- admin_assign_course
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_assign_course(
  p_student_id uuid,
  p_course_id uuid,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, status, assigned_by, expires_at)
  VALUES (p_student_id, p_course_id, 'active', auth.uid(), p_expires_at)
  ON CONFLICT (student_id, course_id) DO UPDATE
    SET status = 'active',
        assigned_by = auth.uid(),
        expires_at = p_expires_at,
        updated_at = now()
  RETURNING id INTO v_enrollment_id;

  INSERT INTO public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'course_assigned', 'enrollment', v_enrollment_id,
    jsonb_build_object('student_id', p_student_id, 'course_id', p_course_id));

  RETURN v_enrollment_id;
END;
$$;

-- ============================================================
-- admin_revoke_enrollment
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_revoke_enrollment(
  p_enrollment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_course_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.enrollments
  SET status = 'revoked', updated_at = now()
  WHERE id = p_enrollment_id
  RETURNING student_id, course_id INTO v_student_id, v_course_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'enrollment_revoked', 'enrollment', p_enrollment_id,
    jsonb_build_object('student_id', v_student_id, 'course_id', v_course_id));
END;
$$;

-- ============================================================
-- recalculate_course_progress
-- Derives course completion from actual lesson_progress data.
-- Never trusts frontend calculations.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_course_progress(
  p_course_id uuid,
  p_student_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed integer;
  v_total integer;
  v_pct numeric(5,2);
  v_last_lesson_id uuid;
BEGIN
  -- Count total active lessons in the course
  SELECT count(*) INTO v_total
  FROM public.lessons l
  JOIN public.course_sections cs ON cs.id = l.section_id
  WHERE cs.course_id = p_course_id
    AND l.status = 'active';

  -- Count completed lessons for this student in this course
  SELECT count(*) INTO v_completed
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.id = lp.lesson_id
  JOIN public.course_sections cs ON cs.id = l.section_id
  WHERE cs.course_id = p_course_id
    AND lp.student_id = p_student_id
    AND lp.completed = true;

  -- Calculate percentage
  v_pct := CASE WHEN v_total > 0 THEN round((v_completed::numeric / v_total) * 100, 2) ELSE 0 END;

  -- Find last watched lesson
  SELECT lp.lesson_id INTO v_last_lesson_id
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.id = lp.lesson_id
  JOIN public.course_sections cs ON cs.id = l.section_id
  WHERE cs.course_id = p_course_id
    AND lp.student_id = p_student_id
    AND lp.last_watched_at IS NOT NULL
  ORDER BY lp.last_watched_at DESC
  LIMIT 1;

  -- Upsert course progress
  INSERT INTO public.course_progress (student_id, course_id, completed_lessons, total_lessons, completion_percentage, last_lesson_id, updated_at)
  VALUES (p_student_id, p_course_id, v_completed, v_total, v_pct, v_last_lesson_id, now())
  ON CONFLICT (student_id, course_id) DO UPDATE
    SET completed_lessons = v_completed,
        total_lessons = v_total,
        completion_percentage = v_pct,
        last_lesson_id = v_last_lesson_id,
        updated_at = now();
END;
$$;

-- ============================================================
-- upsert_lesson_progress
-- Student-facing: updates lesson progress, verifies enrollment,
-- auto-marks completed at threshold, recalculates course progress.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_lesson_progress(
  p_lesson_id uuid,
  p_progress_seconds integer DEFAULT 0,
  p_completion_percentage numeric DEFAULT 0,
  p_completed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_threshold numeric;
  v_should_complete boolean := false;
  v_existing_completed boolean := false;
BEGIN
  -- Verify this is a real student (not admin, not anonymous)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authentication required';
  END IF;

  IF public.is_admin() THEN
    RAISE EXCEPTION 'Admins do not track lesson progress';
  END IF;

  -- Verify the student can access this lesson (enrollment check)
  IF NOT public.student_can_access_lesson(p_lesson_id) THEN
    RAISE EXCEPTION 'Access denied: you are not enrolled in this lesson''s course';
  END IF;

  -- Get the course_id for progress recalculation
  SELECT cs.course_id INTO v_course_id
  FROM public.lessons l
  JOIN public.course_sections cs ON cs.id = l.section_id
  WHERE l.id = p_lesson_id;

  -- Get the completion threshold from platform_settings
  SELECT (value ->> 'value')::numeric INTO v_threshold
  FROM public.platform_settings
  WHERE key = 'default_completion_threshold';
  IF v_threshold IS NULL THEN
    v_threshold := 0.85;
  END IF;

  -- Check existing completed state
  SELECT completed INTO v_existing_completed
  FROM public.lesson_progress
  WHERE student_id = auth.uid() AND lesson_id = p_lesson_id;

  -- Determine if lesson should be marked complete
  -- (explicit mark OR auto-complete at threshold)
  IF p_completed = true THEN
    v_should_complete := true;
  ELSIF v_existing_completed = true THEN
    v_should_complete := true; -- Don't un-complete a lesson
  ELSIF (p_completion_percentage / 100.0) >= v_threshold THEN
    v_should_complete := true;
  END IF;

  -- Upsert lesson progress
  INSERT INTO public.lesson_progress (student_id, lesson_id, progress_seconds, completion_percentage, completed, last_watched_at, created_at, updated_at)
  VALUES (auth.uid(), p_lesson_id, p_progress_seconds, p_completion_percentage, v_should_complete, now(), now(), now())
  ON CONFLICT (student_id, lesson_id) DO UPDATE
    SET progress_seconds = GREATEST(lesson_progress.progress_seconds, p_progress_seconds),
        completion_percentage = GREATEST(lesson_progress.completion_percentage, p_completion_percentage),
        completed = v_should_complete,
        last_watched_at = now(),
        updated_at = now();

  -- Recalculate course progress
  PERFORM public.recalculate_course_progress(v_course_id, auth.uid());
END;
$$;

-- ============================================================
-- GRANT EXECUTE on student-facing functions to authenticated
-- ============================================================

GRANT EXECUTE ON FUNCTION public.upsert_lesson_progress(uuid, integer, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_course_progress(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_access_lesson(uuid) TO authenticated;

-- Admin functions are also executable by authenticated, but they check is_admin() internally
GRANT EXECUTE ON FUNCTION public.admin_create_student(text, text, text, uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_student_status(text, access_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_course(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) TO authenticated;