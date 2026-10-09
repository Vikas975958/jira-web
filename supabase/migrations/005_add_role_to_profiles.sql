-- ============================================================
-- Supabase Migration: 005_add_role_to_profiles.sql
-- Description: Add role column to profiles table with default 'owner'
-- ============================================================

-- 1. Add role column if not exists with default 'owner'
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner';

-- 2. Update existing records with NULL or missing role to 'owner'
UPDATE public.profiles
SET role = 'owner'
WHERE role IS NULL;

-- 3. Ensure column default is 'owner'
ALTER TABLE public.profiles
ALTER COLUMN role SET DEFAULT 'owner';

-- 4. Update handle_new_user trigger function to preserve/default role to 'owner'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $func$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    role = COALESCE(public.profiles.role, EXCLUDED.role, 'owner'),
    updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
