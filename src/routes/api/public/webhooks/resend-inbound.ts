import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "svix";

/**
 * Receives inbound email replies from Resend and logs them into the
 * email_messages thread as direction: "inbound". Also forwards a
 * copy to the real inbox (FORWARD_REPLIES_TO), since replies land
 * only on the dedicated receiving subdomain, not Outlook directly —
 * see docs/email-inbound-setup.md for why.
 *
 * Requires RESEND_WEBHOOK_SECRET (from the webhook's settings page
 * in the Resend dashboard) to verify the request is genuinely from
 * Resend, and RESEND_API_KEY (already set for sending) to fetch the
 * full email body and to forward the copy.
 *
 * POST /api/public/webhooks/resend-inbound
 */
export const Route = createFileRoute("/api/public/webhooks/resend-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["RESEND_WEBHOOK_SECRET"];
        if (!webhookSecret) {
          return Response.json({ error: "resend_webhook_not_configured" }, { status: 500 });
        }

        const rawBody = await request.text();
        try {
          new Webhook(webhookSecret).verify(rawBody, {
            "svix-id": request.headers.get("svix-id") ?? "",
            "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
            "svix-signature": request.headers.get("svix-signature") ?? "",
          });
        } catch {
          return Response.json({ error: "invalid_signature" }, { status: 403 });
        }

        const event = JSON.parse(rawBody);
        if (event.type !== "email.received") {
          return Response.json({ ok: true, skipped: event.type });
        }

        const emailId: string = event.data.email_id;
        const fromAddress: string = event.data.from;
        const subject: string = event.data.subject ?? "";

        const { Resend } = await import("resend");
        const resend = new Resend(process.env["RESEND_API_KEY"]);

        const { data: full } = await resend.emails.receiving.get(emailId);
        const bodyHtml = full?.html ?? full?.text ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id")
          .ilike("email", fromAddress)
          .maybeSingle();

        await supabaseAdmin.from("email_messages").insert({
          lead_id: lead?.id ?? null,
          contact_email: fromAddress.toLowerCase(),
          subject,
          body: bodyHtml,
          direction: "inbound",
          status: "received",
          provider_id: emailId,
        });

        const forwardTo = process.env["REPLY_FORWARDING_EMAIL"];
        if (forwardTo) {
          await resend.emails.send({
            from: "Field Hub <info@replies.taxcomppro.com>",
            to: forwardTo,
            subject: `[Reply] ${subject}`,
            html: `<p>Reply from ${fromAddress}:</p>${bodyHtml}`,
          });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
