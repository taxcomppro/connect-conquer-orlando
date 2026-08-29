import { createServerFn } from "@tanstack/react-start";
import { slugify } from "./connect";

type IntakeInput = {
  sessionId: string;
  displayName: string;
  credential?: string;
  title?: string;
  company?: string;
  city?: string;
  state?: string;
  email?: string;
  phone?: string;
  website?: string;
  bio?: string;
  services?: string[];
  showEmail?: boolean;
  showPhone?: boolean;
  showLocation?: boolean;
  membershipRef?: string;
  membershipPlan?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed ? trimmed : null;
}

/** Public: minimal prefill for the customer's own device. Guarded by the unguessable session id. */
export const getJoinSession = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string }) => {
    if (!input || !UUID_RE.test(input.sessionId ?? "")) throw new Error("Invalid signup link");
    return { sessionId: input.sessionId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("signup_sessions")
      .select("id, stage, full_name, email, phone, company, title, rep_name")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (!session) return null;

    const { data: profile } = await supabaseAdmin
      .from("connect_profiles")
      .select("slug")
      .eq("signup_session_id", session.id)
      .maybeSingle();

    return { ...session, slug: profile?.slug ?? null };
  });

/** Public: the customer completes their Connect profile on their own device. */
export const submitIntake = createServerFn({ method: "POST" })
  .validator((input: IntakeInput) => {
    if (!input || !UUID_RE.test(input.sessionId ?? "")) throw new Error("Invalid signup link");
    if (!text(input.displayName)) throw new Error("Name is required");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("signup_sessions")
      .select("id, stage")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("This signup link is no longer valid.");

    const displayName = text(data.displayName, 120)!;
    const fields = {
      display_name: displayName,
      credential: text(data.credential, 60),
      title: text(data.title, 120),
      company: text(data.company, 160),
      city: text(data.city, 80),
      state: text(data.state, 40),
      email: text(data.email, 160),
      phone: text(data.phone, 40),
      website: text(data.website, 200),
      bio: text(data.bio, 1000),
      services: (data.services ?? []).slice(0, 12).map((s) => String(s).slice(0, 60)),
      // safe privacy defaults: contact details stay hidden unless opted in
      show_email: data.showEmail === true,
      show_phone: data.showPhone === true,
      show_location: data.showLocation !== false,
      published: true,
    };

    const { data: existing } = await supabaseAdmin
      .from("connect_profiles")
      .select("id, slug")
      .eq("signup_session_id", session.id)
      .maybeSingle();

    let slug = existing?.slug ?? "";
    if (!existing) {
      const base = slugify(displayName) || "pro";
      for (let i = 0; i < 6; i += 1) {
        const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: clash } = await supabaseAdmin
          .from("connect_profiles")
          .select("id")
          .eq("slug", candidate)
          .maybeSingle();
        if (!clash) {
          slug = candidate;
          break;
        }
      }
      if (!slug) throw new Error("Could not allocate a profile address. Try again.");
    }

    if (existing) {
      const { error } = await supabaseAdmin
        .from("connect_profiles")
        .update(fields)
        .eq("id", existing.id);
      if (error) throw new Error("Could not save the profile.");
    } else {
      const { error } = await supabaseAdmin
        .from("connect_profiles")
        .insert({ ...fields, slug, signup_session_id: session.id });
      if (error) throw new Error("Could not create the profile.");
    }

    await supabaseAdmin
      .from("signup_sessions")
      .update({
        stage: "ready_for_card",
        full_name: displayName,
        email: fields.email,
        phone: fields.phone,
        company: fields.company,
        title: fields.title,
        membership_ref: text(data.membershipRef, 120),
        membership_plan: text(data.membershipPlan, 80),
        membership_confirmed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    await supabaseAdmin.from("signup_events").insert([
      {
        signup_session_id: session.id,
        event_type: "MEMBERSHIP_CONFIRMED",
        actor_label: "customer",
        payload: { ref: text(data.membershipRef, 120), plan: text(data.membershipPlan, 80) },
      },
      {
        signup_session_id: session.id,
        event_type: "PROFILE_CREATED",
        actor_label: "customer",
        payload: { slug },
      },
    ]);

    return { slug, ok: true };
  });

/** Public: the profile a card tap lands on. Hidden fields are stripped server-side. */
export const getPublicProfile = createServerFn({ method: "POST" })
  .validator((input: { slug: string }) => {
    const slug = text(input?.slug, 60);
    if (!slug) throw new Error("Missing profile");
    return { slug };
  })
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<import("@/integrations/supabase/types").Database>(
      process.env["SUPABASE_URL"]!,
      key,
      {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: profile } = await supabasePublic
      .from("connect_profiles")
      .select(
        "slug, display_name, credential, title, company, city, state, email, phone, website, bio, services, show_email, show_phone, show_location",
      )
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();

    if (!profile) return null;

    return {
      slug: profile.slug,
      displayName: profile.display_name,
      credential: profile.credential,
      title: profile.title,
      company: profile.company,
      location: profile.show_location
        ? [profile.city, profile.state].filter(Boolean).join(", ")
        : null,
      email: profile.show_email ? profile.email : null,
      phone: profile.show_phone ? profile.phone : null,
      website: profile.website,
      bio: profile.bio,
      services: profile.services ?? [],
    };
  });
