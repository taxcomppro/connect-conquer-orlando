import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RATINGS, type Rating } from "@/lib/leads";
import { FieldShell, PageTitle, SectionLabel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/add-lead")({
  head: () => ({
    meta: [
      { title: "Add Lead Manually — TCPC Lead Scanner" },
      { name: "description", content: "Manually add a booth lead without scanning a badge." },
    ],
  }),
  component: AddLeadPage,
});

function AddLeadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    notes: "",
    rating: "warm" as Rating,
    sms_consent: false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!user) return;
    if (!form.first_name.trim() && !form.last_name.trim() && !form.company.trim()) {
      toast.error("Add at least a name or company.");
      return;
    }
    if (form.phone.trim() && !form.sms_consent) {
      toast.error("Confirm they agreed to receive texts before saving a phone number.");
      return;
    }
    setSaving(true);
    const attendeeId = `manual-${crypto.randomUUID().slice(0, 8)}`;
    const nullify = (v: string) => (v.trim() ? v.trim() : null);
    const { error } = await supabase.from("leads").insert({
      attendee_id: attendeeId,
      first_name: nullify(form.first_name),
      last_name: nullify(form.last_name),
      title: nullify(form.title),
      company: nullify(form.company),
      email: nullify(form.email),
      phone: nullify(form.phone),
      notes: nullify(form.notes),
      rating: form.rating,
      sms_consent: form.sms_consent,
      lookup_status: "manual",
      scanned_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save the lead. Try again.");
      return;
    }
    toast.success("Lead added.");
    navigate({ to: "/lead/$attendeeId", params: { attendeeId } });
  }

  return (
    <FieldShell back={{ to: "/leads", label: "Captured leads" }}>
      <PageTitle title="Add a lead" accent="manually" />

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="eyebrow mb-1.5">First name</div>
            <Input
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              className="h-11"
            />
          </div>
          <div>
            <div className="eyebrow mb-1.5">Last name</div>
            <Input
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        <div>
          <div className="eyebrow mb-1.5">Company</div>
          <Input
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
            className="h-11"
          />
        </div>

        <div>
          <div className="eyebrow mb-1.5">Title</div>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="h-11"
          />
        </div>

        <div>
          <div className="eyebrow mb-1.5">Email</div>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className="h-11"
          />
        </div>

        <div>
          <div className="eyebrow mb-1.5">Mobile phone</div>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1…"
            className="h-11"
          />
          {form.phone.trim() ? (
            <label className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.sms_consent}
                onChange={(e) => set("sms_consent", e.target.checked)}
                className="mt-1"
              />
              They agreed to receive text messages from Tax Compliance Pro.
            </label>
          ) : null}
        </div>

        <div>
          <div className="eyebrow mb-1.5">Notes</div>
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <SectionLabel>Rating</SectionLabel>
          <div className="flex gap-2">
            {RATINGS.map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => set("rating", rating)}
                className={`flex-1 rounded-full border px-4 py-2 text-sm capitalize transition-colors ${
                  form.rating === rating
                    ? rating === "hot"
                      ? "border-hot/50 bg-hot/15 text-hot"
                      : rating === "warm"
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-border bg-muted text-foreground"
                    : "border-border bg-panel text-muted-foreground hover:bg-panel-hover"
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="h-12 w-full text-base">
          {saving ? "Saving…" : "Save lead"}
        </Button>
      </div>
    </FieldShell>
  );
}
