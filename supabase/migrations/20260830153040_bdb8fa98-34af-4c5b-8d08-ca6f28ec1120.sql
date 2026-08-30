-- 1. Commission eligibility + personal Dub link on the allowlist
ALTER TABLE public.approved_staff_emails
  ADD COLUMN IF NOT EXISTS commission_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dub_partner_key text;

UPDATE public.approved_staff_emails SET commission_eligible = false
WHERE email IN (
  'jennifer@taxcomppro.com',
  'tonique@taxcomppro.com',
  'tracina@taxcomppro.com',
  'antwaun@safeguardprofessionals.com',
  'redline1logistics@gmail.com'
);

-- 2. Mirror onto staff profiles so the app can read it for the signed-in user
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS commission_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dub_partner_key text;

UPDATE public.staff_profiles sp
SET commission_eligible = a.commission_eligible,
    dub_partner_key = a.dub_partner_key
FROM auth.users u
JOIN public.approved_staff_emails a ON a.email = lower(u.email)
WHERE sp.id = u.id;

-- 3. Booth-level Dub settings (singleton)
CREATE TABLE IF NOT EXISTS public.booth_settings (
  id boolean PRIMARY KEY DEFAULT true,
  pooled_dub_key text,
  pooled_dub_url text,
  dub_workspace_id text,
  dub_program_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booth_settings_singleton CHECK (id)
);

GRANT SELECT, INSERT, UPDATE ON public.booth_settings TO authenticated;
GRANT ALL ON public.booth_settings TO service_role;

ALTER TABLE public.booth_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view booth settings"
ON public.booth_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert booth settings"
ON public.booth_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update booth settings"
ON public.booth_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER booth_settings_set_updated_at
BEFORE UPDATE ON public.booth_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.booth_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- 4. Record how the code was attributed on each signup
ALTER TABLE public.signup_sessions
  ADD COLUMN IF NOT EXISTS dub_attribution text NOT NULL DEFAULT 'pooled';

-- 5. New accounts inherit owner/seller status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  approved public.approved_staff_emails%ROWTYPE;
BEGIN
  SELECT * INTO approved
  FROM public.approved_staff_emails
  WHERE email = lower(NEW.email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This email is not on the approved booth staff list.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.staff_profiles (id, display_name, commission_eligible, dub_partner_key)
  VALUES (
    NEW.id,
    COALESCE(approved.display_name, NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    approved.commission_eligible,
    approved.dub_partner_key
  )
  ON CONFLICT (id) DO UPDATE
    SET commission_eligible = EXCLUDED.commission_eligible,
        dub_partner_key = EXCLUDED.dub_partner_key;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, approved.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF approved.role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;