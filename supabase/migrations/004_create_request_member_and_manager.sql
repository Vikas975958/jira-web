-- ============================================================
-- Supabase Migration: 004_create_request_member_and_manager.sql
-- Description: Creates request_member and request_manager tables
--              with RLS policies and secure approval RPC functions.
--
-- CRITICAL RULE COMPLIANCE:
--  - created_by exists ONLY in public.organizations
--  - public.profiles, public.request_member, and public.request_manager
--    do NOT contain a created_by column.
--  - request_member and request_manager use invited_by (UUID REFERENCES auth.users(id))
-- ============================================================

-- 1. Create request_member table
CREATE TABLE IF NOT EXISTS public.request_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create request_manager table
CREATE TABLE IF NOT EXISTS public.request_manager (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for performance and lookups
CREATE INDEX IF NOT EXISTS idx_request_member_org ON public.request_member(organization_id);
CREATE INDEX IF NOT EXISTS idx_request_member_email ON public.request_member(lower(email));
CREATE INDEX IF NOT EXISTS idx_request_member_status ON public.request_member(status);
CREATE INDEX IF NOT EXISTS idx_request_member_invited_by ON public.request_member(invited_by);

CREATE INDEX IF NOT EXISTS idx_request_manager_org ON public.request_manager(organization_id);
CREATE INDEX IF NOT EXISTS idx_request_manager_email ON public.request_manager(lower(email));
CREATE INDEX IF NOT EXISTS idx_request_manager_status ON public.request_manager(status);
CREATE INDEX IF NOT EXISTS idx_request_manager_invited_by ON public.request_manager(invited_by);

-- 4. Triggers to maintain updated_at column
CREATE OR REPLACE FUNCTION public.handle_request_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_request_member_updated ON public.request_member;
CREATE TRIGGER on_request_member_updated
  BEFORE UPDATE ON public.request_member
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_request_updated_at();

DROP TRIGGER IF EXISTS on_request_manager_updated ON public.request_manager;
CREATE TRIGGER on_request_manager_updated
  BEFORE UPDATE ON public.request_manager
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_request_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.request_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_manager ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "request_member_select" ON public.request_member;
DROP POLICY IF EXISTS "request_member_insert" ON public.request_member;
DROP POLICY IF EXISTS "request_member_update" ON public.request_member;
DROP POLICY IF EXISTS "request_member_delete" ON public.request_member;

DROP POLICY IF EXISTS "request_manager_select" ON public.request_manager;
DROP POLICY IF EXISTS "request_manager_insert" ON public.request_manager;
DROP POLICY IF EXISTS "request_manager_update" ON public.request_manager;
DROP POLICY IF EXISTS "request_manager_delete" ON public.request_manager;

-- ============================================================
-- 6. RLS Policies for request_member
-- ============================================================

-- Authorized org admins/creators, invitation senders, or the invited user themselves can view member requests
CREATE POLICY "request_member_select"
  ON public.request_member FOR SELECT
  TO authenticated
  USING (
    invited_by = auth.uid()
    OR public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
    OR lower(email) = lower(auth.jwt()->>'email')
  );

-- Only org admins or org creators can create member requests
CREATE POLICY "request_member_insert"
  ON public.request_member FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_org_admin(organization_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
      )
    )
  );

-- Only org admins or creators can update member requests (e.g. approve/reject)
CREATE POLICY "request_member_update"
  ON public.request_member FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
  );

-- Only org admins or creators can delete member requests
CREATE POLICY "request_member_delete"
  ON public.request_member FOR DELETE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
  );

-- ============================================================
-- 7. RLS Policies for request_manager
-- ============================================================

-- Authorized org admins/creators, invitation senders, or the invited user themselves can view manager requests
CREATE POLICY "request_manager_select"
  ON public.request_manager FOR SELECT
  TO authenticated
  USING (
    invited_by = auth.uid()
    OR public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
    OR lower(email) = lower(auth.jwt()->>'email')
  );

-- Only org admins or org creators can create manager requests
CREATE POLICY "request_manager_insert"
  ON public.request_manager FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_org_admin(organization_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
      )
    )
  );

-- Only org admins or creators can update manager requests (e.g. approve/reject)
CREATE POLICY "request_manager_update"
  ON public.request_manager FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
  );

-- Only org admins or creators can delete manager requests
CREATE POLICY "request_manager_delete"
  ON public.request_manager FOR DELETE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (o.created_by = auth.uid() OR o.owner_id = auth.uid())
    )
  );

-- ============================================================
-- 8. Secure Server-Side Approval and Assignment Functions (RPC)
-- ============================================================

