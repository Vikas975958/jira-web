-- ==============================================================================
-- Migration 016: One-to-One Private Chat System
-- Supports private conversations between team members, managers, and owners
-- with strict Row Level Security (RLS) and Supabase Realtime support.
-- ==============================================================================

-- 1. Create CHAT_CONVERSATIONS Table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_text TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_chat_distinct_users CHECK (user1_id <> user2_id)
);

-- Unique index to guarantee exactly one conversation between two users in an organization
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conversations_user_pair
  ON public.chat_conversations (
    organization_id,
    LEAST(user1_id, user2_id),
    GREATEST(user1_id, user2_id)
  );

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org ON public.chat_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user1 ON public.chat_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user2 ON public.chat_conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_msg ON public.chat_conversations(last_message_at DESC);

-- 2. Create CHAT_MESSAGES Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast message fetching and unread counts
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_unread ON public.chat_messages(recipient_id, is_read);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "chat_conv_select_participants" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_conv_insert_participants" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_conv_update_participants" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_msg_select_participants" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_msg_insert_sender" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_msg_update_participants" ON public.chat_messages;

-- RLS for chat_conversations:
-- Users can only select conversations where they are user1 or user2
CREATE POLICY "chat_conv_select_participants"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can create a conversation only if they are one of the participants
CREATE POLICY "chat_conv_insert_participants"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Participants can update conversation metadata (e.g. last_message_at)
CREATE POLICY "chat_conv_update_participants"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- RLS for chat_messages:
-- Users can read messages only if they are the sender or recipient
CREATE POLICY "chat_msg_select_participants"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can send messages only where they are the sender
CREATE POLICY "chat_msg_insert_sender"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Recipients or senders can update messages (e.g. mark as read)
CREATE POLICY "chat_msg_update_participants"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = recipient_id OR auth.uid() = sender_id);

-- 4. Automatically update conversation last_message on new message
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_conversations
  SET
    last_message_text = LEFT(NEW.message, 200),
    last_message_at = NEW.created_at,
    last_sender_id = NEW.sender_id,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;

CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message();

-- 5. RPC: Get or Create Private Conversation
CREATE OR REPLACE FUNCTION public.get_or_create_chat_conversation(
  p_organization_id UUID,
  p_other_user_id UUID
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  user1_id UUID,
  user2_id UUID,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_sender_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_u1 UUID;
  v_u2 UUID;
  v_conv_id UUID;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_current_user = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot start a private chat with yourself';
  END IF;

  -- Canonical order
  v_u1 := LEAST(v_current_user, p_other_user_id);
  v_u2 := GREATEST(v_current_user, p_other_user_id);

  -- Check if conversation already exists
  SELECT c.id INTO v_conv_id
  FROM public.chat_conversations c
  WHERE c.organization_id = p_organization_id
    AND c.user1_id = v_u1
    AND c.user2_id = v_u2
  LIMIT 1;

  -- Create if not found
  IF v_conv_id IS NULL THEN
    INSERT INTO public.chat_conversations (
      organization_id,
      user1_id,
      user2_id
    ) VALUES (
      p_organization_id,
      v_u1,
      v_u2
    )
    ON CONFLICT (organization_id, LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))
    DO UPDATE SET updated_at = now()
    RETURNING chat_conversations.id INTO v_conv_id;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.organization_id,
    c.user1_id,
    c.user2_id,
    c.last_message_text,
    c.last_message_at,
    c.last_sender_id,
    c.created_at,
    c.updated_at
  FROM public.chat_conversations c
  WHERE c.id = v_conv_id;
END;
$$;

-- 6. RPC: Mark Conversation Messages as Read
CREATE OR REPLACE FUNCTION public.mark_chat_messages_as_read(
  p_conversation_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.chat_messages
  SET
    is_read = true,
    read_at = now()
  WHERE conversation_id = p_conversation_id
    AND recipient_id = auth.uid()
    AND is_read = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- 7. Add to Supabase Realtime Publication if available
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
