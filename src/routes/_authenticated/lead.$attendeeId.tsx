import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTEREST_OPTIONS, RATINGS, leadName, type Lead, type Rating } from "@/lib/leads";
import { FieldShell, PageTitle, SectionLabel, Panel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_REVIEW_LINKS,
  STATUS_LABELS,
  buildMembershipJoinUrl,
  currentEventId,
  getStaffDeviceId,
  getStaffSessionId,
  newSignupPublicId,
  type SignupSession,
} from "@/lib/signup-sessions";

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

  const [signup, setSignup] = useState<SignupSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [creatingSignup, setCreatingSignup] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("attendee_id", attendeeId)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) toast.error("Couldn't load that lead.");
      if (data) {
        setLead(data);
        setRating(
          (RATINGS as readonly string[]).includes(data.rating) ? (data.rating as Rating) : "warm",
        );
        setInterests(data.interests ?? []);
        setNotes(data.notes ?? "");
        const { data: existingSignup } = await supabase
          .from("signup_sessions")
          .select("*")
          .eq("lead_id", data.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setSignup(existingSignup);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [attendeeId, user]);

  useEffect(() => {
    if (!signup?.join_url) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(signup.join_url, { width: 320, margin: 2 }).then(setQrDataUrl);
  }, [signup?.join_url]);

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

  async function createSignupSession() {
    if (!user || !lead) return;
    setCreatingSignup(true);
    const publicId = newSignupPublicId();
    const joinUrl = buildMembershipJoinUrl(publicId);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const { data, error } = await supabase
      .from("signup_sessions")
      .insert({
        public_id: publicId,
        lead_id: lead.id,
        badge_lead_id: lead.attendee_id,
        event_id: currentEventId(lead.event_name),
        scanned_by_staff_id: lead.scanned_by,
        attributed_to_staff_id: lead.scanned_by,
        created_by_staff_id: user.id,
        staff_device_id: getStaffDeviceId(),
        staff_session_id: getStaffSessionId(),
        dub_partner_id:
          typeof metadata["dub_partner_id"] === "string" ? metadata["dub_partner_id"] : null,
        dub_link_id: typeof metadata["dub_link_id"] === "string" ? metadata["dub_link_id"] : null,
        join_url: joinUrl,
        metadata: { leadEmail: lead.email, leadCompany: lead.company },
      })
      .select("*")
      .single();
    setCreatingSignup(false);

    if (error) {
      toast.error(`Couldn't create the signup QR: ${error.message}`);
      return;
    }

    setSignup(data);
    toast.success("Membership QR is ready. Original sales attribution is locked in.");
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

      <SectionLabel>Review products</SectionLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        {PRODUCT_REVIEW_LINKS.map((product) => (
          <a
            key={product.name}
            href={product.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border bg-panel p-4 transition-colors hover:bg-panel-hover"
          >
            <div className="font-display text-lg">{product.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{product.note}</p>
            <div className="mt-3 text-sm text-signal">Open product ↗</div>
          </a>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-go-line bg-go-soft p-5">
        <div className="eyebrow">Membership handoff</div>
        {!signup ? (
          <>
            <h2 className="mt-2 font-display text-xl">Ready to join Tax Compliance Pro?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a tracked QR after reviewing products. The attendee completes account setup and
              payment on their own phone.
            </p>
            <Button
              onClick={createSignupSession}
              disabled={creatingSignup}
              className="mt-4 h-12 w-full text-base"
            >
              {creatingSignup ? "Creating QR…" : "Create membership QR"}
            </Button>
          </>
        ) : (
          <div className="mt-2 grid items-center gap-5 sm:grid-cols-[220px_1fr]">
            <div className="rounded-xl bg-white p-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Membership signup QR for ${signup.public_id}`}
                  className="aspect-square w-full"
                />
              ) : (
                <div className="aspect-square animate-pulse rounded-lg bg-muted" />
              )}
            </div>
            <div>
              <div className="font-display text-xl">{STATUS_LABELS[signup.status]}</div>
              <div className="mt-1 font-mono text-sm text-signal">{signup.public_id}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Scan with the attendee's phone. The main site owns checkout and sends the verified
                member ID and plan back to this session.
              </p>
              {signup.membership_plan ? (
                <p className="mt-2 text-sm">Plan: {signup.membership_plan}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={signup.join_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                  Open join page ↗
                </a>
                <Link
                  to="/signups"
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm"
                >
                  View signup queue →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

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
