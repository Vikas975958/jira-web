-- ==============================================================================
-- Migration 020: Fix Delete Group RLS Policy and delete_chat_group RPC
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/etadtlxpxazwpwvdqmvq/sql
-- ==============================================================================

-- 1. Helper function: check if user is admin or creator
CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- 2. Update RLS on chat_groups (allows admins AND group creators to update and delete)
DROP POLICY IF EXISTS "chat_groups_update" ON public.chat_groups;
CREATE POLICY "chat_groups_update"
  ON public.chat_groups FOR UPDATE
  TO authenticated
  USING (
    public.is_group_admin(id, auth.uid()) OR auth.uid() = created_by
  )
  WITH CHECK (
    public.is_group_admin(id, auth.uid()) OR auth.uid() = created_by
  );

DROP POLICY IF EXISTS "chat_groups_delete" ON public.chat_groups;
CREATE POLICY "chat_groups_delete"
  ON public.chat_groups FOR DELETE
  TO authenticated
  USING (
    public.is_group_admin(id, auth.uid()) OR auth.uid() = created_by
  );

-- 3. Atomic Stored Procedure: delete_chat_group (SECURITY DEFINER runs with elevated privileges)
CREATE OR REPLACE FUNCTION public.delete_chat_group(
  p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_is_authorized BOOLEAN := false;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is admin or creator
  SELECT (
    public.is_group_admin(p_group_id, v_current_user)
    OR (SELECT created_by FROM public.chat_groups WHERE id = p_group_id) = v_current_user
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Only group administrators can delete this group';
  END IF;

  -- Soft delete the group
  UPDATE public.chat_groups
  SET is_active = false, updated_at = now()
  WHERE id = p_group_id;

  -- Deactivate all members
  UPDATE public.chat_group_members
  SET is_active = false, left_at = now()
  WHERE group_id = p_group_id AND is_active = true;

  RETURN jsonb_build_object('success', true, 'group_id', p_group_id);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_chat_group(UUID) TO authenticated;

