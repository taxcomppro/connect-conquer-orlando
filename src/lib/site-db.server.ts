/**
 * Read-only connection to the TaxCompPro main-site database.
 *
 * This is a SEPARATE Postgres database from Field Hub's own Supabase
 * project — it belongs to taxcomppro-1 (www.taxcomppro.com). Field Hub
 * only ever SELECTs from it, through a dedicated read-only Postgres
 * role (see /docs/site-db-setup.md for the exact SQL), so a leaked
 * credential here can never modify membership data on the main site.
 *
 * Required secret: SITE_DATABASE_URL — the READ-ONLY role's connection
 * string. This is intentionally a different variable name from the
 * main site's own DATABASE_URL, so the two can never be confused.
 */
import { Pool } from "pg";

let _pool: Pool | undefined;

function pool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env["SITE_DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "SITE_DATABASE_URL is not set — the read-only connection to the main site's database isn't configured yet.",
    );
  }
  _pool = new Pool({ connectionString, max: 3, ssl: { rejectUnauthorized: false } });
  return _pool;
}

export type SiteMember = {
  userId: string;
  email: string;
  name: string;
  tier: "FREE" | "VIP" | "MARKETPLACE" | "MARKETPLACE_PLUS";
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  currentPeriodEnd: string | null;
};

const MEMBER_COLUMNS = `
  u.id as "userId", u.email, u.name, u.tier, u."stripeCustomerId",
  s.status as "subscriptionStatus", s.plan as "subscriptionPlan",
  s."currentPeriodEnd"
`;

/**
 * Looks up a TaxCompPro member by email. Read-only; never writes.
 * Use this for one-off lookups (e.g. showing membership status on a
 * lead's detail page).
 */
export async function findSiteMemberByEmail(rawEmail: string): Promise<SiteMember | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;

  const { rows } = await pool().query(
    `select ${MEMBER_COLUMNS}
     from users u
     left join subscriptions s on s."userId" = u.id
     where lower(u.email) = $1
     limit 1`,
    [email],
  );
  return (rows[0] as SiteMember) ?? null;
}

/**
 * Finds members who hold a paid tier and whose subscription changed
 * since `sinceIso`. Used by the sync job to catch conversions Stripe
 * never saw a webhook for — specifically 100%-off coupon upgrades,
 * which the main site applies directly to its own database without
 * ever creating a Stripe Checkout Session.
 */
export async function findRecentUpgrades(sinceIso: string): Promise<SiteMember[]> {
  const { rows } = await pool().query(
    `select ${MEMBER_COLUMNS}
     from users u
     join subscriptions s on s."userId" = u.id
     where u.tier <> 'FREE' and s."updatedAt" >= $1
     order by s."updatedAt" desc
     limit 200`,
    [sinceIso],
  );
  return rows as SiteMember[];
}
