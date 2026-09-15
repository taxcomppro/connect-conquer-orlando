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
      return {
        members: [],
        error: error instanceof Error ? error.message : "Couldn't reach the membership records.",
      };
    }
  });
