import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FieldShell, PageTitle, SectionLabel, Panel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { leadName, leadOutcome, type Lead } from "@/lib/leads";
import { listSmsTemplates, type SmsTemplate } from "@/lib/sms.functions";
import { sendBulkSms } from "@/lib/sms-bulk.functions";

export const Route = createFileRoute("/_authenticated/broadcast")({
  head: () => ({
    meta: [
      { title: "Text all leads — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Send one follow-up text to every badge scanned at Booth 540, with consent checks and per-lead personalization.",
      },
      { property: "og:title", content: "Text all leads — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Bulk follow-up texting for booth leads captured in Field Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BroadcastPage,
});

type Audience = "all" | "consented" | "follow_up" | "hot" | "no_sale";

const AUDIENCES: Array<{ key: Audience; label: string }> = [
  { key: "consented", label: "Consented only" },
  { key: "all", label: "Everyone with a phone" },
  { key: "follow_up", label: "Follow up after show" },
  { key: "hot", label: "Hot leads" },
  { key: "no_sale", label: "No sale yet" },
];

function BroadcastPage() {
  const { user } = useAuth();
  const loadTemplates = useServerFn(listSmsTemplates);
  const runBulk = useServerFn(sendBulkSms);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState<Audience>("consented");
  const [body, setBody] = useState("");
  const [requireConsent, setRequireConsent] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const [{ data, error }, tpl] = await Promise.all([
        supabase.from("leads").select("*").order("scanned_at", { ascending: false }),
        loadTemplates().catch(() => ({ templates: [] as SmsTemplate[] })),
      ]);
      if (!active) return;
      if (error) toast.error("Couldn't load leads.");
      setLeads(data ?? []);
      setTemplates((tpl.templates ?? []) as SmsTemplate[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, loadTemplates]);

  const recipients = useMemo(() => {
    return leads.filter((lead) => {
      if (!lead.phone) return false;
      if (requireConsent && !lead.sms_consent) return false;
      const outcome = leadOutcome(lead);
      if (audience === "consented" && !lead.sms_consent) return false;
      if (audience === "follow_up" && outcome !== "follow_up") return false;
      if (audience === "hot" && lead.rating !== "hot") return false;
      if (audience === "no_sale" && (outcome === "sale_started" || outcome === "sale_closed"))
        return false;
      return true;
    });
  }, [leads, audience, requireConsent]);

  const noPhone = leads.filter((l) => !l.phone).length;

  async function send() {
    if (recipients.length === 0) return;
    const ok = window.confirm(
      `Send this text to ${recipients.length} lead${recipients.length === 1 ? "" : "s"}?`,
    );
    if (!ok) return;
    setSending(true);
    try {
      const result = await runBulk({
        data: {
          leadIds: recipients.map((lead) => lead.id),
          body,
          requireConsent,
        },
      });
      toast.success(
        `Sent ${result.sent} · skipped ${result.skipped}${result.failed ? ` · failed ${result.failed}` : ""}`,
      );
      if (result.errors.length > 0) {
        toast.error(`${result.errors[0]!.name}: ${result.errors[0]!.reason}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the texts.");
    } finally {
      setSending(false);
    }
  }

  return (
    <FieldShell back={{ to: "/leads", label: "Leads" }}>
      <PageTitle
        title="Text"
        accent="all leads"
        lede="One message, every booth lead. Field Hub personalizes each text and logs it on the lead record."
      />

      <Panel className="mt-6">
        <SectionLabel>Who gets it</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-2">
          {AUDIENCES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setAudience(option.key)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                audience === option.key
                  ? "border-signal-line bg-signal-soft text-signal"
                  : "border-border bg-panel text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={requireConsent}
            onChange={(e) => setRequireConsent(e.target.checked)}
          />
          <span>
            Only text leads who gave texting consent. Recommended — turn this off only for
            transactional follow-ups you are certain are permitted.
          </span>
        </label>

        <p className="mt-4 text-sm">
          {loading ? (
            <span className="text-muted-foreground">Loading leads…</span>
          ) : (
            <>
              <span className="text-foreground font-medium">{recipients.length}</span>
              <span className="text-muted-foreground">
                {" "}
                of {leads.length} leads will receive this text
                {noPhone > 0 ? ` · ${noPhone} have no phone on file` : ""}
              </span>
            </>
          )}
        </p>
      </Panel>

      <Panel className="mt-6">
        <SectionLabel>Message</SectionLabel>
        {templates.length > 0 ? (
          <select
            className="mt-3 h-10 w-full rounded-md border border-border bg-panel px-3 text-sm"
            value=""
            onChange={(e) => {
              const template = templates.find((t) => t.id === e.target.value);
              if (template) setBody(template.body);
            }}
          >
            <option value="">Start from a template…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        ) : null}

        <textarea
          className="mt-3 min-h-36 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {{first_name}}, thanks for stopping by TCPC at Booth 540…"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Placeholders: {"{{first_name}}"}, {"{{last_name}}"}, {"{{full_name}}"}, {"{{company}}"},{" "}
          {"{{rep_name}}"} · {body.length}/1600 characters. Add “Reply STOP to opt out.” to
          marketing texts.
        </p>

        <Button
          className="mt-4 h-11 w-full"
          disabled={sending || loading || !body.trim() || recipients.length === 0}
          onClick={() => void send()}
        >
          {sending
            ? "Sending…"
            : `Send to ${recipients.length} lead${recipients.length === 1 ? "" : "s"}`}
        </Button>
      </Panel>

      {!loading && recipients.length > 0 ? (
        <Panel className="mt-6">
          <SectionLabel>Recipients</SectionLabel>
          <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
            {recipients.slice(0, 25).map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-3">
                <span className="text-foreground">{leadName(lead)}</span>
                <span>{lead.phone}</span>
              </li>
            ))}
            {recipients.length > 25 ? <li>+ {recipients.length - 25} more…</li> : null}
          </ul>
        </Panel>
      ) : null}
    </FieldShell>
  );
}
