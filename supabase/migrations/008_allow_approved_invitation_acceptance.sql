-- ==============================================================================
-- Migration 008: Allow 'approved' status in accept_invitation RPC
-- Enables invited members and managers whose request was approved prior to signup
-- to successfully complete signup via their invitation link.
-- ==============================================================================

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

  -- 2. Find matching invitation by token hash
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

  -- 3. Check status: both 'pending' and 'approved' are valid for signup!
  IF v_req.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been accepted.');
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
    COALESCE(p_employee_details->>'phone', v_req.phone),
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
