import { createServerFn } from "@tanstack/react-start";

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

/**
 * These signup routines are reachable by customers on their own device, but the
 * call always happens here on the server with privileged credentials. The
 * database routines themselves are NOT executable by anonymous callers, so the
 * unguessable session id validated above is the only entry point.
 */
async function publicRpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc(name, body);
  if (error) {
    throw new Error(error.message || "The signup service could not complete the request.");
  }
  return (data ?? null) as T | null;
}

/** Public: minimal prefill for the customer's own device. Guarded by the unguessable session id. */
export const getJoinSession = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string }) => {
    if (!input || !UUID_RE.test(input.sessionId ?? "")) throw new Error("Invalid signup link");
    return { sessionId: input.sessionId };
  })
  .handler(async ({ data }) => {
    return publicRpc<{
      id: string;
      stage: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      company: string | null;
      title: string | null;
      rep_name: string | null;
      slug: string | null;
    }>("get_public_join_session", { _session_id: data.sessionId });
  });

/** Public: the customer completes their Connect profile on their own device. */
export const submitIntake = createServerFn({ method: "POST" })
  .validator((input: IntakeInput) => {
    if (!input || !UUID_RE.test(input.sessionId ?? "")) throw new Error("Invalid signup link");
    if (!text(input.displayName)) throw new Error("Name is required");
    return input;
  })
  .handler(async ({ data }) => {
    const result = await publicRpc<{ slug: string; ok: boolean }>("submit_public_connect_profile", {
      _session_id: data.sessionId,
      _display_name: text(data.displayName, 120),
      _credential: text(data.credential, 60),
      _title: text(data.title, 120),
      _company: text(data.company, 160),
      _city: text(data.city, 80),
      _state: text(data.state, 40),
      _email: text(data.email, 160),
      _phone: text(data.phone, 40),
      _website: text(data.website, 200),
      _bio: text(data.bio, 1000),
      _services: (data.services ?? []).slice(0, 12).map((s) => String(s).slice(0, 60)),
      _show_email: data.showEmail === true,
      _show_phone: data.showPhone === true,
      _show_location: data.showLocation !== false,
      _membership_ref: text(data.membershipRef, 120),
      _membership_plan: text(data.membershipPlan, 80),
    });
    if (!result) throw new Error("This signup link is no longer valid.");
    return result;
  });

/** Public: the profile a card tap lands on. Hidden fields are stripped server-side. */
export const getPublicProfile = createServerFn({ method: "POST" })
  .validator((input: { slug: string }) => {
    const slug = text(input?.slug, 60);
    if (!slug) throw new Error("Missing profile");
    return { slug };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Privileged server-side read; hidden fields are stripped here so nothing
    // sensitive ever reaches the browser. The table is not readable by anon.
    const { data: profile } = await supabaseAdmin
      .from("connect_profiles")
      .select(
        "slug, display_name, credential, title, company, city, state, email, phone, website, bio, services, show_email, show_phone, show_location, published",
      )
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();

    if (!profile) return null;

    const location = profile.show_location
      ? [profile.city, profile.state].filter(Boolean).join(", ") || null
      : null;

    return {
      slug: profile.slug,
      displayName: profile.display_name ?? "Member",
      credential: profile.credential,
      title: profile.title,
      company: profile.company,
      location,
      email: profile.show_email ? profile.email : null,
      phone: profile.show_phone ? profile.phone : null,
      website: profile.website,
      bio: profile.bio,
      services: profile.services ?? [],
    };
  });

