import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FieldShell, PageTitle, Panel, SectionLabel } from "@/components/FieldShell";
import { supabase } from "@/integrations/supabase/client";
import { STAGE_LABEL, STAGE_TONE, type Stage } from "@/lib/connect";
import type { Lead } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Field Hub Member CRM" },
      {
        name: "description",
        content: "Monitor lead volume, membership conversions and pipeline progress in Field Hub.",
      },
      { property: "og:title", content: "Dashboard — Field Hub Member CRM" },
      {
        property: "og:description",
        content: "A live view of booth leads, conversions and signup progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const ACTIVE_STAGES: Stage[] = [
  "scanned",
  "signup_sent",
  "membership_confirmed",
  "ready_for_card",
  "card_issued",
];

type DashboardSession = { id: string; stage: Stage };

function DashboardPage() {
  const [leads, setLeads] = useState<Array<Pick<Lead, "id" | "outcome" | "scanned_at">>>([]);
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const [leadResult, sessionResult] = await Promise.all([
        supabase.from("leads").select("id,outcome,scanned_at"),
        supabase.from("signup_sessions").select("id,stage"),
      ]);
      if (!active) return;

      setLoadFailed(Boolean(leadResult.error || sessionResult.error));
      setLeads(leadResult.data ?? []);
      setSessions((sessionResult.data ?? []) as DashboardSession[]);
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
    const total = leads.length;
    const converted = leads.filter((lead) => lead.outcome === "sale_closed").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      total,
      converted,
      conversionRate: total ? (converted / total) * 100 : 0,
      today: leads.filter((lead) => new Date(lead.scanned_at).getTime() >= today.getTime()).length,
    };
  }, [leads]);

  const stageCounts = useMemo(
    () =>
      ACTIVE_STAGES.map((stage) => ({
        stage,
        count: sessions.filter((session) => session.stage === stage).length,
      })),
    [sessions],
  );

  return (
    <FieldShell eyebrowRight="Live booth overview">
      <PageTitle
        title="Field Hub"
        accent="dashboard"
        lede="Lead capture, conversion and card activation progress at a glance."
      />

      {loadFailed ? (
        <Panel className="mt-6 border-destructive/50 text-sm text-destructive">
          The latest dashboard totals could not be loaded. We’ll try again automatically.
        </Panel>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total leads" value={loading ? "—" : metrics.total.toLocaleString()} />
        <Metric
          label="Conversion rate"
          value={loading ? "—" : `${metrics.conversionRate.toFixed(1)}%`}
          tone="text-go"
          detail={loading ? "Loading conversions…" : `${metrics.converted.toLocaleString()} converted`}
        />
        <Metric
          label="Scanned today"
          value={loading ? "—" : metrics.today.toLocaleString()}
          tone="text-signal"
        />
        <Metric
          label="In pipeline"
          value={loading ? "—" : sessions.length.toLocaleString()}
          tone="text-gold"
        />
      </div>

      <SectionLabel>Leads by stage</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stageCounts.map(({ stage, count }) => (
          <Link key={stage} to="/pipeline" className="group block">
            <Panel className="h-full transition-colors group-hover:bg-panel-hover">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${STAGE_TONE[stage]}`}>
                {STAGE_LABEL[stage]}
              </span>
              <div className="mt-4 font-display text-3xl">{loading ? "—" : count}</div>
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