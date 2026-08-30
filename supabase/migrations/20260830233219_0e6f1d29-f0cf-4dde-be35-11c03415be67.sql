-- 1. Drop the SECURITY DEFINER view; public profiles are served server-side
DROP VIEW IF EXISTS public.public_connect_profiles;

-- 2. Revoke execute on internal trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- 3. signup_sessions: only the owning rep or an admin may update
DROP POLICY IF EXISTS "Staff update signup sessions" ON public.signup_sessions;
CREATE POLICY "Owning rep or admin update signup sessions"
ON public.signup_sessions FOR UPDATE TO authenticated
USING (auth.uid() = rep_user_id OR rep_user_id IS NULL OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = rep_user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. connect_profiles: scope insert/update to sessions owned by the acting rep
DROP POLICY IF EXISTS "Staff create connect profiles" ON public.connect_profiles;
CREATE POLICY "Owning rep or admin create connect profiles"
ON public.connect_profiles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.signup_sessions s
    WHERE s.id = signup_session_id AND s.rep_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff update connect profiles" ON public.connect_profiles;
CREATE POLICY "Owning rep or admin update connect profiles"
ON public.connect_profiles FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.signup_sessions s
    WHERE s.id = signup_session_id AND s.rep_user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.signup_sessions s
    WHERE s.id = signup_session_id AND s.rep_user_id = auth.uid()
  )
);

-- 5. card_tokens: issuer or admin only
DROP POLICY IF EXISTS "Staff create card tokens" ON public.card_tokens;
CREATE POLICY "Owning rep or admin create card tokens"
ON public.card_tokens FOR INSERT TO authenticated
WITH CHECK (
  issued_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.signup_sessions s
      WHERE s.id = signup_session_id AND s.rep_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Staff update card tokens" ON public.card_tokens;
CREATE POLICY "Issuer or admin update card tokens"
ON public.card_tokens FOR UPDATE TO authenticated
USING (issued_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (issued_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
