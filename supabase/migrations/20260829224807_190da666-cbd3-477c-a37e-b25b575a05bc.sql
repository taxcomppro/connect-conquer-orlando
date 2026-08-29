GRANT SELECT ON public.connect_profiles TO anon;
CREATE POLICY "Public view published profiles"
ON public.connect_profiles
FOR SELECT
TO anon
USING (published = true);