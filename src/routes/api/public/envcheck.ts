import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/envcheck")({
  server: {
    handlers: {
      GET: async () => {
        const keys = Object.keys(process.env ?? {}).filter((k) =>
          /LOVABLE|TWILIO/i.test(k),
        );
        return new Response(JSON.stringify({ keys }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
