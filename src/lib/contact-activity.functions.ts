import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MemberRow } from "@/lib/members.functions";

export type ActivityKind = "email" | "sms" | "lead" | "signup" | "membership";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  status: string | null;
  error: string | null;
  at: string;
};

export type ContactProfile = {
  email: string;
  name: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  leadId: string | null;
  attendeeId: string | null;
  outcome: string | null;
  joinedTcpc: boolean | null;
  scannedAt: string | null;
  member:
    | (MemberRow & { createdAt: string | null; subscriptionUpdatedAt: string | null })
    | null;
  memberError: string | null;
};

const SIGNUP_EVENT_LABEL: Record<string, string> = {
  PROFILE_CREATED: "Created their Connect profile",
  SIGNUP_SENT: "Signup link sent",
  MEMBERSHIP_CONFIRMED: "Membership confirmed",
  CARD_ISSUED: "Connect card issued",
  PURCHASE_CONFIRMED: "Purchase confirmed",
};

/**
 * Everything known about one contact, keyed by email: their Field Hub lead
 * record, main-site membership status, booth signup history and every text
 * or email ever sent — merged into a single newest-first timeline.
 */
export const getContactActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email?: string | null; leadId?: string | null }) => {
    const email = (input.email ?? "").trim().toLowerCase();
    if (!email && !input.leadId) throw new Error("An email or lead is required.");
    return { email: email || null, leadId: input.leadId ?? null };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ profile: ContactProfile; timeline: ActivityEntry[] }> => {
      const { supabase } = context;
      const timeline: ActivityEntry[] = [];

      // Field Hub lead record (may not exist for site-only members).
      let lead: Record<string, any> | null = null;
      if (data.leadId) {
        const { data: row } = await supabase
          .from("leads")
          .select("*")
          .eq("id", data.leadId)
          .maybeSingle();
        lead = row ?? null;
      }
      if (!lead && data.email) {
        const { data: rows } = await supabase
          .from("leads")
          .select("*")
          .ilike("email", data.email)
          .order("scanned_at", { ascending: false })
          .limit(1);
        lead = rows?.[0] ?? null;
      }

      const email = data.email ?? (lead?.["email"] ?? "").toLowerCase();

      // Main-site membership status.
      let member: ContactProfile["member"] = null;
      let memberError: string | null = null;
      if (email) {
        try {
          const { findSiteMemberByEmail } = await import("@/lib/site-db.server");
          const found = await findSiteMemberByEmail(email);
          if (found) {
            member = {
              userId: found.userId,
              email: found.email,
              name: found.name,
              tier: found.tier,
              subscriptionStatus: found.subscriptionStatus,
              subscriptionPlan: found.subscriptionPlan,
              currentPeriodEnd: found.currentPeriodEnd,
              createdAt: found.createdAt,
              subscriptionUpdatedAt: found.subscriptionUpdatedAt,
            };
          }
        } catch (error) {
          console.error("[getContactActivity] membership lookup failed:", error);
          memberError =
            error instanceof Error ? error.message : "Couldn't reach the membership records.";
        }
      }

      if (lead) {
        timeline.push({
          id: `lead:${lead["id"]}`,
          kind: "lead",
          title: lead["attendee_id"]?.startsWith("manual-")
            ? "Added by the team"
            : "Badge scanned at the booth",
          detail: [lead["company"], lead["title"]].filter(Boolean).join(" · ") || null,
          status: lead["outcome"] ?? null,
          error: null,
          at: lead["scanned_at"],
        });
      }

      if (member?.createdAt) {
        timeline.push({
          id: `member:${member.userId}`,
          kind: "membership",
          title: "Created a TaxCompPro account",
          detail: member.name || member.email,
          status: "FREE",
          error: null,
          at: member.createdAt,
        });
      }

      if (member && member.tier !== "FREE" && member.subscriptionUpdatedAt) {
        timeline.push({
          id: `tier:${member.userId}`,
          kind: "membership",
          title: `Membership on ${member.tier.replace("MARKETPLACE_PLUS", "MARKETPLACE+")}`,
          detail: member.subscriptionPlan
            ? `Plan ${member.subscriptionPlan}${
                member.currentPeriodEnd
                  ? ` · renews ${new Date(member.currentPeriodEnd).toLocaleDateString()}`
                  : ""
              }`
            : null,
          status: member.subscriptionStatus,
          error: null,
          at: member.subscriptionUpdatedAt,
        });
      }

      // Booth signup sessions + their events.
      let sessionIds: string[] = [];
      {
        let query = supabase.from("signup_sessions").select("*");
        query = lead
          ? query.eq("lead_id", lead["id"])
          : query.ilike("email", email || "never-matches");
        const { data: sessions } = await query.order("created_at", { ascending: false });
        for (const session of sessions ?? []) {
          sessionIds.push(session.id);
          timeline.push({
            id: `session:${session.id}`,
            kind: "signup",
            title: "Signup session started",
            detail: session.rep_name ? `With ${session.rep_name}` : null,
            status: session.stage,
            error: null,
            at: session.created_at,
          });
          if (session.membership_confirmed_at) {
            timeline.push({
              id: `session-confirmed:${session.id}`,
              kind: "membership",
              title: "Membership confirmed at the booth",
              detail: session.membership_plan ?? session.membership_ref ?? null,
              status: "confirmed",
              error: null,
              at: session.membership_confirmed_at,
            });
          }
        }
      }

      if (sessionIds.length) {
        const { data: events } = await supabase
          .from("signup_events")
          .select("*")
          .in("signup_session_id", sessionIds)
          .order("created_at", { ascending: false });
        for (const event of events ?? []) {
          timeline.push({
            id: `event:${event.id}`,
            kind: "signup",
            title: SIGNUP_EVENT_LABEL[event.event_type] ?? event.event_type,
            detail: event.actor_label ? `By ${event.actor_label}` : null,
            status: null,
            error: null,
            at: event.created_at,
          });
        }
      }

      // Texts.
      if (lead) {
        const { data: sms } = await supabase
          .from("sms_messages")
          .select("*")
          .eq("lead_id", lead["id"])
          .order("sent_at", { ascending: false });
        for (const message of sms ?? []) {
          timeline.push({
            id: `sms:${message.id}`,
            kind: "sms",
            title: `Text to ${message.to_number}`,
            detail: message.body,
            status: message.status,
            error: message.error,
            at: message.sent_at,
          });
        }
      }

      // Emails.
      if (email) {
        const { data: emails } = await supabase
          .from("email_messages")
          .select("*")
          .ilike("contact_email", email)
          .order("sent_at", { ascending: false });
        for (const message of emails ?? []) {
          timeline.push({
            id: `email:${message.id}`,
            kind: "email",
            title: message.subject || `Email to ${message.to_email}`,
            detail: message.body,
            status: message.status,
            error: message.error,
            at: message.sent_at,
          });
        }
      }

      timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      const profile: ContactProfile = {
        email: email || "",
        name:
          member?.name ||
          [lead?.["first_name"], lead?.["last_name"]].filter(Boolean).join(" ").trim() ||
          email ||
          "Contact",
        phone: lead?.["phone"] ?? null,
        company: lead?.["company"] ?? null,
        title: lead?.["title"] ?? null,
        leadId: lead?.["id"] ?? null,
        attendeeId: lead?.["attendee_id"] ?? null,
        outcome: lead?.["outcome"] ?? null,
        joinedTcpc: lead?.["joined_tcpc"] ?? null,
        scannedAt: lead?.["scanned_at"] ?? null,
        member,
        memberError,
      };

      return { profile, timeline };
    },
  );
