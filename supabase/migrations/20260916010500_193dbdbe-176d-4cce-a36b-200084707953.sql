CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view email templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can create email templates"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can update email templates"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email templates"
  ON public.email_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();