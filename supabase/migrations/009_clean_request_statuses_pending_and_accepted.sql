-- ==============================================================================
-- Migration 009: Streamline request lifecycle to 'pending' and 'accepted'
-- Removes intermediate approval step. Invitations are created as 'pending'
-- and automatically transition to 'accepted' when the invited user signs up.
-- ==============================================================================

-- 1. Reset any existing 'approved' requests that haven't accepted yet to 'pending'
UPDATE public.request_member
SET status = 'pending', updated_at = now()
WHERE status = 'approved';

UPDATE public.request_manager
SET status = 'pending', updated_at = now()
WHERE status = 'approved';
