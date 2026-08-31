import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  INTEREST_OPTIONS,
  OUTCOME_LABEL,
  OUTCOME_TONE,
  RATINGS,
  leadName,
  leadOutcome,
  type Lead,
  type Outcome,
  type Rating,
} from "@/lib/leads";
import { resolveAttribution, type Attribution } from "@/lib/attribution";
import {
  listSmsTemplates,
  getLeadSmsHistory,
  sendLeadSms,
  type SmsTemplate,
  type SmsMessage,
} from "@/lib/sms.functions";
import { runSmsTriggers, renderTemplate } from "@/lib/sms-triggers.functions";
import { PRODUCTS, renderProductMessage } from "@/lib/products";

import { FieldShell, PageTitle, SectionLabel, Panel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/lead/$attendeeId")({
  head: () => ({
    meta: [
      { title: "Qualify Lead — TCPC Lead Scanner" },
      {
        name: "description",
        content:
          "Rate the lead hot, warm or cold, tag their interests, and complete the TCPC join flow with badge data already filled in.",
      },
      { property: "og:title", content: "Qualify Lead — TCPC Lead Scanner" },
      {
        property: "og:description",
        content: "Qualify a scanned booth lead and sign them up for Tax Compliance Pro Connect.",
      },
    ],
  }),
  component: LeadPage,
});

const EDIT_FIELDS: [string, string][] = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["credential", "Credential"],
  ["title", "Title"],
  ["company", "Firm"],
  ["department", "Department"],
  ["email", "Email"],
  ["phone", "Mobile phone"],
  ["website", "Website"],
  ["address1", "Address line 1"],
  ["address2", "Address line 2"],
  ["city", "City"],
  ["state", "State"],
  ["postal_code", "ZIP"],
  ["country", "Country"],
];

