import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ publicId: z.string().regex(/^FH-[A-Z0-9]{10}$/) });

const issueCardInputSchema = z.object({
  publicId: z.string().regex(/^FH-[A-Z0-9]{10}$/),
  accessToken: z.string().min(1),
});

const membershipResultSchema = z.object({
  signupSessionId: z.string(),
  status: z.enum(["CREATED", "QR_SCANNED", "CHECKOUT_STARTED", "MEMBERSHIP_ACTIVE"]),
  taxCompProUserId: z.string().min(1).optional().nullable(),
  membershipId: z.string().min(1).optional().nullable(),
  plan: z.string().min(1).optional().nullable(),
  membershipStatus: z.string().min(1).optional().nullable(),
  integrationReference: z.string().optional().nullable(),
});

const activationResultSchema = z.object({
  cardId: z.string().min(1),
  username: z.string().min(1),
  status: z.enum(["READY_FOR_ACTIVATION", "ACTIVE"]),
  activationUrl: z.string().url(),
  profileUrl: z.string().url().nullable(),
  idempotent: z.boolean().optional(),
});

function jsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function activationErrorMessage(response: Response): Promise<string> {
  const result = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const detail = typeof result?.error === "string" ? result.error : null;
  if (response.status === 404) return detail || "The Tax Comp Pro member was not found.";
  if (response.status === 409) return detail || "ProConnect could not issue this card.";
  if (response.status === 401 || response.status === 403) {
    return "Field Hub is not authorized to issue ProConnect cards.";
  }
  return detail || `ProConnect returned ${response.status}.`;
}

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

/**
 * Issues the card in Tax Comp Pro's existing ProConnect system before recording it locally.
 * The browser never receives the shared ProConnect integration secret.
 */
export const issueProConnectCard = createServerFn({ method: "POST" })
  .validator(issueCardInputSchema)
  .handler(async ({ data }) => {
    const activationUrl = process.env["TAX_COMP_PRO_PROCONNECT_ISSUE_URL"];
    const activationSecret = process.env["TAX_COMP_PRO_PROCONNECT_SECRET"];
    if (!activationUrl || !activationSecret) {
      return { ok: false as const, message: "ProConnect card activation is not configured." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !user) {
      return {
        ok: false as const,
        message: "Your Field Hub session expired. Please sign in again.",
      };
    }

    const { data: staffProfile } = await supabaseAdmin
      .from("staff_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!staffProfile) {
      return { ok: false as const, message: "A Field Hub staff profile is required." };
    }

    const { data: signup, error: signupError } = await supabaseAdmin
      .from("signup_sessions")
      .select("*")
      .eq("public_id", data.publicId)
      .maybeSingle();
    if (signupError || !signup) {
      return {
        ok: false as const,
        message: signupError?.message || "Signup session was not found.",
      };
    }
    if (
      signup.status !== "MEMBERSHIP_ACTIVE" ||
      signup.membership_status !== "ACTIVE" ||
      !signup.tax_comp_pro_user_id ||
      !signup.membership_id
    ) {
      return {
        ok: false as const,
        message: "Active Tax Comp Pro membership must be verified before card issuance.",
      };
    }

    let response: Response;
    try {
      response = await fetch(activationUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activationSecret}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signupSessionId: signup.public_id,
          taxCompProUserId: signup.tax_comp_pro_user_id,
          membershipId: signup.membership_id,
          issuedByStaffId: user.id,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return {
        ok: false as const,
        message: "ProConnect could not be reached. The card was not marked as issued.",
      };
    }

    if (!response.ok) {
      return { ok: false as const, message: await activationErrorMessage(response) };
    }

    const parsed = activationResultSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      return {
        ok: false as const,
        message: "ProConnect returned an invalid activation confirmation.",
      };
    }

    const activation = parsed.data;
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("signup_sessions")
      .update({
        status: "CARD_ISSUED",
        card_issued_by_staff_id: user.id,
        card_issued_at: now,
        metadata: {
          ...jsonObject(signup.metadata),
          proconnect: {
            cardId: activation.cardId,
            username: activation.username,
            status: activation.status,
            activationUrl: activation.activationUrl,
            profileUrl: activation.profileUrl,
          },
        },
      })
      .eq("id", signup.id)
      .eq("status", "MEMBERSHIP_ACTIVE")
      .eq("membership_status", "ACTIVE")
      .select("*")
      .maybeSingle();

    if (updateError || !updated) {
      return {
        ok: false as const,
        message:
          "The card was issued in Tax Comp Pro, but Field Hub could not record it. Retry the issuance to reconcile the status.",
      };
    }

    return { ok: true as const, session: updated, activation };
  });
