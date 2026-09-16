import { createFileRoute, Link } from "@tanstack/react-router";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/hub")({
  head: () => ({
    meta: [
      { title: "Membership Hub — Tax Compliance Pro" },
      {
        name: "description",
        content:
          "The Tax Compliance Pro member CRM: leads from the IRS Nationwide Tax Forum, membership tiers, follow-up texting and conversion tracking.",
      },
      { property: "og:title", content: "Membership Hub — Tax Compliance Pro" },
      {
        property: "og:description",
        content:
          "Track TCPC leads and members from first scan to paid membership.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Hub,
});

const SITES = [
  {
    name: "TaxCompPro",
    note: "The main platform — marketplace, communities, and membership tiers.",
    href: "https://www.taxcomppro.com",
  },
  {
    name: "Atlas AI",
    note: "Real-time tax guidance — ask it anything live, on the spot.",
    href: "https://www.alwaysaskatlas.com",
  },
  {
    name: "ProConnect Card",
    note: "The $29 tap-to-share digital business card and profile.",
    href: "https://connect.taxcomppro.com",
  },
];

const TOOLKITS_AND_COURSES = [
  {
    name: "30 Day Tax Office Launch",
    note: "Build the systems, compliance, and client plan for a new office.",
    href: "https://30daylaunch.taxcomppro.com/",
  },
  {
    name: "Staff Audit Ready Due Diligence",
    note: "Train staff and keep every ERO compliance file organized and examination-ready.",
    href: "https://staff-audit-ready.safeguardpro-9185.chatgpt.site/",
  },
  {
    name: "IRS Fine Defense Toolkit",
    note: "Procedures and documentation for penalty and fine defense.",
    href: "https://irsfinedefense.taxcomppro.com/",
  },
  {
    name: "Schedule C Reconstruction Toolkit",
    note: "A structured approach to reconstructing business records.",
    href: "https://schedulecrecon.taxcomppro.com/",
  },
  {
    name: "Audit Ready Playbook",
    note: "Repeatable workpaper and review practices for defensible files.",
    href: "https://auditplaybook.taxcomppro.com/",
  },
  {
    name: "Credits & Filing Status Explained",
    note: "Practical guidance for documenting credits, dependents, and filing-status decisions.",
    href: "https://credits.taxcomppro.com/",
  },
];

function Hub() {
  const { isAdmin } = useIsAdmin();

  return (
    <FieldShell eyebrowRight="Tax Compliance Pro">
      <PageTitle
        title="Membership"
        accent="Hub"
        lede="Every lead and member in one place. From the first badge scan in Orlando to paid membership and beyond."
      />

      <SectionLabel>Two tracks: capture every lead, close the ones that buy</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/scan"
          className="group rounded-2xl border border-signal-line bg-signal-soft p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="text-2xl">▣</div>
          <div className="mt-3 font-display text-xl">Lead Scanner</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan the badge QR code and pull the attendee's full contact record in a second.
          </p>
          <div className="mt-4 text-sm text-signal">Open scanner →</div>
        </Link>

        <Link
          to="/leads"
          className="group rounded-2xl border border-go-line bg-go-soft p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="text-2xl">◈</div>
          <div className="mt-3 font-display text-xl">Captured Leads</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Every scan lands here. Mark follow-up, not a fit or sale, and export a CSV.
          </p>
          <div className="mt-4 text-sm text-go">View leads →</div>
        </Link>

        <Link
          to="/pipeline"
          className="group rounded-2xl border border-gold/40 bg-gold/10 p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="text-2xl">◎</div>
          <div className="mt-3 font-display text-xl">Sales Pipeline</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the leads that buy: membership, profile and ProConnect card activation.
          </p>
          <div className="mt-4 text-sm text-gold">Open pipeline →</div>
        </Link>

        {isAdmin ? (
          <Link
            to="/admin"
            className="group rounded-2xl border border-border bg-panel p-5 transition-transform hover:-translate-y-0.5"
          >
            <div className="text-2xl">⚙</div>
            <div className="mt-3 font-display text-xl">Admin Panel</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Text rules and referral attribution — admin only.
            </p>
            <div className="mt-4 text-sm text-muted-foreground">Open admin →</div>
          </Link>
        ) : null}
      </div>




      <SectionLabel>Trip briefing</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Brief label="Booth" value="540" />
        <Brief label="Tuesday" value="Show Floor 11:00 AM – 6:00 PM" />
        <Brief label="Wednesday" value="Show Floor 10:00 AM – 2:30 PM" />
      </div>

      <Link
        to="/event-archive"
        className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-gold/40 bg-gold/10 p-4 transition-colors hover:bg-gold/15"
      >
        <div>
          <div className="font-display text-lg">Team Orlando Trip Briefing</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Full schedule, lodging, daily wardrobe and evening plans.
          </p>
        </div>
        <span className="shrink-0 text-sm text-gold">Staff access →</span>
      </Link>

      <SectionLabel>Sites</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SITES.map((site) => (
          <a
            key={site.name}
            href={site.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border bg-panel p-4 transition-colors hover:bg-panel-hover"
          >
            <div className="font-display text-lg">{site.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{site.note}</p>
            <div className="mt-3 text-sm text-signal">Open site ↗</div>
          </a>
        ))}
      </div>

      <div className="mt-8 mb-3 flex items-center justify-between gap-4">
        <span className="eyebrow">Toolkits &amp; courses</span>
        <a
          href="https://www.taxcomppro.com/toolkits"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-signal hover:underline"
        >
          View full catalog ↗
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLKITS_AND_COURSES.map((product) => (
          <a
            key={product.name}
            href={product.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border bg-panel p-4 transition-colors hover:bg-panel-hover"
          >
            <div className="font-display text-lg">{product.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{product.note}</p>
            <div className="mt-3 text-sm text-signal">Open resource ↗</div>
          </a>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link to="/auth" className="eyebrow hover:text-foreground">
          Booth staff sign in →
        </Link>
      </div>
    </FieldShell>
  );
}

function Brief({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-display text-lg">{value}</div>
    </div>
  );
}