function LeadPage() {

  const { attendeeId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<Rating>("warm");
  const [interests, setInterests] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("open");
  const [saving, setSaving] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joinPhone, setJoinPhone] = useState("");
  const [joinCompany, setJoinCompany] = useState("");
  const [joinTitle, setJoinTitle] = useState("");
  const [consent, setConsent] = useState(true);
  const [joining, setJoining] = useState(false);
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [startingSignup, setStartingSignup] = useState(false);

  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [smsHistory, setSmsHistory] = useState<SmsMessage[]>([]);
  const [smsBody, setSmsBody] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [productBase, setProductBase] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchTemplates = useServerFn(listSmsTemplates);
  const fetchSmsHistory = useServerFn(getLeadSmsHistory);
  const doSendSms = useServerFn(sendLeadSms);
  const fireTriggers = useServerFn(runSmsTriggers);

  useEffect(() => {
    if (!user) return;
    void resolveAttribution(user.id).then(setAttribution);
  }, [user]);

  useEffect(() => {
    void supabase
      .from("booth_settings")
      .select("pooled_dub_url")
      .maybeSingle()
      .then(({ data }) => setProductBase(data?.pooled_dub_url ?? null));
  }, []);


  async function startSignup() {
    if (!user || !lead) return;
    setStartingSignup(true);
    const attr = attribution ?? (await resolveAttribution(user.id));


    const { data: staff } = await supabase
      .from("staff_profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: existing } = await supabase
      .from("signup_sessions")
      .select("id")
      .eq("lead_id", lead.id)
      .neq("stage", "void")
      .maybeSingle();

    if (existing) {
      setStartingSignup(false);
      navigate({ to: "/signup/$sessionId", params: { sessionId: existing.id } });
      return;
    }

    const { data, error } = await supabase
      .from("signup_sessions")
      .insert({
        lead_id: lead.id,
        attendee_id: lead.attendee_id,
        rep_user_id: user.id,
        rep_name: staff?.display_name ?? null,
        dub_code: attr.code,
        dub_attribution: attr.kind,
        full_name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        title: lead.title,
      })
      .select()
      .single();

    if (error || !data) {
      setStartingSignup(false);
      toast.error("Couldn't start the signup. Try again.");
      return;
    }

    await supabase.from("signup_events").insert({
      signup_session_id: data.id,
      event_type: "LEAD_SCANNED",
      actor_user_id: user.id,
      actor_label: staff?.display_name ?? null,
      payload: { attendee_id: lead.attendee_id, dub_code: attr.code, dub_attribution: attr.kind },
    });

    await supabase
      .from("leads")
      .update({ outcome: "sale_started" })
      .eq("id", lead.id);
    setOutcome("sale_started");

    setStartingSignup(false);
    navigate({ to: "/signup/$sessionId", params: { sessionId: data.id } });
  }


  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("attendee_id", attendeeId)
        .eq("scanned_by", user.id)
        .maybeSingle();

      if (!active) return;
      if (error) toast.error("Couldn't load that lead.");
      if (data) {
        setLead(data);
        setRating((RATINGS as readonly string[]).includes(data.rating) ? (data.rating as Rating) : "warm");
        setInterests(data.interests ?? []);
        setNotes(data.notes ?? "");
        setOutcome(leadOutcome(data));
        setJoinName([data.first_name, data.last_name].filter(Boolean).join(" "));
        setJoinEmail(data.email ?? "");
        setJoinPhone(data.phone ?? "");
        setJoinCompany(data.company ?? "");
        setJoinTitle(data.title ?? "");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [attendeeId, user]);

  const location = useMemo(() => {
    if (!lead) return "";
    return [lead.city, lead.state].filter(Boolean).join(", ");
  }, [lead]);

  const fullName = useMemo(() => {
    if (!lead) return "";
    return [lead.prefix, lead.first_name, lead.middle_name, lead.last_name, lead.suffix]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [lead]);

  const mailing = useMemo(() => {
    if (!lead) return "";
    return [lead.address1, lead.address2, lead.address3, lead.postal_code]
      .filter(Boolean)
      .join(", ");
  }, [lead]);


  useEffect(() => {
    if (!lead) return;
    let active = true;
    void (async () => {
      try {
        const [{ templates: t }, { messages }] = await Promise.all([
          fetchTemplates(),
          fetchSmsHistory({ data: { leadId: lead.id } }),
        ]);
        if (!active) return;
        setTemplates(t ?? []);
        setSmsHistory(messages ?? []);
        const defaultTemplate = (t ?? []).find((template) => template.is_default);
        if (defaultTemplate) setSmsBody(defaultTemplate.body);
        setSmsConsent(lead.sms_consent ?? false);
      } catch {
        // non-critical; history will just be empty
      }
    })();
    return () => {
      active = false;
    };
  }, [lead, fetchTemplates, fetchSmsHistory]);

  function toggleInterest(value: string) {
    setInterests((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  async function saveLead(options: { thenScan?: boolean } = {}) {
    if (!user || !lead) return;
    setSaving(true);
    const { error } = await supabase
      .from("leads")
      .update({ rating, interests, notes: notes.trim() || null, outcome })
      .eq("id", lead.id);
    setSaving(false);

    if (error) {
      toast.error("Save failed. Check the connection and try again.");
      return;
    }
    toast.success("Lead saved.");
    void fireTriggers({
      data: { leadId: lead.id, event: "outcome_changed", outcome },
    }).catch(() => undefined);
    if (options.thenScan) navigate({ to: "/scan" });
  }

  async function sendText(body: string) {
    if (!user || !lead) return;
    if (!lead.phone) {
      toast.error("This lead has no phone number on file. Edit the contact details to add one.");
      return;
    }
    if (!body.trim()) {
      toast.error("Type a message first.");
      return;
    }
    setSendingSms(true);
    try {
      await doSendSms({
        data: {
          leadId: lead.id,
          to: lead.phone,
          body: body.trim(),
          recordConsent: smsConsent,
        },
      });
      toast.success("Text sent.");
      const { messages } = await fetchSmsHistory({ data: { leadId: lead.id } });
      setSmsHistory(messages ?? []);
      if (smsConsent) setLead({ ...lead, sms_consent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Text failed.");
    } finally {
      setSendingSms(false);
    }
  }

  function handleSendSms(event: React.FormEvent) {
    event.preventDefault();
    void sendText(smsBody);
  }

  function startEditing() {
    if (!lead) return;
    setEdit({
      prefix: lead.prefix ?? "",
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      suffix: lead.suffix ?? "",
      credential: lead.credential ?? "",
      title: lead.title ?? "",
      company: lead.company ?? "",
      department: lead.department ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      website: lead.website ?? "",
      address1: lead.address1 ?? "",
      address2: lead.address2 ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      postal_code: lead.postal_code ?? "",
      country: lead.country ?? "",
    });
    setEditing(true);
  }

  async function saveContact(event: React.FormEvent) {
    event.preventDefault();
    if (!lead) return;
    setSavingEdit(true);
    const patch = Object.fromEntries(
      Object.entries(edit).map(([key, value]) => [key, value.trim() || null]),
    ) as Partial<Lead>;
    const { error } = await supabase
      .from("leads")
      .update(patch as never)
      .eq("id", lead.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Couldn't save the contact details.");
      return;
    }
    setLead({ ...lead, ...patch });

    setEditing(false);
    toast.success("Contact details updated.");
  }


  async function submitJoin(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !lead) return;
    setJoining(true);

    const { error } = await supabase.from("join_submissions").insert({
      attendee_id: lead.attendee_id,
      lead_id: lead.id,
      full_name: joinName.trim(),
      email: joinEmail.trim(),
      phone: joinPhone.trim() || null,
      company: joinCompany.trim() || null,
      title: joinTitle.trim() || null,
      interest: interests[0] ?? null,
      consent_marketing: consent,
      submitted_by: user.id,
    });

    if (error) {
      setJoining(false);
      toast.error("Couldn't submit the join. Try once more.");
      return;
    }

    await supabase.from("leads").update({ joined_tcpc: true, rating: "hot" }).eq("id", lead.id);
    void fireTriggers({ data: { leadId: lead.id, event: "joined_tcpc" } }).catch(() => undefined);
    setJoining(false);
    setShowJoin(false);
    setLead({ ...lead, joined_tcpc: true });
    setRating("hot");
    toast.success(`${joinName || "Attendee"} is in. Hand them the welcome kit.`);
  }

  if (loading) {
    return (
      <FieldShell back={{ to: "/scan", label: "Back to scanner" }}>
        <div className="mt-10 eyebrow animate-pulse">Loading badge record…</div>
      </FieldShell>
    );
  }

  if (!lead) {
    return (
      <FieldShell back={{ to: "/scan", label: "Back to scanner" }}>
        <PageTitle
          title="Badge"
          accent="not found"
          lede={`No scan on file for ${attendeeId}. Scan the badge again to pull the record.`}
        />
      </FieldShell>
    );
  }

  const ratingTone: Record<Rating, string> = {
    hot: "border-hot/60 bg-hot/15 text-hot",
    warm: "border-gold/60 bg-gold/15 text-gold",
    cold: "border-border bg-muted text-muted-foreground",
  };

  return (
    <FieldShell
      eyebrowRight={lead.joined_tcpc ? "TCPC member ✓" : "Qualify"}
      back={{ to: "/scan", label: "Back to scanner" }}
    >
      <PageTitle title={leadName(lead)} />
      <p className="mt-1 text-sm text-muted-foreground">
        {[lead.credential, lead.title, lead.company].filter(Boolean).join(" · ") ||
          "No title on the badge"}
      </p>

      {!editing ? (
        <Panel className="mt-5 space-y-2 text-sm">
          <div className="flex items-center justify-between pb-1">
            <span className="eyebrow">Badge record</span>
            <button
              type="button"
              onClick={startEditing}
              className="text-xs text-signal hover:underline"
            >
              Edit details
            </button>
          </div>
          <Row label="Badge ID" value={lead.attendee_id} />
          {fullName ? <Row label="Name" value={fullName} /> : null}
          {lead.nickname ? <Row label="Goes by" value={lead.nickname} /> : null}
          {lead.credential ? <Row label="Credential" value={lead.credential} /> : null}
          {lead.title ? <Row label="Title" value={lead.title} /> : null}
          {lead.company ? <Row label="Firm" value={lead.company} /> : null}
          {lead.department ? <Row label="Department" value={lead.department} /> : null}
          {lead.email ? <Row label="Email" value={lead.email} /> : null}
          {lead.phone ? <Row label="Phone" value={lead.phone} /> : null}
          {lead.fax ? <Row label="Fax" value={lead.fax} /> : null}
          {lead.website ? <Row label="Website" value={lead.website} /> : null}
          {mailing ? <Row label="Address" value={mailing} /> : null}
          {location ? <Row label="Location" value={location} /> : null}
          {lead.country ? <Row label="Country" value={lead.country} /> : null}
          {lead.association ? <Row label="Association" value={lead.association} /> : null}
          {lead.demographics ? <Row label="Demographics" value={lead.demographics} /> : null}
          {lead.qualifiers ? <Row label="Qualifiers" value={lead.qualifiers} /> : null}
          {lead.event_name ? <Row label="Event" value={lead.event_name} /> : null}
          {lead.lookup_status !== "found" ? (
            <p className="pt-1 text-xs text-gold">
              Badge details weren't available yet — the record fills in after the show data sync.
            </p>
          ) : null}
        </Panel>
      ) : (
        <Panel className="mt-5">
          <div className="eyebrow">Edit contact details</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Badges often carry an office landline. Update the phone or email so texts and follow-up
            reach them directly.
          </p>
          <form onSubmit={saveContact} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {EDIT_FIELDS.map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`ed-${key}`}>{label}</Label>
                  <Input
                    id={`ed-${key}`}
                    value={edit[key] ?? ""}
                    inputMode={key === "phone" ? "tel" : undefined}
                    onChange={(e) => setEdit((c) => ({ ...c, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={savingEdit} className="h-12 flex-1">
                {savingEdit ? "Saving…" : "Save details"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
                className="h-12 flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      )}


      <SectionLabel>How hot is this lead?</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {RATINGS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRating(option)}
            className={`h-14 rounded-xl border text-sm font-semibold capitalize transition-colors ${
              rating === option
                ? ratingTone[option]
                : "border-border bg-panel text-muted-foreground hover:bg-panel-hover"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <SectionLabel>What are they interested in?</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((option) => {
          const active = interests.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleInterest(option)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                active
                  ? "border-signal-line bg-signal-soft text-signal"
                  : "border-border bg-panel text-muted-foreground hover:bg-panel-hover"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <SectionLabel>Booth notes</SectionLabel>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Runs a 3-person shop, filing 400 returns, hates their current software…"
      />

      <SectionLabel>Where does this lead land?</SectionLabel>
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">
        Not every scan becomes a sale. Mark the outcome so follow-up after the show is clean.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["open", "follow_up", "not_a_fit", "sale_closed"] as Outcome[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setOutcome(option)}
            className={`min-h-14 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              outcome === option
                ? OUTCOME_TONE[option]
                : "border-border bg-panel text-muted-foreground hover:bg-panel-hover"
            }`}
          >
            {OUTCOME_LABEL[option]}
          </button>
        ))}
      </div>
      {outcome === "sale_started" ? (
        <p className="mt-2 text-sm text-signal">
          {OUTCOME_LABEL.sale_started} — a signup session is open in the sales pipeline.
        </p>
      ) : null}

      <div className="mt-8 rounded-2xl border border-signal-line bg-signal-soft p-5">
        <div className="eyebrow">ProConnect signup</div>
        <h2 className="mt-2 font-display text-xl">Membership + card flow</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates the signup session, locks your attribution to it, and shows the QR code the
          customer scans on their own phone.
        </p>
        <div className="mt-3 rounded-xl border border-border bg-panel p-4">
          <div className="eyebrow">Attribution</div>
          <div className="mt-1 font-medium">{attribution?.label ?? "Checking…"}</div>
          {attribution ? (
            <p className="mt-1 text-sm text-muted-foreground">{attribution.detail}</p>
          ) : null}
        </div>
        <Button
          onClick={startSignup}
          disabled={startingSignup}
          className="mt-4 h-12 w-full text-base"
        >
          {startingSignup ? "Starting…" : "Start ProConnect signup →"}
        </Button>
      </div>

      {!lead.joined_tcpc ? (

        <div className="mt-8 rounded-2xl border border-go-line bg-go-soft p-5">
          <div className="eyebrow">Close the loop</div>
          <h2 className="mt-2 font-display text-xl">Join Tax Compliance Pro Connect</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Badge data is already filled in — confirm the email and they're a member before they
            leave the booth.
          </p>
          {!showJoin ? (
            <Button onClick={() => setShowJoin(true)} className="mt-4 h-12 w-full text-base">
              Start join flow
            </Button>
          ) : (
            <form onSubmit={submitJoin} className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="jname">Full name</Label>
                <Input
                  id="jname"
                  required
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jemail">Email</Label>
                <Input
                  id="jemail"
                  type="email"
                  required
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="jphone">Phone</Label>
                  <Input
                    id="jphone"
                    value={joinPhone}
                    onChange={(e) => setJoinPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jcompany">Firm</Label>
                  <Input
                    id="jcompany"
                    value={joinCompany}
                    onChange={(e) => setJoinCompany(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jtitle">Title</Label>
                <Input
                  id="jtitle"
                  value={joinTitle}
                  onChange={(e) => setJoinTitle(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-panel px-4 py-3">
                <Label htmlFor="consent" className="text-sm font-normal">
                  Okay to send updates and offers
                </Label>
                <Switch id="consent" checked={consent} onCheckedChange={setConsent} />
              </div>
              <Button type="submit" disabled={joining} className="h-12 w-full text-base">
                {joining ? "Submitting…" : "Complete TCPC join"}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-go-line bg-go-soft p-5">
          <div className="eyebrow">Member</div>
          <p className="mt-1 text-sm">
            This attendee joined TCPC at the booth. Give them the welcome kit and the Atlas AI demo
            link.
          </p>
        </div>
      )}

      {lead.phone ? (
        <div className="mt-8 rounded-2xl border border-border bg-panel p-5">
          <div className="eyebrow">SMS follow-up</div>
          <h2 className="mt-2 font-display text-xl">Text {leadName(lead)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a quick follow-up to {lead.phone}. Every product link carries the booth Dub code
            {attribution?.code ? ` (${attribution.code})` : ""}.
          </p>

          <div className="mt-4">
            <div className="eyebrow">Product links</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PRODUCTS.map((product) => {
                const message = renderProductMessage(product, {
                  firstName: lead.first_name,
                  fullName: leadName(lead),
                  baseUrl: productBase,
                  dubCode: attribution?.code ?? null,
                });
                return (
                  <div
                    key={product.slug}
                    className="rounded-xl border border-border bg-muted p-3 text-sm"
                  >
                    <div className="font-medium">{product.name}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{product.blurb}</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSmsBody(message)}
                      >
                        Preview
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        disabled={sendingSms}
                        onClick={() => {
                          setSmsBody(message);
                          void sendText(message);
                        }}
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {templates.length > 0 ? (
            <div className="mt-5">
              <div className="eyebrow">Saved templates — send now</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Button
                    key={`quick-${template.id}`}
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={sendingSms}
                    onClick={() => {
                      const body = renderTemplate(template.body, { lead });
                      setSmsBody(body);
                      void sendText(body);
                    }}
                  >
                    {template.name} →
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSendSms} className="mt-5 space-y-3">

            {templates.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const template = templates.find((t) => t.id === value);
                    if (template) setSmsBody(template.body);
                  }}
                >
                  <SelectTrigger id="template" className="w-full">
                    <SelectValue placeholder="Pick a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="smsBody">Message</Label>
              <Textarea
                id="smsBody"
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                rows={4}
                placeholder="Thanks for stopping by TCPC booth 540…"
              />
              <p className="text-right text-xs text-muted-foreground">
                {smsBody.length}/1600
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3">
              <Label htmlFor="smsConsent" className="text-sm font-normal">
                Lead consented to SMS updates
              </Label>
              <Switch
                id="smsConsent"
                checked={smsConsent}
                onCheckedChange={setSmsConsent}
              />
            </div>

            <Button
              type="submit"
              disabled={sendingSms || !smsBody.trim()}
              className="h-12 w-full text-base"
            >
              {sendingSms ? "Sending…" : "Send text →"}
            </Button>
          </form>

          {smsHistory.length > 0 ? (
            <div className="mt-5 space-y-2">
              <div className="eyebrow">Sent messages</div>
              {smsHistory.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-border bg-muted p-3 text-sm"
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{msg.status}</span>
                    <span>{new Date(msg.sent_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-panel p-5">
          <div className="eyebrow">SMS follow-up</div>
          <p className="mt-1 text-sm text-muted-foreground">
            No phone number on this badge, so SMS follow-up isn't available.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => saveLead({ thenScan: true })}
          disabled={saving}
          className="h-12 flex-1 text-base"
        >
          Save & scan next
        </Button>
        <Button
          variant="outline"
          onClick={() => saveLead()}
          disabled={saving}
          className="h-12 flex-1 text-base"
        >
          Save
        </Button>
      </div>

      <div className="mt-4 text-center">
        <Link to="/leads" className="text-sm text-muted-foreground hover:text-foreground">
          View all my leads →
        </Link>
      </div>
    </FieldShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="eyebrow">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
