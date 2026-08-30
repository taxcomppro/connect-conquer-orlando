import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { FieldShell, PageTitle, SectionLabel, Panel } from "@/components/FieldShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listSmsTemplates, saveSmsTemplate, type SmsTemplate } from "@/lib/sms.functions";
import {
  listSmsTriggers,
  saveSmsTrigger,
  deleteSmsTrigger,
  TRIGGER_EVENTS,
  TRIGGER_EVENT_LABEL,
  type SmsTrigger,
  type TriggerEvent,
} from "@/lib/sms-triggers.functions";
import { OUTCOMES, OUTCOME_LABEL } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Auto-send text rules — TCPC Field Hub" },
      {
        name: "description",
        content:
          "Set up automatic follow-up texts that fire when a badge is scanned, an outcome changes, or an attendee joins TCPC.",
      },
      { property: "og:title", content: "Auto-send text rules — TCPC Field Hub" },
      {
        property: "og:description",
        content: "Automatic booth follow-up texts triggered by lead activity in Field Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const loadTriggers = useServerFn(listSmsTriggers);
  const loadTemplates = useServerFn(listSmsTemplates);
  const persistTrigger = useServerFn(saveSmsTrigger);
  const removeTrigger = useServerFn(deleteSmsTrigger);
  const persistTemplate = useServerFn(saveSmsTemplate);

  const [triggers, setTriggers] = useState<SmsTrigger[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [event, setEvent] = useState<TriggerEvent>("outcome_changed");
  const [matchOutcome, setMatchOutcome] = useState<string>("follow_up");
  const [templateId, setTemplateId] = useState("");
  const [requireConsent, setRequireConsent] = useState(true);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");

  async function refresh() {
    const [{ triggers: t }, { templates: tpl }] = await Promise.all([
      loadTriggers(),
      loadTemplates(),
    ]);
    setTriggers(t ?? []);
    setTemplates((tpl ?? []) as SmsTemplate[]);
    if (!templateId && (tpl ?? []).length > 0) setTemplateId(tpl![0]!.id);
    setLoading(false);
  }

  useEffect(() => {
    void refresh().catch(() => {
      setLoading(false);
      toast.error("Couldn't load automation rules.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTrigger(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await persistTrigger({
        data: {
          name,
          event,
          matchOutcome: event === "outcome_changed" ? matchOutcome : null,
          templateId,
          enabled: true,
          requireConsent,
        },
      });
      setName("");
      await refresh();
      toast.success("Rule saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that rule.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(trigger: SmsTrigger) {
    setBusy(true);
    try {
      await persistTrigger({
        data: {
          id: trigger.id,
          name: trigger.name,
          event: trigger.event,
          matchOutcome: trigger.match_outcome,
          templateId: trigger.template_id,
          enabled: !trigger.enabled,
          requireConsent: trigger.require_consent,
        },
      });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the rule.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await removeTrigger({ data: { id } });
      await refresh();
      toast.success("Rule removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the rule.");
    } finally {
      setBusy(false);
    }
  }

  async function addTemplate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { template } = await persistTemplate({
        data: { name: newTemplateName, body: newTemplateBody },
      });
      setNewTemplateName("");
      setNewTemplateBody("");
      await refresh();
      setTemplateId(template.id);
      toast.success("Template saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldShell back={{ to: "/", label: "Field Hub" }}>
      <PageTitle
        title="Auto-send"
        accent="text rules"
        lede="Pick a moment in the booth flow and Field Hub sends the matching text on its own — once per lead, from the booth number."
      />

      <Panel className="mt-6">
        <SectionLabel>New rule</SectionLabel>
        <form className="mt-4 grid gap-4" onSubmit={addTrigger}>
          <div className="grid gap-2">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Follow-up text after the show"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rule-event">When this happens</Label>
            <select
              id="rule-event"
              className="h-10 rounded-md border border-border bg-panel px-3 text-sm"
              value={event}
              onChange={(e) => setEvent(e.target.value as TriggerEvent)}
            >
              {TRIGGER_EVENTS.map((value) => (
                <option key={value} value={value}>
                  {TRIGGER_EVENT_LABEL[value]}
                </option>
              ))}
            </select>
          </div>

          {event === "outcome_changed" ? (
            <div className="grid gap-2">
              <Label htmlFor="rule-outcome">Only when the outcome is</Label>
              <select
                id="rule-outcome"
                className="h-10 rounded-md border border-border bg-panel px-3 text-sm"
                value={matchOutcome}
                onChange={(e) => setMatchOutcome(e.target.value)}
              >
                {OUTCOMES.map((value) => (
                  <option key={value} value={value}>
                    {OUTCOME_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="rule-template">Send this template</Label>
            <select
              id="rule-template"
              className="h-10 rounded-md border border-border bg-panel px-3 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
            >
              <option value="">Choose a template…</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={requireConsent}
              onChange={(e) => setRequireConsent(e.target.checked)}
            />
            <span>
              Only send if the lead has given texting consent. Recommended — leave this on unless
              the message is a transactional confirmation.
            </span>
          </label>

          <Button type="submit" disabled={busy || !templateId} className="h-11">
            {busy ? "Saving…" : "Add rule"}
          </Button>
        </form>
      </Panel>

      <Panel className="mt-6">
        <SectionLabel>Active rules</SectionLabel>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : triggers.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No auto-send rules yet. Add one above.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {triggers.map((trigger) => {
              const template = templates.find((t) => t.id === trigger.template_id);
              return (
                <li
                  key={trigger.id}
                  className="rounded-lg border border-border bg-panel px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{trigger.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {TRIGGER_EVENT_LABEL[trigger.event as TriggerEvent] ?? trigger.event}
                        {trigger.match_outcome
                          ? ` → ${OUTCOME_LABEL[trigger.match_outcome as keyof typeof OUTCOME_LABEL] ?? trigger.match_outcome}`
                          : ""}
                        {" · "}
                        {template?.name ?? "Template removed"}
                        {trigger.require_consent ? " · consent required" : " · no consent check"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void toggle(trigger)}
                      >
                        {trigger.enabled ? "Pause" : "Enable"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void remove(trigger.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  {template ? (
                    <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                      {template.body}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="mt-6">
        <SectionLabel>New template</SectionLabel>
        <form className="mt-4 grid gap-4" onSubmit={addTemplate}>
          <div className="grid gap-2">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Booth follow-up"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-body">Message</Label>
            <textarea
              id="tpl-body"
              className="min-h-28 rounded-md border border-border bg-panel px-3 py-2 text-sm"
              value={newTemplateBody}
              onChange={(e) => setNewTemplateBody(e.target.value)}
              placeholder="Hi {{first_name}}, great meeting you at TCPC booth 540. Here's your ProConnect link: …"
              required
            />
            <p className="text-xs text-muted-foreground">
              Placeholders: {"{{first_name}}"}, {"{{last_name}}"}, {"{{full_name}}"},{" "}
              {"{{company}}"}, {"{{rep_name}}"}
            </p>
          </div>
          <Button type="submit" disabled={busy} className="h-11">
            Save template
          </Button>
        </form>
      </Panel>
    </FieldShell>
  );
}
