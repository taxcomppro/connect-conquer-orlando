import { createFileRoute, Link } from "@tanstack/react-router";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TCPC Field Hub — IRS Forum Orlando, Booth 540" },
      {
        name: "description",
        content:
          "The Tax Compliance Pro booth team hub for the IRS Nationwide Tax Forum in Orlando: badge scanning, lead qualification, TCPC join flow, demos and the trip briefing.",
      },
      { property: "og:title", content: "TCPC Field Hub — IRS Forum Orlando, Booth 540" },
      {
        property: "og:description",
        content:
          "Scan badges, qualify leads and sign up new TCPC members from Booth 540 in Orlando.",
      },
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
  return (
    <FieldShell eyebrowRight="IRS Nationwide Tax Forum · Orlando">
      <PageTitle
        title="Field Hub —"
        accent="Booth 540"
        lede="Everything the floor team needs in one place. Scan a badge, qualify the lead, close the TCPC join before they walk away."
      />

      <SectionLabel>Lead capture</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
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
            Review the day's scans, track TCPC joins and export a CSV for follow-up.
          </p>
          <div className="mt-4 text-sm text-go">View leads →</div>
        </Link>
      </div>

      <SectionLabel>Trip briefing</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Brief label="Booth" value="540" />
        <Brief label="Tuesday" value="Show Floor 11:00 AM – 6:00 PM" />
        <Brief label="Wednesday" value="Show Floor 10:00 AM – 2:30 PM" />
      </div>

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
