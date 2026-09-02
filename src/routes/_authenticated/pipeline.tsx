import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGE_LABEL, STAGE_TONE, sessionName, type SignupSession, type Stage } from "@/lib/connect";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Sales pipeline — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Track every booth signup from badge scan to membership, profile and issued ProConnect card, with rep and DUB attribution.",
      },
      { property: "og:title", content: "Sales pipeline — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Every booth signup from scan to card, with full attribution and export.",
      },
    ],
  }),
  component: PipelinePage,
});

const FILTERS: Array<{ key: "all" | Stage; label: string }> = [
  { key: "all", label: "All" },
  { key: "signup_sent", label: "Waiting" },
  { key: "ready_for_card", label: "Ready for card" },
  { key: "card_issued", label: "Issued" },
];

function PipelinePage() {
  const [sessions, setSessions] = useState<SignupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Stage>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("signup_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (active) {
        setSessions(data ?? []);
        setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(load, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filter === "ready_for_card" && s.stage !== "ready_for_card") return false;
      if (filter === "card_issued" && s.stage !== "card_issued") return false;
      if (filter === "signup_sent" && !["scanned", "signup_sent", "membership_confirmed"].includes(s.stage))
        return false;
      if (!q) return true;
      return [s.full_name, s.email, s.company, s.attendee_id, s.dub_code, s.rep_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [sessions, filter, query]);

  const stats = useMemo(
    () => ({
      total: sessions.length,
      ready: sessions.filter((s) => s.stage === "ready_for_card").length,
      issued: sessions.filter((s) => s.stage === "card_issued").length,
    }),
    [sessions],
  );

  async function exportMigrationBundle() {
    const [{ data: profiles }, { data: cards }, { data: events }] = await Promise.all([
      supabase.from("connect_profiles").select("*"),
      supabase.from("card_tokens").select("*"),
      supabase.from("signup_events").select("*"),
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      source: "tcpc-field-hub",
      signupSessions: sessions,
      connectProfiles: profiles ?? [],
      cardTokens: cards ?? [],
      signupEvents: events ?? [],
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcpc-field-hub-migration-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <FieldShell eyebrowRight="Sales pipeline" back={{ to: "/", label: "Back to hub" }}>
      <PageTitle
        title="Sales"
        accent="pipeline"
        lede="Scan → membership → profile → card. Every step attributed to the rep who started it."
      />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="In pipeline" value={stats.total} />
        <Stat label="Ready for card" value={stats.ready} tone="text-gold" />
        <Stat label="Cards issued" value={stats.issued} tone="text-go" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              filter === option.key
                ? "border-signal-line bg-signal-soft text-signal"
                : "border-border bg-panel text-muted-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Input
        className="mt-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, firm, badge ID, DUB code…"
      />

      <SectionLabel>{loading ? "Loading…" : `${visible.length} in pipeline`}</SectionLabel>
      <div className="space-y-2">
        {visible.map((session) => (
          <Link
            key={session.id}
            to={
              session.stage === "ready_for_card" || session.stage === "card_issued"
                ? "/activate/$sessionId"
                : "/signup/$sessionId"
            }
            params={{ sessionId: session.id }}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel p-4 transition-colors hover:bg-panel-hover"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{sessionName(session)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[session.company, session.rep_name && `Rep: ${session.rep_name}`, session.dub_code]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${STAGE_TONE[session.stage as Stage]}`}
            >
              {STAGE_LABEL[session.stage as Stage]}
            </span>
          </Link>
        ))}
        {!loading && !visible.length ? (
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Start one from a scanned lead.
          </p>
        ) : null}
      </div>

      <SectionLabel>Migration</SectionLabel>
      <div className="rounded-2xl border border-border bg-panel p-5">
        <p className="text-sm text-muted-foreground">
          Exports every signup, profile, card token and event as one JSON file with stable IDs —
          the handoff package for loading into the main site after the show.
        </p>
        <Button variant="outline" onClick={exportMigrationBundle} className="mt-4 h-12 w-full">
          Download migration bundle
        </Button>
      </div>
    </FieldShell>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-display text-2xl ${tone}`}>{value}</div>
    </div>
  );
}
