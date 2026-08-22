import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readBadge, type BadgeLookupResult } from "./edc.server";

export const lookupBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { attendeeId: string }) => {
    if (!input || typeof input.attendeeId !== "string") {
      throw new Error("attendeeId is required");
    }
    return { attendeeId: input.attendeeId.slice(0, 64) };
  })
  .handler(async ({ data }): Promise<BadgeLookupResult> => {
    return readBadge(
      process.env["EDC_SHOW_ID"],
      process.env["EDC_API_KEY"] ?? process.env["EDC_APP_KEY"],
      data.attendeeId,
      process.env["EDC_API_URL"],
    );
  });

export const getShowConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const showId = process.env["EDC_SHOW_ID"] ?? "";
    const apiKey = process.env["EDC_API_KEY"] ?? process.env["EDC_APP_KEY"] ?? "";
    return {
      configured: Boolean(showId && apiKey),
      mode: showId === "sandbox" ? ("sandbox" as const) : ("live" as const),
    };
  });
