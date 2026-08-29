import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCardBase } from "@/hooks/useCardBase";
import { FieldShell, PageTitle, Panel, SectionLabel } from "@/components/FieldShell";
import { QrPanel, CopyField } from "@/components/QrPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STAGE_LABEL,
  cardUrl,
  profileUrl,
  sessionName,
  type CardToken,
  type ConnectProfile,
  type SignupSession,
  type Stage,
} from "@/lib/connect";

export const Route = createFileRoute("/_authenticated/activate/$sessionId")({
  head: () => ({
    meta: [
      { title: "Card activation station — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Re-verify membership, mint the permanent card address, write the NFC card and verify the read-back before handing it over.",
      },
      { property: "og:title", content: "Card activation station — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Write and verify a ProConnect NFC card at the booth activation station.",
      },
    ],
  }),
  component: ActivatePage,
});

function makeToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

function ActivatePage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const { base, setBase } = useCardBase();

  const [session, setSession] = useState<SignupSession | null>(null);
  const [profile, setProfile] = useState<ConnectProfile | null>(null);
  const [card, setCard] = useState<CardToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [readback, setReadback] = useState("");
  const [baseDraft, setBaseDraft] = useState("");

  useEffect(() => setBaseDraft(base), [base]);

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from("signup_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    setSession(s);
    if (s) {
      const { data: p } = await supabase
        .from("connect_profiles")
        .select("*")
        .eq("signup_session_id", s.id)
        .maybeSingle();
      setProfile(p);
      if (p) {
        const { data: c } = await supabase
          .from("card_tokens")
          .select("*")
          .eq("profile_id", p.id)
          .neq("status", "void")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setCard(c);
      }
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function issueCard() {
    if (!session || !profile || !user) return;
    setBusy(true);
    // Independent re-verification: the profile must exist and the session must
    // have reached membership confirmation before a card can be minted.
    const { data: fresh } = await supabase
      .from("signup_sessions")
      .select("stage, membership_confirmed_at")
      .eq("id", session.id)
      .maybeSingle();

    const ok =
      fresh &&
      (fresh.membership_confirmed_at !== null ||
        fresh.stage === "ready_for_card" ||
        fresh.stage === "card_issued");

    if (!ok) {
      setBusy(false);
      toast.error("Membership isn't confirmed yet — finish the signup first.");
      return;
    }

    const token = makeToken();
    const { data, error } = await supabase
      .from("card_tokens")
      .insert({
        token,
        profile_id: profile.id,
        signup_session_id: session.id,
        issued_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    setBusy(false);
    if (error || !data) {
      toast.error("Couldn't mint the card address. Try again.");
      return;
    }
    setCard(data);
    await supabase.from("signup_events").insert({
      signup_session_id: session.id,
      event_type: "CARD_TOKEN_MINTED",
      actor_user_id: user.id,
      payload: { token },
    });
  }

  async function confirmWritten() {
    if (!card || !user || !session) return;
    const expected = cardUrl(base, card.token);
    const given = readback.trim().replace(/\/+$/, "");
    if (given && given.toLowerCase() !== expected.toLowerCase()) {
      toast.error("Read-back doesn't match. Rewrite the card before handing it over.");
      return;
    }
    setBusy(true);
    await supabase
      .from("card_tokens")
      .update({
        status: "issued",
        written_at: new Date().toISOString(),
        verified_at: given ? new Date().toISOString() : null,
      })
      .eq("id", card.id);
    await supabase.from("signup_sessions").update({ stage: "card_issued" }).eq("id", session.id);
    await supabase.from("signup_events").insert({
      signup_session_id: session.id,
      event_type: "CARD_ISSUED",
      actor_user_id: user.id,
      payload: { token: card.token, verified: Boolean(given), base },
    });
    setBusy(false);
    toast.success("Card issued. Hand it over and have them tap it.");
    void load();
  }

  if (loading) {
    return (
      <FieldShell back={{ to: "/pipeline", label: "Back to pipeline" }}>
        <div className="mt-10 eyebrow animate-pulse">Loading activation record…</div>
      </FieldShell>
    );
  }

  if (!session) {
    return (
      <FieldShell back={{ to: "/pipeline", label: "Back to pipeline" }}>
        <PageTitle title="Signup" accent="not found" />
      </FieldShell>
    );
  }

  const link = card ? cardUrl(base, card.token) : "";
  const publicProfile = profile ? profileUrl(base, profile.slug) : "";

  // During the show the cards must resolve to Field Hub, not the main site,
  // unless the main site has already been wired to redirect here.
  const usingMainSiteBase = /taxcomppro\.com\/connect/i.test(base);
  const baseIsValid = base.trim().length > 0 && !usingMainSiteBase;

  return (
    <FieldShell
      eyebrowRight={STAGE_LABEL[session.stage as Stage]}
      back={{ to: "/pipeline", label: "Back to pipeline" }}
    >
      <PageTitle
        title={sessionName(session)}
        accent="· activation"
        lede="Verify, write, read back, hand over."
      />

      <SectionLabel>1 · Membership check</SectionLabel>
      <Panel className="text-sm">
        {session.membership_confirmed_at ? (
          <span className="text-go">
            Confirmed {new Date(session.membership_confirmed_at).toLocaleString()}
          </span>
        ) : (
          <span className="text-gold">
            Not confirmed yet — send them back to finish the signup on their phone.
          </span>
        )}
      </Panel>

      <SectionLabel>2 · Profile</SectionLabel>
      {profile ? (
        <Panel className="space-y-2 text-sm">
          <div className="font-display text-lg">{profile.display_name}</div>
          <p className="text-muted-foreground">
            {[profile.credential, profile.title, profile.company].filter(Boolean).join(" · ")}
          </p>
          <a
            href={publicProfile}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-signal"
          >
            Open the public profile →
          </a>
        </Panel>
      ) : (
        <Panel className="text-sm text-gold">
          No profile yet. The customer completes it from the signup QR code.
        </Panel>
      )}

      <SectionLabel>3 · Card address</SectionLabel>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="base">Domain written on cards</Label>
          <div className="flex gap-2">
            <Input id="base" value={baseDraft} onChange={(e) => setBaseDraft(e.target.value)} />
            <Button variant="outline" onClick={() => setBase(baseDraft)}>
              Pin
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Set this to the Field Hub published domain. After the show, migrate each card by
            setting its override target URL on the main site.
          </p>
          {usingMainSiteBase ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <strong>Do not write cards to www.taxcomppro.com/connect</strong> unless the main site
              is already redirecting that path to Field Hub. During the show, use the Field Hub
              domain so taps resolve here.
            </div>
          ) : null}
        </div>

        {!card ? (
          <Button
            onClick={issueCard}
            disabled={busy || !profile || !baseIsValid}
            className="h-12 w-full text-base"
          >
            {busy ? "Working…" : "Mint permanent card address"}
          </Button>
        ) : (
          <>
            <CopyField label="Write this URL to the NFC card" value={link} />
            <div className="flex justify-center py-2">
              <QrPanel value={link} size={200} caption="Or scan into your NFC writer app" />
            </div>
          </>
        )}
      </div>

      {card ? (
        <>
          <SectionLabel>4 · Write &amp; verify</SectionLabel>
          <Panel className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Write the card on the USB writer or with an NFC writer app on a phone. Then tap the
              card on a phone and paste what it opened here.
            </p>
            <div className="space-y-2">
              <Label htmlFor="readback">Read-back URL</Label>
              <Input
                id="readback"
                value={readback}
                onChange={(e) => setReadback(e.target.value)}
                placeholder={link}
              />
            </div>
            <Button
              onClick={confirmWritten}
              disabled={busy || !baseIsValid}
              className="h-12 w-full text-base"
            >
              {busy ? "Saving…" : "Confirm written & issue card"}
            </Button>
          </Panel>
        </>
      ) : null}

      {session.stage === "card_issued" ? (
        <div className="mt-8 rounded-2xl border border-go-line bg-go-soft p-5">
          <div className="eyebrow">Card issued</div>
          <p className="mt-1 text-sm">
            Taps so far: {card?.tap_count ?? 0}. Hand it over and have them tap it once in front of
            you.
          </p>
        </div>
      ) : null}
    </FieldShell>
  );
}
