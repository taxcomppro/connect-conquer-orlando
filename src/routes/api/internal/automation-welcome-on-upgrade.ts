import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth } from "@/lib/site-conversions.server";

/**
 * Funnel stage 5: upgrade detected → welcome confirmation.
 *
 * Both the Stripe webhook and the site-db sync job already mark a
 * signup_sessions row as membership_confirmed the moment someone
 * upgrades — this job just watches for that and sends a welcome
 * email, once per contact ever. Kept as its own poll (rather than
 * inserted into the webhook/sync code directly) so it can't
 * interfere with the conversion tracking those already handle.
 *
 * Triggered by Vercel Cron (see vercel.json), every 15 minutes.
 * GET/POST /api/internal/automation-welcome-on-upgrade
 */

const RULE = "welcome_on_upgrade";

async function run(): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail, DEFAULT_FROM } = await import("@/lib/resend.server");
  const { fillAutomationPlaceholders, htmlToPlainText } = await import("@/lib/automation.server");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("signup_sessions")
    .select("email, full_name, lead_id, membership_plan")
    .not("membership_confirmed_at", "is", null)
    .gte("membership_confirmed_at", since);

  if (sessionsError) {
    return Response.json(
      { error: "signup_sessions_query_failed", detail: sessionsError.message },
      { status: 500 },
    );
  }

  const { data: template } = await supabaseAdmin
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", "Welcome to Paid Membership")
    .maybeSingle();

  if (!template) {
    return Response.json({ error: "template_missing" }, { status: 500 });
  }

  let sent = 0;
  for (const session of sessions ?? []) {
    const email = (session.email ?? "").trim().toLowerCase();
    if (!email) continue;

    const { data: already } = await supabaseAdmin
      .from("automation_sends")
      .select("id")
      .eq("rule", RULE)
      .eq("contact_email", email)
      .maybeSingle();
    if (already) continue;

    let name = session.full_name ?? "";
    if (!name && session.lead_id) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("first_name, last_name")
        .eq("id", session.lead_id)
        .maybeSingle();
      name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ");
    }

    const body = fillAutomationPlaceholders(template.html_body, {
      email,
      name,
      plan: session.membership_plan,
    });

    try {
      await sendEmail({
        to: email,
        subject: template.subject,
        html: body,
        text: htmlToPlainText(body),
      });
    } catch {
      continue;
    }

    await supabaseAdmin.from("email_messages").insert({
      lead_id: session.lead_id,
      contact_email: email,
      to_email: email,
      from_email: DEFAULT_FROM,
      subject: template.subject,
      body,
      direction: "outbound",
      status: "sent",
    });

    await supabaseAdmin.from("automation_sends").insert({ rule: RULE, contact_email: email });

    sent += 1;
  }

  return Response.json({ ok: true, checked: (sessions ?? []).length, sent });
}

export const Route = createFileRoute("/api/internal/automation-welcome-on-upgrade")({
  server: {
    handlers: {
      GET: async ({ request }) => checkCronAuth(request) ?? (await run()),
      POST: async ({ request }) => checkCronAuth(request) ?? (await run()),
    },
  },
});
