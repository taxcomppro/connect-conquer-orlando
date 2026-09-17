import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AutomationResult } from "@/lib/automation-runs.server";

export const AUTOMATION_RULES = [
  { key: "lead_signup_nudge", label: "Create Your Free Account nudge" },
  { key: "upgrade_followup", label: "Upgrade offer follow-up" },
  { key: "welcome_on_upgrade", label: "Welcome after upgrade" },
] as const;

export type AutomationRuleKey = (typeof AUTOMATION_RULES)[number]["key"];

/** Runs one funnel automation immediately, for a signed-in staff member. */
export const runAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rule: AutomationRuleKey }) => {
    if (!AUTOMATION_RULES.some((r) => r.key === input.rule)) {
      throw new Error("Unknown automation.");
    }
    return { rule: input.rule };
  })
  .handler(async ({ data }): Promise<AutomationResult> => {
    const runs = await import("@/lib/automation-runs.server");
    if (data.rule === "lead_signup_nudge") return runs.runLeadSignupNudge();
    if (data.rule === "upgrade_followup") return runs.runUpgradeFollowup();
    return runs.runWelcomeOnUpgrade();
  });
