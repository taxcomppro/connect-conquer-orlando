import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readBadge, type BadgeLookupResult } from "./edc.server";

export const lookupBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attendeeId: string }) => {
    if (!input || typeof input.attendeeId !== "string") {
      throw new Error("attendeeId is required");
    }
    return { attendeeId: input.attendeeId.slice(0, 64) };
  })
  .handler(async ({ data }): Promise<BadgeLookupResult> => {
    return readBadge(process.env["EDC_SHOW_ID"], process.env["EDC_APP_KEY"], data.attendeeId);
  });

export const getShowConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const showId = process.env["EDC_SHOW_ID"] ?? "";
    return {
      configured: Boolean(showId && process.env["EDC_APP_KEY"]),
      mode: showId === "sandbox" ? ("sandbox" as const) : ("live" as const),
      showId,
    };
  });
