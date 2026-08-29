-- Card issuance is now orchestrated by a Field Hub server function that first
-- receives confirmation from ProConnect. Prevent browser clients from flipping
-- CARD_ISSUED directly through the phase-one database function.
REVOKE EXECUTE ON FUNCTION public.issue_proconnect_card(uuid) FROM authenticated;
