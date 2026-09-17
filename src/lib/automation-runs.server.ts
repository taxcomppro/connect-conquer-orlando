/**
 * The three funnel automation jobs, in one place so they can be run
 * either by the scheduler (see src/routes/api/internal/automation-*.ts)
 * or on demand from the Automations page.
 */

export type AutomationResult = {
  ok: boolean;
  rule: string;
  checked: number;
  sent: number;
  error?: string;
  detail?: string;
};

/** Funnel stage 2: lead captured but never created a free account. */
export async function runLeadSignupNudge(): Promise<AutomationResult> {
  const rule = "lead_signup_nudge";
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
    return { ok: false, rule, checked: 0, sent: 0, error: "leads_query_failed", detail: leadsError.message };
  }

  let memberEmails: Set<string>;
  try {
    memberEmails = await listAllMemberEmails();
  } catch (error) {
    return {
      ok: false,
      rule,
      checked: 0,
      sent: 0,
      error: "site_db_unreachable",
      detail: error instanceof Error ? error.message : String(error),
    };
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
    return { ok: false, rule, checked: candidates.length, sent: 0, error: "template_missing" };
  }

  let sent = 0;
  let lastError: string | undefined;
  for (const lead of candidates) {
    const email = lead.email!.trim().toLowerCase();

    const { data: already } = await supabaseAdmin
      .from("automation_sends")
      .select("id")
      .eq("rule", rule)
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
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
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

    await supabaseAdmin.from("automation_sends").insert({ rule, contact_email: email });
    sent += 1;
  }

  return {
    ok: true,
    rule,
    checked: candidates.length,
    sent,
    ...(sent === 0 && lastError ? { error: "send_failed", detail: lastError } : {}),
  };
}

/** Funnel stage 4: free member saw the upgrade offer and didn't act. */
export async function runUpgradeFollowup(): Promise<AutomationResult> {
  const rule = "upgrade_followup";
  const UPGRADE_EMAIL_SUBJECT = "Your 2 Free Months of Tax Comp Pro Are Ready 🎉";
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
    return {
      ok: false,
      rule,
      checked: 0,
      sent: 0,
      error: "email_messages_query_failed",
      detail: sendsError.message,
    };
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
    return { ok: false, rule, checked: uniqueByEmail.size, sent: 0, error: "template_missing" };
  }

  let sent = 0;
  let checked = 0;
  let lastError: string | undefined;
  for (const { email, leadId } of uniqueByEmail.values()) {
    checked += 1;

    const { data: already } = await supabaseAdmin
      .from("automation_sends")
      .select("id")
      .eq("rule", rule)
      .eq("contact_email", email)
      .maybeSingle();
    if (already) continue;

    let member;
    try {
      member = await findSiteMemberByEmail(email);
    } catch (error) {
      return {
        ok: false,
        rule,
        checked,
        sent,
        error: "site_db_unreachable",
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    // Not a member yet, or already upgraded — no reminder needed.
    if (!member || member.tier !== "FREE") continue;

    const body = fillAutomationPlaceholders(template.html_body, { email, name: member.name });

    try {
      await sendEmail({
        to: email,
        subject: template.subject,
        html: body,
        text: htmlToPlainText(body),
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
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

    await supabaseAdmin.from("automation_sends").insert({ rule, contact_email: email });
    sent += 1;
  }

  return {
    ok: true,
    rule,
    checked,
    sent,
    ...(sent === 0 && lastError ? { error: "send_failed", detail: lastError } : {}),
  };
}

/** Funnel stage 5: upgrade detected → welcome confirmation. */
export async function runWelcomeOnUpgrade(): Promise<AutomationResult> {
  const rule = "welcome_on_upgrade";
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
    return {
      ok: false,
      rule,
      checked: 0,
      sent: 0,
      error: "signup_sessions_query_failed",
      detail: sessionsError.message,
    };
  }

  const { data: template } = await supabaseAdmin
    .from("email_templates")
    .select("subject, html_body")
    .eq("name", "Welcome to Paid Membership")
    .maybeSingle();

  if (!template) {
    return { ok: false, rule, checked: (sessions ?? []).length, sent: 0, error: "template_missing" };
  }

  let sent = 0;
  let lastError: string | undefined;
  for (const session of sessions ?? []) {
    const email = (session.email ?? "").trim().toLowerCase();
    if (!email) continue;

    const { data: already } = await supabaseAdmin
      .from("automation_sends")
      .select("id")
      .eq("rule", rule)
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
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
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

    await supabaseAdmin.from("automation_sends").insert({ rule, contact_email: email });
    sent += 1;
  }

  return {
    ok: true,
    rule,
    checked: (sessions ?? []).length,
    sent,
    ...(sent === 0 && lastError ? { error: "send_failed", detail: lastError } : {}),
  };
}
