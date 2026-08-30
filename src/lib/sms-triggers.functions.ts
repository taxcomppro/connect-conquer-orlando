import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tables } from "@/integrations/supabase/types";
import { FIELD_HUB_URL, joinUrl } from "./connect";

export type SmsTrigger = Tables<"sms_triggers">;

export const TRIGGER_EVENTS = ["lead_captured", "outcome_changed", "joined_tcpc"] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export const TRIGGER_EVENT_LABEL: Record<TriggerEvent, string> = {
  lead_captured: "Badge scanned (new lead)",
  outcome_changed: "Lead outcome set",
  joined_tcpc: "Attendee joined TCPC",
};

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") ? value.trim() : `+${digits}`;
}

export function renderTemplate(
  body: string,
  options: {
    lead: { first_name?: string | null; last_name?: string | null; company?: string | null };
    repName?: string | null;
    signupLink?: string | null;
  },
): string {
  const { lead, repName, signupLink } = options;
  const map: Record<string, string> = {
    first_name: lead.first_name?.trim() || "there",
    last_name: lead.last_name?.trim() || "",
    full_name: [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || "there",
    company: lead.company?.trim() || "",
    rep_name: repName?.trim() || "the TCPC team",
    signup_link: signupLink?.trim() || "",
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => map[key] ?? match);
}

export const listSmsTriggers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sms_triggers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { triggers: (data ?? []) as SmsTrigger[] };
  });

export const saveSmsTrigger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | undefined;
      name: string;
      event: string;
      matchOutcome?: string | null | undefined;
      templateId: string;
      enabled?: boolean | undefined;
      requireConsent?: boolean | undefined;
    }) => {
      const name = input.name.trim();
      if (!name) throw new Error("Give the rule a name.");
      if (!(TRIGGER_EVENTS as readonly string[]).includes(input.event)) {
        throw new Error("Unknown trigger event.");
      }
      if (!input.templateId) throw new Error("Pick a message template.");
      return {
        id: input.id ?? null,
        name,
        event: input.event,
        matchOutcome: input.event === "outcome_changed" ? (input.matchOutcome || null) : null,
        templateId: input.templateId,
        enabled: input.enabled !== false,
        requireConsent: input.requireConsent !== false,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      name: data.name,
      event: data.event,
      match_outcome: data.matchOutcome,
      template_id: data.templateId,
      enabled: data.enabled,
      require_consent: data.requireConsent,
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("sms_triggers")
        .update(row)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { trigger: updated as SmsTrigger };
    }

    const { data: inserted, error } = await supabase
      .from("sms_triggers")
      .insert({ ...row, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { trigger: inserted as SmsTrigger };
  });

export const deleteSmsTrigger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sms_triggers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * Fires any enabled auto-send rules that match this event for a lead.
 * Safe to call from anywhere — it never throws on a skipped or failed send.
 */
export const runSmsTriggers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; event: string; outcome?: string | null | undefined }) => ({
    leadId: input.leadId,
    event: input.event,
    outcome: input.outcome ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sent: string[] = [];
    const skipped: string[] = [];

    const { data: triggers } = await supabase
      .from("sms_triggers")
      .select("*, sms_templates(body)")
      .eq("event", data.event)
      .eq("enabled", true);

    if (!triggers || triggers.length === 0) return { sent, skipped };

    const { data: lead } = await supabase
      .from("leads")
      .select("id, attendee_id, phone, first_name, last_name, company, email, sms_consent, outcome")
      .eq("id", data.leadId)
      .maybeSingle();

    if (!lead) return { sent, skipped: ["lead_not_found"] };
    if (!lead.phone) return { sent, skipped: ["no_phone"] };

    const { data: staff } = await supabase
      .from("staff_profiles")
      .select("display_name, commission_eligible, dub_partner_key")
      .eq("id", userId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from("booth_settings")
      .select("pooled_dub_key")
      .maybeSingle();

    const outcome = data.outcome ?? lead.outcome;

    // Resolve or create a signup session so templates can include a welcome link.
    let signupSessionId: string | null = null;
    const { data: existingSession } = await supabase
      .from("signup_sessions")
      .select("id")
      .eq("lead_id", lead.id)
      .neq("stage", "void")
      .maybeSingle();

    if (existingSession) {
      signupSessionId = existingSession.id;
    } else {
      let dubCode: string | null = null;
      let dubAttribution = "none";
      if (staff?.commission_eligible === false) {
        dubAttribution = "owner";
      } else if (staff?.dub_partner_key) {
        dubCode = staff.dub_partner_key;
        dubAttribution = "personal";
      } else if (settings?.pooled_dub_key) {
        dubCode = settings.pooled_dub_key;
        dubAttribution = "pooled";
      }

      const { data: newSession, error: sessionError } = await supabase
        .from("signup_sessions")
        .insert({
          lead_id: lead.id,
          attendee_id: lead.attendee_id,
          rep_user_id: userId,
          rep_name: staff?.display_name ?? null,
          dub_code: dubCode,
          dub_attribution: dubAttribution,
          full_name: [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || null,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          source: "sms_trigger",
          stage: "scanned",
        })
        .select("id")
        .single();

      if (!sessionError && newSession) {
        signupSessionId = newSession.id;
      }
    }

    const signupLink = signupSessionId ? joinUrl(FIELD_HUB_URL, signupSessionId) : "";

    for (const trigger of triggers) {
      if (trigger.event === "outcome_changed" && trigger.match_outcome && trigger.match_outcome !== outcome) {
        skipped.push(trigger.id);
        continue;
      }
      if (trigger.require_consent && !lead.sms_consent) {
        skipped.push(trigger.id);
        continue;
      }

      const templateBody = (trigger as unknown as { sms_templates: { body: string } | null }).sms_templates?.body;
      if (!templateBody) {
        skipped.push(trigger.id);
        continue;
      }

      // Already auto-sent this rule to this lead?
      const { data: existing } = await supabase
        .from("sms_messages")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("trigger_id", trigger.id)
        .maybeSingle();
      if (existing) {
        skipped.push(trigger.id);
        continue;
      }

      const body = renderTemplate(templateBody, {
        lead,
        repName: staff?.display_name ?? null,
        signupLink,
      });
      const to = normalizePhone(lead.phone);

      try {
        const { sendSms } = await import("./sms.server");
        const result = await sendSms({ to, body });
        await supabase.from("sms_messages").insert({
          lead_id: lead.id,
          to_number: result.to,
          from_number: result.from,
          body: result.body,
          status: result.status,
          twilio_sid: result.sid || null,
          sent_by: userId,
          trigger_id: trigger.id,
        });
        sent.push(trigger.id);
      } catch (err) {
        await supabase.from("sms_messages").insert({
          lead_id: lead.id,
          to_number: to,
          from_number: "auto",
          body,
          status: "failed",
          error: err instanceof Error ? err.message : "Send failed",
          sent_by: userId,
          trigger_id: trigger.id,
        });
        skipped.push(trigger.id);
      }
    }

    return { sent, skipped };
  });
