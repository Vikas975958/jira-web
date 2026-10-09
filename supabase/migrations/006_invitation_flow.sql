-- ============================================================
-- Supabase Migration: 006_invitation_flow.sql
-- Description:
--  1. Add employee details and role to public.profiles.
--  2. Update request_member and request_manager tables with
--     role check constraints, requested_by, invitation_token_hash,
--     expires_at, accepted_by, and accepted status.
--  3. Configure RLS policies for token validation and request access.
--  4. Provide atomic acceptance RPC function.
-- ============================================================

-- 1. PROFILES TABLE: Ensure role and employee detail columns exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS employee_type TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id UUID,
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Ensure default role is 'owner'
UPDATE public.profiles
SET role = 'owner'
WHERE role IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN role SET DEFAULT 'owner';

-- 2. REQUEST_MEMBER TABLE: Add missing columns and constraints
ALTER TABLE public.request_member
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill requested_by from invited_by if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_member' AND column_name = 'invited_by'
  ) THEN
    UPDATE public.request_member
    SET requested_by = invited_by
    WHERE requested_by IS NULL AND invited_by IS NOT NULL;
  END IF;
END $$;

-- Enforce role constraint on request_member: role must be 'member'
DO $$
BEGIN
  ALTER TABLE public.request_member DROP CONSTRAINT IF EXISTS check_request_member_role;
  ALTER TABLE public.request_member ADD CONSTRAINT check_request_member_role CHECK (role = 'member');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Update status check constraint on request_member to allow 'accepted'
DO $$
BEGIN
  ALTER TABLE public.request_member DROP CONSTRAINT IF EXISTS request_member_status_check;
  ALTER TABLE public.request_member ADD CONSTRAINT request_member_status_check
    CHECK (status IN ('pending', 'accepted', 'approved', 'rejected', 'expired'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Indexes for request_member
CREATE INDEX IF NOT EXISTS idx_request_member_token_hash ON public.request_member(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_request_member_requested_by ON public.request_member(requested_by);

-- 3. REQUEST_MANAGER TABLE: Add missing columns and constraints
ALTER TABLE public.request_manager
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'manager',
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill requested_by from invited_by if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'request_manager' AND column_name = 'invited_by'
  ) THEN
    UPDATE public.request_manager
    SET requested_by = invited_by
    WHERE requested_by IS NULL AND invited_by IS NOT NULL;
  END IF;
END $$;

-- Enforce role constraint on request_manager: role must be 'manager'
DO $$
BEGIN
  ALTER TABLE public.request_manager DROP CONSTRAINT IF EXISTS check_request_manager_role;
  ALTER TABLE public.request_manager ADD CONSTRAINT check_request_manager_role CHECK (role = 'manager');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Update status check constraint on request_manager to allow 'accepted'
DO $$
BEGIN
  ALTER TABLE public.request_manager DROP CONSTRAINT IF EXISTS request_manager_status_check;
  ALTER TABLE public.request_manager ADD CONSTRAINT request_manager_status_check
    CHECK (status IN ('pending', 'accepted', 'approved', 'rejected', 'expired'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Indexes for request_manager
CREATE INDEX IF NOT EXISTS idx_request_manager_token_hash ON public.request_manager(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_request_manager_requested_by ON public.request_manager(requested_by);

-- 4. RLS POLICIES FOR INVITATION VALIDATION
-- Allow public (or anon) token verification by hash so signup page can validate before user logs in
DROP POLICY IF EXISTS "request_member_token_read" ON public.request_member;
CREATE POLICY "request_member_token_read"
  ON public.request_member FOR SELECT
  TO public
  USING (
    invitation_token_hash IS NOT NULL
  );

DROP POLICY IF EXISTS "request_manager_token_read" ON public.request_manager;
CREATE POLICY "request_manager_token_read"
  ON public.request_manager FOR SELECT
  TO public
  USING (
    invitation_token_hash IS NOT NULL
  );

-- 5. FUNCTION & RPC: Atomic invitation acceptance
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token_hash TEXT,
  p_role TEXT,
  p_user_id UUID,
  p_user_email TEXT,
  p_employee_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_req RECORD;
  v_org_id UUID;
  v_req_id UUID;
BEGIN
  -- 1. Validate role input
  IF p_role NOT IN ('member', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role for invitation.');
  END IF;

  -- 2. Find matching pending invitation by token hash
  IF p_role = 'member' THEN
    SELECT * INTO v_req
    FROM public.request_member
    WHERE invitation_token_hash = p_token_hash
    FOR UPDATE;
  ELSE
    SELECT * INTO v_req
    FROM public.request_manager
    WHERE invitation_token_hash = p_token_hash
    FOR UPDATE;
  END IF;

  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or invalid token.');
  END IF;

  -- 3. Check status: both pending and approved can be accepted by user
  IF v_req.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been accepted.');
  ELSIF v_req.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation is no longer active.');
  END IF;

  -- 4. Check expiration
  IF v_req.expires_at IS NOT NULL AND v_req.expires_at < now() THEN
    -- Mark expired
    IF p_role = 'member' THEN
      UPDATE public.request_member SET status = 'expired', updated_at = now() WHERE id = v_req.id;
    ELSE
      UPDATE public.request_manager SET status = 'expired', updated_at = now() WHERE id = v_req.id;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired.');
  END IF;

  -- 5. Check email matches
  IF lower(v_req.email) <> lower(p_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation email does not match registered user.');
  END IF;

  v_org_id := v_req.organization_id;
  v_req_id := v_req.id;

  -- 6. Update user's profile with role and employee details
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    organization_id,
    department,
    employee_type,
    job_title,
    company_name,
    phone,
    profile_photo,
    updated_at
  )
  VALUES (
    p_user_id,
    p_user_email,
    COALESCE(p_employee_details->>'full_name', v_req.full_name, ''),
    p_role,
    v_org_id,
    p_employee_details->>'department',
    p_employee_details->>'employee_type',
    p_employee_details->>'job_title',
    p_employee_details->>'company_name',
    p_employee_details->>'phone',
    p_employee_details->>'profile_photo',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    role = p_role,
    organization_id = v_org_id,
    full_name = COALESCE(NULLIF(p_employee_details->>'full_name', ''), public.profiles.full_name),
    department = COALESCE(p_employee_details->>'department', public.profiles.department),
    employee_type = COALESCE(p_employee_details->>'employee_type', public.profiles.employee_type),
    job_title = COALESCE(p_employee_details->>'job_title', public.profiles.job_title),
    company_name = COALESCE(p_employee_details->>'company_name', public.profiles.company_name),
    phone = COALESCE(p_employee_details->>'phone', public.profiles.phone),
    profile_photo = COALESCE(p_employee_details->>'profile_photo', public.profiles.profile_photo),
    updated_at = now();

  -- 7. Add user to organization_members
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  )
  VALUES (
    v_org_id,
    p_user_id,
    p_role,
    'active',
    now()
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    role = p_role,
    status = 'active';

  -- 8. Mark the request as accepted
  IF p_role = 'member' THEN
    UPDATE public.request_member
    SET
      status = 'accepted',
      accepted_by = p_user_id,
      updated_at = now()
    WHERE id = v_req_id;
  ELSE
    UPDATE public.request_manager
    SET
      status = 'accepted',
      accepted_by = p_user_id,
      updated_at = now()
    WHERE id = v_req_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'role', p_role,
    'request_id', v_req_id
  );
END;
$$;
