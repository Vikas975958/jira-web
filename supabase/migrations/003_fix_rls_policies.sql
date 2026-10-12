-- ============================================================
-- Fix Infinite Recursion in Organization & Members RLS Policies
-- ============================================================

-- 1. Helper SECURITY DEFINER functions to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_org_ids(u_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = u_id;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = u_id AND role IN ('owner', 'manager')
  );
$$;

-- 2. Drop all conflicting policies on organizations and organization_members
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;

DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete" ON public.organization_members;

-- 3. Re-create non-recursive RLS Policies for organizations
CREATE POLICY "organizations_select"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

CREATE POLICY "organizations_insert"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "organizations_update"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_org_admin(id, auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_org_admin(id, auth.uid())
  );

CREATE POLICY "organizations_delete"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR owner_id = auth.uid()
  );

-- 4. Re-create non-recursive RLS Policies for organization_members
CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

CREATE POLICY "org_members_insert"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "org_members_update"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
  );

CREATE POLICY "org_members_delete"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_admin(organization_id, auth.uid())
  );
