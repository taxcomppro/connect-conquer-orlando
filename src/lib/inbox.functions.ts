import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InboundItem = {
  id: string;
  channel: "sms" | "email";
  /** Phone number for texts, email address for email replies. */
  contact: string;
  name: string | null;
  subject: string | null;
  body: string;
  sentAt: string;
  email: string | null;
  attendeeId: string | null;
};

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Every inbound text and email reply, newest first, with the lead matched when we have one. */
export const listInbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: InboundItem[] }> => {
    const { supabase } = context;

    const [{ data: sms }, { data: emails }] = await Promise.all([
      supabase
        .from("sms_messages")
        .select("id, body, sent_at, from_number, contact_phone, lead_id")
        .eq("direction", "inbound")
        .order("sent_at", { ascending: false })
        .limit(100),
      supabase
        .from("email_messages")
        .select("id, body, subject, sent_at, contact_email, lead_id")
        .eq("direction", "inbound")
        .order("sent_at", { ascending: false })
        .limit(100),
    ]);

    const leadIds = [
      ...new Set(
        [...(sms ?? []), ...(emails ?? [])].map((m) => m.lead_id).filter((id): id is string => !!id),
      ),
    ];

    const { data: leads } = leadIds.length
      ? await supabase
          .from("leads")
          .select("id, first_name, last_name, email, phone, attendee_id")
          .in("id", leadIds)
      : { data: [] };

    const leadById = new Map((leads ?? []).map((lead) => [lead.id, lead]));
    const phoneIndex = new Map<string, (typeof leads)[number]>();
    for (const lead of leads ?? []) {
      const key = digitsOnly(lead.phone).slice(-10);
      if (key && !phoneIndex.has(key)) phoneIndex.set(key, lead);
    }

    const items: InboundItem[] = [];

    for (const message of sms ?? []) {
      const contact = message.contact_phone || message.from_number || "";
      const lead =
        (message.lead_id ? leadById.get(message.lead_id) : undefined) ??
        phoneIndex.get(digitsOnly(contact).slice(-10));
      items.push({
        id: message.id,
        channel: "sms",
        contact,
        name: lead ? [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null : null,
        subject: null,
        body: message.body,
        sentAt: message.sent_at,
        email: lead?.email ?? null,
        attendeeId: lead?.attendee_id ?? null,
      });
    }

    for (const message of emails ?? []) {
      const lead = message.lead_id ? leadById.get(message.lead_id) : undefined;
      items.push({
        id: message.id,
        channel: "email",
        contact: message.contact_email,
        name: lead ? [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null : null,
        subject: message.subject,
        body: message.body,
        sentAt: message.sent_at,
        email: message.contact_email,
        attendeeId: lead?.attendee_id ?? null,
      });
    }

    items.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return { items: items.slice(0, 150) };
  });
