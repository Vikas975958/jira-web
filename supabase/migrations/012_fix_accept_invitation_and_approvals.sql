-- ==============================================================================
-- Migration 012: Fix accept_invitation RPC and reconcile pending requests
-- 1. Fixes the runtime exception: record "v_req" has no field "phone"
-- 2. Streamlines approve_member_request and approve_manager_request to 'accepted'
-- 3. Adds RLS policy allowing invited users to accept their own invitation record
-- 4. Reconciles existing users who signed up but remained pending (e.g. prateek)
-- ==============================================================================

-- 1. Fix accept_invitation RPC
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

  -- 2. Find matching invitation by token hash first
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

  -- Fallback: match by email if token hash didn't hit (e.g. direct email invite)
  IF v_req.id IS NULL AND p_user_email IS NOT NULL THEN
    IF p_role = 'member' THEN
      SELECT * INTO v_req
      FROM public.request_member
      WHERE lower(email) = lower(trim(p_user_email))
        AND status IN ('pending', 'approved')
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE;
    ELSE
      SELECT * INTO v_req
      FROM public.request_manager
      WHERE lower(email) = lower(trim(p_user_email))
        AND status IN ('pending', 'approved')
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE;
    END IF;
  END IF;

  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or invalid token.');
  END IF;

  -- 3. Check status
  IF v_req.status = 'accepted' THEN
    RETURN jsonb_build_object('success', true, 'message', 'This invitation has already been accepted.', 'organization_id', v_req.organization_id);
  ELSIF v_req.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation is no longer active.');
  END IF;

  -- 4. Check expiration
  IF v_req.expires_at IS NOT NULL AND v_req.expires_at < now() THEN
    IF p_role = 'member' THEN
      UPDATE public.request_member SET status = 'expired', updated_at = now() WHERE id = v_req.id;
    ELSE
      UPDATE public.request_manager SET status = 'expired', updated_at = now() WHERE id = v_req.id;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired.');
  END IF;

  -- 5. Check email matches
  IF lower(trim(v_req.email)) <> lower(trim(p_user_email)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation email does not match registered user.');
  END IF;

  v_org_id := v_req.organization_id;
  v_req_id := v_req.id;

  -- 6. Update user's profile with role and employee details (NO v_req.phone, since request tables do not have phone!)
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
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id,
    department = COALESCE(EXCLUDED.department, profiles.department),
    employee_type = COALESCE(EXCLUDED.employee_type, profiles.employee_type),
    job_title = COALESCE(EXCLUDED.job_title, profiles.job_title),
    company_name = COALESCE(EXCLUDED.company_name, profiles.company_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    profile_photo = COALESCE(EXCLUDED.profile_photo, profiles.profile_photo),
    updated_at = now();

  -- 7. Add user to organization_members
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    created_by,
    invited_by,
    joined_at
  )
  VALUES (
    v_org_id,
    p_user_id,
    p_role,
    'active',
    COALESCE(v_req.requested_by, v_req.invited_by),
    COALESCE(v_req.invited_by, v_req.requested_by),
    now()
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active',
    joined_at = now();

  -- 8. Mark invitation as accepted
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

-- 2. Update approve_member_request to set status = 'accepted'
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
  -- 1. Fetch request
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

  -- 3. Check if user already registered in profiles or auth
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(v_req.email))
  LIMIT 1;

  -- 4. Update request status to accepted
  UPDATE public.request_member
  SET
    status = 'accepted',
    accepted_by = COALESCE(v_user_id, v_caller_id),
    updated_at = now()
  WHERE id = req_id;

  -- 5. If user exists, assign membership
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, status, created_by, invited_by, joined_at)
    VALUES (
      v_req.organization_id,
      v_user_id,
      'member',
      'active',
      COALESCE(v_req.requested_by, v_req.invited_by, v_caller_id),
      COALESCE(v_req.invited_by, v_req.requested_by, v_caller_id),
      now()
    )
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = 'member', status = 'active', updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', req_id,
    'status', 'accepted',
    'assigned_user_id', v_user_id
  );
END;
$$;

-- 3. Update approve_manager_request to set status = 'accepted'
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
  -- 1. Fetch request
  SELECT * INTO v_req FROM public.request_manager WHERE id = req_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manager request not found.';
  END IF;

  -- 2. Check authorization (Owner only)
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = v_req.organization_id AND (created_by = v_caller_id OR owner_id = v_caller_id)) THEN
    v_is_authorized := TRUE;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: only organization owners can approve manager requests.';
  END IF;

  -- 3. Check if user already registered in profiles
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(v_req.email))
  LIMIT 1;

  -- 4. Update request status to accepted
  UPDATE public.request_manager
  SET
    status = 'accepted',
    accepted_by = COALESCE(v_user_id, v_caller_id),
    updated_at = now()
  WHERE id = req_id;

  -- 5. If user exists, assign membership
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, status, created_by, invited_by, joined_at)
    VALUES (
      v_req.organization_id,
      v_user_id,
      'manager',
      'active',
      COALESCE(v_req.requested_by, v_req.invited_by, v_caller_id),
      COALESCE(v_req.invited_by, v_req.requested_by, v_caller_id),
      now()
    )
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = 'manager', status = 'active', updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', req_id,
    'status', 'accepted',
    'assigned_user_id', v_user_id
  );
END;
$$;

-- 4. Allow users accepting their own invitation to update the request record
DROP POLICY IF EXISTS "request_member_update_self_accept" ON public.request_member;
CREATE POLICY "request_member_update_self_accept"
  ON public.request_member FOR UPDATE
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt()->>'email')
    OR accepted_by = auth.uid()
  )
  WITH CHECK (
    lower(email) = lower(auth.jwt()->>'email')
    OR accepted_by = auth.uid()
  );

DROP POLICY IF EXISTS "request_manager_update_self_accept" ON public.request_manager;
CREATE POLICY "request_manager_update_self_accept"
  ON public.request_manager FOR UPDATE
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt()->>'email')
    OR accepted_by = auth.uid()
  )
  WITH CHECK (
    lower(email) = lower(auth.jwt()->>'email')
    OR accepted_by = auth.uid()
  );

-- 5. Reconcile all pending requests for already-registered users (fixes prateek and any future stuck invites)
UPDATE public.request_member rm
SET
  status = 'accepted',
  accepted_by = p.id,
  updated_at = now()
FROM public.profiles p
WHERE lower(rm.email) = lower(p.email)
  AND rm.status = 'pending';

UPDATE public.request_manager rmg
SET
  status = 'accepted',
  accepted_by = p.id,
  updated_at = now()
FROM public.profiles p
WHERE lower(rmg.email) = lower(p.email)
  AND rmg.status = 'pending';
