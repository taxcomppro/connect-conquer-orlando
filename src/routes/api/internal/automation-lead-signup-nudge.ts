import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth } from "@/lib/site-conversions.server";

/**
 * Funnel stage 2: Lead → creates a Free account.
 * Triggered by Vercel Cron (see vercel.json), every 6 hours.
 * GET/POST /api/internal/automation-lead-signup-nudge
 */

async function run(): Promise<Response> {
  const { runLeadSignupNudge } = await import("@/lib/automation-runs.server");
  const result = await runLeadSignupNudge();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const Route = createFileRoute("/api/internal/automation-lead-signup-nudge")({
  server: {
    handlers: {
      GET: async ({ request }) => (await checkCronAuth(request)) ?? (await run()),
      POST: async ({ request }) => (await checkCronAuth(request)) ?? (await run()),
    },
  },
});
