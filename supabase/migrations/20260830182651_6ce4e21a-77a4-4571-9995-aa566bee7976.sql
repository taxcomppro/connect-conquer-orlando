CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sms_templates TO authenticated;
GRANT DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view SMS templates"
  ON public.sms_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create SMS templates"
  ON public.sms_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Staff can update own SMS templates"
  ON public.sms_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete SMS templates"
  ON public.sms_templates
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  to_number text NOT NULL,
  from_number text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  twilio_sid text,
  error text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view SMS messages"
  ON public.sms_messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create SMS messages"
  ON public.sms_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sent_by);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false;

CREATE TRIGGER sms_templates_set_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sms_messages_set_updated_at
  BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sms_templates (name, body, is_default, created_by)
VALUES
  ('Booth thank-you', 'Thanks for stopping by TCPC booth 540 at the IRS Forum! Learn more about Tax Compliance Pro Connect: https://tax-pro-connect-hub.lovable.app', true, NULL),
  ('Follow-up after show', 'Hi from TCPC! It was great meeting you in Orlando. Ready to simplify your tax season? Reply here or visit https://tax-pro-connect-hub.lovable.app', false, NULL),
  ('ProConnect card ready', 'Your TCPC ProConnect card is activated and your profile is live. Tap your card anytime to share your link!', false, NULL)
ON CONFLICT DO NOTHING;