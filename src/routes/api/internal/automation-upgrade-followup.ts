import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth } from "@/lib/site-conversions.server";

/**
 * Funnel stage 4: Free member saw the upgrade offer, didn't act.
 *
 * Finds contacts who received the "Free → Paid Upgrade" email more
 * than 3 days ago and are still on the Free tier — sends a reminder,
 * once per contact ever.
 *
 * Triggered by Vercel Cron (see vercel.json), daily.
 * GET/POST /api/internal/automation-upgrade-followup
 */

const RULE = "upgrade_followup";
const UPGRADE_EMAIL_SUBJECT = "Your 2 Free Months of Tax Comp Pro Are Ready 🎉";

async function run(): Promise<Response> {
  const { findSiteMemberByEmail } = await import("@/lib/site-db.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail, DEFAULT_FROM } = await import("@/lib/resend.server");
  const { fillAutomationPlaceholders, htmlToPlainText } = await import("@/lib/automation.server");

  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sends, error: sendsError } = await supabaseAdmin
    .from("email_messages")
    .select("contact_email, lead_id")
    .eq("subject", UPGRADE_EMAIL_SUBJECT)
    .eq("direction", "outbound")
    .lt("sent_at", cutoff);

  if (sendsError) {
    return Response.json(
      { error: "email_messages_query_failed", detail: sendsError.message },
      { status: 500 },
    );
  }

  const uniqueByEmail = new Map<string, { email: string; leadId: string | null }>();
  for (const row of sends ?? []) {
    const email = (row.contact_email ?? "").trim().toLowerCase();
    if (email) uniqueByEmail.set(email, { email, leadId: row.lead_id });
  }

  const { data: template } = await supabaseAdmin
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", "Upgrade Offer Follow-up")
    .maybeSingle();

  if (!template) {
    return Response.json({ error: "template_missing" }, { status: 500 });
  }

  let sent = 0;
  let checked = 0;
  for (const { email, leadId } of uniqueByEmail.values()) {
    checked += 1;

    const { data: already } = await supabaseAdmin
      .from("automation_sends")
      .select("id")
      .eq("rule", RULE)
      .eq("contact_email", email)
      .maybeSingle();
    if (already) continue;

    let member;
    try {
      member = await findSiteMemberByEmail(email);
    } catch (error) {
      return Response.json(
        {
          error: "site_db_unreachable",
          detail: error instanceof Error ? error.message : String(error),
        },
        { status: 502 },
      );
    }

    // Not a member yet, or already upgraded — no reminder needed.
    if (!member || member.tier !== "FREE") continue;

    const body = fillAutomationPlaceholders(template.html_body, {
      email,
      name: member.name,
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
      lead_id: leadId,
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

  return Response.json({ ok: true, checked, sent });
}

export const Route = createFileRoute("/api/internal/automation-upgrade-followup")({
  server: {
    handlers: {
      GET: async ({ request }) => checkCronAuth(request) ?? (await run()),
      POST: async ({ request }) => checkCronAuth(request) ?? (await run()),
    },
  },
});
