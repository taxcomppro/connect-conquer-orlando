/**
 * Records Resend delivery/engagement events (delivered, opened, clicked,
 * bounced, complained) against the email_messages row they belong to, so
 * opens and clicks show up on each contact's activity thread and in the
 * Funnel counters.
 */

const TRACKED: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
};

export function isTrackedResendEvent(type: string): boolean {
  return Boolean(TRACKED[type]);
}

/** Verifies a Resend webhook against either configured signing secret. */
export async function verifyResendWebhook(
  rawBody: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const { Webhook } = await import("svix");
  const secrets = [
    process.env["RESEND_WEBHOOK_SECRET"],
    process.env["RESEND_EVENTS_WEBHOOK_SECRET"],
  ].filter((value): value is string => Boolean(value));

  for (const secret of secrets) {
    try {
      new Webhook(secret).verify(rawBody, headers);
      return true;
    } catch {
      // try the next secret
    }
  }
  return false;
}

export async function recordResendEvent(event: {
  type: string;
  created_at?: string;
  data?: Record<string, any>;
}): Promise<{ recorded: boolean; reason?: string }> {
  const eventType = TRACKED[event.type];
  if (!eventType) return { recorded: false, reason: "untracked" };

  const data = event.data ?? {};
  const providerId: string | null = data["email_id"] ?? null;
  const recipients: string[] = Array.isArray(data["to"]) ? data["to"] : data["to"] ? [data["to"]] : [];
  const contactEmail = (recipients[0] ?? "").trim().toLowerCase();
  if (!contactEmail) return { recorded: false, reason: "no_recipient" };

  const click = data["click"] ?? {};
  const open = data["open"] ?? {};
  const occurredAt =
    click["timestamp"] ?? open["timestamp"] ?? event.created_at ?? new Date().toISOString();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let emailMessageId: string | null = null;
  if (providerId) {
    const { data: message } = await supabaseAdmin
      .from("email_messages")
      .select("id")
      .eq("provider_id", providerId)
      .maybeSingle();
    emailMessageId = message?.id ?? null;
  }

  const { error } = await supabaseAdmin.from("email_events").insert({
    email_message_id: emailMessageId,
    provider_id: providerId,
    contact_email: contactEmail,
    event_type: eventType,
    link_url: click["link"] ?? null,
    user_agent: click["userAgent"] ?? open["userAgent"] ?? null,
    occurred_at: occurredAt,
  });

  // Duplicate deliveries are expected — Resend retries.
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    console.error("[resend-events] insert failed:", error.message);
    return { recorded: false, reason: "insert_failed" };
  }

  return { recorded: true };
}
