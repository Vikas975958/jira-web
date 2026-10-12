-- ==============================================================================
-- Migration 011: Allow Public Read on Project Invitations by Token Hash
-- Enables the public signup flow (/signup?token=...&projectId=...) to validate
-- project invitation tokens before a user has signed in.
-- ==============================================================================

DROP POLICY IF EXISTS "project_invitations_token_read" ON public.project_invitations;

CREATE POLICY "project_invitations_token_read"
  ON public.project_invitations FOR SELECT
  TO public
  USING (
    invitation_token_hash IS NOT NULL
  );
