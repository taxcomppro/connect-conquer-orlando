import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { PurchaseItem } from "./stripe.server";

export type LookupResult = {
  configured: boolean;
  purchases: {
    reference: string;
    email: string | null;
    name: string | null;
    amountCents: number;
    currency: string;
    createdAt: string;
    mode: string;
    items: PurchaseItem[];
    summary: string;
  }[];
  error?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Staff-only: "did this person actually pay?" — checks the TaxCompPro Stripe account. */
export const lookupStripePurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@")) throw new Error("Add an email address to the lead first.");
    return { email };
  })
  .handler(async ({ data }): Promise<LookupResult> => {
    if (!process.env["STRIPE_SECRET_KEY"]) {
      return { configured: false, purchases: [] };
    }
    const { findPurchasesByEmail, describePurchase } = await import("./stripe.server");
    try {
      const purchases = await findPurchasesByEmail(data.email);
      return {
        configured: true,
        purchases: purchases.map((p) => ({
          reference: p.reference,
          email: p.email,
          name: p.name,
          amountCents: p.amountCents,
          currency: p.currency,
          createdAt: p.createdAt,
          mode: p.mode,
          items: p.items,
          summary: describePurchase(p),
        })),
      };
    } catch (err) {
      return {
        configured: true,
        purchases: [],
        error: err instanceof Error ? err.message : "Stripe lookup failed.",
      };
    }
  });

/** Staff-only: attach a verified Stripe purchase to a signup session. */
export const confirmStripePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { sessionId: string; reference: string }) => {
    if (!UUID_RE.test(input?.sessionId ?? "")) throw new Error("Invalid signup session.");
    const reference = String(input?.reference ?? "").slice(0, 120);
    if (!reference.startsWith("cs_")) throw new Error("Invalid Stripe reference.");
    return { sessionId: input.sessionId, reference };
  })
  .handler(async ({ data, context }) => {
    const { getCheckoutSession, describePurchase } = await import("./stripe.server");
    const purchase = await getCheckoutSession(data.reference);

    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const { data: session } = await supabase
      .from("signup_sessions")
      .select("id, stage, lead_id, membership_confirmed_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Signup session not found.");

    const nextStage =
      session.stage === "scanned" || session.stage === "signup_sent"
        ? "membership_confirmed"
        : session.stage;

    const { error } = await supabase
      .from("signup_sessions")
      .update({
        stage: nextStage,
        membership_confirmed_at: session.membership_confirmed_at ?? now,
        membership_confirmed_by: userId,
        membership_ref: purchase.reference,
        membership_plan: describePurchase(purchase),
        stripe_reference: purchase.reference,
        stripe_customer_id: purchase.customerId,
        purchase_amount_cents: purchase.amountCents,
        purchase_currency: purchase.currency,
        purchase_items: purchase.items,
        purchase_confirmed_source: "stripe_manual",
      })
      .eq("id", session.id);
    if (error) throw new Error("Couldn't save the purchase to this signup.");

    await supabase.from("signup_events").insert({
      signup_session_id: session.id,
      event_type: "MEMBERSHIP_CONFIRMED",
      actor_user_id: userId,
      actor_label: "stripe",
      payload: {
        reference: purchase.reference,
        amountCents: purchase.amountCents,
        currency: purchase.currency,
        items: purchase.items,
        source: "stripe_manual",
      },
    });

    if (session.lead_id) {
      await supabase
        .from("leads")
        .update({ outcome: "sale_closed", joined_tcpc: true })
        .eq("id", session.lead_id);
    }

    return {
      ok: true,
      summary: describePurchase(purchase),
      amountCents: purchase.amountCents,
      currency: purchase.currency,
    };
  });
