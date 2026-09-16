/**
 * Shared helpers for the automated funnel emails.
 *
 * The automation jobs run without a signed-in staff member, so they fill
 * merge fields themselves rather than going through the composer path.
 */

import { UNSUBSCRIBE_BASE } from "@/lib/email.functions";

export function fillAutomationPlaceholders(
  html: string,
  contact: {
    email: string;
    name?: string | null | undefined;
    company?: string | null | undefined;
    plan?: string | null | undefined;
  },
): string {
  const parts = (contact.name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "there";
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  const unsubscribe = `${UNSUBSCRIBE_BASE}?email=${encodeURIComponent(contact.email)}`;
  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*last_name\s*\}\}/gi, last)
    .replace(/\{\{\s*full_name\s*\}\}/gi, (contact.name ?? "").trim() || first)
    .replace(/\{\{\s*company\s*\}\}/gi, (contact.company ?? "").trim())
    .replace(/\{\{\s*plan\s*\}\}/gi, (contact.plan ?? "").trim() || "your new plan")
    .replace(/\{\{\s*rep_name\s*\}\}/gi, "Tax Comp Pro")
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubscribe)
    .replace(/\{\{\s*email\s*\}\}/gi, contact.email);
}

/** Rough HTML → plain text so every automated email carries a text part. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