-- Function: Approve Member Request
CREATE OR REPLACE FUNCTION public.approve_member_request(req_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.request_member%ROWTYPE;
  v_user_id UUID;
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  -- 1. Fetch the request
  SELECT * INTO v_req FROM public.request_member WHERE id = req_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member request not found.';
  END IF;

  -- 2. Check authorization
  IF public.is_org_admin(v_req.organization_id, v_caller_id) OR
     EXISTS (SELECT 1 FROM public.organizations WHERE id = v_req.organization_id AND (created_by = v_caller_id OR owner_id = v_caller_id)) THEN
    v_is_authorized := TRUE;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: only organization owners or managers can approve member requests.';
  END IF;

  -- 3. Update request status to approved
  UPDATE public.request_member
  SET status = 'approved', updated_at = now()
  WHERE id = req_id;

  -- 4. Check if user already registered in profiles
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower(v_req.email)
  LIMIT 1;

  -- 5. If user exists, assign membership
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_req.organization_id, v_user_id, 'member', 'active')
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = 'member', status = 'active', updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', req_id,
    'status', 'approved',
    'assigned_user_id', v_user_id
  );
END;
$$;

-- Function: Reject Member Request
CREATE OR REPLACE FUNCTION public.reject_member_request(req_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.request_member%ROWTYPE;
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_req FROM public.request_member WHERE id = req_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member request not found.';
  END IF;

  IF public.is_org_admin(v_req.organization_id, v_caller_id) OR
     EXISTS (SELECT 1 FROM public.organizations WHERE id = v_req.organization_id AND (created_by = v_caller_id OR owner_id = v_caller_id)) THEN
    v_is_authorized := TRUE;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: only organization owners or managers can reject member requests.';
  END IF;

  UPDATE public.request_member
  SET status = 'rejected', updated_at = now()
  WHERE id = req_id;

  RETURN jsonb_build_object('success', true, 'request_id', req_id, 'status', 'rejected');
END;
$$;

-- Function: Approve Manager Request
CREATE OR REPLACE FUNCTION public.approve_manager_request(req_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.request_manager%ROWTYPE;
  v_user_id UUID;
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  -- 1. Fetch the request
  SELECT * INTO v_req FROM public.request_manager WHERE id = req_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manager request not found.';
  END IF;

  -- 2. Check authorization
  IF public.is_org_admin(v_req.organization_id, v_caller_id) OR
     EXISTS (SELECT 1 FROM public.organizations WHERE id = v_req.organization_id AND (created_by = v_caller_id OR owner_id = v_caller_id)) THEN
    v_is_authorized := TRUE;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: only organization owners or managers can approve manager requests.';
  END IF;

  -- 3. Update request status to approved
  UPDATE public.request_manager
  SET status = 'approved', updated_at = now()
  WHERE id = req_id;

  -- 4. Check if user already registered in profiles
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower(v_req.email)
  LIMIT 1;

  -- 5. If user exists, assign manager role
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_req.organization_id, v_user_id, 'manager', 'active')
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = 'manager', status = 'active', updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', req_id,
    'status', 'approved',
    'assigned_user_id', v_user_id
  );
END;
$$;

-- Function: Reject Manager Request
CREATE OR REPLACE FUNCTION public.reject_manager_request(req_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.request_manager%ROWTYPE;
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_req FROM public.request_manager WHERE id = req_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manager request not found.';
  END IF;

  IF public.is_org_admin(v_req.organization_id, v_caller_id) OR
     EXISTS (SELECT 1 FROM public.organizations WHERE id = v_req.organization_id AND (created_by = v_caller_id OR owner_id = v_caller_id)) THEN
    v_is_authorized := TRUE;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: only organization owners or managers can reject manager requests.';
  END IF;

  UPDATE public.request_manager
  SET status = 'rejected', updated_at = now()
  WHERE id = req_id;

  RETURN jsonb_build_object('success', true, 'request_id', req_id, 'status', 'rejected');
END;
$$;

-- Function: Sync / Claim pending approved requests upon user login or signup
CREATE OR REPLACE FUNCTION public.claim_approved_requests(target_user_id UUID, target_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  -- Process approved member requests
  FOR r IN
    SELECT * FROM public.request_member
    WHERE lower(email) = lower(target_email) AND status = 'approved'
  LOOP
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (r.organization_id, target_user_id, 'member', 'active')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- Process approved manager requests
  FOR r IN
    SELECT * FROM public.request_manager
    WHERE lower(email) = lower(target_email) AND status = 'approved'
  LOOP
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (r.organization_id, target_user_id, 'manager', 'active')
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = 'manager', status = 'active';
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'claimed_memberships', v_count);
END;
$$;
