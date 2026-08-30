ALTER TABLE public.booth_settings
  ADD COLUMN IF NOT EXISTS dub_group_id text;

UPDATE public.booth_settings
  SET dub_group_id = 'grp_1M14ZGDQKCRBKM2FZ6SP7YT8H'
  WHERE id = true;