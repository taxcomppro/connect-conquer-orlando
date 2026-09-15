import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth, runSiteConversionSync } from "@/lib/site-conversions.server";

/**
 * Scheduled sync of main-site membership upgrades into Field Hub.
 *
 * Requires `Authorization: Bearer $CRON_SECRET`. POST works the same
 * way, for manual testing with curl.
 *
 * GET/POST /api/internal/sync-site-conversions
 */
export const Route = createFileRoute("/api/internal/sync-site-conversions")({
  server: {
    handlers: {
      GET: async ({ request }) => checkCronAuth(request) ?? (await runSiteConversionSync()),
      POST: async ({ request }) => checkCronAuth(request) ?? (await runSiteConversionSync()),
    },
  },
});
