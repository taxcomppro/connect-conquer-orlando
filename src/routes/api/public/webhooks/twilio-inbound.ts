import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

/**
 * Receives inbound SMS replies from Twilio and logs them into the
 * sms_messages thread as direction: "inbound", so replies show up
 * alongside outbound texts on a contact's page.
 *
 * Configure in Twilio Console: Phone Numbers → your number →
 * Messaging → "A MESSAGE COMES IN" → this URL, HTTP POST.
 *
 * Signature note: Twilio signs the exact URL configured in the console.
 * Behind Cloudflare + Vercel the incoming Host header can differ from
 * that, so every plausible URL is checked and a failure logs enough
 * detail (never the token) to spot a misconfiguration.
 *
 * POST /api/public/webhooks/twilio-inbound
 */

const PATH = "/api/public/webhooks/twilio-inbound";

function signatureFor(authToken: string, url: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort();
  let data = url;
  for (const key of sorted) data += key + params[key];
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

function candidateUrls(request: Request): string[] {
  const headerHosts = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    "fieldhub.taxcomppro.com",
  ].filter((host): host is string => !!host);

  const urls = new Set<string>();
  try {
    urls.add(new URL(request.url).toString());
  } catch {
    // ignore unparsable request URLs
  }
  for (const host of headerHosts) {
    urls.add(`https://${host}${PATH}`);
    urls.add(`http://${host}${PATH}`);
  }
  return [...urls];
}

export const Route = createFileRoute("/api/public/webhooks/twilio-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const params = Object.fromEntries(new URLSearchParams(rawBody));
        const signature = request.headers.get("x-twilio-signature");
        const authToken = process.env["TWILIO_AUTH_TOKEN"];

        let verified = false;
        if (authToken && signature) {
          for (const url of candidateUrls(request)) {
            const expected = signatureFor(authToken, url, params);
            if (
              expected.length === signature.length &&
              crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
            ) {
              verified = true;
              break;
            }
          }
        }

        if (!verified) {
          console.error("[twilio-inbound] signature check failed", {
            hasToken: !!authToken,
            hasSignature: !!signature,
            host: request.headers.get("host"),
            forwardedHost: request.headers.get("x-forwarded-host"),
            tried: candidateUrls(request),
            from: params["From"] ?? null,
          });
          return new Response("Invalid signature", { status: 403 });
        }

        const from = params["From"] ?? "";
        const to = params["To"] ?? "";
        const body = params["Body"] ?? "";
        const messageSid = params["MessageSid"] ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Best-effort match to an existing lead by phone, comparing the last
        // ten digits so formatting differences ("(409) 998-4343") still match.
        const digits = from.replace(/\D/g, "").slice(-10);
        let leadId: string | null = null;
        if (digits) {
          const { data: candidates } = await supabaseAdmin
            .from("leads")
            .select("id, phone")
            .not("phone", "is", null)
            .limit(5000);
          leadId =
            (candidates ?? []).find(
              (lead) => (lead.phone ?? "").replace(/\D/g, "").slice(-10) === digits,
            )?.id ?? null;
        }

        const { error } = await supabaseAdmin.from("sms_messages").insert({
          lead_id: leadId,
          contact_phone: from,
          to_number: to,
          from_number: from,
          body,
          direction: "inbound",
          status: "received",
          twilio_sid: messageSid,
        });
        if (error) console.error("[twilio-inbound] insert failed:", error);

        return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
