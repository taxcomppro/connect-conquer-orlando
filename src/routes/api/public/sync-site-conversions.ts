import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth, runSiteConversionSync } from "@/lib/site-conversions.server";

/**
 * Same sync as /api/internal/sync-site-conversions, exposed under the
 * /api/public prefix so an external scheduler can reach it on the
 * published site. Still gated by `Authorization: Bearer $CRON_SECRET`.
 *
 * GET/POST /api/public/sync-site-conversions
 */
export const Route = createFileRoute("/api/public/sync-site-conversions")({
  server: {
    handlers: {
      GET: async ({ request }) => (await checkCronAuth(request)) ?? (await runSiteConversionSync()),
      POST: async ({ request }) => (await checkCronAuth(request)) ?? (await runSiteConversionSync()),
    },
  },
});
