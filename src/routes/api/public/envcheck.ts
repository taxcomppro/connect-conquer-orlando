import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/envcheck")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          hasLovableKey: Boolean(process.env["LOVABLE_API_KEY"]),
          hasTwilioKey: Boolean(process.env["TWILIO_API_KEY"]),
          hasServiceRole: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
        });
      },
    },
  },
});
