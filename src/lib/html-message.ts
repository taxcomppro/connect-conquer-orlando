/**
 * Helpers for showing email bodies in the CRM. Emails sent from templates are
 * HTML, so the raw markup must be rendered rather than printed as code — with
 * scripts, styles and event handlers stripped first.
 */

export function looksLikeHtml(body: string): boolean {
  return /<(p|div|table|br|span|a|h1|h2|h3|img|body|html|td|tr|ul|li|strong)\b|<!doctype/i.test(
    body,
  );
}

export function sanitizeEmailHtml(body: string): string {
  return body
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|head|body|meta|title|link)\b[^>]*>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}
