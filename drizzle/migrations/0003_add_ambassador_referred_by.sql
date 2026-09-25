ALTER TABLE public.ambassadors ADD COLUMN referred_by text;
COMMENT ON COLUMN public.ambassadors.referred_by IS 'Name of the person who referred this ambassador (from the application form).';