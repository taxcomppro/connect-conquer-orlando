DROP POLICY "Public view published profiles" ON public.connect_profiles;
REVOKE SELECT ON public.connect_profiles FROM anon;

CREATE OR REPLACE VIEW public.public_connect_profiles AS
SELECT
  slug,
  display_name,
  credential,
  title,
  company,
  CASE WHEN show_location THEN city ELSE NULL END AS city,
  CASE WHEN show_location THEN state ELSE NULL END AS state,
  CASE WHEN show_email THEN email ELSE NULL END AS email,
  CASE WHEN show_phone THEN phone ELSE NULL END AS phone,
  website,
  bio,
  services
FROM public.connect_profiles
WHERE published = true;

GRANT SELECT ON public.public_connect_profiles TO anon;