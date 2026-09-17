import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { FieldShell, PageTitle, SectionLabel, Panel } from "@/components/FieldShell";
import { getFunnelStats, type FunnelStats } from "@/lib/funnel.functions";
import { fetchMembersSafe } from "@/lib/members-client";
import type { MemberRow } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/funnel")({
  head: () => ({
    meta: [
      { title: "Funnel Overview — Membership Hub" },
      {
        name: "description",
        content:
          "Stage-by-stage view of the lead-to-paid membership funnel: badge scans, signup nudges, free accounts, upgrade offers and paid members.",
      },
      { property: "og:title", content: "Funnel Overview — Membership Hub" },
      {
        property: "og:description",
        content: "See how many contacts sit in each stage of the Tax Comp Pro membership funnel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FunnelPage,
});

type Stage = {
  key: string;
  label: string;
  count: number;
  note: string;
  to?: string;
  segment?: string;
};

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function timeAgo(iso: string | undefined): string {
  if (!iso) return "never run";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "moments ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FunnelPage() {
  const stats = useServerFn(getFunnelStats);
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    stats()
      .then((data) => {
        if (live) setFunnel(data);
      })
      .catch(() => {
        if (live) setFunnel(null);
      });
    fetchMembersSafe().then((result) => {
      if (!live) return;
      setMembers(result.members);
      setMemberError(result.error);
    });
    return () => {
      live = false;
    };
  }, [stats]);

  const free = members.filter((m) => m.tier === "FREE").length;
  const paidRows = members.filter((m) => m.tier !== "FREE");
  const paid = paidRows.length;

  const stages: Stage[] = [
    {
      key: "captured",
      label: "Captured",
      count: funnel?.leadsTotal ?? 0,
      note: `${funnel?.leadsWithEmail ?? 0} reachable by email · ${funnel?.leadsLast7 ?? 0} new in 7 days`,
      segment: "lead",
    },
    {
      key: "nudged",
      label: "Signup nudge sent",
      count: funnel?.ruleCounts["lead_signup_nudge"] ?? 0,
      note: `Last sent ${timeAgo(funnel?.ruleLastSent["lead_signup_nudge"])} · runs every 6 hours`,
    },
    {
      key: "free",
      label: "Free account created",
      count: free,
      note: memberError ? "Member records unavailable right now" : "Signed up on taxcomppro.com",
      segment: "free",
    },
    {
      key: "offer",
      label: "Upgrade offer follow-up",
      count: funnel?.ruleCounts["upgrade_followup"] ?? 0,
      note: `Last sent ${timeAgo(funnel?.ruleLastSent["upgrade_followup"])} · runs daily`,
    },
    {
      key: "paid",
      label: "Paid member",
      count: paid,
      note: `Welcome email sent to ${funnel?.ruleCounts["welcome_on_upgrade"] ?? 0}`,
      segment: "paid",
    },
  ];

  const top = (stages[0]?.count ?? 0) || 1;

  return (
    <FieldShell eyebrowRight="Funnel" back={{ to: "/admin", label: "Back to Admin" }}>
      <PageTitle
        title="Funnel"
        accent="Overview"
        lede="Every stage from badge scan to paid membership, with how many people sit in each one and what the automations have already sent."
      />

      <SectionLabel>Stages</SectionLabel>
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const width = Math.max(6, Math.round((stage.count / top) * 100));
          const prev = index > 0 ? (stages[index - 1]?.count ?? 0) : null;
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-display text-lg">{stage.label}</div>
                <div className="font-mono text-2xl">{stage.count.toLocaleString()}</div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-signal to-go"
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{stage.note}</span>
                {prev !== null ? (
                  <span className="font-mono text-signal">
                    {pct(stage.count, prev)} of previous stage
                  </span>
                ) : null}
              </div>
            </>
          );

          return stage.segment ? (
            <Link
              key={stage.key}
              to="/segment/$segment"
              params={{ segment: stage.segment }}
              className="block rounded-xl border border-border bg-panel p-4 transition-transform hover:-translate-y-0.5"
            >
              {body}
            </Link>
          ) : (
            <Panel key={stage.key}>{body}</Panel>
          );
        })}
      </div>

      <SectionLabel>Conversion</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <div className="eyebrow">Lead → free</div>
          <div className="mt-1 font-mono text-2xl">{pct(free, funnel?.leadsTotal ?? 0)}</div>
        </Panel>
        <Panel>
          <div className="eyebrow">Free → paid</div>
          <div className="mt-1 font-mono text-2xl">{pct(paid, free + paid)}</div>
        </Panel>
        <Panel>
          <div className="eyebrow">Replies in 7 days</div>
          <div className="mt-1 font-mono text-2xl">{funnel?.repliesIn7 ?? 0}</div>
        </Panel>
      </div>

      <SectionLabel>Activity, last 7 days</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel>
          <div className="eyebrow">Emails sent</div>
          <div className="mt-1 font-mono text-2xl">{funnel?.emailsSent7 ?? 0}</div>
        </Panel>
        <Panel>
          <div className="eyebrow">Texts sent</div>
          <div className="mt-1 font-mono text-2xl">{funnel?.smsSent7 ?? 0}</div>
        </Panel>
      </div>

      {memberError ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Membership records are unavailable right now, so the free and paid stages show zero.
        </p>
      ) : null}
    </FieldShell>
  );
}
