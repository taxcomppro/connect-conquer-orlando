import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/envcheck")({
  server: {
    handlers: {
      GET: async () => {
        const hasLovable = Boolean(process.env["LOVABLE_API_KEY"]);
        const hasTwilio = Boolean(process.env["TWILIO_API_KEY"]);
        return new Response(JSON.stringify({ hasLovable, hasTwilio }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
