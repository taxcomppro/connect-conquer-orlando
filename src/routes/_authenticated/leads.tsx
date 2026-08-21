import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { leadName, toCsv, type Lead } from "@/lib/leads";
import { FieldShell, PageTitle } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Captured Leads — TCPC Lead Scanner" },
      {
        name: "description",
        content:
          "Review every badge scanned at Booth 540, track TCPC joins, and export the day's leads to CSV for follow-up.",
      },
      { property: "og:title", content: "Captured Leads — TCPC Lead Scanner" },
      {
        property: "og:description",
        content: "Review, filter and export the leads captured at the IRS Forum booth.",
      },
    ],
  }),
  component: LeadsPage,
});

type Filter = "all" | "hot" | "warm" | "cold" | "joined";

function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("scanned_at", { ascending: false });
      if (!active) return;
      if (error) toast.error("Couldn't load leads.");
      setLeads(data ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const stats = useMemo(
    () => ({
      total: leads.length,
      hot: leads.filter((l) => l.rating === "hot").length,
      joined: leads.filter((l) => l.joined_tcpc).length,
    }),
    [leads],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "joined" && !lead.joined_tcpc) return false;
      if (filter !== "all" && filter !== "joined" && lead.rating !== filter) return false;
      if (!query) return true;
      return [lead.first_name, lead.last_name, lead.company, lead.email, lead.attendee_id]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query));
    });
  }, [leads, filter, search]);

  function exportCsv() {
    const blob = new Blob([toCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tcpc-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const filters: Filter[] = ["all", "hot", "warm", "cold", "joined"];

  return (
    <FieldShell
      eyebrowRight={
        <Link to="/scan" className="transition-colors hover:text-foreground">
          Scan a badge →
        </Link>
      }
      back={{ to: "/", label: "Field Hub" }}
    >
      <PageTitle title="Booth" accent="leads" />

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="Scanned" value={stats.total} tone="text-foreground" />
        <Stat label="Hot" value={stats.hot} tone="text-hot" />
        <Stat label="TCPC joins" value={stats.joined} tone="text-go" />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, firm, email or badge ID"
          className="h-11"
        />
        <Button variant="outline" onClick={exportCsv} className="h-11 sm:w-40">
          Export CSV
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {filters.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-full border px-4 py-1.5 text-sm capitalize transition-colors ${
              filter === option
                ? "border-signal-line bg-signal-soft text-signal"
                : "border-border bg-panel text-muted-foreground hover:bg-panel-hover"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <div className="eyebrow animate-pulse">Loading leads…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-panel p-6 text-center text-sm text-muted-foreground">
            Nothing here yet. Scan a badge to start the list.
          </div>
        ) : (
          visible.map((lead) => (
            <Link
              key={lead.id}
              to="/lead/$attendeeId"
              params={{ attendeeId: lead.attendee_id }}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-3 transition-colors hover:bg-panel-hover"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{leadName(lead)}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {[lead.title, lead.company].filter(Boolean).join(" · ") || lead.attendee_id}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {lead.joined_tcpc ? (
                  <span className="rounded-full border border-go-line bg-go-soft px-2.5 py-1 text-xs text-go">
                    Joined
                  </span>
                ) : null}
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs capitalize ${
                    lead.rating === "hot"
                      ? "border-hot/50 bg-hot/15 text-hot"
                      : lead.rating === "warm"
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {lead.rating}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </FieldShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-display text-2xl ${tone}`}>{value}</div>
    </div>
  );
}
