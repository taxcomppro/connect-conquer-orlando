import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

/**
 * Receives inbound SMS replies from Twilio and logs them into the
 * sms_messages thread as direction: "inbound", so replies show up
 * alongside outbound texts on a contact's page instead of only in
 * Twilio's own console.
 *
 * Configure in Twilio Console: Phone Numbers → your number →
 * Messaging → "A MESSAGE COMES IN" → this URL, HTTP POST.
 *
 * Requires TWILIO_AUTH_TOKEN (the Account Auth Token from the Twilio
 * Console dashboard — not the API Key used for sending) to verify
 * the request actually came from Twilio.
 *
 * POST /api/public/webhooks/twilio-inbound
 */

function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  if (!authToken || !signature) return false;

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];

  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

export const Route = createFileRoute("/api/public/webhooks/twilio-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const params = Object.fromEntries(new URLSearchParams(rawBody));
        const signature = request.headers.get("x-twilio-signature");
        const url = `https://${request.headers.get("host")}/api/public/webhooks/twilio-inbound`;

        if (!verifyTwilioSignature(url, params, signature)) {
          return new Response("Invalid signature", { status: 403 });
        }

        const from = params["From"] ?? "";
        const to = params["To"] ?? "";
        const body = params["Body"] ?? "";
        const messageSid = params["MessageSid"] ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Best-effort match to an existing lead by phone number, so
        // the reply threads onto their existing record when we have
        // one. Not finding a match still logs the message — it just
        // has no lead_id, same as any other site-only contact.
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("phone", from)
          .maybeSingle();

        await supabaseAdmin.from("sms_messages").insert({
          lead_id: lead?.id ?? null,
          contact_phone: from,
          to_number: to,
          from_number: from,
          body,
          direction: "inbound",
          status: "received",
          twilio_sid: messageSid,
        });

        return new Response(EMPTY_TWIML, {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
