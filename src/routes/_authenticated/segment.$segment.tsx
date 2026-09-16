import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageComposer, type ComposeContact } from "@/components/MessageComposer";
import { leadName, type Lead } from "@/lib/leads";
import { listMembers, type MemberRow } from "@/lib/members.functions";
import { normalizeEmail, type Tier } from "@/lib/audience";

type SegmentKey = "lead" | "free" | "paid" | "all" | "VIP" | "MARKETPLACE" | "MARKETPLACE_PLUS";

const SEGMENTS: Record<
  SegmentKey,
  { label: string; tone: string; lede: string; paid: boolean }
> = {
  lead: {
    label: "Leads",
    tone: "border-border bg-panel text-muted-foreground",
    lede: "Contacts captured at the booth or added by hand who never created an account.",
    paid: false,
  },
  free: {
    label: "Free members",
    tone: "border-signal-line bg-signal-soft text-signal",
    lede: "Members on the free tier — the pool to convert to paid.",
    paid: false,
  },
  paid: {
    label: "Paid members",
    tone: "border-go-line bg-go-soft text-go",
    lede: "Everyone on VIP, Marketplace or Marketplace+.",
    paid: true,
  },
  all: {
    label: "All members",
    tone: "border-border bg-panel text-muted-foreground",
    lede: "Every member account, free and paid.",
    paid: true,
  },
  VIP: {
    label: "VIP",
    tone: "border-gold/50 bg-gold/10 text-gold",
    lede: "Members on the VIP tier.",
    paid: true,
  },
  MARKETPLACE: {
    label: "Marketplace",
    tone: "border-go-line bg-go-soft text-go",
    lede: "Members on the Marketplace tier.",
    paid: true,
  },
  MARKETPLACE_PLUS: {
    label: "Marketplace+",
    tone: "border-go-line bg-go-soft text-go",
    lede: "Members on the Marketplace+ tier.",
    paid: true,
  },
};

function resolveSegment(raw: string): SegmentKey {
  const key = raw as SegmentKey;
  return key in SEGMENTS ? key : "all";
}

