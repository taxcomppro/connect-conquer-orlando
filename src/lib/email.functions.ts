import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tables } from "@/integrations/supabase/types";

export type EmailMessage = Tables<"email_messages">;
export type SmsMessageRow = Tables<"sms_messages">;

export type BulkEmailResult = {
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ name: string; reason: string }>;
};

export type ThreadEntry = {
  id: string;
  channel: "sms" | "email";
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  target: string;
  sentAt: string;
};

function fillPlaceholders(text: string, contact: { name?: string | null; email: string }): string {
  const parts = (contact.name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "there";
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*last_name\s*\}\}/gi, last)
    .replace(/\{\{\s*full_name\s*\}\}/gi, (contact.name ?? "").trim() || first)
    .replace(/\{\{\s*email\s*\}\}/gi, contact.email);
}

/**
 * Sends one email to many contacts through Resend and logs every attempt in
 * email_messages. Contacts are keyed by email — a Field Hub lead id is
 * optional, since many membership-board contacts were never booth leads.
 */
export const sendBulkEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      contacts: Array<{ email: string; name?: string | null; leadId?: string | null }>;
      subject: string;
      body: string;
    }) => {
      const subject = input.subject.trim();
      const body = input.body.trim();
      if (!subject) throw new Error("Add a subject line first.");
      if (!body) throw new Error("Write a message first.");
      if (!input.contacts?.length) throw new Error("No contacts selected.");
      return { contacts: input.contacts.slice(0, 500), subject, body };
    },
  )
  .handler(async ({ data, context }): Promise<BulkEmailResult> => {
    const { supabase, userId } = context;
    const { sendEmail, textToHtml, DEFAULT_FROM } = await import("./resend.server");

    const result: BulkEmailResult = { sent: 0, failed: 0, skipped: 0, errors: [] };

    for (const contact of data.contacts) {
      const email = (contact.email ?? "").trim();
      const label = (contact.name ?? "").trim() || email || "Contact";

      if (!email || !email.includes("@")) {
        result.skipped += 1;
        continue;
      }

      const subject = fillPlaceholders(data.subject, { name: contact.name, email });
      const body = fillPlaceholders(data.body, { name: contact.name, email });

      try {
        const sent = await sendEmail({
          to: email,
          subject,
          text: body,
          html: textToHtml(body),
        });
        await supabase.from("email_messages").insert({
          lead_id: contact.leadId ?? null,
          contact_email: email,
          to_email: sent.to,
          from_email: sent.from,
          subject,
          body,
          status: "sent",
          provider_id: sent.id || null,
          sent_by: userId,
        });
        result.sent += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Couldn't send the email.";
        result.failed += 1;
        result.errors.push({ name: label, reason });
        await supabase.from("email_messages").insert({
          lead_id: contact.leadId ?? null,
          contact_email: email,
          to_email: email,
          from_email: DEFAULT_FROM,
          subject,
          body,
          status: "failed",
          error: reason,
          sent_by: userId,
        });
      }
    }

    return result;
  });

/** Combined SMS + email history for one contact, newest first. */
export const getContactThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email?: string | null; leadId?: string | null }) => ({
    email: (input.email ?? "").trim().toLowerCase() || null,
    leadId: input.leadId ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ entries: ThreadEntry[] }> => {
    const { supabase } = context;
    const entries: ThreadEntry[] = [];

    if (data.leadId) {
      const { data: sms } = await supabase
        .from("sms_messages")
        .select("*")
        .eq("lead_id", data.leadId)
        .order("sent_at", { ascending: false });
      for (const message of sms ?? []) {
        entries.push({
          id: message.id,
          channel: "sms",
          subject: null,
          body: message.body,
          status: message.status,
          error: message.error,
          target: message.to_number,
          sentAt: message.sent_at,
        });
      }
    }

    if (data.email || data.leadId) {
      let query = supabase.from("email_messages").select("*");
      query = data.email
        ? query.ilike("contact_email", data.email)
        : query.eq("lead_id", data.leadId!);
      const { data: emails } = await query.order("sent_at", { ascending: false });
      for (const message of emails ?? []) {
        entries.push({
          id: message.id,
          channel: "email",
          subject: message.subject,
          body: message.body,
          status: message.status,
          error: message.error,
          target: message.to_email,
          sentAt: message.sent_at,
        });
      }
    }

    entries.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return { entries };
  });
