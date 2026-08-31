import { createFileRoute } from "@tanstack/react-router";

import type { TablesUpdate } from "@/integrations/supabase/types";

/**
 * Stripe webhook. Point the TaxCompPro Stripe account at
 *   POST https://fieldhub.taxcomppro.com/api/public/webhooks/stripe
 * with the event `checkout.session.completed` (and optionally
 * `invoice.paid`). Store the signing secret as STRIPE_WEBHOOK_SECRET.
 *
 * When a purchase lands, the matching signup session flips to
 * "Membership confirmed" and records exactly what was bought.
 */

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "webhook_not_configured" }, { status: 500 });

        const body = await request.text();
        const header = request.headers.get("stripe-signature") ?? "";

        const { verifyStripeSignature, getCheckoutSession, describePurchase } = await import(
          "@/lib/stripe.server"
        );
        if (!(await verifyStripeSignature(body, header, secret))) {
          return Response.json({ error: "invalid_signature" }, { status: 401 });
        }

        let event: StripeEvent;
        try {
          event = JSON.parse(body) as StripeEvent;
        } catch {
          return Response.json({ error: "invalid_payload" }, { status: 400 });
        }

        if (event.type !== "checkout.session.completed") {
          return Response.json({ ok: true, ignored: event.type });
        }

        const object = event.data.object;
        const checkoutId = typeof object["id"] === "string" ? object["id"] : null;
        if (!checkoutId) return Response.json({ error: "missing_session" }, { status: 400 });

        const purchase = await getCheckoutSession(checkoutId);
        const email = purchase.email?.toLowerCase() ?? null;
        const metadata = (object["metadata"] ?? {}) as Record<string, string>;
        const hintedSessionId = metadata["field_hub_session_id"] ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let query = supabaseAdmin
          .from("signup_sessions")
          .select("id, stage, lead_id, membership_confirmed_at")
          .neq("stage", "void")
          .order("created_at", { ascending: false })
          .limit(1);
        if (hintedSessionId) query = query.eq("id", hintedSessionId);
        else if (email) query = query.eq("email", email);
        else return Response.json({ error: "unmatchable" }, { status: 400 });

        const { data: found } = await query.maybeSingle();
        const now = new Date().toISOString();

        const purchaseFields = {
          membership_ref: purchase.reference,
          membership_plan: describePurchase(purchase),
          stripe_reference: purchase.reference,
          stripe_customer_id: purchase.customerId,
          purchase_amount_cents: purchase.amountCents,
          purchase_currency: purchase.currency,
          purchase_items: purchase.items,
          purchase_confirmed_source: "stripe_webhook",
        } satisfies TablesUpdate<"signup_sessions">;

        let session = found;

        if (!session) {
          const { data: created, error: insertError } = await supabaseAdmin
            .from("signup_sessions")
            .insert({
              email,
              full_name: purchase.name,
              rep_user_id: null,
              stage: "membership_confirmed",
              membership_confirmed_at: now,
              ...purchaseFields,
            })
            .select("id, stage, lead_id, membership_confirmed_at")
            .single();
          if (insertError || !created) {
            return Response.json({ error: "create_failed" }, { status: 500 });
          }
          session = created;
        } else {
          const update: TablesUpdate<"signup_sessions"> = {
            ...purchaseFields,
            membership_confirmed_at: session.membership_confirmed_at ?? now,
          };
          if (session.stage === "scanned" || session.stage === "signup_sent") {
            update["stage"] = "membership_confirmed";
          }
          const { error } = await supabaseAdmin
            .from("signup_sessions")
            .update(update)
            .eq("id", session.id);
          if (error) return Response.json({ error: "update_failed" }, { status: 500 });
        }

        if (!found?.membership_confirmed_at) {
          await supabaseAdmin.from("signup_events").insert({
            signup_session_id: session.id,
            event_type: "MEMBERSHIP_CONFIRMED",
            actor_label: "stripe",
            payload: {
              reference: purchase.reference,
              amountCents: purchase.amountCents,
              currency: purchase.currency,
              items: purchase.items,
              source: "stripe_webhook",
            },
          });
        }

        if (session.lead_id) {
          await supabaseAdmin
            .from("leads")
            .update({ outcome: "sale_closed", joined_tcpc: true })
            .eq("id", session.lead_id);
        }

        return Response.json({ ok: true, sessionId: session.id });
      },
    },
  },
});
