ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'open';

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT leads_outcome_check
    CHECK (outcome IN ('open','follow_up','not_a_fit','sale_started','sale_closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS leads_outcome_idx ON public.leads (outcome);