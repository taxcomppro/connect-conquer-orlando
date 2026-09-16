CREATE TABLE public.automation_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule text NOT NULL,
  contact_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_sends_rule_email_unique UNIQUE (rule, contact_email)
);

GRANT SELECT ON public.automation_sends TO authenticated;
GRANT ALL ON public.automation_sends TO service_role;

ALTER TABLE public.automation_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view automation sends"
  ON public.automation_sends FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX automation_sends_rule_idx ON public.automation_sends (rule);