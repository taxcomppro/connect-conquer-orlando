import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FunnelStats = {
  /** Active (non-archived) leads captured. */
  leadsTotal: number;
  /** Active leads that have an email we can nurture. */
  leadsWithEmail: number;
  /** Leads captured in the last 7 days. */
  leadsLast7: number;
  /** Automation sends keyed by rule name. */
  ruleCounts: Record<string, number>;
  /** Most recent send per rule (ISO string). */
  ruleLastSent: Record<string, string>;
  /** Outbound message volume in the last 7 days. */
  emailsSent7: number;
  smsSent7: number;
  /** Inbound replies in the last 7 days. */
  repliesIn7: number;
  /** Email engagement in the last 7 days. */
  emailOpens7: number;
  emailClicks7: number;
  /** Distinct people who opened / clicked in the last 7 days. */
  openedPeople7: number;
  clickedPeople7: number;
};

const DAY = 24 * 60 * 60 * 1000;

/** Staff-only funnel counters, read from the CRM's own tables. */
export const getFunnelStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FunnelStats> => {
    const { supabase } = context;
    const since = new Date(Date.now() - 7 * DAY).toISOString();

    const [leads, sends, emails7, sms7, replies7, engagement7] = await Promise.all([
      supabase.from("leads").select("email, scanned_at, outcome").neq("outcome", "archived"),
      supabase.from("automation_sends").select("rule, sent_at"),
      supabase
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("sent_at", since),
      supabase
        .from("sms_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("sent_at", since),
      supabase
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .gte("sent_at", since),
      supabase
        .from("email_events")
        .select("contact_email, event_type")
        .in("event_type", ["opened", "clicked"])
        .gte("occurred_at", since),
    ]);

    const opens = (engagement7.data ?? []).filter((row) => row.event_type === "opened");
    const clicks = (engagement7.data ?? []).filter((row) => row.event_type === "clicked");
    const openedPeople = new Set(opens.map((row) => row.contact_email.toLowerCase()));
    const clickedPeople = new Set(clicks.map((row) => row.contact_email.toLowerCase()));

    const leadRows = leads.data ?? [];
    const ruleCounts: Record<string, number> = {};
    const ruleLastSent: Record<string, string> = {};
    for (const row of sends.data ?? []) {
      const rule = row.rule as string;
      ruleCounts[rule] = (ruleCounts[rule] ?? 0) + 1;
      const at = row.sent_at as string | null;
      if (at && (!ruleLastSent[rule] || at > ruleLastSent[rule])) ruleLastSent[rule] = at;
    }

    return {
      leadsTotal: leadRows.length,
      leadsWithEmail: leadRows.filter((l) => (l.email ?? "").includes("@")).length,
      leadsLast7: leadRows.filter((l) => (l.scanned_at ?? "") >= since).length,
      ruleCounts,
      ruleLastSent,
      emailsSent7: emails7.count ?? 0,
      smsSent7: sms7.count ?? 0,
      repliesIn7: replies7.count ?? 0,
      emailOpens7: opens.length,
      emailClicks7: clicks.length,
      openedPeople7: openedPeople.size,
      clickedPeople7: clickedPeople.size,
    };
  });
