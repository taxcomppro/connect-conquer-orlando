import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGE_LABEL, STAGE_TONE, sessionName, type SignupSession, type Stage } from "@/lib/connect";

export const Route = createFileRoute("/_authenticated/event-archive")({
  head: () => ({
    meta: [
      { title: "Event archive — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Track every booth signup from badge scan to membership, profile and issued ProConnect card, with rep and DUB attribution.",
      },
      { property: "og:title", content: "Event archive — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Every booth signup from scan to card, with full attribution and export.",
      },
    ],
  }),
  component: EventArchivePage,
});

const BOARD_STAGES: Stage[] = [
  "scanned",
  "signup_sent",
  "membership_confirmed",
  "ready_for_card",
  "card_issued",
];

function EventArchivePage() {
  const [sessions, setSessions] = useState<SignupSession[]>([]);
  const [loading, setLoading] = useState(true);
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
      if (!BOARD_STAGES.includes(s.stage as Stage)) return false;
      if (!q) return true;
      return [s.full_name, s.email, s.company, s.attendee_id, s.dub_code, s.rep_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [sessions, query]);

  const columns = useMemo(
    () => BOARD_STAGES.map((stage) => ({ stage, sessions: visible.filter((session) => session.stage === stage) })),
    [visible],
  );

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
    <FieldShell eyebrowRight="Event archive" back={{ to: "/", label: "Back to hub" }}>
      <PageTitle
        title="Event"
        accent="archive"
        lede="Historical record of the Orlando forum booth: scan → membership → profile → card, with rep attribution."
      />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="In pipeline" value={stats.total} />
        <Stat label="Ready for card" value={stats.ready} tone="text-gold" />
        <Stat label="Cards issued" value={stats.issued} tone="text-go" />
      </div>

      <Input
        className="mt-5"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, firm, badge ID, DUB code…"
      />

      <SectionLabel>{loading ? "Loading…" : `${visible.length} in pipeline`}</SectionLabel>
      <div className="-mx-5 overflow-x-auto px-5 pb-3 sm:-mx-7 sm:px-7">
        <div className="grid min-w-[1020px] grid-cols-5 gap-3">
          {columns.map(({ stage, sessions: stageSessions }) => (
            <section key={stage} aria-labelledby={`archive-${stage}`}>
              <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
                <span
                  id={`archive-${stage}`}
                  className={`rounded-full border px-2.5 py-1 text-xs ${STAGE_TONE[stage]}`}
                >
                  {STAGE_LABEL[stage]}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{stageSessions.length}</span>
              </div>
              <div className="space-y-2">
                {stageSessions.map((session) => (
                  <Link
                    key={session.id}
                    to={
                      session.stage === "ready_for_card" || session.stage === "card_issued"
                        ? "/activate/$sessionId"
                        : "/signup/$sessionId"
                    }
                    params={{ sessionId: session.id }}
                    className="block min-h-28 rounded-xl border border-border bg-panel p-3 transition-colors hover:bg-panel-hover"
                  >
                    <div className="line-clamp-2 font-medium leading-snug">{sessionName(session)}</div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {session.company ? <div className="line-clamp-2">{session.company}</div> : null}
                      {session.rep_name ? <div className="truncate">Rep: {session.rep_name}</div> : null}
                      {session.dub_code ? <div className="truncate text-gold">{session.dub_code}</div> : null}
                    </div>
                  </Link>
                ))}
                {!loading && stageSessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    No leads in this stage
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
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
