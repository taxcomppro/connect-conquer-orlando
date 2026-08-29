import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { FieldShell, PageTitle } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { issueProConnectCard, refreshMembershipStatus } from "@/lib/signup-sessions.functions";
import {
  STATUS_LABELS,
  isReadyForCard,
  type SignupSession,
  type SignupSessionStatus,
} from "@/lib/signup-sessions";

export const Route = createFileRoute("/_authenticated/signups")({
  head: () => ({
    meta: [
      { title: "Event Signups — TCPC Field Hub" },
      {
        name: "description",
        content: "Track pending and completed TCPC event signups and issue ProConnect cards.",
      },
    ],
  }),
  component: SignupsPage,
});

type Scope = "mine" | "event";
type Queue = "pending" | "completed" | "all";

type LeadSummary = {
  id: string;
  attendee_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
};
type StaffSummary = { id: string; display_name: string };

const pendingStatuses: SignupSessionStatus[] = ["CREATED", "QR_SCANNED", "CHECKOUT_STARTED"];
const completedStatuses: SignupSessionStatus[] = ["MEMBERSHIP_ACTIVE", "CARD_ISSUED"];

function SignupsPage() {
  const { user, session: authSession } = useAuth();
  const refreshFromMainSite = useServerFn(refreshMembershipStatus);
  const activateProConnectCard = useServerFn(issueProConnectCard);
  const [sessions, setSessions] = useState<SignupSession[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadSummary>>({});
  const [staff, setStaff] = useState<Record<string, StaffSummary>>({});
  const [scope, setScope] = useState<Scope>("mine");
  const [queue, setQueue] = useState<Queue>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("signup_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Couldn't load event signups.");
      setLoading(false);
      return;
    }

    const next = data ?? [];
    setSessions(next);
    const leadIds = [...new Set(next.map((session) => session.lead_id))];
    const staffIds = [
      ...new Set(
        next
          .flatMap((session) => [
            session.scanned_by_staff_id,
            session.attributed_to_staff_id,
            session.card_issued_by_staff_id,
          ])
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [leadResult, staffResult] = await Promise.all([
      leadIds.length
        ? supabase
            .from("leads")
            .select("id,attendee_id,first_name,last_name,company")
            .in("id", leadIds)
        : Promise.resolve({ data: [], error: null }),
      staffIds.length
        ? supabase.from("staff_profiles").select("id,display_name").in("id", staffIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setLeads(Object.fromEntries((leadResult.data ?? []).map((lead) => [lead.id, lead])));
    setStaff(Object.fromEntries((staffResult.data ?? []).map((person) => [person.id, person])));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadSessions();
    const timer = window.setInterval(() => void loadSessions(), 15_000);
    return () => window.clearInterval(timer);
  }, [loadSessions]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sessions.filter((session) => {
      if (scope === "mine" && session.scanned_by_staff_id !== user?.id) return false;
      if (queue === "pending" && !pendingStatuses.includes(session.status)) return false;
      if (queue === "completed" && !completedStatuses.includes(session.status)) return false;
      const lead = leads[session.lead_id];
      if (!query) return true;
      return [
        session.public_id,
        session.badge_lead_id,
        session.membership_plan,
        lead?.first_name,
        lead?.last_name,
        lead?.company,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [sessions, scope, queue, search, leads, user?.id]);

  async function checkStatus(session: SignupSession) {
    setBusyId(session.id);
    const result = await refreshFromMainSite({ data: { publicId: session.public_id } });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Signup is now ${STATUS_LABELS[result.session.status].toLowerCase()}.`);
    await loadSessions();
  }

  async function issueCard(session: SignupSession) {
    if (!authSession?.access_token) {
      toast.error("Your Field Hub session expired. Please sign in again.");
      return;
    }
    setBusyId(session.id);
    const result = await activateProConnectCard({
      data: { publicId: session.public_id, accessToken: authSession.access_token },
    });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(
      result.activation.status === "ACTIVE"
        ? "ProConnect card issued and profile is active."
        : "ProConnect card issued. The member can now finish activation.",
    );
    await loadSessions();
  }

  return (
    <FieldShell
      eyebrowRight={
        <Link to="/scan" className="transition-colors hover:text-foreground">
          Scan a badge →
        </Link>
      }
      back={{ to: "/", label: "Field Hub" }}
    >
      <PageTitle
        title="Event"
        accent="signups"
        lede="Track the attendee's checkout without moving membership or payment data into Field Hub."
      />

      <div className="mt-6 grid grid-cols-2 gap-2">
        <ScopeButton active={scope === "mine"} onClick={() => setScope("mine")}>
          My Signups
        </ScopeButton>
        <ScopeButton active={scope === "event"} onClick={() => setScope("event")}>
          All Event Signups
        </ScopeButton>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, firm, badge or signup ID"
          className="h-11"
        />
        <div className="flex shrink-0 gap-2">
          {(["pending", "completed", "all"] as Queue[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setQueue(option)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                queue === option
                  ? "border-signal-line bg-signal-soft text-signal"
                  : "border-border bg-panel text-muted-foreground"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="eyebrow animate-pulse">Loading signups…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-panel p-6 text-center text-sm text-muted-foreground">
            No signups in this queue yet.
          </div>
        ) : (
          visible.map((session) => {
            const lead = leads[session.lead_id];
            const name =
              [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") ||
              `Badge ${session.badge_lead_id}`;
            return (
              <article key={session.id} className="rounded-xl border border-border bg-panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg">{name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {[lead?.company, session.public_id].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <StatusChip status={session.status} />
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <Fact
                    label="Original attribution"
                    value={staff[session.attributed_to_staff_id]?.display_name || "Staff member"}
                  />
                  <Fact label="Plan" value={session.membership_plan || "Waiting"} />
                  <Fact
                    label="Card issued by"
                    value={
                      session.card_issued_by_staff_id
                        ? staff[session.card_issued_by_staff_id]?.display_name || "Staff member"
                        : "Not issued"
                    }
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {pendingStatuses.includes(session.status) ? (
                    <Button
                      variant="outline"
                      disabled={busyId === session.id}
                      onClick={() => checkStatus(session)}
                    >
                      {busyId === session.id ? "Checking…" : "Check membership status"}
                    </Button>
                  ) : null}
                  {isReadyForCard(session) ? (
                    <Button disabled={busyId === session.id} onClick={() => issueCard(session)}>
                      {busyId === session.id ? "Issuing…" : "Issue ProConnect card"}
                    </Button>
                  ) : null}
                  <Link
                    to="/lead/$attendeeId"
                    params={{ attendeeId: session.badge_lead_id }}
                    className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm"
                  >
                    Open lead →
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </FieldShell>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left font-display text-lg transition-colors ${
        active
          ? "border-signal-line bg-signal-soft text-signal"
          : "border-border bg-panel text-muted-foreground hover:bg-panel-hover"
      }`}
    >
      {children}
    </button>
  );
}

function StatusChip({ status }: { status: SignupSessionStatus }) {
  const tone =
    status === "CARD_ISSUED"
      ? "border-go-line bg-go-soft text-go"
      : status === "MEMBERSHIP_ACTIVE"
        ? "border-gold/50 bg-gold/15 text-gold"
        : "border-signal-line bg-signal-soft text-signal";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>
      {STATUS_LABELS[status]} · {status}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 truncate">{value}</div>
    </div>
  );
}
