CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id uuid REFERENCES public.email_messages(id) ON DELETE SET NULL,
  provider_id text,
  contact_email text NOT NULL,
  event_type text NOT NULL,
  link_url text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read email events"
ON public.email_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX email_events_contact_email_idx ON public.email_events (lower(contact_email));
CREATE INDEX email_events_provider_id_idx ON public.email_events (provider_id);
CREATE INDEX email_events_occurred_at_idx ON public.email_events (occurred_at DESC);
CREATE UNIQUE INDEX email_events_dedupe_idx ON public.email_events (provider_id, event_type, coalesce(link_url, ''), occurred_at);