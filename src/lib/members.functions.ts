import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberRow = {
  userId: string;
  email: string;
  name: string;
  tier: "FREE" | "VIP" | "MARKETPLACE" | "MARKETPLACE_PLUS";
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  currentPeriodEnd: string | null;
};

/** Staff-only: the full member list from the main site, read-only. */
export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ members: MemberRow[]; error: string | null }> => {
    try {
      const { listAllMembers } = await import("@/lib/site-db.server");
      const members = await listAllMembers();
      return {
        members: members.map((m) => ({
          userId: m.userId,
          email: m.email,
          name: m.name,
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
      return {
        members: [],
        error: `Couldn't reach the membership records. ${detail}`,
      };
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
