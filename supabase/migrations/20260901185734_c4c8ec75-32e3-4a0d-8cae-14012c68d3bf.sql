UPDATE public.approved_staff_emails SET email = lower(email) WHERE email <> lower(email);

CREATE OR REPLACE FUNCTION public.normalize_approved_staff_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_approved_staff_email_trg ON public.approved_staff_emails;
CREATE TRIGGER normalize_approved_staff_email_trg
BEFORE INSERT OR UPDATE ON public.approved_staff_emails
FOR EACH ROW EXECUTE FUNCTION public.normalize_approved_staff_email();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved public.approved_staff_emails%ROWTYPE;
BEGIN
  SELECT * INTO approved
  FROM public.approved_staff_emails
  WHERE lower(email) = lower(NEW.email);

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
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_approved_staff_email() FROM anon, authenticated;