CREATE TABLE public.email_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_email text NOT NULL,
  to_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_id text,
  error text,
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.email_messages TO authenticated;
GRANT ALL ON public.email_messages TO service_role;

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view email messages"
  ON public.email_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can create email messages"
  ON public.email_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sent_by);

CREATE INDEX email_messages_contact_email_idx ON public.email_messages (lower(contact_email));
CREATE INDEX email_messages_lead_id_idx ON public.email_messages (lead_id);

CREATE TRIGGER email_messages_set_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();