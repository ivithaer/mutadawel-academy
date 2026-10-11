/*
# Fix Column-Level Privileges on profiles

## Issue
The earlier migration granted broad `UPDATE ON profiles TO authenticated` which
overrode the restricted `GRANT UPDATE (display_name, username, avatar_url)`.
This meant students could UPDATE their own role, status, or email — a critical
privilege escalation vulnerability.

## Fix
1. REVOKE all UPDATE on profiles from authenticated
2. GRANT UPDATE only on safe columns (display_name, username, avatar_url)
3. Admins bypass column restrictions via RLS (admins_update_all_profiles policy)
   and the is_admin() SECURITY DEFINER functions.
*/

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, username, avatar_url) ON profiles TO authenticated;