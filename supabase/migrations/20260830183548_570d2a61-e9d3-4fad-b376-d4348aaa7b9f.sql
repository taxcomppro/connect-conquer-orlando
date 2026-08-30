CREATE TABLE public.sms_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event text NOT NULL CHECK (event IN ('lead_captured','outcome_changed','joined_tcpc')),
  match_outcome text,
  template_id uuid NOT NULL REFERENCES public.sms_templates(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  require_consent boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_triggers TO authenticated;
GRANT ALL ON public.sms_triggers TO service_role;

ALTER TABLE public.sms_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sms triggers"
  ON public.sms_triggers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create sms triggers"
  ON public.sms_triggers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sms triggers"
  ON public.sms_triggers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sms triggers"
  ON public.sms_triggers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER sms_triggers_set_updated_at
  BEFORE UPDATE ON public.sms_triggers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sms_messages
  ADD COLUMN trigger_id uuid REFERENCES public.sms_triggers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX sms_messages_lead_trigger_unique
  ON public.sms_messages (lead_id, trigger_id)
  WHERE trigger_id IS NOT NULL;