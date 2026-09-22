CREATE TABLE public.site_members_cache (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('FREE', 'VIP', 'MARKETPLACE', 'MARKETPLACE_PLUS')),
  subscription_status TEXT,
  subscription_plan TEXT,
  current_period_end TIMESTAMPTZ,
  source_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_members_cache TO authenticated;
GRANT ALL ON public.site_members_cache TO service_role;

ALTER TABLE public.site_members_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read cached site members"
ON public.site_members_cache
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE INDEX site_members_cache_tier_idx ON public.site_members_cache (tier);
CREATE INDEX site_members_cache_email_lower_idx ON public.site_members_cache (lower(email));