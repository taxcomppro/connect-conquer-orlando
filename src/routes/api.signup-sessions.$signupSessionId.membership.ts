import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const payloadSchema = z.object({
  signupSessionId: z.string().regex(/^FH-[A-Z0-9]{10}$/),
  status: z.enum(["QR_SCANNED", "CHECKOUT_STARTED", "MEMBERSHIP_ACTIVE"]),
  taxCompProUserId: z.string().min(1).optional().nullable(),
  membershipId: z.string().min(1).optional().nullable(),
  plan: z.string().min(1).optional().nullable(),
  membershipStatus: z.string().min(1).optional().nullable(),
  integrationReference: z.string().optional().nullable(),
});

const statusOrder = {
  CREATED: 0,
  QR_SCANNED: 1,
  CHECKOUT_STARTED: 2,
  MEMBERSHIP_ACTIVE: 3,
  CARD_ISSUED: 4,
  EXPIRED: 5,
  CANCELLED: 5,
} as const;

export const Route = createFileRoute("/api/signup-sessions/$signupSessionId/membership")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const secret = process.env["FIELD_HUB_MEMBERSHIP_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "Webhook not configured" }, { status: 503 });

        const rawBody = await request.text();
        const provided = request.headers.get("x-field-hub-signature")?.replace(/^sha256=/, "");
        const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
        if (!provided || provided.length !== expected.length) {
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }
        if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        let json: unknown;
        try {
          json = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = payloadSchema.safeParse(json);
        if (!parsed.success || parsed.data.signupSessionId !== params.signupSessionId) {
          return Response.json({ error: "Invalid membership event" }, { status: 400 });
        }

        const event = parsed.data;
        if (
          event.status === "MEMBERSHIP_ACTIVE" &&
          (!event.taxCompProUserId || event.membershipStatus !== "ACTIVE")
        ) {
          return Response.json(
            { error: "Active membership requires taxCompProUserId and ACTIVE status" },
            { status: 422 },
          );
        }

        const { prisma } = await import("@/lib/prisma.server");
        const current = await prisma.signupSession.findUnique({
          where: { publicId: params.signupSessionId },
        });
        if (!current) return Response.json({ error: "Signup session not found" }, { status: 404 });
        if (current.status === "CARD_ISSUED") {
          return Response.json({ ok: true, status: current.status });
        }
        if (statusOrder[event.status] < statusOrder[current.status]) {
          return Response.json({ error: "Status regression is not allowed" }, { status: 409 });
        }

        const now = new Date();
        const identityFields = {
          ...(event.taxCompProUserId ? { taxCompProUserId: event.taxCompProUserId } : {}),
          ...(event.membershipId ? { membershipId: event.membershipId } : {}),
          ...(event.plan ? { membershipPlan: event.plan } : {}),
          ...(event.membershipStatus ? { membershipStatus: event.membershipStatus } : {}),
          ...(event.integrationReference
            ? { integrationReference: event.integrationReference }
            : {}),
        };
        const timestampFields = {
          ...(event.status === "QR_SCANNED" ? { qrScannedAt: now } : {}),
          ...(event.status === "CHECKOUT_STARTED" ? { checkoutStartedAt: now } : {}),
          ...(event.status === "MEMBERSHIP_ACTIVE" ? { completedAt: now } : {}),
        };
        const updated = await prisma.signupSession.update({
          where: { publicId: params.signupSessionId },
          data: {
            status: event.status,
            lastMembershipCheckAt: now,
            ...identityFields,
            ...timestampFields,
          },
        });

        return Response.json({ ok: true, status: updated.status });
      },
    },
  },
});
