import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
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
  { name: "Atlas AI", note: "Ask-anything tax research assistant" },
  { name: "TaxCompPro", note: "Compliance workflow and client tracking" },
  { name: "Atlas Academy", note: "CE-ready training library" },
  { name: "30 Day Launch", note: "Start-a-practice sprint" },
  { name: "Schedule C Recon", note: "Reconstruct records that survive audit" },
  { name: "ProConnect Card", note: "Member benefits and referral network" },
];

function Hub() {
  const { session } = useAuth();

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
        <Brief label="Show" value="IRS Nationwide Tax Forum" />
        <Brief label="City" value="Orlando, FL" />
      </div>

      <SectionLabel>Product demos</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((demo) => (
          <div key={demo.name} className="rounded-xl border border-border bg-panel p-4">
            <div className="font-display text-lg">{demo.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{demo.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        {session ? (
          <span className="eyebrow">Signed in · scans are attributed to you</span>
        ) : (
          <Link to="/auth" className="eyebrow hover:text-foreground">
            Booth staff sign in →
          </Link>
        )}
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
