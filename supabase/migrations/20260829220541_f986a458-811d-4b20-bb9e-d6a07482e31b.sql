-- pipeline stage
CREATE TYPE public.signup_stage AS ENUM (
  'scanned',
  'signup_sent',
  'membership_confirmed',
  'ready_for_card',
  'card_issued',
  'void'
);

-- signup sessions
CREATE TABLE public.signup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  attendee_id text,
  stage public.signup_stage NOT NULL DEFAULT 'scanned',
  rep_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rep_name text,
  dub_code text,
  source text NOT NULL DEFAULT 'booth_scan',
  full_name text,
  email text,
  phone text,
  company text,
  title text,
  membership_confirmed_at timestamptz,
  membership_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  membership_ref text,
  membership_plan text,
  external_member_id text,
  migrated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signup_sessions_stage_idx ON public.signup_sessions (stage, created_at DESC);
CREATE INDEX signup_sessions_lead_idx ON public.signup_sessions (lead_id);
GRANT SELECT, INSERT, UPDATE ON public.signup_sessions TO authenticated;
GRANT ALL ON public.signup_sessions TO service_role;
ALTER TABLE public.signup_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view signup sessions" ON public.signup_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create signup sessions" ON public.signup_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = rep_user_id);
CREATE POLICY "Staff update signup sessions" ON public.signup_sessions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete signup sessions" ON public.signup_sessions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- connect profiles
CREATE TABLE public.connect_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_session_id uuid NOT NULL REFERENCES public.signup_sessions(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  credential text,
  title text,
  company text,
  city text,
  state text,
  email text,
  phone text,
  website text,
  bio text,
  services text[] NOT NULL DEFAULT '{}',
  show_email boolean NOT NULL DEFAULT false,
  show_phone boolean NOT NULL DEFAULT false,
  show_location boolean NOT NULL DEFAULT true,
  published boolean NOT NULL DEFAULT true,
  external_profile_id text,
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX connect_profiles_session_idx ON public.connect_profiles (signup_session_id);
GRANT SELECT, INSERT, UPDATE ON public.connect_profiles TO authenticated;
GRANT ALL ON public.connect_profiles TO service_role;
ALTER TABLE public.connect_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view connect profiles" ON public.connect_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create connect profiles" ON public.connect_profiles
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update connect profiles" ON public.connect_profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete connect profiles" ON public.connect_profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- card tokens
CREATE TABLE public.card_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  profile_id uuid NOT NULL REFERENCES public.connect_profiles(id) ON DELETE CASCADE,
  signup_session_id uuid NOT NULL REFERENCES public.signup_sessions(id) ON DELETE CASCADE,
  override_target_url text,
  status text NOT NULL DEFAULT 'issued',
  written_at timestamptz,
  verified_at timestamptz,
  tap_count integer NOT NULL DEFAULT 0,
  last_tap_at timestamptz,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_tokens_profile_idx ON public.card_tokens (profile_id);
GRANT SELECT, INSERT, UPDATE ON public.card_tokens TO authenticated;
GRANT ALL ON public.card_tokens TO service_role;
ALTER TABLE public.card_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view card tokens" ON public.card_tokens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create card tokens" ON public.card_tokens
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update card tokens" ON public.card_tokens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete card tokens" ON public.card_tokens
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- audit trail
CREATE TABLE public.signup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_session_id uuid NOT NULL REFERENCES public.signup_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signup_events_session_idx ON public.signup_events (signup_session_id, created_at DESC);
GRANT SELECT, INSERT ON public.signup_events TO authenticated;
GRANT ALL ON public.signup_events TO service_role;
ALTER TABLE public.signup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view signup events" ON public.signup_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create signup events" ON public.signup_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- timestamps
CREATE TRIGGER signup_sessions_set_updated_at BEFORE UPDATE ON public.signup_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER connect_profiles_set_updated_at BEFORE UPDATE ON public.connect_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER card_tokens_set_updated_at BEFORE UPDATE ON public.card_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();