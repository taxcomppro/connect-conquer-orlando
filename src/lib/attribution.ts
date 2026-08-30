import { supabase } from "@/integrations/supabase/client";

export type AttributionKind = "owner" | "personal" | "pooled" | "none";

export type Attribution = {
  code: string | null;
  kind: AttributionKind;
  label: string;
  detail: string;
};

/**
 * Attribution is decided by who is signed in — nobody types a code at the booth.
 * Owners are not commission-eligible, so their signups carry no affiliate code at all.
 */
export async function resolveAttribution(userId: string): Promise<Attribution> {
  const [{ data: staff }, { data: settings }] = await Promise.all([
    supabase
      .from("staff_profiles")
      .select("display_name, commission_eligible, dub_partner_key")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("booth_settings").select("pooled_dub_key").maybeSingle(),
  ]);

  if (staff && staff.commission_eligible === false) {
    return {
      code: null,
      kind: "owner",
      label: "No affiliate link — owner sale",
      detail: "Owner accounts are excluded from the commission pool, so nothing is tagged in Dub.",
    };
  }

  if (staff?.dub_partner_key) {
    return {
      code: staff.dub_partner_key,
      kind: "personal",
      label: `Personal link · ${staff.dub_partner_key}`,
      detail: "This sale is attributed to your own Dub link.",
    };
  }

  if (settings?.pooled_dub_key) {
    return {
      code: settings.pooled_dub_key,
      kind: "pooled",
      label: `Pooled booth link · ${settings.pooled_dub_key}`,
      detail: "Counts toward the shared Orlando commission pool split between the six sellers.",
    };
  }

  return {
    code: null,
    kind: "none",
    label: "No Dub link configured",
    detail: "An admin needs to set the pooled booth link in Dub settings.",
  };
}
