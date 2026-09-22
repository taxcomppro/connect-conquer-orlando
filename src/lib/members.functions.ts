import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberRow = {
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  tier: "FREE" | "VIP" | "MARKETPLACE" | "MARKETPLACE_PLUS";
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  currentPeriodEnd: string | null;
};

function isMemberTier(tier: string): tier is MemberRow["tier"] {
  return tier === "FREE" || tier === "VIP" || tier === "MARKETPLACE" || tier === "MARKETPLACE_PLUS";
}

/** Staff-only: the full member list from the main site, read-only. */
export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ members: MemberRow[]; error: string | null }> => {
    try {
      const { listAllMembers } = await import("@/lib/site-db.server");
      const members = await listAllMembers();
      const rows = members.map((m) => ({
        user_id: m.userId,
        email: m.email,
        name: m.name,
        phone: m.phone ?? null,
        tier: m.tier,
        subscription_status: m.subscriptionStatus,
        subscription_plan: m.subscriptionPlan,
        current_period_end: m.currentPeriodEnd,
        source_created_at: m.createdAt,
        synced_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: cacheError } = await supabaseAdmin
          .from("site_members_cache")
          .upsert(rows, { onConflict: "user_id" });
        if (cacheError) console.error("[listMembers] failed to refresh local cache:", cacheError);
      }
      return {
        members: members.map((m) => ({
          userId: m.userId,
          email: m.email,
          name: m.name,
          phone: m.phone ?? null,
          tier: m.tier,
          subscriptionStatus: m.subscriptionStatus,
          subscriptionPlan: m.subscriptionPlan,
          currentPeriodEnd: m.currentPeriodEnd,
        })),
        error: null,
      };
    } catch (error) {
      // Log the real failure server-side so it's diagnosable in runtime logs,
      // then return a readable message to the client instead of a bare 500.
      console.error("[listMembers] membership lookup failed:", error);
      const detail =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : typeof error === "string"
            ? error
            : JSON.stringify(error);
      const { data: cached, error: cacheError } = await context.supabase
        .from("site_members_cache")
        .select(
          "user_id,email,name,phone,tier,subscription_status,subscription_plan,current_period_end",
        )
        .order("source_created_at", { ascending: false });
      if (!cacheError && cached && cached.length > 0) {
        return {
          members: cached.flatMap((m) =>
            isMemberTier(m.tier)
              ? [{
                  userId: m.user_id,
                  email: m.email,
                  name: m.name,
                  phone: m.phone,
                  tier: m.tier,
                  subscriptionStatus: m.subscription_status,
                  subscriptionPlan: m.subscription_plan,
                  currentPeriodEnd: m.current_period_end,
                }]
              : [],
          ),
          error: null,
        };
      }
      return { members: [], error: `Couldn't reach the membership records. ${detail}` };
    }
  });

/** Staff-only: Marketplace members who have never posted a listing. */
export const listUnactivatedSellers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ members: MemberRow[]; error: string | null }> => {
    try {
      const { listUnactivatedSellers: query } = await import("@/lib/site-db.server");
      const members = await query();
      return {
        members: members.map((m) => ({
          userId: m.userId,
          email: m.email,
          name: m.name,
          phone: m.phone ?? null,
          tier: m.tier,
          subscriptionStatus: m.subscriptionStatus,
          subscriptionPlan: m.subscriptionPlan,
          currentPeriodEnd: m.currentPeriodEnd,
        })),
        error: null,
      };
    } catch (error) {
      console.error("[listUnactivatedSellers] lookup failed:", error);
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return { members: [], error: `Couldn't reach the membership records. ${detail}` };
    }
  });
