CREATE OR REPLACE FUNCTION public.set_lead_outcome(_lead_id uuid, _outcome text)
RETURNS public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated public.leads;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF _outcome NOT IN ('open', 'follow_up', 'not_a_fit', 'sale_started', 'sale_closed') THEN
    RAISE EXCEPTION 'Invalid lead outcome.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.leads
  SET outcome = _outcome,
      joined_tcpc = CASE WHEN _outcome = 'sale_closed' THEN true ELSE joined_tcpc END
  WHERE id = _lead_id
  RETURNING * INTO _updated;

  IF _updated.id IS NULL THEN
    RAISE EXCEPTION 'Lead not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN _updated;
END;
$$;

REVOKE ALL ON FUNCTION public.set_lead_outcome(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_lead_outcome(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_outcome(uuid, text) TO service_role;