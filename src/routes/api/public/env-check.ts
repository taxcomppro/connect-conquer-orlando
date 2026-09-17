import { createFileRoute } from "@tanstack/react-router";
import { readEnv } from "@/lib/env.server";

// Diagnostics only: reports presence (true/false) of each expected env var.
// Never returns values.
const EXPECTED = [
  "LOVABLE_API_KEY",
  "TWILIO_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "REPLY_FORWARDING_EMAIL",
  "SITE_DATABASE_URL",
  "CRON_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TCPC_WEBHOOK_SECRET",
  "DUB_API_KEY",
  "EDC_API_KEY",
  "EDC_API_URL",
  "EDC_APP_KEY",
  "EDC_SHOW_ID",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const Route = createFileRoute("/api/public/env-check")({
  server: {
    handlers: {
      GET: async () => {
        const presence: Record<string, boolean> = {};
        for (const name of EXPECTED) {
          presence[name] = Boolean(readEnv(name));
        }
        return Response.json({ ok: true, presence });
      },
    },
  },
});
