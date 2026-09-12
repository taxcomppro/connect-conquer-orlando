import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OUTCOMES, type Outcome } from "@/lib/leads";

export const setLeadOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; outcome: Outcome }) => {
    if (!input?.leadId || !OUTCOMES.includes(input.outcome)) {
      throw new Error("Invalid lead outcome.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updates =
      data.outcome === "sale_closed"
        ? { outcome: data.outcome, joined_tcpc: true }
        : { outcome: data.outcome };
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .update(updates)
      .eq("id", data.leadId)
      .select("id, outcome, joined_tcpc")
      .single();

    if (error) throw new Error(error.message);
    return lead;
  });