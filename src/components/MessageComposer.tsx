import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/FieldShell";
import { listSmsTemplates, type SmsTemplate } from "@/lib/sms.functions";
import { sendBulkSms } from "@/lib/sms-bulk.functions";
import { sendBulkEmail } from "@/lib/email.functions";

export type ComposeContact = {
  id: string;
  name: string;
  email: string | null;
  leadId: string | null;
};

export function MessageComposer({
  contacts,
  onClose,
  onSent,
}: {
  contacts: ComposeContact[];
  onClose: () => void;
  onSent?: () => void;
}) {
  const loadTemplates = useServerFn(listSmsTemplates);
  const runBulkSms = useServerFn(sendBulkSms);
  const runBulkEmail = useServerFn(sendBulkEmail);

  const [tab, setTab] = useState<"sms" | "email">("sms");
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [smsBody, setSmsBody] = useState("");
  const [requireConsent, setRequireConsent] = useState(true);
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { templates: t } = await loadTemplates();
        if (active) setTemplates((t ?? []) as SmsTemplate[]);
      } catch {
        // templates are optional
      }
    })();
    return () => {
      active = false;
    };
  }, [loadTemplates]);

  const textable = contacts.filter((c) => c.leadId);
  const emailable = contacts.filter((c) => (c.email ?? "").includes("@"));

  async function sendSms() {
    if (textable.length === 0) return;
    setSending(true);
    try {
      const result = await runBulkSms({
        data: {
          leadIds: textable.map((c) => c.leadId!),
          body: smsBody,
          requireConsent,
        },
      });
      toast.success(
        `Texts sent ${result.sent} · skipped ${result.skipped}${result.failed ? ` · failed ${result.failed}` : ""}`,
      );
      if (result.errors.length > 0) {
        toast.error(`${result.errors[0]!.name}: ${result.errors[0]!.reason}`);
      }
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the texts.");
    } finally {
      setSending(false);
    }
  }

  async function sendEmail() {
    if (emailable.length === 0) return;
    setSending(true);
    try {
      const result = await runBulkEmail({
        data: {
          contacts: emailable.map((c) => ({
            email: c.email!,
            name: c.name,
            leadId: c.leadId,
          })),
          subject,
          body: emailBody,
        },
      });
      toast.success(
        `Emails sent ${result.sent} · skipped ${result.skipped}${result.failed ? ` · failed ${result.failed}` : ""}`,
      );
      if (result.errors.length > 0) {
        toast.error(`${result.errors[0]!.name}: ${result.errors[0]!.reason}`);
      }
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the emails.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-signal-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Message selected</div>
          <div className="mt-1 font-display text-xl">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Close ✕
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {(["sms", "email"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTab(option)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              tab === option
                ? "border-signal-line bg-signal-soft text-signal"
                : "border-border bg-panel text-muted-foreground hover:text-foreground"
            }`}
          >
            {option === "sms" ? "SMS" : "Email"}
          </button>
        ))}
      </div>

      {tab === "sms" ? (
        <div className="mt-4">
          <SectionLabel>Text message</SectionLabel>
          {templates.length > 0 ? (
            <select
              className="h-10 w-full rounded-md border border-border bg-panel px-3 text-sm"
              value=""
              onChange={(e) => {
                const template = templates.find((t) => t.id === e.target.value);
                if (template) setSmsBody(template.body);
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
            className="mt-3 min-h-32 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm"
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
            placeholder="Hi {{first_name}}, quick note from Tax Compliance Pro…"
          />
          <label className="mt-3 flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={requireConsent}
              onChange={(e) => setRequireConsent(e.target.checked)}
            />
            <span>Only text contacts who gave texting consent.</span>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            {textable.length} of {contacts.length} selected have a Field Hub lead record and can be
            texted · {smsBody.length}/1600 characters.
          </p>
          <Button
            className="mt-4 h-11 w-full"
            disabled={sending || !smsBody.trim() || textable.length === 0}
            onClick={() => void sendSms()}
          >
            {sending ? "Sending…" : `Text ${textable.length} contact${textable.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <SectionLabel>Email</SectionLabel>
          <input
            className="h-10 w-full rounded-md border border-border bg-panel px-3 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
          />
          <textarea
            className="mt-3 min-h-40 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Hi {{first_name}}, …"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Placeholders: {"{{first_name}}"}, {"{{last_name}}"}, {"{{full_name}}"}. Replies go to
            jennifer@taxcomppro.com · {emailable.length} of {contacts.length} selected have an email
            address.
          </p>
          <Button
            className="mt-4 h-11 w-full"
            disabled={sending || !subject.trim() || !emailBody.trim() || emailable.length === 0}
            onClick={() => void sendEmail()}
          >
            {sending
              ? "Sending…"
              : `Email ${emailable.length} contact${emailable.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
}
