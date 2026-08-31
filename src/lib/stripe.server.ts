/**
 * Thin Stripe REST helpers. Field Hub only READS the TaxCompPro Stripe
 * account — it never creates charges. Use a restricted (read-only) key so a
 * leaked booth key can't move money.
 *
 * Required secret: STRIPE_SECRET_KEY (restricted key, read access to
 * Checkout Sessions, Customers, Charges, Subscriptions, Invoices).
 * Optional secret: STRIPE_WEBHOOK_SECRET (for the live webhook route).
 */

const STRIPE_API = "https://api.stripe.com/v1";

export type PurchaseItem = {
  name: string;
  quantity: number;
  amountCents: number;
};

export type StripePurchase = {
  reference: string;
  customerId: string | null;
  email: string | null;
  name: string | null;
  amountCents: number;
  currency: string;
  createdAt: string;
  mode: string;
  items: PurchaseItem[];
};

function stripeKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe is not connected yet — add STRIPE_SECRET_KEY.");
  return key;
}

async function stripeGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${STRIPE_API}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${stripeKey()}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Stripe request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

type StripeList<T> = { data: T[] };

type CheckoutSession = {
  id: string;
  amount_total: number | null;
  currency: string | null;
  created: number;
  mode: string;
  payment_status: string;
  status: string;
  customer: string | { id: string } | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  customer_email?: string | null;
};

type LineItem = {
  description: string | null;
  quantity: number | null;
  amount_total: number | null;
  price?: { nickname?: string | null; product?: string | { name?: string } } | null;
};

function customerId(session: CheckoutSession): string | null {
  const c = session.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

async function lineItemsFor(sessionId: string): Promise<PurchaseItem[]> {
  try {
    const list = await stripeGet<StripeList<LineItem>>(`/checkout/sessions/${sessionId}/line_items`, {
      limit: "20",
    });
    return list.data.map((item) => ({
      name:
        item.description ??
        item.price?.nickname ??
        (typeof item.price?.product === "object" ? (item.price.product.name ?? "Item") : "Item"),
      quantity: item.quantity ?? 1,
      amountCents: item.amount_total ?? 0,
    }));
  } catch {
    return [];
  }
}

function toPurchase(session: CheckoutSession, items: PurchaseItem[]): StripePurchase {
  return {
    reference: session.id,
    customerId: customerId(session),
    email: session.customer_details?.email ?? session.customer_email ?? null,
    name: session.customer_details?.name ?? null,
    amountCents: session.amount_total ?? 0,
    currency: (session.currency ?? "usd").toUpperCase(),
    createdAt: new Date(session.created * 1000).toISOString(),
    mode: session.mode,
    items,
  };
}

function isPaid(session: CheckoutSession): boolean {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

/**
 * Finds completed Stripe checkouts for an email address.
 * Looks the customer up by email first (exact match), then falls back to
 * scanning recent checkout sessions — customers who paid as a guest have no
 * Customer record until checkout completes.
 */
export async function findPurchasesByEmail(
  rawEmail: string,
  opts: { sinceDays?: number } = {},
): Promise<StripePurchase[]> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return [];
  const since = Math.floor(Date.now() / 1000) - (opts.sinceDays ?? 45) * 86400;

  const found = new Map<string, CheckoutSession>();

  const customers = await stripeGet<StripeList<{ id: string }>>("/customers", {
    email,
    limit: "5",
  });

  for (const customer of customers.data) {
    const list = await stripeGet<StripeList<CheckoutSession>>("/checkout/sessions", {
      customer: customer.id,
      limit: "20",
    });
    for (const s of list.data) if (isPaid(s)) found.set(s.id, s);
  }

  if (found.size === 0) {
    const recent = await stripeGet<StripeList<CheckoutSession>>("/checkout/sessions", {
      limit: "100",
      "created[gte]": String(since),
    });
    for (const s of recent.data) {
      const sessionEmail = (s.customer_details?.email ?? s.customer_email ?? "").toLowerCase();
      if (sessionEmail === email && isPaid(s)) found.set(s.id, s);
    }
  }

  const sessions = [...found.values()].sort((a, b) => b.created - a.created).slice(0, 5);
  const purchases: StripePurchase[] = [];
  for (const session of sessions) {
    purchases.push(toPurchase(session, await lineItemsFor(session.id)));
  }
  return purchases;
}

/** Loads one checkout session (used by the webhook to fetch line items). */
export async function getCheckoutSession(id: string): Promise<StripePurchase> {
  const session = await stripeGet<CheckoutSession>(`/checkout/sessions/${id}`);
  return toPurchase(session, await lineItemsFor(session.id));
}

/** Human summary such as "TaxCompPro Membership — Pro ×1". */
export function describePurchase(purchase: StripePurchase): string {
  if (purchase.items.length === 0) return "Stripe purchase";
  return purchase.items
    .map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name))
    .join(", ");
}

/** Verifies a Stripe-Signature header against the raw request body. */
export async function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k ?? "", rest.join("=")];
    }),
  ) as Record<string, string>;

  const timestamp = Number(parts["t"]);
  const signature = parts["v1"];
  if (!signature || !Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${parts["t"]}.${rawBody}`),
  );
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
