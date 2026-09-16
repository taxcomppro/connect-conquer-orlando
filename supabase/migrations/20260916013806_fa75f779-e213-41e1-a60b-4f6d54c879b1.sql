REVOKE ALL ON FUNCTION public.get_public_join_session(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.submit_public_connect_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, text[],
  boolean, boolean, boolean, text, text
) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.get_public_join_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_connect_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, text[],
  boolean, boolean, boolean, text, text
) TO service_role;