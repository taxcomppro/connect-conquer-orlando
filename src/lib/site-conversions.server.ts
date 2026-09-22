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
  const { findRecentUpgrades, listAllMembers } = await import("@/lib/site-db.server");
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

  // Keep a local read snapshot for the CRM. The Pipeline reads this whenever
  // the main-site database is slow, so member cards remain available.
  try {
    const allMembers = await listAllMembers();
    if (allMembers.length > 0) {
      const { error: cacheError } = await supabaseAdmin.from("site_members_cache").upsert(
        allMembers.map((member) => ({
          user_id: member.userId,
          email: member.email,
          name: member.name,
          phone: member.phone,
          tier: member.tier,
          subscription_status: member.subscriptionStatus,
          subscription_plan: member.subscriptionPlan,
          current_period_end: member.currentPeriodEnd,
          source_created_at: member.createdAt,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "user_id" },
      );
      if (cacheError) console.error("[site-sync] failed to refresh member cache:", cacheError);
    }
  } catch (error) {
    console.error("[site-sync] member cache refresh failed:", error);
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

/**
 * Gate for the scheduled endpoints.
 *
 * Accepts either the platform's own cron invocation (Vercel sets the
 * x-vercel-cron header on scheduled requests) or a Bearer secret, read
 * through readEnv so it works whichever runtime serves the request.
 */
export async function checkCronAuth(request: Request): Promise<Response | null> {
  if (request.headers.get("x-vercel-cron")) return null;

  const { readEnv } = await import("@/lib/env.server");
  const secrets = [await readEnv("CRON_SECRET"), await readEnv("LOVABLE_CRON_SECRET")].filter(
    Boolean,
  );
  if (!secrets.length) {
    return Response.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!secrets.some((secret) => header === `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
