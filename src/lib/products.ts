/**
 * Product catalog used for the booth's manual "send them the link" texts.
 * Every link carries the booth's Dub code (`?via=<code>`) so the pooled
 * commission group gets credit for whatever the rep walks the client through.
 */

export const PRODUCT_BASE_URL = "https://www.taxcomppro.com/connect";

export type Product = {
  slug: string;
  name: string;
  blurb: string;
  /** Path appended to the connect base URL. */
  path: string;
  /** SMS copy; supports {{first_name}} and {{product_link}}. */
  body: string;
};

export const PRODUCTS: Product[] = [
  {
    slug: "membership",
    name: "TaxCompPro Membership",
    blurb: "Any membership tier — 2 months free at the Forum.",
    path: "/membership",
    body: "Hi {{first_name}}, it's the Tax Compliance Pro team at Booth 540. Here's the membership you looked at — Forum attendees get the first 2 months free: {{product_link}}\n\nReply STOP to opt out.",
  },
  {
    slug: "atlas-ai",
    name: "Atlas AI",
    blurb: "The AI research and notice-response assistant.",
    path: "/atlas-ai",
    body: "Hi {{first_name}}, here's Atlas AI — the assistant we demoed at Booth 540: {{product_link}}\n\nReply STOP to opt out.",
  },
  {
    slug: "proconnect-card",
    name: "ProConnect Card",
    blurb: "NFC networking card + public profile.",
    path: "/card",
    body: "Hi {{first_name}}, here's the ProConnect card and profile we showed you at Booth 540: {{product_link}}\n\nReply STOP to opt out.",
  },
  {
    slug: "atlas-academy",
    name: "Atlas Academy",
    blurb: "Training library and CE-friendly coursework.",
    path: "/academy",
    body: "Hi {{first_name}}, here's Atlas Academy — the training library we talked about at Booth 540: {{product_link}}\n\nReply STOP to opt out.",
  },
  {
    slug: "30-day-launch",
    name: "30 Day Launch",
    blurb: "Launch program for new and growing firms.",
    path: "/30-day-launch",
    body: "Hi {{first_name}}, here's the 30 Day Launch program from Booth 540: {{product_link}}\n\nReply STOP to opt out.",
  },
  {
    slug: "schedule-c-recon",
    name: "Schedule C Recon",
    blurb: "Schedule C reconciliation toolkit.",
    path: "/schedule-c-recon",
    body: "Hi {{first_name}}, here's the Schedule C Recon toolkit we went over at Booth 540: {{product_link}}\n\nReply STOP to opt out.",
  },
  {
    slug: "irs-fine-defense",
    name: "IRS Fine Defense",
    blurb: "Penalty abatement and defense playbook.",
    path: "/irs-fine-defense",
    body: "Hi {{first_name}}, here's IRS Fine Defense from Booth 540: {{product_link}}\n\nReply STOP to opt out.",
  },
  {
    slug: "audit-playbook",
    name: "Audit Playbook",
    blurb: "Step-by-step audit representation guide.",
    path: "/audit-playbook",
    body: "Hi {{first_name}}, here's the Audit Playbook we discussed at Booth 540: {{product_link}}\n\nReply STOP to opt out.",
  },
];

/**
 * Builds the product URL with the booth/seller Dub code attached.
 *
 * The main site does not serve per-product sub-pages yet (every /connect/<path>
 * loads the same shell, so deep links read as dead). Until the developer ships
 * them, every link lands on the live /connect page and carries the product as a
 * `p=<slug>` query param, which the site can pick up later without changing
 * anything here.
 */
export function productLink(
  product: Product,
  options: { baseUrl?: string | null; dubCode?: string | null } = {},
): string {
  const base = (options.baseUrl || PRODUCT_BASE_URL).replace(/\/+$/, "");
  const params = new URLSearchParams({ p: product.slug });
  if (options.dubCode) params.set("via", options.dubCode);
  return `${base}?${params.toString()}`;
}

/** Fills {{first_name}} / {{full_name}} / {{product_link}} for a manual send. */
export function renderProductMessage(
  product: Product,
  options: {
    firstName?: string | null;
    fullName?: string | null;
    baseUrl?: string | null;
    dubCode?: string | null;
  },
): string {
  const map: Record<string, string> = {
    first_name: options.firstName?.trim() || "there",
    full_name: options.fullName?.trim() || "there",
    product_link: productLink(product, options),
    product_name: product.name,
  };
  return product.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => map[key] ?? match);
}
