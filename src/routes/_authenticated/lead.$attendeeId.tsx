import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTEREST_OPTIONS, RATINGS, leadName, type Lead, type Rating } from "@/lib/leads";
import { FieldShell, PageTitle, SectionLabel, Panel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

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

function LeadPage() {
  const { attendeeId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<Rating>("warm");
  const [interests, setInterests] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joinPhone, setJoinPhone] = useState("");
  const [joinCompany, setJoinCompany] = useState("");
  const [joinTitle, setJoinTitle] = useState("");
  const [consent, setConsent] = useState(true);
  const [joining, setJoining] = useState(false);
  const [dubCode, setDubCode] = useState("");
  const [startingSignup, setStartingSignup] = useState(false);

  useEffect(() => {
    setDubCode(window.localStorage.getItem("tcpc.dubCode") ?? "");
  }, []);

  async function startSignup() {
    if (!user || !lead) return;
    setStartingSignup(true);
    window.localStorage.setItem("tcpc.dubCode", dubCode.trim());

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
        dub_code: dubCode.trim() || null,
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
      payload: { attendee_id: lead.attendee_id, dub_code: dubCode.trim() || null },
    });

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
      .update({ rating, interests, notes: notes.trim() || null })
      .eq("id", lead.id);
    setSaving(false);

    if (error) {
      toast.error("Save failed. Check the connection and try again.");
      return;
    }
    toast.success("Lead saved.");
    if (options.thenScan) navigate({ to: "/scan" });
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

      <Panel className="mt-5 space-y-2 text-sm">
        <Row label="Badge ID" value={lead.attendee_id} />
        {lead.email ? <Row label="Email" value={lead.email} /> : null}
        {lead.phone ? <Row label="Phone" value={lead.phone} /> : null}
        {location ? <Row label="Location" value={location} /> : null}
        {lead.event_name ? <Row label="Event" value={lead.event_name} /> : null}
        {lead.lookup_status !== "found" ? (
          <p className="pt-1 text-xs text-gold">
            Badge details weren't available yet — the record fills in after the show data sync.
          </p>
        ) : null}
      </Panel>

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

      <div className="mt-8 rounded-2xl border border-signal-line bg-signal-soft p-5">
        <div className="eyebrow">ProConnect signup</div>
        <h2 className="mt-2 font-display text-xl">Membership + card flow</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates the signup session, locks your attribution to it, and shows the QR code the
          customer scans on their own phone.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="dub">DUB code</Label>
          <Input
            id="dub"
            value={dubCode}
            onChange={(e) => setDubCode(e.target.value)}
            placeholder="Your DUB attribution code"
          />
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
