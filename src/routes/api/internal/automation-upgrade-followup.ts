import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth } from "@/lib/site-conversions.server";

/**
 * Funnel stage 4: Free member saw the upgrade offer, didn't act.
 * Triggered by Vercel Cron (see vercel.json), daily.
 * GET/POST /api/internal/automation-upgrade-followup
 */

async function run(): Promise<Response> {
  const { runUpgradeFollowup } = await import("@/lib/automation-runs.server");
  const result = await runUpgradeFollowup();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const Route = createFileRoute("/api/internal/automation-upgrade-followup")({
  server: {
    handlers: {
      GET: async ({ request }) => (await checkCronAuth(request)) ?? (await run()),
      POST: async ({ request }) => (await checkCronAuth(request)) ?? (await run()),
    },
  },
});
