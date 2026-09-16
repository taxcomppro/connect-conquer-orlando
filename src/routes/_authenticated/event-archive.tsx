import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGE_LABEL, STAGE_TONE, sessionName, type SignupSession, type Stage } from "@/lib/connect";

export const Route = createFileRoute("/_authenticated/event-archive")({
  head: () => ({
    meta: [
      { title: "Event Archive — Membership Hub" },
      {
        name: "description",
        content:
          "Track every booth signup from badge scan to membership, profile and issued ProConnect card, with rep and DUB attribution, plus the Orlando trip briefing.",
      },
      { property: "og:title", content: "Event Archive — Membership Hub" },
      {
        property: "og:description",
        content: "Every booth signup from scan to card, full attribution, and the archived team trip briefing.",
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

const SCHEDULE = [
  {
    label: "Set-Up",
    day: "Monday",
    time: "1:00 – 6:00 PM",
    note: "Everyone arrives at different times—head to Booth 540 when you land.",
  },
  { label: "Show Floor — Day 1", day: "Tuesday", time: "11:00 AM – 6:00 PM" },
  { label: "Show Floor — Day 2", day: "Wednesday", time: "10:00 AM – 2:30 PM" },
  { label: "Dismantle", day: "Wednesday", time: "2:30 – 4:30 PM" },
];

const WARDROBE = [
  {
    day: "Monday",
    occasion: "Arrival & Set-Up",
    attire: "Team T-shirt—comfortable for travel and setting up the booth.",
  },
  {
    day: "Tuesday",
    occasion: "Show Floor — Day 1",
    attire: "Polo shirt—your choice of black or white.",
  },
  {
    day: "Wednesday",
    occasion: "Show Floor — Day 2",
    attire: "Atlas AI jersey—to match the baseball-themed demo room.",
  },
];

const EVENINGS = [
  {
    day: "Monday",
    plan: "Q&A Kickback",
    detail: "At the house—a chance to get everyone up to speed before the show.",
  },
  {
    day: "Tuesday",
    plan: "Hotel Mixer",
    detail: "After the forum wraps—mix and mingle with fellow attendees at the hotel.",
  },
  {
    day: "Wednesday",
    plan: "Blue Martini Mixer",
    detail: "Business mixer at Blue Martini in Orlando.",
  },
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
      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain pb-3 [scrollbar-gutter:stable]">
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

      <SectionLabel>Trip briefing</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCHEDULE.map((item) => (
          <InfoCard key={`${item.day}-${item.label}`} title={item.label} eyebrow={item.day}>
            <div className="font-display text-xl">{item.time}</div>
            {item.note ? <p className="mt-2 text-sm text-muted-foreground">{item.note}</p> : null}
          </InfoCard>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoCard title="Booth Assignment" eyebrow="Exhibit floor">
          <div className="font-display text-2xl text-signal">540</div>
        </InfoCard>
        <InfoCard title="Bonaire 6 (Classroom)" eyebrow="Baseball-themed demo room">
          <div className="font-display text-lg">Wednesday, September 2</div>
          <div className="mt-1 text-sm text-muted-foreground">10:00 AM – 12:00 PM</div>
        </InfoCard>
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-panel p-5 sm:p-6">
        <div className="eyebrow">Veranda Palms Resort · Kissimmee</div>
        <h2 className="mt-2 font-display text-2xl">Team house</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          12 bedrooms · 15 beds · 11 baths · pool and spa
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <BriefItem
            label="Location"
            value="Kissimmee, Florida · exact address is in the team travel confirmation"
          />
          <BriefItem label="Check-in" value="Sunday, August 30 · 4:00 PM" />
          <BriefItem label="Check-out" value="Thursday, September 3 · 10:00 AM" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoCard title="Parking" eyebrow="At the house">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>2 garage spaces and 3 driveway spaces</li>
            <li>No street, sidewalk or grass parking</li>
            <li>Overflow parking is at the clubhouse, first-come, first-served</li>
          </ul>
        </InfoCard>
        <InfoCard title="House Rules" eyebrow="Please review">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>No smoking anywhere inside the house</li>
            <li>Grill use is $100 with propane included; notify the host first</li>
            <li>No parties or outside events; keep team activities respectful of the property</li>
          </ul>
        </InfoCard>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {WARDROBE.map((item) => (
          <InfoCard key={item.day} title={item.occasion} eyebrow={item.day}>
            <p className="text-sm text-muted-foreground">{item.attire}</p>
          </InfoCard>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
        <div className="eyebrow text-gold">Evening dress code</div>
        <p className="mt-2 text-sm">
          Business casual for every outing. For men: no hats, tank tops or open-toed shoes.
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {EVENINGS.map((item) => (
          <InfoCard key={item.day} title={item.plan} eyebrow={item.day}>
            <p className="text-sm text-muted-foreground">{item.detail}</p>
          </InfoCard>
        ))}
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
