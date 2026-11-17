-- ==============================================================================
-- Migration 019: Group Chat System
-- Supports Group Conversations, Group Memberships, Group Messages,
-- Group Message Read Receipts, and Realtime Subscriptions with strict RLS.
-- ==============================================================================

-- 1. Create CHAT_GROUPS Table
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  group_image TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_text TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for chat_groups
CREATE INDEX IF NOT EXISTS idx_chat_groups_org ON public.chat_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON public.chat_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_groups_last_msg ON public.chat_groups(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_groups_active ON public.chat_groups(is_active);

-- 2. Create CHAT_GROUP_MEMBERS Table
CREATE TABLE IF NOT EXISTS public.chat_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  left_at TIMESTAMPTZ
);

-- Prevent duplicate active memberships for the same user in a group
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_active_group_membership
  ON public.chat_group_members(group_id, user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON public.chat_group_members(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group ON public.chat_group_members(group_id, is_active);

-- 3. Extend CHAT_MESSAGES for Group Chat Support
-- Make conversation_id and recipient_id nullable to support group messages
ALTER TABLE public.chat_messages ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE public.chat_messages ALTER COLUMN recipient_id DROP NOT NULL;

-- Add group_id referencing chat_groups
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE;

-- Ensure message has valid target: either 1-to-1 conversation OR group
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chk_chat_message_target;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chk_chat_message_target
  CHECK (
    (conversation_id IS NOT NULL AND recipient_id IS NOT NULL AND group_id IS NULL)
    OR
    (group_id IS NOT NULL AND conversation_id IS NULL AND recipient_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_chat_messages_group_created ON public.chat_messages(group_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON public.chat_messages(group_id) WHERE group_id IS NOT NULL;

-- 4. Create CHAT_GROUP_MESSAGE_READS Table (Read receipts for groups)
CREATE TABLE IF NOT EXISTS public.chat_group_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_msg_read UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_msg_reads_msg ON public.chat_group_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_group_msg_reads_user ON public.chat_group_message_reads(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_msg_reads_group ON public.chat_group_message_reads(group_id);

-- 5. Helper Functions for Security & RLS
CREATE OR REPLACE FUNCTION public.is_active_group_member(p_group_id UUID, p_user_id UUID)
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
      AND is_active = true
  );
$$;

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

CREATE OR REPLACE FUNCTION public.count_group_admins(p_group_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.chat_group_members
  WHERE group_id = p_group_id
    AND role = 'admin'
    AND is_active = true;
$$;

-- 6. Trigger to Update last_message on chat_conversations OR chat_groups
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.chat_conversations
    SET
      last_message_text = LEFT(NEW.message, 200),
      last_message_at = NEW.created_at,
      last_sender_id = NEW.sender_id,
      updated_at = now()
    WHERE id = NEW.conversation_id;
  ELSIF NEW.group_id IS NOT NULL THEN
    UPDATE public.chat_groups
    SET
      last_message_text = LEFT(NEW.message, 200),
      last_message_at = NEW.created_at,
      last_sender_id = NEW.sender_id,
      updated_at = now()
    WHERE id = NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message();

-- 7. Row Level Security (RLS)
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_message_reads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "chat_groups_select" ON public.chat_groups;
DROP POLICY IF EXISTS "chat_groups_insert" ON public.chat_groups;
DROP POLICY IF EXISTS "chat_groups_update" ON public.chat_groups;
DROP POLICY IF EXISTS "chat_group_members_select" ON public.chat_group_members;
DROP POLICY IF EXISTS "chat_group_members_insert" ON public.chat_group_members;
DROP POLICY IF EXISTS "chat_group_members_update" ON public.chat_group_members;
DROP POLICY IF EXISTS "chat_group_reads_select" ON public.chat_group_message_reads;
DROP POLICY IF EXISTS "chat_group_reads_insert" ON public.chat_group_message_reads;
DROP POLICY IF EXISTS "chat_msg_select_participants" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_msg_insert_sender" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_msg_update_participants" ON public.chat_messages;

-- RLS for chat_groups
CREATE POLICY "chat_groups_select"
  ON public.chat_groups FOR SELECT
  TO authenticated
  USING (
    is_active = true AND (
      public.is_active_group_member(id, auth.uid()) OR auth.uid() = created_by
    )
  );

CREATE POLICY "chat_groups_insert"
  ON public.chat_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

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

-- RLS for chat_group_members
CREATE POLICY "chat_group_members_select"
  ON public.chat_group_members FOR SELECT
  TO authenticated
  USING (
    public.is_active_group_member(group_id, auth.uid()) OR user_id = auth.uid()
  );

CREATE POLICY "chat_group_members_insert"
  ON public.chat_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_group_admin(group_id, auth.uid())
    OR (SELECT created_by FROM public.chat_groups WHERE id = group_id) = auth.uid()
  );

CREATE POLICY "chat_group_members_update"
  ON public.chat_group_members FOR UPDATE
  TO authenticated
  USING (
    public.is_group_admin(group_id, auth.uid()) OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_group_admin(group_id, auth.uid()) OR user_id = auth.uid()
  );

-- RLS for chat_group_message_reads
CREATE POLICY "chat_group_reads_select"
  ON public.chat_group_message_reads FOR SELECT
  TO authenticated
  USING (public.is_active_group_member(group_id, auth.uid()));

CREATE POLICY "chat_group_reads_insert"
  ON public.chat_group_message_reads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_group_member(group_id, auth.uid()));

-- Unified RLS for chat_messages (Both 1-to-1 and Group Messages)
CREATE POLICY "chat_msg_select_participants"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    (conversation_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = recipient_id))
    OR
    (group_id IS NOT NULL AND public.is_active_group_member(group_id, auth.uid()))
  );

CREATE POLICY "chat_msg_insert_sender"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND (
      (conversation_id IS NOT NULL AND recipient_id IS NOT NULL)
      OR
      (group_id IS NOT NULL AND public.is_active_group_member(group_id, auth.uid()))
    )
  );

CREATE POLICY "chat_msg_update_participants"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (
    (conversation_id IS NOT NULL AND (auth.uid() = recipient_id OR auth.uid() = sender_id))
    OR
    (group_id IS NOT NULL AND auth.uid() = sender_id)
  )
  WITH CHECK (
    (conversation_id IS NOT NULL AND (auth.uid() = recipient_id OR auth.uid() = sender_id))
    OR
    (group_id IS NOT NULL AND auth.uid() = sender_id)
  );

-- 8. Stored Procedure: Create Chat Group with Members Atomically
CREATE OR REPLACE FUNCTION public.create_chat_group(
  p_organization_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_group_image TEXT DEFAULT NULL,
  p_member_user_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_group_id UUID;
  v_member_id UUID;
  v_result JSONB;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Group name cannot be blank';
  END IF;

  -- 1. Create the group
  INSERT INTO public.chat_groups (
    organization_id,
    name,
    description,
    group_image,
    created_by,
    last_message_text,
    last_message_at,
    last_sender_id
  ) VALUES (
    p_organization_id,
    trim(p_name),
    COALESCE(trim(p_description), ''),
    p_group_image,
    v_current_user,
    'Group created',
    now(),
    v_current_user
  )
  RETURNING id INTO v_group_id;

  -- 2. Add creator as admin
  INSERT INTO public.chat_group_members (
    group_id,
    user_id,
    role,
    added_by,
    is_active
  ) VALUES (
    v_group_id,
    v_current_user,
    'admin',
    v_current_user,
    true
  );

  -- 3. Add other members
  IF p_member_user_ids IS NOT NULL AND array_length(p_member_user_ids, 1) > 0 THEN
    FOREACH v_member_id IN ARRAY p_member_user_ids LOOP
      IF v_member_id <> v_current_user THEN
        INSERT INTO public.chat_group_members (
          group_id,
          user_id,
          role,
          added_by,
          is_active
        ) VALUES (
          v_group_id,
          v_member_id,
          'member',
          v_current_user,
          true
        )
        ON CONFLICT (group_id, user_id) WHERE is_active = true
        DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- 4. Initial system message in group
  INSERT INTO public.chat_messages (
    group_id,
    sender_id,
    message,
    created_at
  ) VALUES (
    v_group_id,
    v_current_user,
    'Group "' || trim(p_name) || '" was created.',
    now()
  );

  -- 5. Return complete group object
  SELECT to_jsonb(g.*) INTO v_result
  FROM public.chat_groups g
  WHERE g.id = v_group_id;

  RETURN v_result;
END;
$$;

-- 9. Stored Procedure: Add Members to Group
CREATE OR REPLACE FUNCTION public.add_chat_group_members(
  p_group_id UUID,
  p_user_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_target_id UUID;
  v_added_count INT := 0;
BEGIN
  v_current_user := auth.uid();
  IF NOT public.is_group_admin(p_group_id, v_current_user) THEN
    RAISE EXCEPTION 'Only group admins can add new members';
  END IF;

  IF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) > 0 THEN
    FOREACH v_target_id IN ARRAY p_user_ids LOOP
      -- Insert or re-activate member
      INSERT INTO public.chat_group_members (
        group_id,
        user_id,
        role,
        added_by,
        is_active,
        joined_at,
        left_at
      ) VALUES (
        p_group_id,
        v_target_id,
        'member',
        v_current_user,
        true,
        now(),
        NULL
      )
      ON CONFLICT (group_id, user_id) WHERE is_active = true
      DO NOTHING;

      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'added_count', v_added_count);
END;
$$;

-- 10. Stored Procedure: Remove Group Member or Leave Group
CREATE OR REPLACE FUNCTION public.remove_chat_group_member(
  p_group_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_target_role TEXT;
  v_admin_count INT;
BEGIN
  v_current_user := auth.uid();

  -- Get target member role and verify active membership
  SELECT role INTO v_target_role
  FROM public.chat_group_members
  WHERE group_id = p_group_id
    AND user_id = p_target_user_id
    AND is_active = true;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User is not an active member of this group';
  END IF;

  -- Only self or group admin can remove
  IF v_current_user <> p_target_user_id AND NOT public.is_group_admin(p_group_id, v_current_user) THEN
    RAISE EXCEPTION 'Only group admins can remove other members';
  END IF;

  -- Last-admin protection: If target is admin, ensure at least one other active admin remains
  IF v_target_role = 'admin' THEN
    SELECT public.count_group_admins(p_group_id) INTO v_admin_count;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last active administrator. Please promote another member to admin first.';
    END IF;
  END IF;

  -- Mark member as inactive
  UPDATE public.chat_group_members
  SET
    is_active = false,
    left_at = now()
  WHERE group_id = p_group_id
    AND user_id = p_target_user_id
    AND is_active = true;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 11. Stored Procedure: Promote or Demote Group Member Role
CREATE OR REPLACE FUNCTION public.update_chat_group_member_role(
  p_group_id UUID,
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_admin_count INT;
BEGIN
  v_current_user := auth.uid();

  IF NOT public.is_group_admin(p_group_id, v_current_user) THEN
    RAISE EXCEPTION 'Only group admins can change member roles';
  END IF;

  IF p_new_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin or member.';
  END IF;

  -- Last-admin protection: If demoting from admin to member
  IF p_new_role = 'member' THEN
    SELECT public.count_group_admins(p_group_id) INTO v_admin_count;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last remaining group administrator.';
    END IF;
  END IF;

  UPDATE public.chat_group_members
  SET role = p_new_role
  WHERE group_id = p_group_id
    AND user_id = p_target_user_id
    AND is_active = true;

  RETURN jsonb_build_object('success', true, 'role', p_new_role);
END;
$$;

-- 12. Stored Procedure: Mark Group Messages as Read
CREATE OR REPLACE FUNCTION public.mark_chat_group_messages_as_read(
  p_group_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_marked_count INT := 0;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert read records for all messages in this group not sent by current user
  WITH unread_msgs AS (
    SELECT m.id
    FROM public.chat_messages m
    WHERE m.group_id = p_group_id
      AND m.sender_id <> v_current_user
      AND NOT EXISTS (
        SELECT 1 FROM public.chat_group_message_reads r
        WHERE r.message_id = m.id AND r.user_id = v_current_user
      )
  ),
  inserted AS (
    INSERT INTO public.chat_group_message_reads (group_id, message_id, user_id, read_at)
    SELECT p_group_id, u.id, v_current_user, now()
    FROM unread_msgs u
    ON CONFLICT (message_id, user_id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_marked_count FROM inserted;

  RETURN v_marked_count;
END;
$$;

-- 13. Stored Procedure: Delete Group (Admin only)
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
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.is_group_admin(p_group_id, v_current_user)
    OR (SELECT created_by FROM public.chat_groups WHERE id = p_group_id) = v_current_user
  ) THEN
    RAISE EXCEPTION 'Only group admins can delete this group';
  END IF;

  -- Soft delete the group
  UPDATE public.chat_groups
  SET is_active = false, updated_at = now()
  WHERE id = p_group_id;

  -- Deactivate all members
  UPDATE public.chat_group_members
  SET is_active = false, left_at = now()
  WHERE group_id = p_group_id AND is_active = true;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RLS Policy for DELETE on chat_groups
DROP POLICY IF EXISTS "chat_groups_delete" ON public.chat_groups;
CREATE POLICY "chat_groups_delete"
  ON public.chat_groups FOR DELETE
  TO authenticated
  USING (
    public.is_group_admin(id, auth.uid())
    OR auth.uid() = created_by
  );

-- 14. Enable Realtime Publications for Group Tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_message_reads;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

