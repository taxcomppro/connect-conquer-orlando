CREATE TABLE public.ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  business text,
  city text,
  state text,
  instagram text,
  facebook text,
  tiktok text,
  linkedin text,
  stage text NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied','invited','approved','registered','active','archived')),
  source text NOT NULL DEFAULT 'manual',
  tags text[] NOT NULL DEFAULT '{}',
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassadors TO authenticated;
GRANT ALL ON public.ambassadors TO service_role;
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read ambassadors" ON public.ambassadors FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff add ambassadors" ON public.ambassadors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff edit ambassadors" ON public.ambassadors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete ambassadors" ON public.ambassadors FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX ambassadors_email_idx ON public.ambassadors (lower(email));
CREATE TRIGGER ambassadors_set_updated_at BEFORE UPDATE ON public.ambassadors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ambassador_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ambassador_notes TO authenticated;
GRANT ALL ON public.ambassador_notes TO service_role;
ALTER TABLE public.ambassador_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read notes" ON public.ambassador_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff add notes" ON public.ambassador_notes FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Authors delete notes" ON public.ambassador_notes FOR DELETE TO authenticated USING (author_id = auth.uid());