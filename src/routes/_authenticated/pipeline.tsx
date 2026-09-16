import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageComposer, type ComposeContact } from "@/components/MessageComposer";
import { leadName, type Lead } from "@/lib/leads";
import { listMembers, type MemberRow } from "@/lib/members.functions";
import { normalizeEmail, TIER_AUDIENCES, type Tier } from "@/lib/audience";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Membership Pipeline — Membership Hub" },
      {
        name: "description",
        content:
          "Track every contact from lead to free member to paid VIP, Marketplace and Marketplace+ membership.",
      },
      { property: "og:title", content: "Membership Pipeline — Membership Hub" },
      {
        property: "og:description",
        content: "Convert free members to paid: leads, free, VIP, Marketplace and Marketplace+.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

const TIER_COLUMNS: { key: "lead" | Tier; label: string; tone: string; paid: boolean }[] = [
  { key: "lead", label: "Lead", tone: "border-border bg-panel text-muted-foreground", paid: false },
  { key: "FREE", label: "Free", tone: "border-signal-line bg-signal-soft text-signal", paid: false },
  { key: "VIP", label: "VIP", tone: "border-gold/50 bg-gold/10 text-gold", paid: true },
  {
    key: "MARKETPLACE",
    label: "Marketplace",
    tone: "border-go-line bg-go-soft text-go",
    paid: true,
  },
  {
    key: "MARKETPLACE_PLUS",
    label: "Marketplace+",
    tone: "border-go-line bg-go-soft text-go",
    paid: true,
  },
];

type Card = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  attendeeId: string | null;
  leadId: string | null;
};

function PipelinePage() {
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

  const columns = useMemo(() => {
    const memberEmails = new Set(members.map((m) => normalizeEmail(m.email)).filter(Boolean));
    const leadByEmail = new Map<string, Lead>();
    for (const lead of leads) {
      const email = normalizeEmail(lead.email);
      if (email && !leadByEmail.has(email)) leadByEmail.set(email, lead);
    }

    const leadCards: Card[] = leads
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

    const byTier = (tier: Tier): Card[] =>
      members
        .filter((m) => m.tier === tier)
        .map((m) => {
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
        });

    const q = query.trim().toLowerCase();
    const match = (card: Card) =>
      !q || [card.name, card.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));

    return TIER_COLUMNS.map((column) => ({
      ...column,
      cards: (column.key === "lead" ? leadCards : byTier(column.key)).filter(match),
    }));
  }, [leads, members, query]);

  const allCards = useMemo(() => columns.flatMap((column) => column.cards), [columns]);

  const selectedContacts = useMemo<ComposeContact[]>(
    () =>
      allCards
        .filter((card) => selected[card.id])
        .map((card) => ({
          id: card.id,
          name: card.name,
          email: card.email,
          leadId: card.leadId,
        })),
    [allCards, selected],
  );

  function toggleCard(id: string) {
    setSelected((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  function selectSegment(key: Tier | "lead") {
    const column = columns.find((c) => c.key === key);
    if (!column) return;
    setSelected(Object.fromEntries(column.cards.map((card) => [card.id, true as const])));
  }

  const stats = useMemo(() => {
    const paid = members.filter((m) => m.tier !== "FREE").length;
    const free = members.filter((m) => m.tier === "FREE").length;
    return {
      free,
      paid,
      rate: members.length ? Math.round((paid / members.length) * 100) : 0,
    };
  }, [members]);

  return (
    <FieldShell eyebrowRight="Membership pipeline">
      <PageTitle
        title="Membership"
        accent="pipeline"
        lede="Leads who never signed up, free members to convert, and every paid tier — ongoing."
      />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Free members" value={stats.free} />
        <Stat label="Paid members" value={stats.paid} tone="text-go" />
        <Stat label="Paid share" value={`${stats.rate}%`} tone="text-gold" />
      </div>

      <Input
        className="mt-5"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or email…"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="eyebrow">Select</span>
        {TIER_AUDIENCES.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => selectSegment(option.key)}
            className="rounded-full border border-border bg-panel px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelected(Object.fromEntries(allCards.map((c) => [c.id, true as const])))}
          className="rounded-full border border-border bg-panel px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Everyone
        </button>
        {selectedContacts.length > 0 ? (
          <>
            <Button
              className="h-9"
              onClick={() => setComposerOpen(true)}
            >
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

      {memberError ? (
        <div className="mt-5 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-gold">
          Membership records are unavailable right now, so only leads are shown. {memberError}
        </div>
      ) : null}

      <SectionLabel>{loading ? "Loading…" : "By membership tier"}</SectionLabel>
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-3 [scrollbar-gutter:stable]">
        <div className="grid min-w-[820px] grid-cols-5 gap-3 xl:min-w-0">
          {columns.map((column) => (
            <section key={column.key} aria-labelledby={`tier-${column.key}`}>
              <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
                <span
                  id={`tier-${column.key}`}
                  className={`rounded-full border px-2.5 py-1 text-xs ${column.tone}`}
                >
                  {column.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {column.cards.length}
                </span>
              </div>
              <div className="space-y-2">
                {column.cards.map((card) => (
                  <MemberCard
                    key={card.id}
                    card={card}
                    showStatus={column.paid}
                    selected={Boolean(selected[card.id])}
                    onToggle={() => toggleCard(card.id)}
                  />
                ))}
                {!loading && column.cards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    Nobody in this tier
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </FieldShell>
  );
}

function MemberCard({
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

function Stat({ label, value, tone = "" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-display text-2xl ${tone}`}>{value}</div>
    </div>
  );
}
