CREATE TABLE public.approved_staff_emails (
  email text PRIMARY KEY,
  display_name text,
  role app_role NOT NULL DEFAULT 'staff',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.approved_staff_emails TO authenticated;
GRANT ALL ON public.approved_staff_emails TO service_role;

ALTER TABLE public.approved_staff_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view approved emails"
ON public.approved_staff_emails FOR SELECT TO authenticated USING (true);

INSERT INTO public.approved_staff_emails (email, display_name, role, note) VALUES
  ('jennifer@taxcomppro.com', 'Jennifer Lewis', 'admin', null),
  ('tonique@taxcomppro.com', 'Tonique Clay', 'admin', 'Booth Manager'),
  ('tracina@taxcomppro.com', 'Tracina Morris', 'staff', null),
  ('antwaun@safeguardprofessionals.com', 'Antwaun King', 'staff', null),
  ('itstoniclay@gmail.com', 'Toni Clay', 'staff', null),
  ('redline1logistics@gmail.com', 'Kenneth Blanchard', 'staff', null),
  ('christal@safeguardprofessionals.com', 'Christal James', 'staff', null),
  ('andres@safeguardprofessionals.com', 'Andres Benoit', 'staff', null),
  ('fontenetteyjeremy8@gmail.com', 'Jeremy Fontenette', 'staff', null),
  ('mattisenniblett21@gmail.com', 'Mattisen Niblett', 'staff', null),
  ('iashiarob@gmail.com', 'Iashia Robertson', 'staff', null);

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

  INSERT INTO public.staff_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(approved.display_name, NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

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