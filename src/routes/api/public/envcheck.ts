import { createFileRoute } from "@tanstack/react-router";

/** Diagnostic: reports only whether texting credentials are present. No values. */
export const Route = createFileRoute("/api/public/envcheck")({
  server: {
    handlers: {
      GET: async () => {
        const body = {
          hasLovableKey: Boolean(process.env["LOVABLE_API_KEY"]),
          hasTwilioKey: Boolean(process.env["TWILIO_API_KEY"]),
          hasTwilioFrom: Boolean(process.env["TWILIO_FROM_NUMBER"]),
        };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
