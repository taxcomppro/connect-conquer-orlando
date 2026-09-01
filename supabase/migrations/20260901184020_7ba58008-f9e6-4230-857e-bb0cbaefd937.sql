CREATE OR REPLACE FUNCTION public.get_public_join_session(_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'stage', s.stage, 'full_name', s.full_name,
    'email', s.email, 'phone', s.phone, 'company', s.company,
    'title', s.title, 'rep_name', s.rep_name, 'slug', p.slug
  )
  FROM public.signup_sessions s
  LEFT JOIN public.connect_profiles p ON p.signup_session_id = s.id
  WHERE s.id = _session_id AND s.stage <> 'void'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_join_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_join_session(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_public_connect_profile(
  _session_id uuid, _display_name text, _credential text DEFAULT NULL,
  _title text DEFAULT NULL, _company text DEFAULT NULL, _city text DEFAULT NULL,
  _state text DEFAULT NULL, _email text DEFAULT NULL, _phone text DEFAULT NULL,
  _website text DEFAULT NULL, _bio text DEFAULT NULL, _services text[] DEFAULT '{}',
  _show_email boolean DEFAULT false, _show_phone boolean DEFAULT false,
  _show_location boolean DEFAULT true, _membership_ref text DEFAULT NULL,
  _membership_plan text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _slug text;
  _base text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.signup_sessions WHERE id = _session_id AND stage <> 'void') THEN
    RAISE EXCEPTION 'This signup link is no longer valid.';
  END IF;
  IF nullif(btrim(_display_name), '') IS NULL THEN RAISE EXCEPTION 'Name is required.'; END IF;

  SELECT id, slug INTO _profile_id, _slug FROM public.connect_profiles WHERE signup_session_id = _session_id;
  IF _profile_id IS NULL THEN
    _base := trim(both '-' from regexp_replace(lower(btrim(_display_name)), '[^a-z0-9]+', '-', 'g'));
    IF _base = '' THEN _base := 'pro'; END IF;
    _slug := left(_base, 40) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    INSERT INTO public.connect_profiles (
      signup_session_id, slug, display_name, credential, title, company, city, state,
      email, phone, website, bio, services, show_email, show_phone, show_location, published
    ) VALUES (
      _session_id, _slug, left(btrim(_display_name), 120), nullif(left(btrim(_credential), 60), ''),
      nullif(left(btrim(_title), 120), ''), nullif(left(btrim(_company), 160), ''),
      nullif(left(btrim(_city), 80), ''), nullif(left(btrim(_state), 40), ''),
      nullif(left(btrim(_email), 160), ''), nullif(left(btrim(_phone), 40), ''),
      nullif(left(btrim(_website), 200), ''), nullif(left(btrim(_bio), 1000), ''),
      coalesce(_services[1:12], '{}'), _show_email, _show_phone, _show_location, true
    );
  ELSE
    UPDATE public.connect_profiles SET
      display_name = left(btrim(_display_name), 120), credential = nullif(left(btrim(_credential), 60), ''),
      title = nullif(left(btrim(_title), 120), ''), company = nullif(left(btrim(_company), 160), ''),
      city = nullif(left(btrim(_city), 80), ''), state = nullif(left(btrim(_state), 40), ''),
      email = nullif(left(btrim(_email), 160), ''), phone = nullif(left(btrim(_phone), 40), ''),
      website = nullif(left(btrim(_website), 200), ''), bio = nullif(left(btrim(_bio), 1000), ''),
      services = coalesce(_services[1:12], '{}'), show_email = _show_email,
      show_phone = _show_phone, show_location = _show_location, published = true
    WHERE id = _profile_id;
  END IF;

  UPDATE public.signup_sessions SET
    stage = 'ready_for_card', full_name = left(btrim(_display_name), 120),
    email = nullif(left(btrim(_email), 160), ''), phone = nullif(left(btrim(_phone), 40), ''),
    company = nullif(left(btrim(_company), 160), ''), title = nullif(left(btrim(_title), 120), ''),
    membership_ref = nullif(left(btrim(_membership_ref), 120), ''),
    membership_plan = nullif(left(btrim(_membership_plan), 80), '')
  WHERE id = _session_id;

  INSERT INTO public.signup_events (signup_session_id, event_type, actor_label, payload)
  VALUES (_session_id, 'PROFILE_CREATED', 'customer', jsonb_build_object('slug', _slug));
  RETURN jsonb_build_object('slug', _slug, 'ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_public_connect_profile(uuid, text, text, text, text, text, text, text, text, text, text, text[], boolean, boolean, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_connect_profile(uuid, text, text, text, text, text, text, text, text, text, text, text[], boolean, boolean, boolean, text, text) TO anon, authenticated, service_role;