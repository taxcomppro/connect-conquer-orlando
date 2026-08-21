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

const DEMOS = [
  {
    name: "Atlas AI",
    note: "Real-time tax guidance — ask it anything live, on the spot.",
    href: "https://www.alwaysaskatlas.com",
  },
  {
    name: "TaxCompPro",
    note: "The main platform — marketplace, communities, and membership tiers.",
    href: "https://www.taxcomppro.com",
  },
  {
    name: "ProConnect Card",
    note: "The $29 tap-to-share digital business card and profile.",
    href: "https://connect.taxcomppro.com",
  },
  {
    name: "Atlas Academy",
    note: "Courses, toolkits, and staff training, all under one profile.",
    href: "https://academy.taxcomppro.com",
  },
  {
    name: "30 Day Tax Office Launch",
    note: "Build the systems, compliance, and client plan for a new office.",
    href: "https://30daylaunch.taxcomppro.com",
  },
  {
    name: "Schedule C Reconstruction",
    note: "A structured approach to reconstructing business records.",
    href: "https://schedulecrecon.taxcomppro.com",
  },
  {
    name: "IRS Fine Defense",
    note: "Procedures and documentation for penalty and fine defense.",
    href: "https://irsfinedefense.taxcomppro.com",
  },
  {
    name: "Audit Ready Playbook",
    note: "Repeatable workpaper and review practices for defensible files.",
    href: "https://auditready.taxcomppro.com",
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

      <SectionLabel>Product demos</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((demo) => (
          <a
            key={demo.name}
            href={demo.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border bg-panel p-4 transition-colors hover:bg-panel-hover"
          >
            <div className="font-display text-lg">{demo.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{demo.note}</p>
            <div className="mt-3 text-sm text-signal">Open demo ↗</div>
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
