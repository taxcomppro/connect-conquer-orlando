import { createFileRoute, Link } from "@tanstack/react-router";

import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Admin-only controls for the TCPC booth: auto-send text rules and referral link attribution settings.",
      },
      { property: "og:title", content: "Admin panel — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Manage booth text rules and referral attribution from one admin panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPanel,
});

function AdminPanel() {
  const { isAdmin, loading } = useIsAdmin();

  return (
    <FieldShell eyebrowRight="Admin only" back={{ to: "/", label: "Back to Field Hub" }}>
      <PageTitle
        title="Admin"
        accent="Panel"
        lede="Controls the floor team never needs to touch — text automation and referral attribution."
      />

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Checking your access…</p>
      ) : !isAdmin ? (
        <div className="mt-8 rounded-2xl border border-border bg-panel p-6">
          <div className="font-display text-xl">Admins only</div>
          <p className="mt-1 text-sm text-muted-foreground">
            This area is limited to booth admins. Head back to the hub to keep scanning.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-signal">
            Back to Field Hub →
          </Link>
        </div>
      ) : (
        <>
          <SectionLabel>Booth controls</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/automations"
              className="rounded-2xl border border-signal-line bg-signal-soft p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="text-2xl">⚡</div>
              <div className="mt-3 font-display text-xl">Text Rules</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Automatic follow-up texts on badge scan, outcome change or join — plus the message
                templates behind them.
              </p>
              <div className="mt-4 text-sm text-signal">Manage rules →</div>
            </Link>

            <Link
              to="/dub"
              className="rounded-2xl border border-gold/40 bg-gold/10 p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="text-2xl">◎</div>
              <div className="mt-3 font-display text-xl">Referral Attribution</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Pooled booth link, partner group and per-seller commission eligibility. Hidden from
                the floor team.
              </p>
              <div className="mt-4 text-sm text-gold">Open settings →</div>
            </Link>
          </div>
        </>
      )}
    </FieldShell>
  );
}
