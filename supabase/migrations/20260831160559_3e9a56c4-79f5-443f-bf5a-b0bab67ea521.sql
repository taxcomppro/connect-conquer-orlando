ALTER TABLE public.signup_sessions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_reference text,
  ADD COLUMN IF NOT EXISTS purchase_amount_cents integer,
  ADD COLUMN IF NOT EXISTS purchase_currency text,
  ADD COLUMN IF NOT EXISTS purchase_items jsonb,
  ADD COLUMN IF NOT EXISTS purchase_confirmed_source text;

CREATE INDEX IF NOT EXISTS signup_sessions_stripe_reference_idx
  ON public.signup_sessions (stripe_reference);

CREATE INDEX IF NOT EXISTS signup_sessions_email_lower_idx
  ON public.signup_sessions (lower(email));