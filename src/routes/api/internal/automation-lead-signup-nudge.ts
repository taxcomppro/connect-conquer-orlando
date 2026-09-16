import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth } from "@/lib/site-conversions.server";

/**
 * Funnel stage 2: Lead → creates a Free account.
 *
 * Finds leads who have an email, were captured more than 24 hours
 * ago, and have never created a TaxCompPro account (no matching
 * email in the site's users table) — then sends them the
 * "Create Your Free Account" email, once per lead ever.
 *
 * Triggered by Vercel Cron (see vercel.json), every 6 hours.
 * GET/POST /api/internal/automation-lead-signup-nudge
 */

const RULE = "lead_signup_nudge";

async function run(): Promise<Response> {
  const { listAllMemberEmails } = await import("@/lib/site-db.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail, DEFAULT_FROM } = await import("@/lib/resend.server");
  const { fillAutomationPlaceholders, htmlToPlainText } = await import("@/lib/automation.server");

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, error: leadsError } = await supabaseAdmin
    .from("leads")
    .select("id, email, first_name, last_name, company")
    .not("email", "is", null)
    .neq("outcome", "archived")
    .lt("scanned_at", cutoff);

  if (leadsError) {
    return Response.json(
      { error: "leads_query_failed", detail: leadsError.message },
      { status: 500 },
    );
  }

  let memberEmails: Set<string>;
  try {
    memberEmails = await listAllMemberEmails();
  } catch (error) {
    return Response.json(
      {
        error: "site_db_unreachable",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  const candidates = (leads ?? []).filter(
    (lead) => lead.email && !memberEmails.has(lead.email.trim().toLowerCase()),
  );

  const { data: template } = await supabaseAdmin
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", "Create Your Free Account")
    .maybeSingle();

  if (!template) {
    return Response.json({ error: "template_missing" }, { status: 500 });
  }

  let sent = 0;
  for (const lead of candidates) {
    const email = lead.email!.trim().toLowerCase();

    const { data: already } = await supabaseAdmin
      .from("automation_sends")
      .select("id")
      .eq("rule", RULE)
      .eq("contact_email", email)
      .maybeSingle();
    if (already) continue;

    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
    const body = fillAutomationPlaceholders(template.html_body, {
      email,
      name,
      company: lead.company,
    });

    try {
      await sendEmail({
        to: email,
        subject: template.subject,
        html: body,
        text: htmlToPlainText(body),
      });
    } catch {
      continue; // best-effort — next run retries, since no send was recorded
    }

    await supabaseAdmin.from("email_messages").insert({
      lead_id: lead.id,
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

  return Response.json({ ok: true, candidates: candidates.length, sent });
}

export const Route = createFileRoute("/api/internal/automation-lead-signup-nudge")({
  server: {
    handlers: {
      GET: async ({ request }) => checkCronAuth(request) ?? (await run()),
      POST: async ({ request }) => checkCronAuth(request) ?? (await run()),
    },
  },
});
