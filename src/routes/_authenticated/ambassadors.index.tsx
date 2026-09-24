import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FieldShell, PageTitle, Panel, SectionLabel } from "@/components/FieldShell";
import { AmbassadorFields, EMPTY_AMBASSADOR } from "@/components/AmbassadorFields";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/MessageComposer";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AMBASSADOR_STAGES, ambassadorInputSchema } from "@/lib/ambassadors";
import type { Database } from "@/integrations/supabase/types";

type Ambassador = Database["public"]["Tables"]["ambassadors"]["Row"];

export const Route = createFileRoute("/_authenticated/ambassadors/")({
  head: () => ({
    meta: [
      { title: "Brand Ambassadors — Membership Hub" },
      { name: "description", content: "Collect, track and nurture Tax Compliance Pro brand ambassadors." },
      { property: "og:title", content: "Brand Ambassadors — Membership Hub" },
      { property: "og:description", content: "Ambassador board from application to active." },
    ],
  }),
  component: AmbassadorsPage,
});

function AmbassadorsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY_AMBASSADOR);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("https://fieldhub.taxcomppro.com");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("ambassadors")
      .select("*")
      .neq("stage", "archived")
      .order("created_at", { ascending: false });
    if (error) toast.error("Couldn't load ambassadors.");
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (tag && !r.tags.includes(tag)) return false;
      if (!q) return true;
      const hay = [r.full_name, r.email, r.business, r.city, r.state].join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      return digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits);
    });
  }, [rows, search, tag]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const parsed = ambassadorInputSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ambassadors").insert({
      ...parsed.data,
      email: parsed.data.email.toLowerCase(),
      stage: "invited",
      source: "manual",
      added_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't add ambassador.");
      return;
    }
    toast.success("Ambassador added.");
    setValues(EMPTY_AMBASSADOR);
    setOpen(false);
    void load();
  }

  const embed = `<iframe src="${origin}/ambassador-apply" style="width:100%;min-height:760px;border:0" title="Brand ambassador application"></iframe>`;

  return (
    <FieldShell eyebrowRight={`${rows.length} ambassadors`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          title="Brand"
          accent="Ambassadors"
          lede="Applications from your embedded form and people you add by hand, from first contact to active."
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add ambassador</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add ambassador</DialogTitle>
            </DialogHeader>
            <form onSubmit={add} className="space-y-4">
              <AmbassadorFields values={values} onChange={setValues} />
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Add as Invited"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, email, phone, business…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {allTags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(tag === t ? null : t)}
            className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
              tag === t ? "border-signal-line bg-signal-soft text-signal" : "border-border text-muted-foreground"
            }`}
          >
            #{t}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelected(new Set(visible.map((r) => r.id)))}
          disabled={visible.length === 0}
        >
          Select all ({visible.length})
        </Button>
        {selected.size > 0 ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setComposing(true)}>
              Message selected ({selected.size})
            </Button>
          </>
        ) : null}
      </div>

      {composing && selected.size > 0 ? (
        <MessageComposer
          contacts={rows
            .filter((r) => selected.has(r.id))
            .map((r) => ({
              id: r.id,
              name: r.full_name,
              email: r.email,
              leadId: null,
              phone: r.phone,
              company: r.business,
            }))}
          onClose={() => setComposing(false)}
        />
      ) : null}

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {AMBASSADOR_STAGES.map((stage) => {
            const cards = visible.filter((r) => r.stage === stage.key);
            const allOn = cards.length > 0 && cards.every((r) => selected.has(r.id));
            return (
              <div key={stage.key} className="rounded-xl border border-border bg-panel/50 p-2">
                <div className="flex items-center justify-between px-1 pb-2 eyebrow">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allOn}
                      disabled={cards.length === 0}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          cards.forEach((r) => (allOn ? next.delete(r.id) : next.add(r.id)));
                          return next;
                        })
                      }
                    />
                    {stage.label}
                  </label>
                  <span>{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {loading ? <p className="px-1 text-xs text-muted-foreground">Loading…</p> : null}
                  {cards.map((r) => (
                    <div key={r.id} className="relative">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.full_name}`}
                        className="absolute right-2 top-2 z-10"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    <Link
                      to="/ambassadors/$id"
                      params={{ id: r.id }}
                      className="block rounded-lg border border-border bg-panel p-3 pr-8 transition-colors hover:border-signal-line"
                    >
                      <div className="truncate text-sm font-medium">{r.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.business ?? r.email ?? "—"}
                      </div>
                      {r.city || r.state ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {[r.city, r.state].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                      {r.tags.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.tags.map((t) => (
                            <span key={t} className="font-mono text-[10px] text-signal">
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SectionLabel>Embed the application form</SectionLabel>
      <Panel>
        <p className="text-sm text-muted-foreground">
          Paste this into any web page. Every submission lands in Applied above.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-xs">
          {embed}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(embed);
              toast.success("Embed code copied.");
            }}
          >
            Copy embed code
          </Button>
          <Button variant="outline" asChild>
            <a href="/ambassador-apply" target="_blank" rel="noreferrer">
              Preview form
            </a>
          </Button>
        </div>
      </Panel>
    </FieldShell>
  );
}
