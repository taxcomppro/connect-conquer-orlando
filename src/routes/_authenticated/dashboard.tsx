import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FieldShell, PageTitle, Panel, SectionLabel } from "@/components/FieldShell";
import { supabase } from "@/integrations/supabase/client";
import { listMembers, type MemberRow } from "@/lib/members.functions";
import type { Tier } from "@/lib/audience";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Field Hub Member CRM" },
      {
        name: "description",
        content: "Monitor free and paid membership totals, conversion rate and new leads in Field Hub.",
      },
      { property: "og:title", content: "Dashboard — Field Hub Member CRM" },
      {
        property: "og:description",
        content: "A live view of membership tiers, paid conversion rate and new leads captured today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const PAID_TIERS: { tier: Tier; label: string; tone: string }[] = [
  { tier: "VIP", label: "VIP", tone: "border-gold/50 bg-gold/10 text-gold" },
  { tier: "MARKETPLACE", label: "Marketplace", tone: "border-go-line bg-go-soft text-go" },
  { tier: "MARKETPLACE_PLUS", label: "Marketplace+", tone: "border-go-line bg-go-soft text-go" },
];

function DashboardPage() {
  const [leads, setLeads] = useState<Array<{ id: string; scanned_at: string }>>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const [leadResult, memberResult] = await Promise.all([
        supabase.from("leads").select("id,scanned_at"),
        listMembers().catch((error: unknown) => ({
          members: [] as MemberRow[],
          error: error instanceof Error ? error.message : "Couldn't load membership records.",
        })),
      ]);
      if (!active) return;

      setLoadFailed(Boolean(leadResult.error));
      setLeads(leadResult.data ?? []);
      setMembers(memberResult.members);
      setMemberError(memberResult.error);
      setLoading(false);
    }

    void load();
    const timer = window.setInterval(load, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const metrics = useMemo(() => {
    const free = members.filter((m) => m.tier === "FREE").length;
    const paid = members.filter((m) => m.tier !== "FREE").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      free,
      paid,
      total: members.length,
      conversionRate: members.length ? (paid / members.length) * 100 : 0,
      newLeadsToday: leads.filter(
        (lead) => new Date(lead.scanned_at).getTime() >= today.getTime(),
      ).length,
      byTier: PAID_TIERS.map((entry) => ({
        ...entry,
        count: members.filter((m) => m.tier === entry.tier).length,
      })),
    };
  }, [leads, members]);

  return (
    <FieldShell eyebrowRight="Membership overview">
      <PageTitle
        title="Field Hub"
        accent="dashboard"
        lede="Free and paid membership totals, paid conversion rate and new leads captured today."
      />

      {loadFailed ? (
        <Panel className="mt-6 border-destructive/50 text-sm text-destructive">
          The latest lead totals could not be loaded. We’ll try again automatically.
        </Panel>
      ) : null}

      {memberError ? (
        <div className="mt-6 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold">
          Membership records are unavailable right now. {memberError}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Free members" value={loading ? "—" : metrics.free.toLocaleString()} />
        <Metric
          label="Paid members"
          value={loading ? "—" : metrics.paid.toLocaleString()}
          tone="text-go"
          detail={loading ? undefined : `${metrics.total.toLocaleString()} members total`}
        />
        <Metric
          label="Conversion rate"
          value={loading ? "—" : `${metrics.conversionRate.toFixed(1)}%`}
          tone="text-gold"
          detail="Paid ÷ all members"
        />
        <Metric
          label="New leads today"
          value={loading ? "—" : metrics.newLeadsToday.toLocaleString()}
          tone="text-signal"
        />
      </div>

      <SectionLabel>Paid tiers</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.byTier.map((entry) => (
          <Link key={entry.tier} to="/pipeline" className="group block">
            <Panel className="h-full transition-colors group-hover:bg-panel-hover">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${entry.tone}`}>
                {entry.label}
              </span>
              <div className="mt-4 font-display text-3xl">{loading ? "—" : entry.count}</div>
              <div className="mt-1 text-xs text-muted-foreground">View in pipeline →</div>
            </Panel>
          </Link>
        ))}
      </div>
    </FieldShell>
  );
}

function Metric({
  label,
  value,
  tone = "text-foreground",
  detail,
}: {
  label: string;
  value: string;
  tone?: string;
  detail?: string;
}) {
  return (
    <Panel className="min-h-28">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 font-display text-3xl ${tone}`}>{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
    </Panel>
  );
}
