-- Trigger-only functions: never callable through the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.normalize_approved_staff_email() FROM anon, authenticated, public;

-- Role check: signed-in users only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Intentionally public (customer booth signup on their own device)
GRANT EXECUTE ON FUNCTION public.get_public_join_session(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_connect_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, text[],
  boolean, boolean, boolean, text, text
) TO anon, authenticated;