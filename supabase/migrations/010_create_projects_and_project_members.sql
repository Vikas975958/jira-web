-- ==============================================================================
-- Migration 010: Create Projects, Project Members, and Project Invitations
-- Provides complete schema, foreign keys, indexes, RLS policies, and RPCs for
-- Organization and Project Management Flow.
-- ==============================================================================

-- 1. Create PROJECTS table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'archived')),
  start_date DATE,
  due_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- 2. Create PROJECT_MEMBERS table
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'member')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

-- Indexes for project_members
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON public.project_members(role);

-- 3. Create PROJECT_INVITATIONS table
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  intended_role TEXT NOT NULL DEFAULT 'member' CHECK (intended_role IN ('manager', 'member')),
  invitation_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'canceled')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for project_invitations
CREATE INDEX IF NOT EXISTS idx_project_invitations_org_id ON public.project_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON public.project_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_project_invitations_token_hash ON public.project_invitations(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON public.project_invitations(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function: Check caller role in organization
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT om.role
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id AND om.user_id = p_user_id AND om.status = 'active'
  LIMIT 1;
$$;

-- 6. Helper Function: Check if user is in project
CREATE OR REPLACE FUNCTION public.is_user_in_project(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;

-- 7. RLS Policies for PROJECTS
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

-- SELECT:
-- Owners & Managers of the organization can view all projects.
-- Members can view projects they are assigned to or that they created.
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
    OR public.is_user_in_project(id, auth.uid())
    OR created_by = auth.uid()
  );

-- INSERT:
-- Only Owners and Managers in the organization can create projects.
CREATE POLICY "projects_insert"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
  );

-- UPDATE:
-- Only Owners and Managers in the organization can update projects.
CREATE POLICY "projects_update"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
  )
  WITH CHECK (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
  );

-- DELETE:
-- Only Owners (and authorized managers) can delete projects.
CREATE POLICY "projects_delete"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    public.get_user_org_role(organization_id, auth.uid()) = 'owner'
  );

-- 8. RLS Policies for PROJECT_MEMBERS
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "project_members_update" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;

-- SELECT:
-- Org Owners/Managers can view all project members.
-- Assigned project members can view fellow members of the same project.
CREATE POLICY "project_members_select"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND (
          public.get_user_org_role(p.organization_id, auth.uid()) IN ('owner', 'manager')
          OR public.is_user_in_project(p.id, auth.uid())
        )
    )
  );

-- INSERT / UPDATE / DELETE:
-- Only Org Owners and Managers can modify project members.
CREATE POLICY "project_members_insert"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.get_user_org_role(p.organization_id, auth.uid()) IN ('owner', 'manager')
    )
  );

CREATE POLICY "project_members_update"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.get_user_org_role(p.organization_id, auth.uid()) IN ('owner', 'manager')
    )
  );

CREATE POLICY "project_members_delete"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.get_user_org_role(p.organization_id, auth.uid()) IN ('owner', 'manager')
    )
  );

-- 9. RLS Policies for PROJECT_INVITATIONS
DROP POLICY IF EXISTS "project_invitations_select" ON public.project_invitations;
DROP POLICY IF EXISTS "project_invitations_insert" ON public.project_invitations;
DROP POLICY IF EXISTS "project_invitations_update" ON public.project_invitations;
DROP POLICY IF EXISTS "project_invitations_delete" ON public.project_invitations;

CREATE POLICY "project_invitations_select"
  ON public.project_invitations FOR SELECT
  TO authenticated
  USING (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
    OR lower(email) = lower(auth.jwt()->>'email')
  );

CREATE POLICY "project_invitations_insert"
  ON public.project_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "project_invitations_update"
  ON public.project_invitations FOR UPDATE
  TO authenticated
  USING (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
    OR lower(email) = lower(auth.jwt()->>'email')
  );

CREATE POLICY "project_invitations_delete"
  ON public.project_invitations FOR DELETE
  TO authenticated
  USING (
    public.get_user_org_role(organization_id, auth.uid()) IN ('owner', 'manager')
  );

-- 10. Atomic RPC: Accept Project Invitation
CREATE OR REPLACE FUNCTION public.accept_project_invitation(
  p_token_hash TEXT,
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- 1. Find pending invitation by token hash
  SELECT * INTO v_invite
  FROM public.project_invitations
  WHERE invitation_token_hash = p_token_hash
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project invitation not found or invalid token.');
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This project invitation has already been accepted.');
  ELSIF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation is no longer active.');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.project_invitations SET status = 'expired', updated_at = now() WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'This project invitation has expired.');
  END IF;

  IF lower(v_invite.email) <> lower(p_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation email does not match registered user email.');
  END IF;

  -- 2. Ensure user belongs to the organization
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  )
  VALUES (
    v_invite.organization_id,
    p_user_id,
    v_invite.intended_role,
    'active',
    now()
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    status = 'active',
    updated_at = now();

  -- 3. Add user to project_members
  INSERT INTO public.project_members (
    project_id,
    user_id,
    role,
    assigned_by,
    joined_at
  )
  VALUES (
    v_invite.project_id,
    p_user_id,
    v_invite.intended_role,
    v_invite.invited_by,
    now()
  )
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = now();

  -- 4. Mark invitation as accepted
  UPDATE public.project_invitations
  SET
    status = 'accepted',
    accepted_by = p_user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invite.organization_id,
    'project_id', v_invite.project_id,
    'role', v_invite.intended_role
  );
END;
$$;