export const Route = createFileRoute("/_authenticated/segment/$segment")({
  head: ({ params }) => {
    const segment = SEGMENTS[resolveSegment(params.segment)];
    return {
      meta: [
        { title: `${segment.label} — Membership Hub` },
        { name: "description", content: segment.lede },
        { property: "og:title", content: `${segment.label} — Membership Hub` },
        { property: "og:description", content: segment.lede },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: SegmentPage,
});

type Card = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  attendeeId: string | null;
  leadId: string | null;
};

function SegmentPage() {
  const { segment: rawSegment } = Route.useParams();
  const segmentKey = resolveSegment(rawSegment);
  const segment = SEGMENTS[segmentKey];

  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [leadResult, memberResult] = await Promise.all([
        supabase.from("leads").select("*").order("scanned_at", { ascending: false }),
        listMembers().catch((error: unknown) => ({
          members: [] as MemberRow[],
          error: error instanceof Error ? error.message : "Couldn't load membership records.",
        })),
      ]);
      if (!active) return;
      setLeads(leadResult.data ?? []);
      setMembers(memberResult.members);
      setMemberError(memberResult.error);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelected({});
    setComposerOpen(false);
  }, [segmentKey]);

  const cards = useMemo<Card[]>(() => {
    const memberEmails = new Set(members.map((m) => normalizeEmail(m.email)).filter(Boolean));
    const leadByEmail = new Map<string, Lead>();
    for (const lead of leads) {
      const email = normalizeEmail(lead.email);
      if (email && !leadByEmail.has(email)) leadByEmail.set(email, lead);
    }

    const memberCard = (m: MemberRow): Card => {
      const email = normalizeEmail(m.email);
      const lead = email ? leadByEmail.get(email) : undefined;
      return {
        id: `member:${m.userId}`,
        name: m.name || m.email || "Member",
        email: m.email,
        status: m.subscriptionStatus,
        attendeeId: lead?.attendee_id ?? null,
        leadId: lead?.id ?? null,
      };
    };

    let list: Card[];
    if (segmentKey === "lead") {
      list = leads
        .filter((lead) => {
          const email = normalizeEmail(lead.email);
          return !email || !memberEmails.has(email);
        })
        .map((lead) => ({
          id: `lead:${lead.id}`,
          name: leadName(lead),
          email: lead.email,
          status: null,
          attendeeId: lead.attendee_id,
          leadId: lead.id,
        }));
    } else if (segmentKey === "free") {
      list = members.filter((m) => m.tier === "FREE").map(memberCard);
    } else if (segmentKey === "paid") {
      list = members.filter((m) => m.tier !== "FREE").map(memberCard);
    } else if (segmentKey === "all") {
      list = members.map(memberCard);
    } else {
      list = members.filter((m) => m.tier === (segmentKey as Tier)).map(memberCard);
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((card) =>
      [card.name, card.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [leads, members, query, segmentKey]);

  const selectedContacts = useMemo<ComposeContact[]>(
    () =>
      cards
        .filter((card) => selected[card.id])
        .map((card) => ({ id: card.id, name: card.name, email: card.email, leadId: card.leadId })),
    [cards, selected],
  );

  function toggleCard(id: string) {
    setSelected((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  return (
    <FieldShell eyebrowRight={segment.label}>
      <PageTitle title={segment.label} accent="group" lede={segment.lede} />

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <Link to="/pipeline" className="text-muted-foreground hover:text-foreground">
          Full pipeline
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          {loading ? "Loading…" : `${cards.length} contacts`}
        </span>
      </div>

      <Input
        className="mt-5"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or email…"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelected(Object.fromEntries(cards.map((c) => [c.id, true as const])))}
          className="rounded-full border border-border bg-panel px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Select all ({cards.length})
        </button>
        {selectedContacts.length > 0 ? (
          <>
            <Button className="h-9" onClick={() => setComposerOpen(true)}>
              Message selected ({selectedContacts.length})
            </Button>
            <button
              type="button"
              onClick={() => {
                setSelected({});
                setComposerOpen(false);
              }}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          </>
        ) : null}
      </div>

      {composerOpen && selectedContacts.length > 0 ? (
        <MessageComposer contacts={selectedContacts} onClose={() => setComposerOpen(false)} />
      ) : null}

      {memberError && segmentKey !== "lead" ? (
        <div className="mt-5 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold">
          Membership records are unavailable right now. {memberError}
        </div>
      ) : null}

      <SectionLabel>Contacts</SectionLabel>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SegmentCard
            key={card.id}
            card={card}
            showStatus={segment.paid}
            selected={Boolean(selected[card.id])}
            onToggle={() => toggleCard(card.id)}
          />
        ))}
      </div>
      {!loading && cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
          Nobody in this group yet
        </div>
      ) : null}
    </FieldShell>
  );
}

function SegmentCard({
  card,
  showStatus,
  selected,
  onToggle,
}: {
  card: Card;
  showStatus: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const details = (
    <>
      <div className="line-clamp-2 font-medium leading-snug">{card.name}</div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {card.email ? <div className="truncate">{card.email}</div> : null}
        {showStatus && card.status ? <div className="truncate text-go">{card.status}</div> : null}
      </div>
    </>
  );

  return (
    <div
      className={`flex min-h-24 gap-2 rounded-xl border bg-panel p-3 transition-colors ${
        selected ? "border-signal-line bg-signal-soft" : "border-border"
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${card.name}`}
      />
      {card.email ? (
        <Link
          to="/contact/$email"
          params={{ email: encodeURIComponent(card.email) }}
          className="min-w-0 flex-1 hover:text-signal"
        >
          {details}
        </Link>
      ) : card.attendeeId ? (
        <Link
          to="/lead/$attendeeId"
          params={{ attendeeId: card.attendeeId }}
          className="min-w-0 flex-1 hover:text-signal"
        >
          {details}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{details}</div>
      )}
    </div>
  );
}
