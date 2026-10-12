-- ==============================================================================
-- Migration 014: Stored procedure to reliably fetch all organization members with profiles
-- Guarantees full names and emails are never blank or missing due to RLS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_organization_team_members(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ,
  created_by UUID,
  invited_by UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  WITH om_data AS (
    SELECT
      om.id,
      om.organization_id,
      om.user_id,
      om.role,
      om.status,
      om.joined_at,
      om.created_by,
      om.invited_by,
      COALESCE(
        NULLIF(trim(p.full_name), ''),
        NULLIF(trim(rm.full_name), ''),
        NULLIF(trim(rmg.full_name), ''),
        split_part(COALESCE(p.email, rm.email, rmg.email, u.email::text), '@', 1)
      ) AS full_name,
      COALESCE(
        NULLIF(trim(p.email), ''),
        NULLIF(trim(rm.email), ''),
        NULLIF(trim(rmg.email), ''),
        u.email::text
      ) AS email,
      COALESCE(p.phone, '') AS phone
    FROM public.organization_members om
    LEFT JOIN public.profiles p ON p.id = om.user_id
    LEFT JOIN auth.users u ON u.id = om.user_id
    LEFT JOIN LATERAL (
      SELECT r.full_name, r.email
      FROM public.request_member r
      WHERE (r.accepted_by = om.user_id OR lower(r.email) = lower(p.email))
        AND r.organization_id = p_organization_id
      ORDER BY r.updated_at DESC
      LIMIT 1
    ) rm ON true
    LEFT JOIN LATERAL (
      SELECT rg.full_name, rg.email
      FROM public.request_manager rg
      WHERE (rg.accepted_by = om.user_id OR lower(rg.email) = lower(p.email))
        AND rg.organization_id = p_organization_id
      ORDER BY rg.updated_at DESC
      LIMIT 1
    ) rmg ON true
    WHERE om.organization_id = p_organization_id
      AND om.status = 'active'
  ),
  req_accepted AS (
    -- Include accepted member requests not yet in organization_members
    SELECT
      rm.id,
      rm.organization_id,
      COALESCE(rm.accepted_by, rm.id) AS user_id,
      'member'::text AS role,
      'active'::text AS status,
      rm.updated_at AS joined_at,
      COALESCE(rm.requested_by, rm.invited_by) AS created_by,
      COALESCE(rm.invited_by, rm.requested_by) AS invited_by,
      COALESCE(NULLIF(trim(rm.full_name), ''), split_part(rm.email, '@', 1)) AS full_name,
      rm.email::text AS email,
      ''::text AS phone
    FROM public.request_member rm
    WHERE rm.organization_id = p_organization_id
      AND rm.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM om_data o WHERE o.user_id = rm.accepted_by OR lower(o.email) = lower(rm.email)
      )
    UNION ALL
    -- Include accepted manager requests not yet in organization_members
    SELECT
      rmg.id,
      rmg.organization_id,
      COALESCE(rmg.accepted_by, rmg.id) AS user_id,
      'manager'::text AS role,
      'active'::text AS status,
      rmg.updated_at AS joined_at,
      COALESCE(rmg.requested_by, rmg.invited_by) AS created_by,
      COALESCE(rmg.invited_by, rmg.requested_by) AS invited_by,
      COALESCE(NULLIF(trim(rmg.full_name), ''), split_part(rmg.email, '@', 1)) AS full_name,
      rmg.email::text AS email,
      ''::text AS phone
    FROM public.request_manager rmg
    WHERE rmg.organization_id = p_organization_id
      AND rmg.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM om_data o WHERE o.user_id = rmg.accepted_by OR lower(o.email) = lower(rmg.email)
      )
  )
  SELECT * FROM om_data
  UNION ALL
  SELECT * FROM req_accepted;
END;
$$;
