-- ==============================================================================
-- Migration 018: Add is_edited column to chat_messages
-- Supports tracking whether a message was modified by the sender.
-- ==============================================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_messages_is_edited
  ON public.chat_messages(is_edited);
