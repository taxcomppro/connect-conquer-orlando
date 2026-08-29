import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FieldShell, PageTitle, Panel, SectionLabel } from "@/components/FieldShell";
import { QrPanel, CopyField } from "@/components/QrPanel";
import { Button } from "@/components/ui/button";
import {
  MEMBERSHIP_URL,
  STAGE_LABEL,
  joinUrl,
  sessionName,
  type SignupSession,
  type Stage,
} from "@/lib/connect";
import { useCardBase } from "@/hooks/useCardBase";

export const Route = createFileRoute("/_authenticated/signup/$sessionId")({
  head: () => ({
    meta: [
      { title: "Membership handoff — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Show the customer the membership QR code, then watch the signup move to Ready for Card.",
      },
      { property: "og:title", content: "Membership handoff — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Hand the customer their signup link and track it to card activation.",
      },
    ],
  }),
  component: HandoffPage,
});

function HandoffPage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { base } = useCardBase();
  const [session, setSession] = useState<SignupSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("signup_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (!active) return;
      setSession(data);
      setLoading(false);
    }
    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session || !user) return;
    if (session.stage === "scanned") {
      void supabase
        .from("signup_sessions")
        .update({ stage: "signup_sent" })
        .eq("id", session.id)
        .then(() =>
          supabase.from("signup_events").insert({
            signup_session_id: session.id,
            event_type: "SIGNUP_LINK_SHOWN",
            actor_user_id: user.id,
          }),
        );
    }
  }, [session, user]);

  async function markConfirmed() {
    if (!session || !user) return;
    const { error } = await supabase
      .from("signup_sessions")
      .update({
        stage: "membership_confirmed",
        membership_confirmed_at: new Date().toISOString(),
        membership_confirmed_by: user.id,
      })
      .eq("id", session.id);
    if (error) {
      toast.error("Couldn't update the signup.");
      return;
    }
    await supabase.from("signup_events").insert({
      signup_session_id: session.id,
      event_type: "MEMBERSHIP_CONFIRMED",
      actor_user_id: user.id,
      actor_label: "staff",
    });
    toast.success("Marked confirmed — send them to the activation station.");
    setSession({ ...session, stage: "membership_confirmed" });
  }

  if (loading) {
    return (
      <FieldShell back={{ to: "/pipeline", label: "Back to pipeline" }}>
        <div className="mt-10 eyebrow animate-pulse">Loading signup…</div>
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

  const link = joinUrl(base, session.id);
  const ready = session.stage === "ready_for_card" || session.stage === "card_issued";

  return (
    <FieldShell
      eyebrowRight={STAGE_LABEL[session.stage as Stage]}
      back={{ to: "/pipeline", label: "Back to pipeline" }}
    >
      <PageTitle
        title={sessionName(session)}
        lede="Turn the iPad around and let them scan this with their own phone."
      />

      <div className="mt-6 flex justify-center">
        <QrPanel value={link} size={260} caption="Customer scans this with their phone camera" />
      </div>

      <div className="mt-4 space-y-2">
        <CopyField label="Signup link" value={link} />
        <CopyField label="Membership plans" value={MEMBERSHIP_URL} />
      </div>

      <SectionLabel>Attribution locked in</SectionLabel>
      <Panel className="space-y-2 text-sm">
        <Row label="Rep" value={session.rep_name ?? "—"} />
        <Row label="DUB code" value={session.dub_code ?? "—"} />
        <Row label="Badge ID" value={session.attendee_id ?? "—"} />
        <Row label="Session ID" value={session.id} />
      </Panel>

      {ready ? (
        <div className="mt-8 rounded-2xl border border-go-line bg-go-soft p-5">
          <div className="eyebrow">Ready for card</div>
          <p className="mt-1 text-sm">Their profile is built. Take them to the activation station.</p>
          <Button
            onClick={() => navigate({ to: "/activate/$sessionId", params: { sessionId: session.id } })}
            className="mt-4 h-12 w-full text-base"
          >
            Open activation station →
          </Button>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-panel p-5">
          <div className="eyebrow">Waiting on the customer</div>
          <p className="mt-1 text-sm text-muted-foreground">
            This flips to <strong>Ready for card</strong> automatically the moment they finish their
            profile. If they signed up on their own and showed you the confirmation, mark it here.
          </p>
          <Button variant="outline" onClick={markConfirmed} className="mt-4 h-12 w-full text-base">
            Membership confirmed at booth
          </Button>
        </div>
      )}
    </FieldShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="eyebrow">{label}</span>
      <span className="truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}
