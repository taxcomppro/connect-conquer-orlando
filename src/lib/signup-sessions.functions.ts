import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ publicId: z.string().regex(/^FH-[A-Z0-9]{10}$/) });

const membershipResultSchema = z.object({
  signupSessionId: z.string(),
  status: z.enum(["CREATED", "QR_SCANNED", "CHECKOUT_STARTED", "MEMBERSHIP_ACTIVE"]),
  taxCompProUserId: z.string().min(1).optional().nullable(),
  membershipId: z.string().min(1).optional().nullable(),
  plan: z.string().min(1).optional().nullable(),
  membershipStatus: z.string().min(1).optional().nullable(),
  integrationReference: z.string().optional().nullable(),
});

export const refreshMembershipStatus = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }) => {
    const statusUrl = process.env["TAX_COMP_PRO_MEMBERSHIP_STATUS_URL"];
    const integrationSecret = process.env["TAX_COMP_PRO_INTEGRATION_SECRET"];

    if (!statusUrl || !integrationSecret) {
      return { ok: false as const, message: "Membership status polling is not configured." };
    }

    const url = new URL(statusUrl);
    url.searchParams.set("signupSessionId", data.publicId);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${integrationSecret}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { ok: false as const, message: `Membership service returned ${response.status}.` };
    }

    const result = membershipResultSchema.parse(await response.json());
    if (result.signupSessionId !== data.publicId) {
      return { ok: false as const, message: "Membership response did not match this signup." };
    }

    if (
      result.status === "MEMBERSHIP_ACTIVE" &&
      (!result.taxCompProUserId || result.membershipStatus !== "ACTIVE")
    ) {
      return {
        ok: false as const,
        message: "Membership response was missing an active member ID.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const timestampFields = {
      ...(result.status === "QR_SCANNED" ? { qr_scanned_at: now } : {}),
      ...(result.status === "CHECKOUT_STARTED" ? { checkout_started_at: now } : {}),
      ...(result.status === "MEMBERSHIP_ACTIVE" ? { completed_at: now } : {}),
    };
    const { data: updated, error } = await supabaseAdmin
      .from("signup_sessions")
      .update({
        status: result.status,
        tax_comp_pro_user_id: result.taxCompProUserId ?? null,
        membership_id: result.membershipId ?? null,
        membership_plan: result.plan ?? null,
        membership_status: result.membershipStatus ?? null,
        integration_reference: result.integrationReference ?? null,
        last_membership_check_at: now,
        ...timestampFields,
      })
      .eq("public_id", data.publicId)
      .neq("status", "CARD_ISSUED")
      .select("*")
      .maybeSingle();

    if (error || !updated) {
      return { ok: false as const, message: error?.message || "Signup session was not found." };
    }

    return { ok: true as const, session: updated };
  });
