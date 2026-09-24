import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FieldShell, PageTitle, Panel, SectionLabel } from "@/components/FieldShell";
import { AmbassadorFields, EMPTY_AMBASSADOR } from "@/components/AmbassadorFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AMBASSADOR_STAGES, STAGE_LABEL, ambassadorInputSchema, type AmbassadorStage } from "@/lib/ambassadors";
import type { Database } from "@/integrations/supabase/types";

type Ambassador = Database["public"]["Tables"]["ambassadors"]["Row"];
type Note = Database["public"]["Tables"]["ambassador_notes"]["Row"];

export const Route = createFileRoute("/_authenticated/ambassadors/$id")({
  head: () => ({
    meta: [
      { title: "Ambassador — Membership Hub" },
      { name: "description", content: "Brand ambassador profile, stage, tags and notes." },
      { property: "og:title", content: "Ambassador — Membership Hub" },
      { property: "og:description", content: "Brand ambassador profile, stage, tags and notes." },
    ],
  }),
  component: AmbassadorPage,
});

function AmbassadorPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [row, setRow] = useState<Ambassador | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [values, setValues] = useState(EMPTY_AMBASSADOR);
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const [a, n] = await Promise.all([
      supabase.from("ambassadors").select("*").eq("id", id).maybeSingle(),
      supabase.from("ambassador_notes").select("*").eq("ambassador_id", id).order("created_at", { ascending: false }),
    ]);
    setRow(a.data ?? null);
    setNotes(n.data ?? []);
    if (a.data) {
      const d = a.data;
      setValues({
        full_name: d.full_name,
        email: d.email ?? "",
        phone: d.phone ?? "",
        business: d.business ?? "",
        city: d.city ?? "",
        state: d.state ?? "",
        instagram: d.instagram ?? "",
        facebook: d.facebook ?? "",
        tiktok: d.tiktok ?? "",
        linkedin: d.linkedin ?? "",
      });
    }
  }, [id]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function update(patch: Partial<Ambassador>) {
    const { error } = await supabase.from("ambassadors").update(patch).eq("id", id);
    if (error) toast.error("Couldn't save.");
    else void load();
  }

  async function saveDetails() {
    const parsed = ambassadorInputSchema.safeParse(values);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the form."); return; }
    await update({ ...parsed.data, email: parsed.data.email.toLowerCase() });
    setEditing(false);
    toast.success("Saved.");
  }

  async function addNote() {
    const body = note.trim().slice(0, 2000);
    if (!body || !user) return;
    const { data: profile } = await supabase.from("staff_profiles").select("display_name").eq("id", user.id).maybeSingle();
    const { error } = await supabase.from("ambassador_notes").insert({
      ambassador_id: id,
      body,
      author_id: user.id,
      author_name: profile?.display_name ?? user.email ?? null,
    });
    if (error) { toast.error("Couldn't add note."); return; }
    setNote("");
    void load();
  }

  if (!row) {
    return (
      <FieldShell back={{ to: "/ambassadors", label: "Ambassadors" }}>
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      </FieldShell>
    );
  }

  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 30);
    if (t && !row.tags.includes(t)) void update({ tags: [...row.tags, t] });
    setNewTag("");
  };

  return (
    <FieldShell back={{ to: "/ambassadors", label: "Ambassadors" }} eyebrowRight={STAGE_LABEL[row.stage as AmbassadorStage]}>
      <PageTitle title={row.full_name} lede={[row.business, [row.city, row.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")} />

      <SectionLabel>Stage</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {AMBASSADOR_STAGES.map((s) => (
          <Button key={s.key} size="sm" variant={row.stage === s.key ? "default" : "outline"} onClick={() => void update({ stage: s.key })}>
            {s.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => void update({ stage: "archived" })}>
          Archive
        </Button>
      </div>

      <SectionLabel>Tags</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        {row.tags.map((t) => (
          <button key={t} type="button" onClick={() => void update({ tags: row.tags.filter((x) => x !== t) })} className="rounded-full border border-signal-line bg-signal-soft px-2.5 py-1 font-mono text-xs text-signal" title="Remove tag">
            #{t} ×
          </button>
        ))}
        <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Add tag" className="h-8 w-36" />
        <Button size="sm" variant="outline" onClick={addTag}>Add</Button>
      </div>

      <SectionLabel>Contact details</SectionLabel>
      <Panel>
        {editing ? (
          <div className="space-y-4">
            <AmbassadorFields values={values} onChange={setValues} />
            <div className="flex gap-2">
              <Button onClick={() => void saveDetails()}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {([
              ["Email", row.email], ["Phone", row.phone], ["Instagram", row.instagram],
              ["Facebook", row.facebook], ["TikTok", row.tiktok], ["LinkedIn", row.linkedin],
              ["Source", row.source === "web_form" ? "Website form" : "Added manually"],
              ["Added", new Date(row.created_at).toLocaleDateString()],
            ] as const).map(([k, v]) => (
              <div key={k}>
                <span className="eyebrow">{k}</span>
                <div className="break-words">{v || "—"}</div>
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit details</Button>
            </div>
          </div>
        )}
      </Panel>

      <SectionLabel>Notes</SectionLabel>
      <Panel>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" maxLength={2000} />
        <Button className="mt-2" size="sm" onClick={() => void addNote()} disabled={!note.trim()}>Add note</Button>
        <div className="mt-4 space-y-3">
          {notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : null}
          {notes.map((n) => (
            <div key={n.id} className="border-t border-border pt-3">
              <div className="eyebrow">{n.author_name ?? "Staff"} · {new Date(n.created_at).toLocaleString()}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </FieldShell>
  );
}
