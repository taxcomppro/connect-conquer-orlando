import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import type { TablesUpdate } from "@/integrations/supabase/types";

/**
 * Minimal main-site bridge: TaxCompPro checkout fires one POST here when a
 * membership purchase completes. Verified with HMAC-SHA256 over
 * `${timestamp}.${rawBody}` using the shared TCPC_WEBHOOK_SECRET.
 *
 * POST /api/public/webhooks/membership
 * Headers:
 *   x-webhook-timestamp: unix seconds
 *   x-webhook-signature: hex hmac-sha256(secret, `${timestamp}.${rawBody}`)
 * Body (JSON):
 *   { sessionId?: uuid, email?: string, membershipRef?: string, plan?: string }
 */
const payloadSchema = z.object({
  sessionId: z.string().uuid().optional(),
  email: z.string().email().max(200),
  fullName: z.string().max(160).optional(),
  membershipRef: z.string().max(120).optional(),
  plan: z.string().max(80).optional(),
  /** Finished profile link on the main site; the card is written to this when present. */
  profileUrl: z.string().url().max(500).optional(),
  memberId: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/public/webhooks/membership")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TCPC_WEBHOOK_SECRET"];
        if (!secret) {
          return Response.json({ error: "webhook_not_configured" }, { status: 500 });
        }

        const body = await request.text();
        const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
        const signature = request.headers.get("x-webhook-signature") ?? "";

        const ts = Number(timestamp);
        if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
          return Response.json({ error: "stale_timestamp" }, { status: 401 });
        }

        const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
        const sigBuf = Buffer.from(signature, "utf8");
        const expBuf = Buffer.from(expected, "utf8");
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return Response.json({ error: "invalid_signature" }, { status: 401 });
        }

        let payload: z.infer<typeof payloadSchema>;
        try {
          payload = payloadSchema.parse(JSON.parse(body));
        } catch {
          return Response.json({ error: "invalid_payload" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const email = payload.email.toLowerCase();
        let query = supabaseAdmin
          .from("signup_sessions")
          .select("id, stage, email, membership_confirmed_at")
          .neq("stage", "void")
          .order("created_at", { ascending: false })
          .limit(1);
        query = payload.sessionId ? query.eq("id", payload.sessionId) : query.eq("email", email);
        const { data: found } = await query.maybeSingle();

        const now = new Date().toISOString();
        let session = found;

        // A profile link means the main site already built the profile, so the
        // card can be written immediately — no Field Hub intake needed.
        const nextStage = payload.profileUrl ? "ready_for_card" : "membership_confirmed";

        if (!session) {
          // Card-first flow: customer tapped a generic card and bought without a
          // prior badge scan — open their sales record straight from the purchase.
          const { data: created, error: insertError } = await supabaseAdmin
            .from("signup_sessions")
            .insert({
              email,
              rep_user_id: null,
              full_name: payload.fullName ?? null,
              stage: nextStage,
              membership_confirmed_at: now,
              membership_ref: payload.membershipRef ?? null,
              membership_plan: payload.plan ?? null,
              external_profile_url: payload.profileUrl ?? null,
              external_member_id: payload.memberId ?? null,
            })
            .select("id, stage, email, membership_confirmed_at")
            .single();
          if (insertError || !created) {
            return Response.json({ error: "create_failed" }, { status: 500 });
          }
          session = created;
        } else {
          const update: TablesUpdate<"signup_sessions"> = {
            membership_confirmed_at: session.membership_confirmed_at ?? now,
          };
          if (payload.membershipRef) update["membership_ref"] = payload.membershipRef;
          if (payload.plan) update["membership_plan"] = payload.plan;
          if (payload.memberId) update["external_member_id"] = payload.memberId;
          if (payload.profileUrl) update["external_profile_url"] = payload.profileUrl;
          if (payload.fullName && session.stage !== "card_issued") {
            update["full_name"] = payload.fullName;
          }
          if (session.stage === "scanned" || session.stage === "signup_sent") {
            update["stage"] = nextStage;
          } else if (payload.profileUrl && session.stage === "membership_confirmed") {
            update["stage"] = "ready_for_card";
          }
          const { error } = await supabaseAdmin
            .from("signup_sessions")
            .update(update)
            .eq("id", session.id);
          if (error) {
            return Response.json({ error: "update_failed" }, { status: 500 });
          }
        }

        if (!found?.membership_confirmed_at) {
          await supabaseAdmin.from("signup_events").insert({
            signup_session_id: session.id,
            event_type: "MEMBERSHIP_CONFIRMED",
            actor_label: "taxcomppro",
            payload: {
              ref: payload.membershipRef ?? null,
              plan: payload.plan ?? null,
              profileUrl: payload.profileUrl ?? null,
              source: "webhook",
            },
          });
        }

        return Response.json({
          ok: true,
          sessionId: session.id,
          joinPath: `/join/${session.id}`,
          readyForCard: Boolean(payload.profileUrl),
          alreadyConfirmed: Boolean(found?.membership_confirmed_at),
        });
      },
    },
  },
});
