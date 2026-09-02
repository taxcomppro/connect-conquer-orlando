import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tables } from "@/integrations/supabase/types";

export type SmsTemplate = Tables<"sms_templates">;
export type SmsMessage = Tables<"sms_messages">;

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.startsWith("+") && digits.length > 1) return digits;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export const listSmsTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sms_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const getLeadSmsHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: messages, error } = await context.supabase
      .from("sms_messages")
      .select("*")
      .eq("lead_id", data.leadId)
      .order("sent_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { messages: messages ?? [] };
  });

export const sendLeadSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      leadId: string;
      to: string;
      body: string;
      recordConsent?: boolean | undefined;
    }) => {
      const to = input.to.trim();
      const body = input.body.trim();
      if (!to) throw new Error("Phone number is required.");
      if (!body) throw new Error("Message body is required.");
      if (body.length > 1600) throw new Error("Message is too long (max 1600 characters).");
      return {
        leadId: input.leadId,
        to,
        body,
        recordConsent: Boolean(input.recordConsent),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, phone, scanned_by")
      .eq("id", data.leadId)
      .maybeSingle();

    if (leadError) throw new Error(leadError.message);
    if (!lead) throw new Error("Lead not found.");

    // Any signed-in booth staff member can text any lead.


    const normalizedTo = normalizePhone(data.to);

    const { sendSms } = await import("./sms.server");
    const result = await sendSms({ to: normalizedTo, body: data.body });

    const { error: insertError } = await supabase.from("sms_messages").insert({
      lead_id: data.leadId,
      to_number: result.to,
      from_number: result.from,
      body: result.body,
      status: result.status,
      twilio_sid: result.sid || null,
      sent_by: userId,
    });

    if (insertError) throw new Error(insertError.message);

    if (data.recordConsent) {
      await supabase.from("leads").update({ sms_consent: true }).eq("id", data.leadId);
    }

    return { success: true, sid: result.sid, status: result.status };
  });

export const saveSmsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { name: string; body: string; isDefault?: boolean | undefined }) => {
      const name = input.name.trim();
      const body = input.body.trim();
      if (!name) throw new Error("Template name is required.");
      if (!body) throw new Error("Template body is required.");
      if (body.length > 1600) throw new Error("Template body is too long.");
      return { name, body, isDefault: Boolean(input.isDefault) };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("sms_templates")
      .insert({
        name: data.name,
        body: data.body,
        is_default: data.isDefault,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { template: inserted as SmsTemplate };
  });
