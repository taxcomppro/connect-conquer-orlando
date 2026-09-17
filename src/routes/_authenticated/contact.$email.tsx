import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { FieldShell, PageTitle, Panel, SectionLabel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/MessageComposer";
import {
  getContactActivity,
  type ActivityEntry,
  type ContactProfile,
} from "@/lib/contact-activity.functions";
import { looksLikeHtml, sanitizeEmailHtml } from "@/lib/html-message";


export const Route = createFileRoute("/_authenticated/contact/$email")({
  head: () => ({
    meta: [
      { title: "Contact activity — Membership Hub" },
      {
        name: "description",
        content:
          "Every text, email, signup step and membership change for one contact, newest first.",
      },
      { property: "og:title", content: "Contact activity — Membership Hub" },
      {
        property: "og:description",
        content: "One timeline per person: messages, signup history and membership status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactActivityPage,
});

const KIND_TONE: Record<ActivityEntry["kind"], string> = {
  email: "border-go-line bg-go-soft text-go",
  sms: "border-signal-line bg-signal-soft text-signal",
  lead: "border-border bg-panel text-muted-foreground",
  signup: "border-gold/50 bg-gold/10 text-gold",
  membership: "border-go-line bg-go-soft text-go",
};

const KIND_LABEL: Record<ActivityEntry["kind"], string> = {
  email: "Email",
  sms: "Text",
  lead: "Lead",
  signup: "Signup",
  membership: "Membership",
};

const TIER_LABEL: Record<string, string> = {
  FREE: "Free",
  VIP: "VIP",
  MARKETPLACE: "Marketplace",
  MARKETPLACE_PLUS: "Marketplace+",
};

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ContactActivityPage() {
  const { email } = Route.useParams();
  const load = useServerFn(getContactActivity);
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [timeline, setTimeline] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const decoded = decodeURIComponent(email);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const result = await load({ data: { email: decoded } });
        if (!active) return;
        setProfile(result.profile);
        setTimeline(result.timeline);
        setError(null);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Couldn't load this contact.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [decoded, load]);

  return (
    <FieldShell eyebrowRight="Contact activity" back={{ to: "/pipeline", label: "Back to pipeline" }}>
      <PageTitle
        title={profile?.name ?? decoded}
        accent="activity"
        lede="Every text, email, signup step and membership change for this person, newest first."
      />

      {error ? (
        <Panel className="mt-5 border-gold/50 bg-gold/10 text-sm text-gold">{error}</Panel>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Panel>
          <div className="eyebrow">Contact</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="break-all">{decoded}</div>
            {profile?.phone ? <div className="text-muted-foreground">{profile.phone}</div> : null}
            {profile?.company || profile?.title ? (
              <div className="text-muted-foreground">
                {[profile?.title, profile?.company].filter(Boolean).join(" · ")}
              </div>
            ) : null}
            {profile?.attendeeId ? (
              <Link
                to="/lead/$attendeeId"
                params={{ attendeeId: profile.attendeeId }}
                className="inline-block text-signal hover:underline"
              >
                Open lead record →
              </Link>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <div className="eyebrow">Membership</div>
          {profile?.member ? (
            <div className="mt-2 space-y-1 text-sm">
              <div className="font-medium">
                {TIER_LABEL[profile.member.tier] ?? profile.member.tier}
              </div>
              {profile.member.subscriptionStatus ? (
                <div className="text-go">{profile.member.subscriptionStatus}</div>
              ) : null}
              {profile.member.subscriptionPlan ? (
                <div className="text-muted-foreground">Plan {profile.member.subscriptionPlan}</div>
              ) : null}
              {profile.member.createdAt ? (
                <div className="text-muted-foreground">
                  Joined {new Date(profile.member.createdAt).toLocaleDateString()}
                </div>
              ) : null}
              {profile.member.currentPeriodEnd ? (
                <div className="text-muted-foreground">
                  Renews {new Date(profile.member.currentPeriodEnd).toLocaleDateString()}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">
              {profile?.memberError ?? "No account on taxcomppro.com yet."}
            </div>
          )}
        </Panel>
      </div>

      {profile ? (
        <div className="mt-4">
          <Button className="h-9" onClick={() => setComposerOpen((open) => !open)}>
            {composerOpen ? "Close composer" : "Message this contact"}
          </Button>
        </div>
      ) : null}

      {composerOpen && profile ? (
        <MessageComposer
          contacts={[
            {
              id: profile.leadId ?? profile.email,
              name: profile.name,
              email: profile.email || null,
              leadId: profile.leadId,
              phone: profile.phone,
            },
          ]}
          onClose={() => setComposerOpen(false)}
        />
      ) : null}

      <SectionLabel>{loading ? "Loading activity…" : `Activity (${timeline.length})`}</SectionLabel>
      <div className="space-y-2">
        {timeline.map((entry) => {
          const isMessage = entry.kind === "sms" || entry.kind === "email";
          const inbound = entry.direction === "inbound";
          const align = !isMessage
            ? ""
            : inbound
              ? "sm:mr-auto sm:max-w-[85%]"
              : "sm:ml-auto sm:max-w-[85%]";
          return (
            <Panel
              key={entry.id}
              className={`${align} ${
                isMessage
                  ? inbound
                    ? "border-l-2 border-l-signal"
                    : "border-r-2 border-r-go"
                  : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${KIND_TONE[entry.kind]}`}
                >
                  {KIND_LABEL[entry.kind]}
                  {isMessage ? (inbound ? " · Received" : " · Sent") : ""}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{when(entry.at)}</span>
              </div>
              <div className="mt-2 text-sm font-medium">{entry.title}</div>
              {entry.detail ? (
                entry.kind === "email" && looksLikeHtml(entry.detail) ? (
                  <div
                    className="email-body mt-2 max-h-80 overflow-y-auto rounded-lg border border-border bg-background/60 p-3 text-sm"
                    // Sanitized above: scripts, styles, iframes and inline handlers removed.
                    dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(entry.detail) }}
                  />
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                    {entry.detail}
                  </p>
                )
              ) : null}

              {entry.status ? (
                <div className="mt-2 font-mono text-xs text-muted-foreground">{entry.status}</div>
              ) : null}
              {entry.error ? <div className="mt-1 text-xs text-gold">{entry.error}</div> : null}
            </Panel>
          );
        })}
        {!loading && timeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No activity recorded for this contact yet.
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}
