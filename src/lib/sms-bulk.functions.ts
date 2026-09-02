import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderTemplate } from "./sms-triggers.functions";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") ? value.trim() : `+${digits}`;
}

export type BulkSmsResult = {
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ name: string; reason: string }>;
};

/**
 * Sends one message to many leads. Any signed-in booth staff member can text
 * any lead. Leads without a phone (or without consent when required) are
 * skipped, and every send is logged in sms_messages.
 */
export const sendBulkSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      leadIds: string[];
      body: string;
      requireConsent?: boolean | undefined;
      skipAlreadyTexted?: boolean | undefined;
    }) => {
      const body = input.body.trim();
      if (!body) throw new Error("Write a message first.");
      if (body.length > 1600) throw new Error("Message is too long (max 1600 characters).");
      if (!input.leadIds?.length) throw new Error("No leads selected.");
      return {
        leadIds: input.leadIds.slice(0, 500),
        body,
        requireConsent: input.requireConsent !== false,
        skipAlreadyTexted: Boolean(input.skipAlreadyTexted),
      };
    },
  )
  .handler(async ({ data, context }): Promise<BulkSmsResult> => {
    const { supabase, userId } = context;

    const { data: staff } = await supabase
      .from("staff_profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, first_name, last_name, company, phone, sms_consent, scanned_by")
      .in("id", data.leadIds);
    if (error) throw new Error(error.message);

    const result: BulkSmsResult = { sent: 0, failed: 0, skipped: 0, errors: [] };
    const { sendSms } = await import("./sms.server");

    for (const lead of leads ?? []) {
      const name =
        [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || "Lead";

      if (!lead.phone) {
        result.skipped += 1;
        continue;
      }
      if (data.requireConsent && !lead.sms_consent) {
        result.skipped += 1;
        continue;
      }

      if (data.skipAlreadyTexted) {
        const { count } = await supabase
          .from("sms_messages")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", lead.id)
          .eq("status", "queued");
        if ((count ?? 0) > 0) {
          result.skipped += 1;
          continue;
        }
      }

      const body = renderTemplate(data.body, {
        lead,
        repName: staff?.display_name ?? null,
        signupLink: "",
      });
      const to = normalizePhone(lead.phone);

      try {
        const sendResult = await sendSms({
          to,
          body,
          lovableApiKey: process.env["LOVABLE_API_KEY"] ?? "",
          twilioApiKey: process.env["TWILIO_API_KEY"] ?? "",
          from: process.env["TWILIO_FROM_NUMBER"],
        });
        await supabase.from("sms_messages").insert({
          lead_id: lead.id,
          to_number: sendResult.to,
          from_number: sendResult.from,
          body: sendResult.body,
          status: sendResult.status,
          twilio_sid: sendResult.sid || null,
          sent_by: userId,
        });
        result.sent += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Send failed";
        await supabase.from("sms_messages").insert({
          lead_id: lead.id,
          to_number: to,
          from_number: "bulk",
          body,
          status: "failed",
          error: reason,
          sent_by: userId,
        });
        result.failed += 1;
        if (result.errors.length < 5) result.errors.push({ name, reason });
      }
    }

    return result;
  });
