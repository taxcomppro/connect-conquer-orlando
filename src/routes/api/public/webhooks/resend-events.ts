import { createFileRoute } from "@tanstack/react-router";
import {
  isTrackedResendEvent,
  recordResendEvent,
  verifyResendWebhook,
} from "@/lib/resend-events.server";

/**
 * Receives Resend delivery + engagement events (delivered, opened, clicked,
 * bounced, complained) and stores them so each contact's activity thread and
 * the Funnel page can report opens and clicks.
 *
 * Verified with RESEND_WEBHOOK_SECRET or RESEND_EVENTS_WEBHOOK_SECRET.
 *
 * POST /api/public/webhooks/resend-events
 */
export const Route = createFileRoute("/api/public/webhooks/resend-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const verified = await verifyResendWebhook(rawBody, {
          "svix-id": request.headers.get("svix-id") ?? "",
          "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
          "svix-signature": request.headers.get("svix-signature") ?? "",
        });
        if (!verified) {
          return Response.json({ error: "invalid_signature" }, { status: 403 });
        }

        const event = JSON.parse(rawBody);
        if (!isTrackedResendEvent(event.type)) {
          return Response.json({ ok: true, skipped: event.type });
        }

        const result = await recordResendEvent(event);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
