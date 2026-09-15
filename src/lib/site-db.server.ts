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
  _pool = new Pool({
    connectionString,
    max: 3,
    ssl: { rejectUnauthorized: false },
    // Hard limits so a hung connection surfaces as an error instead of an opaque timeout.
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    query_timeout: 8000,
    statement_timeout: 8000,
  });
  _pool.on("error", (error) => {
    console.error("[site-db] idle pool client error:", error);
  });
  return _pool;
}

/** Rejects if the database doesn't answer within `ms`, so callers never hang. */
async function withTimeout<T>(label: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms — the main site's database did not respond.`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

/**
 * Every member on the main site, newest first. Read-only. Used by the
 * membership-tier pipeline board in Field Hub.
 */
export async function listAllMembers(): Promise<SiteMember[]> {
  const { rows } = await withTimeout(
    "listAllMembers",
    8000,
    pool().query(
      `select ${MEMBER_COLUMNS}
     from users u
     left join subscriptions s on s."userId" = u.id
     order by u."createdAt" desc nulls last
     limit 5000`,
    ),
  );
  return rows as SiteMember[];
}
