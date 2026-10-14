-- ==============================================================================
-- Migration 015: Ensure assigned members and issue creators can view/update tasks
-- 1. Backfill any existing tasks where assignee_id is NULL by matching profiles
-- 2. Update RLS policies to permit both assigned members AND creators to view and update
-- ==============================================================================

-- 1. Backfill existing tasks where assignee_id is NULL using full_name or email match in public.profiles
UPDATE public.tasks t
SET assignee_id = p.id
FROM public.profiles p
WHERE t.assignee_id IS NULL
  AND t.assignee IS NOT NULL
  AND t.assignee != 'Unassigned'
  AND (
    lower(trim(t.assignee)) = lower(trim(p.full_name))
    OR lower(trim(t.assignee)) = lower(trim(p.email))
  );

-- 2. Update tasks_select policy:
--    - Org admins (owners and managers) can view all tasks in the org
--    - Assigned member (assignee_id = auth.uid()) OR task creator (created_by = auth.uid()) can view the task
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR (
      (assignee_id = auth.uid() OR created_by = auth.uid())
      AND organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  );

-- 3. Update tasks_update policy:
--    - Org admins can update any task
--    - Assigned member OR task creator can update their task (status, progress, etc.)
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR (
      (assignee_id = auth.uid() OR created_by = auth.uid())
      AND organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  );
