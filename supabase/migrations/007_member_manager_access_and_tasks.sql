-- ============================================================
-- Supabase Migration: 007_member_manager_access_and_tasks.sql
-- Description:
--  1. Ensure created_by and invited_by exist in organization_members.
--  2. Create public.tasks table for assigned task tracking.
--  3. Implement strict RLS policies:
--     - Owners see only members created or invited by them.
--     - Managers cannot access owner's private profile data.
--     - Members can ONLY access their own assigned task details.
--     - Multi-tenant isolation: users cannot access data of other orgs.
-- ============================================================

-- 1. ORGANIZATION_MEMBERS: Add created_by & invited_by tracking columns
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_created_by ON public.organization_members(created_by);
CREATE INDEX IF NOT EXISTS idx_org_members_invited_by ON public.organization_members(invited_by);

-- Backfill organization_members created_by from organizations if null and user is owner
UPDATE public.organization_members om
SET created_by = o.created_by
FROM public.organizations o
WHERE om.organization_id = o.id
  AND om.created_by IS NULL
  AND o.created_by IS NOT NULL;

-- 2. TASKS TABLE: Create public.tasks for issue/task management
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY DEFAULT ('JIRA-' || substr(gen_random_uuid()::text, 1, 8)),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  type TEXT NOT NULL DEFAULT 'task' CHECK (type IN ('story', 'task', 'bug')),
  project_name TEXT NOT NULL DEFAULT 'Main Project',
  due_date TIMESTAMPTZ,
  assignee TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- Maintain tasks updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_tasks_updated ON public.tasks;
CREATE TRIGGER on_tasks_updated
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tasks_updated_at();

-- 3. HELPER FUNCTIONS FOR SECURITY DEFINER ROLE CHECKS
CREATE OR REPLACE FUNCTION public.get_user_org_ids(u_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = u_id AND status = 'active';
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
    WHERE organization_id = org_id AND user_id = u_id AND role IN ('owner', 'manager') AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND (created_by = u_id OR owner_id = u_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(org_id UUID, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = u_id AND role = 'owner' AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND (created_by = u_id OR owner_id = u_id)
  );
$$;

-- 4. RLS POLICIES FOR TASKS TABLE
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

-- Members see ONLY their assigned tasks; Owners and managers see tasks in their organization
CREATE POLICY "tasks_select"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    -- Admins/managers see tasks in their organizations
    (public.is_org_admin(organization_id, auth.uid()))
    OR
    -- Members see ONLY tasks assigned to them within their organization
    (
      assignee_id = auth.uid()
      AND organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  );

-- Admins/managers and assigned members can insert
CREATE POLICY "tasks_insert"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

-- Owners/managers can update tasks; members can update only their assigned tasks (e.g. status)
CREATE POLICY "tasks_update"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR (
      assignee_id = auth.uid()
      AND organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  )
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    OR (
      assignee_id = auth.uid()
      AND organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  );

-- Only owners and managers can delete tasks
CREATE POLICY "tasks_delete"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
  );

-- 5. RLS POLICIES FOR ORGANIZATION_MEMBERS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete" ON public.organization_members;

-- Select policy:
-- 1. Users can always see their own membership
-- 2. Owners see ONLY members they created or invited (or org creator)
-- 3. Managers can view members of their organization
-- 4. Members cannot see other members' rows (members see task details only)
CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    -- User's own membership
    user_id = auth.uid()
    OR
    -- If current user is an owner, show only members created or invited by them
    (
      public.is_org_owner(organization_id, auth.uid())
      AND (
        created_by = auth.uid()
        OR invited_by = auth.uid()
        OR user_id = auth.uid()
      )
    )
    OR
    -- If current user is a manager (not owner), can view organization team members
    (
      public.is_org_admin(organization_id, auth.uid())
      AND NOT public.is_org_owner(organization_id, auth.uid())
    )
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

-- 6. SECURE RPC TO FETCH MEMBERS WITH PRIVACY RESTRICTIONS
-- Strips owner's private account details when accessed by managers
CREATE OR REPLACE FUNCTION public.get_safe_organization_members(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ,
  created_by UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_id UUID := auth.uid();
BEGIN
  -- Determine caller role in this org
  SELECT om.role INTO v_caller_role
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = v_caller_id AND om.status = 'active';

  IF v_caller_role IS NULL THEN
    -- Check if user is organization creator/owner
    IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id AND (o.created_by = v_caller_id OR o.owner_id = v_caller_id)) THEN
      v_caller_role := 'owner';
    END IF;
  END IF;

  -- Members have access to task details only; return only their own membership
  IF v_caller_role = 'member' THEN
    RETURN QUERY
    SELECT
      om.id,
      om.organization_id,
      om.user_id,
      om.role,
      om.status,
      om.joined_at,
      om.created_by,
      p.full_name,
      p.email,
      p.phone
    FROM public.organization_members om
    LEFT JOIN public.profiles p ON p.id = om.user_id
    WHERE om.organization_id = p_organization_id AND om.user_id = v_caller_id;
    RETURN;
  END IF;

  -- Owners: show only members created or invited by them (plus self)
  IF v_caller_role = 'owner' THEN
    RETURN QUERY
    SELECT
      om.id,
      om.organization_id,
      om.user_id,
      om.role,
      om.status,
      om.joined_at,
      om.created_by,
      p.full_name,
      p.email,
      p.phone
    FROM public.organization_members om
    LEFT JOIN public.profiles p ON p.id = om.user_id
    WHERE om.organization_id = p_organization_id
      AND (om.user_id = v_caller_id OR om.created_by = v_caller_id OR om.invited_by = v_caller_id);
    RETURN;
  END IF;

  -- Managers: see team members, BUT owner private details (email, phone) are masked
  IF v_caller_role = 'manager' THEN
    RETURN QUERY
    SELECT
      om.id,
      om.organization_id,
      om.user_id,
      om.role,
      om.status,
      om.joined_at,
      om.created_by,
      p.full_name,
      CASE WHEN om.role = 'owner' THEN '[Protected Owner Account]' ELSE p.email END AS email,
      CASE WHEN om.role = 'owner' THEN NULL ELSE p.phone END AS phone
    FROM public.organization_members om
    LEFT JOIN public.profiles p ON p.id = om.user_id
    WHERE om.organization_id = p_organization_id;
    RETURN;
  END IF;

  RETURN;
END;
$$;
