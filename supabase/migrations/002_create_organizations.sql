-- ============================================================
-- Supabase Organizations & Organization Members Table Setup
-- ============================================================

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  industry TEXT,
  company_size TEXT,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for performance and uniqueness lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);

-- 3. Create organization_members table (if not exists)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'manager', 'member'
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_member UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;

DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete" ON public.organization_members;

-- 5. RLS Policies for organizations
-- Users can read organizations they belong to OR created
CREATE POLICY "organizations_select"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Any authenticated user can create an organization
CREATE POLICY "organizations_insert"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Owners and creators can update their organization
CREATE POLICY "organizations_update"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Only owners can delete the organization
CREATE POLICY "organizations_delete"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR owner_id = auth.uid()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- 6. RLS Policies for organization_members
-- Members can view memberships of orgs they belong to
CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Any authenticated user can insert membership (e.g. self when creating org or invited)
CREATE POLICY "org_members_insert"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Owners/Managers can update members
CREATE POLICY "org_members_update"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Owners/Managers can remove members, or user can remove themselves
CREATE POLICY "org_members_delete"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- 7. Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_organizations_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = now();
  -- Keep owner_id in sync with created_by if empty
  IF NEW.owner_id IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.owner_id = NEW.created_by;
  END IF;
  IF NEW.created_by IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.created_by = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_organizations_updated ON public.organizations;
CREATE TRIGGER on_organizations_updated
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_organizations_updated_at();

DROP TRIGGER IF EXISTS on_org_members_updated ON public.organization_members;
CREATE TRIGGER on_org_members_updated
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profiles_updated_at();
