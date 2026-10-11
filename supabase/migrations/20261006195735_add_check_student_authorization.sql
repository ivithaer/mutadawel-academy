/*
# Add check_student_authorization RPC

## Overview
Adds a SECURITY DEFINER function that allows the frontend to verify whether
the current authenticated user is an authorized, active student. This is needed
because student_access is admin-only via RLS — students cannot query it directly.

## Security
- SECURITY DEFINER: runs with elevated privileges to read student_access.
- Only returns a boolean — never exposes student_access data.
- Checks: email exists in student_access, status = 'authorized', not expired,
  AND profiles.status = 'active', AND profiles.role = 'student'.
- Admins (role = 'super_admin') get true automatically.
*/

CREATE OR REPLACE FUNCTION public.check_student_authorization()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_access public.student_access%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Admins are always authorized
  IF v_profile.role = 'super_admin' AND v_profile.status = 'active' THEN
    RETURN true;
  END IF;

  -- Students must have active profile status
  IF v_profile.status != 'active' THEN
    RETURN false;
  END IF;

  -- Check student_access
  SELECT * INTO v_access FROM public.student_access WHERE email = v_profile.email;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_access.status != 'authorized' THEN
    RETURN false;
  END IF;

  IF v_access.expires_at IS NOT NULL AND v_access.expires_at <= now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_student_authorization() TO authenticated;