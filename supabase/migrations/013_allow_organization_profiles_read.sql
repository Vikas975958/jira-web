-- ==============================================================================
-- Migration 013: Allow authenticated users to view profiles of teammates
-- Ensures that organization members and managers can see each other's full names and emails
-- ==============================================================================

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

-- Allow authenticated users to read profiles
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
