/**
 * Thin Resend REST helper for Field Hub email.
 *
 * Required secret: RESEND_API_KEY (a Resend API key with send access on a
 * verified taxcomppro.com sending domain).
 *
 * Every send comes from and replies to info@taxcomppro.com, regardless of
 * which team member triggered it.
 */

const RESEND_API = "https://api.resend.com";

export const DEFAULT_FROM = "Tax Compliance Pro <info@taxcomppro.com>";
export const REPLY_TO = "info@taxcomppro.com";

export type EmailSendResult = {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
};

async function resendKey(): Promise<string> {
  const { readEnv } = await import("./env.server");
  const key = (await readEnv("RESEND_API_KEY")) || process.env["RESEND_API_KEY"] || "";
  if (!key) {
    throw new Error("Email sending is not connected yet — add RESEND_API_KEY.");
  }
  return key;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html?: string | undefined;
  text?: string | undefined;
  from?: string | undefined;
  replyTo?: string | undefined;
}): Promise<EmailSendResult> {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const text = (input.text ?? "").trim();
  const html = input.html?.trim();

  if (!to) throw new Error("An email address is required to send an email.");
  if (!subject) throw new Error("A subject line is required.");
  if (!text && !html) throw new Error("A message body is required.");

  const key = await resendKey();
  const from = input.from?.trim() || DEFAULT_FROM;

  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    reply_to: input.replyTo?.trim() || REPLY_TO,
  };
  if (html) payload["html"] = html;
  if (text) payload["text"] = text;

  const response = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
  } catch {
    data = { message: responseText };
  }

  if (!response.ok) {
    const message =
      typeof data["message"] === "string"
        ? data["message"]
        : `Resend request failed (${response.status})`;
    console.error(`Resend send failed [${response.status}]: ${responseText}`);
    throw new Error(message);
  }

  return {
    id: String(data["id"] ?? ""),
    to,
    from,
    subject,
    body: text || html || "",
  };
}

/** Very small plain-text → HTML conversion so emails read well in every client. */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px;line-height:1.6">${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#111">${paragraphs}</div>`;
}
