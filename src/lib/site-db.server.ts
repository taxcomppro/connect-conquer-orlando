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

const CONNECTION_TIMEOUT_MS = 8_000;
const MEMBER_CACHE_MS = 30_000;
let memberCache: { members: SiteMember[]; loadedAt: number } | undefined;
let memberRequest: Promise<SiteMember[]> | undefined;

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
    // Serverless instances should hold at most one database connection. A
    // larger per-instance pool can exhaust the database when Vercel scales.
    max: 1,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: 10_000,
    query_timeout: CONNECTION_TIMEOUT_MS,
    statement_timeout: CONNECTION_TIMEOUT_MS,
    keepAlive: true,
    allowExitOnIdle: true,
  });
  _pool.on("error", (error) => {
    console.error("[site-db] idle pool client error:", error);
  });
  return _pool;
}

async function resetPool(failedPool: Pool) {
  if (_pool === failedPool) _pool = undefined;
  try {
    await failedPool.end();
  } catch (error) {
    console.error("[site-db] failed to close unhealthy pool:", error);
  }
}

/** Runs a read and retries once with a fresh pool after a connection failure. */
async function queryWithRetry<T>(label: string, text: string, values: unknown[] = []): Promise<T[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const activePool = pool();
    try {
      const { rows } = await activePool.query(text, values);
      return rows as T[];
    } catch (error) {
      lastError = error;
      console.error(`[site-db] ${label} attempt ${attempt} failed:`, error);
      await resetPool(activePool);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed after retrying.`);
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
  createdAt: string | null;
  subscriptionUpdatedAt: string | null;
};

const MEMBER_COLUMNS = `
  u.id as "userId", u.email, u.name, u.tier, u."stripeCustomerId",
  u."createdAt" as "createdAt",
  s.status as "subscriptionStatus", s.plan as "subscriptionPlan",
  s."currentPeriodEnd", s."updatedAt" as "subscriptionUpdatedAt"
`;

/**
 * Looks up a TaxCompPro member by email. Read-only; never writes.
 * Use this for one-off lookups (e.g. showing membership status on a
 * lead's detail page).
 */
export async function findSiteMemberByEmail(rawEmail: string): Promise<SiteMember | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;

  const rows = await queryWithRetry<SiteMember>(
    "findSiteMemberByEmail",
    `select ${MEMBER_COLUMNS}
     from users u
     left join subscriptions s on s."userId" = u.id
     where lower(u.email) = $1
     limit 1`,
    [email],
  );
  return rows[0] ?? null;
}

/**
 * Finds members who hold a paid tier and whose subscription changed
 * since `sinceIso`. Used by the sync job to catch conversions Stripe
 * never saw a webhook for — specifically 100%-off coupon upgrades,
 * which the main site applies directly to its own database without
 * ever creating a Stripe Checkout Session.
 */
export async function findRecentUpgrades(sinceIso: string): Promise<SiteMember[]> {
  return queryWithRetry<SiteMember>(
    "findRecentUpgrades",
    `select ${MEMBER_COLUMNS}
     from users u
     join subscriptions s on s."userId" = u.id
     where u.tier <> 'FREE' and s."updatedAt" >= $1
     order by s."updatedAt" desc
     limit 200`,
    [sinceIso],
  );
}

/**
 * Every member on the main site, newest first. Read-only. Used by the
 * membership-tier pipeline board in Field Hub.
 */
export async function listAllMembers(): Promise<SiteMember[]> {
  if (memberCache && Date.now() - memberCache.loadedAt < MEMBER_CACHE_MS) {
    return memberCache.members;
  }
  if (memberRequest) return memberRequest;

  memberRequest = queryWithRetry<SiteMember>(
    "listAllMembers",
    `select ${MEMBER_COLUMNS}
     from users u
     left join subscriptions s on s."userId" = u.id
     order by u."createdAt" desc nulls last
     limit 5000`,
  )
    .then((members) => {
      memberCache = { members, loadedAt: Date.now() };
      return members;
    })
    .catch((error) => {
      if (memberCache) {
        console.error("[site-db] serving cached membership records after refresh failed:", error);
        return memberCache.members;
      }
      throw error;
    })
    .finally(() => {
      memberRequest = undefined;
    });

  return memberRequest;
}

/**
 * Every member's email as a lowercase set, for cheaply checking
 * "has this lead already created a site account?" without a separate
 * database round-trip per lead.
 */
export async function listAllMemberEmails(): Promise<Set<string>> {
  const rows = await queryWithRetry<{ email: string }>(
    "listAllMemberEmails",
    `select lower(email) as email from users where email is not null`,
  );
  return new Set(rows.map((row) => row.email));
}

/**
 * Marketplace / Marketplace+ members who have never created a single
 * marketplace_listings row — they pay for seller access but have
 * nothing listed yet. Used for the activation-nudge audience.
 */
export async function listUnactivatedSellers(): Promise<SiteMember[]> {
  return queryWithRetry<SiteMember>(
    "listUnactivatedSellers",
    `select ${MEMBER_COLUMNS}
     from users u
     left join subscriptions s on s."userId" = u.id
     where u.tier in ('MARKETPLACE', 'MARKETPLACE_PLUS')
       and not exists (
         select 1 from marketplace_listings ml where ml."userId" = u.id
       )
     order by u."createdAt" desc nulls last
     limit 500`,
  );
}
