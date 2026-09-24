import { createFileRoute } from "@tanstack/react-router";
import { ambassadorInputSchema } from "@/lib/ambassadors";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// Public: the embeddable brand ambassador form posts here from any site.
export const Route = createFileRoute("/api/public/ambassador-signup")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let raw: Record<string, unknown>;
        try {
          const type = request.headers.get("content-type") ?? "";
          raw = type.includes("application/json")
            ? await request.json()
            : Object.fromEntries((await request.formData()).entries());
        } catch {
          return json({ ok: false, error: "Invalid request." }, 400);
        }
        // Honeypot: bots fill hidden fields.
        if (raw["website_url"]) return json({ ok: true });

        const parsed = ambassadorInputSchema.safeParse(raw);
        if (!parsed.success) {
          return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form." }, 400);
        }
        const data = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const email = data.email.toLowerCase();
        const { data: existing } = await supabaseAdmin
          .from("ambassadors")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (existing) {
          await supabaseAdmin.from("ambassadors").update({ ...data, email }).eq("id", existing.id);
          return json({ ok: true });
        }
        const { error } = await supabaseAdmin
          .from("ambassadors")
          .insert({ ...data, email, stage: "applied", source: "web_form" });
        if (error) {
          console.error("[ambassador-signup] insert failed:", error);
          return json({ ok: false, error: "Couldn't save your details. Please try again." }, 500);
        }
        return json({ ok: true });
      },
    },
  },
});
