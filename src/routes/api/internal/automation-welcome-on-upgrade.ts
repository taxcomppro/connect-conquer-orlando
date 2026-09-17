import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth } from "@/lib/site-conversions.server";

/**
 * Funnel stage 5: upgrade detected → welcome confirmation.
 * Triggered by Vercel Cron (see vercel.json), every 15 minutes.
 * GET/POST /api/internal/automation-welcome-on-upgrade
 */

async function run(): Promise<Response> {
  const { runWelcomeOnUpgrade } = await import("@/lib/automation-runs.server");
  const result = await runWelcomeOnUpgrade();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const Route = createFileRoute("/api/internal/automation-welcome-on-upgrade")({
  server: {
    handlers: {
      GET: async ({ request }) => (await checkCronAuth(request)) ?? (await run()),
      POST: async ({ request }) => (await checkCronAuth(request)) ?? (await run()),
    },
  },
});
