import { createFileRoute } from "@tanstack/react-router";

/**
 * Permanent card address. Every NFC card is written once with this URL and
 * never has to be rewritten: the destination is resolved at tap time, so
 * migrating to the main site later is a data change (override_target_url),
 * not a re-encoding of physical cards.
 */
export const Route = createFileRoute("/c/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = String(params.token ?? "").slice(0, 64);
        const origin = new URL(request.url).origin;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: card } = await supabaseAdmin
          .from("card_tokens")
          .select("id, status, override_target_url, tap_count, connect_profiles(slug, published)")
          .eq("token", token)
          .maybeSingle();

        if (!card || card.status === "void") {
          return Response.redirect(`${origin}/card-not-found`, 302);
        }

        void supabaseAdmin
          .from("card_tokens")
          .update({ tap_count: (card.tap_count ?? 0) + 1, last_tap_at: new Date().toISOString() })
          .eq("id", card.id)
          .then(() => undefined);

        const profile = card.connect_profiles as { slug: string; published: boolean } | null;
        const target =
          card.override_target_url ??
          (profile?.slug ? `${origin}/p/${profile.slug}` : `${origin}/card-not-found`);

        return new Response(null, {
          status: 302,
          headers: { Location: target, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
