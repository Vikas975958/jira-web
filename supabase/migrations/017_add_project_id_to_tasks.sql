-- ==============================================================================
-- Migration 017: Add project_id foreign key column to public.tasks table
-- Connects tasks directly to projects with foreign key, cascade set null,
-- index for performance, and backfills existing tasks by project name matching.
-- ==============================================================================

-- 1. Add project_id column referencing public.projects(id)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. Create index for fast project-level task queries and joins
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- 3. Backfill existing tasks where project_id is null by matching on organization_id and project_name
UPDATE public.tasks t
SET project_id = p.id
FROM public.projects p
WHERE t.organization_id = p.organization_id
  AND lower(trim(t.project_name)) = lower(trim(p.name))
  AND t.project_id IS NULL;
