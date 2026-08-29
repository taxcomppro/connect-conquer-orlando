import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicProfile } from "@/lib/booth.functions";
import { FieldShell } from "@/components/FieldShell";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const profile = await getPublicProfile({ data: { slug: params.slug } });
    if (!profile) throw notFound();
    return profile;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Profile unavailable — ProConnect" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.displayName} — ProConnect`;
    const description =
      loaderData.bio?.slice(0, 150) ||
      [loaderData.title, loaderData.company].filter(Boolean).join(" at ") ||
      "Tax professional on Tax Compliance Pro Connect.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => <Unavailable />,
  notFoundComponent: () => <Unavailable />,
  component: ProfilePage,
});

function Unavailable() {
  return (
    <FieldShell eyebrowRight="ProConnect">
      <h1 className="mt-10 font-display text-3xl">Profile unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This ProConnect profile isn't published yet.
      </p>
    </FieldShell>
  );
}

function ProfilePage() {
  const profile = Route.useLoaderData();

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-20 sm:px-7">
      <div className="pt-8 eyebrow">Tax Compliance Pro · Connect</div>

      <div className="mt-6 rounded-3xl border border-signal-line bg-signal-soft p-6">
        <h1 className="font-display text-3xl leading-tight font-medium tracking-tight">
          {profile.displayName}
          {profile.credential ? (
            <span className="text-signal">, {profile.credential}</span>
          ) : null}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {[profile.title, profile.company].filter(Boolean).join(" · ") || "Tax professional"}
        </p>
        {profile.location ? (
          <p className="mt-1 text-sm text-muted-foreground">{profile.location}</p>
        ) : null}
      </div>

      {profile.bio ? (
        <p className="mt-6 text-[15px] leading-relaxed whitespace-pre-line">{profile.bio}</p>
      ) : null}

      {profile.services.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {profile.services.map((service) => (
            <span
              key={service}
              className="rounded-full border border-go-line bg-go-soft px-3 py-1.5 text-sm text-go"
            >
              {service}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-8 space-y-2">
        {profile.email ? (
          <a
            href={`mailto:${profile.email}`}
            className="flex h-14 items-center justify-center rounded-xl border border-signal-line bg-signal-soft text-base text-signal"
          >
            Email {profile.displayName.split(" ")[0]}
          </a>
        ) : null}
        {profile.phone ? (
          <a
            href={`tel:${profile.phone}`}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-panel text-base"
          >
            Call {profile.phone}
          </a>
        ) : null}
        {profile.website ? (
          <a
            href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-panel text-base"
          >
            Visit website
          </a>
        ) : null}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <Link to="/" className="text-signal">
          Tax Compliance Pro
        </Link>
      </p>
    </div>
  );
}
