-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Staff can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- staff profiles
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Team Member',
  booth_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all profiles" ON public.staff_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert own profile" ON public.staff_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Staff can update own profile" ON public.staff_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id text NOT NULL,
  prefix text,
  first_name text,
  middle_name text,
  last_name text,
  suffix text,
  nickname text,
  title text,
  company text,
  department text,
  address1 text,
  address2 text,
  address3 text,
  city text,
  state text,
  postal_code text,
  country text,
  country_code text,
  phone text,
  fax text,
  email text,
  website text,
  event_name text,
  demographics text,
  qualifiers text,
  association text,
  credential text,
  rating text NOT NULL DEFAULT 'warm',
  interests text[] NOT NULL DEFAULT '{}',
  joined_tcpc boolean NOT NULL DEFAULT false,
  notes text,
  lookup_status text NOT NULL DEFAULT 'found',
  scanned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attendee_id, scanned_by)
);
CREATE INDEX leads_scanned_at_idx ON public.leads (scanned_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all leads" ON public.leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert own leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = scanned_by);
CREATE POLICY "Staff can update own leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (auth.uid() = scanned_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = scanned_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can delete own leads" ON public.leads
  FOR DELETE TO authenticated
  USING (auth.uid() = scanned_by OR public.has_role(auth.uid(), 'admin'));

-- join submissions
CREATE TABLE public.join_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  attendee_id text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  title text,
  interest text,
  consent_marketing boolean NOT NULL DEFAULT false,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_submissions TO authenticated;
GRANT ALL ON public.join_submissions TO service_role;
ALTER TABLE public.join_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all join submissions" ON public.join_submissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert join submissions" ON public.join_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Staff can update own join submissions" ON public.join_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = submitted_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can delete own join submissions" ON public.join_submissions
  FOR DELETE TO authenticated
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(), 'admin'));

-- timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER staff_profiles_set_updated_at BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto profile + default staff role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.staff_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();