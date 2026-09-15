/**
 * Polls the TaxCompPro main site's database (read-only) for members
 * who upgraded since the last run, and marks the matching Field Hub
 * lead / signup session as converted.
 *
 * This exists specifically for the gap the Stripe webhook can't
 * cover: a 100%-off coupon upgrade never creates a Stripe Checkout
 * Session, so Stripe never fires an event for it. This job catches
 * those by reading the site's database directly instead.
 */

export async function runSiteConversionSync(): Promise<Response> {
  const { findRecentUpgrades } = await import("@/lib/site-db.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Look back further than the schedule interval so a slow or delayed
  // run never misses an upgrade that happened between runs.
  const since = new Date(Date.now() - 45 * 60 * 1000).toISOString();

  let members: Awaited<ReturnType<typeof findRecentUpgrades>>;
  try {
    members = await findRecentUpgrades(since);
  } catch (error) {
    return Response.json(
      {
        error: "site_db_unreachable",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  let updated = 0;
  const results: Array<{ email: string; matched: boolean; alreadyConfirmed: boolean }> = [];

  for (const member of members) {
    const email = member.email.toLowerCase();

    const { data: session } = await supabaseAdmin
      .from("signup_sessions")
      .select("id, lead_id, membership_confirmed_at")
      .eq("email", email)
      .neq("stage", "void")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      results.push({ email, matched: false, alreadyConfirmed: false });
      continue;
    }
    if (session.membership_confirmed_at) {
      // Already recorded — most likely the Stripe webhook got there first.
      results.push({ email, matched: true, alreadyConfirmed: true });
      continue;
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("signup_sessions")
      .update({
        stage: "membership_confirmed",
        membership_confirmed_at: now,
        membership_plan: member.tier,
        purchase_confirmed_source: "site_db_poll",
      })
      .eq("id", session.id);

    await supabaseAdmin.from("signup_events").insert({
      signup_session_id: session.id,
      event_type: "MEMBERSHIP_CONFIRMED",
      actor_label: "site_db_poll",
      payload: { tier: member.tier, source: "site_db_poll" },
    });

    if (session.lead_id) {
      await supabaseAdmin
        .from("leads")
        .update({ outcome: "sale_closed", joined_tcpc: true })
        .eq("id", session.lead_id);
    }

    updated += 1;
    results.push({ email, matched: true, alreadyConfirmed: false });
  }

  return Response.json({ ok: true, checked: members.length, updated, results });
}

/** Shared-secret gate for the scheduled sync endpoints. */
export function checkCronAuth(request: Request): Response | null {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return Response.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
