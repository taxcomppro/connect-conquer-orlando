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

const CONNECTION_TIMEOUT_MS = 12_000;
// Members change slowly, so a warm cache is served immediately and refreshed
// in the background instead of making the board wait for a fresh round-trip.
const MEMBER_CACHE_MS = 300_000;
let memberCache: { members: SiteMember[]; loadedAt: number } | undefined;
let memberRequest: Promise<SiteMember[]> | undefined;
let unlistedUnavailable = false;

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
  // Another concurrent query may already have detached and closed this pool.
  // Only the caller that detaches it should attempt to close it.
  if (_pool !== failedPool) return;
  _pool = undefined;
  try {
    await failedPool.end();
  } catch (error) {
    console.error("[site-db] failed to close unhealthy pool:", error);
  }
}

function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const code = "code" in error ? String(error.code) : "";
  if (code === "42501") return false;
  return /connect|connection|timeout|terminated|closed|socket|econn/i.test(error.message);
}

/** Runs a read and retries once with a fresh pool after a connection failure. */
async function queryWithRetry<T>(label: string, text: string, values: unknown[] = []): Promise<T[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const activePool = pool();
    const startedAt = Date.now();
    try {
      const { rows } = await activePool.query(text, values);
      console.log(`[site-db] ${label} ok in ${Date.now() - startedAt}ms (${rows.length} rows)`);
      return rows as T[];
    } catch (error) {
      lastError = error;
      console.error(`[site-db] ${label} attempt ${attempt} failed:`, error);
      if (!isConnectionFailure(error)) throw error;
      await resetPool(activePool);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed after retrying.`);
}

export type SiteMember = {
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  tier: "FREE" | "VIP" | "MARKETPLACE" | "MARKETPLACE_PLUS";
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  currentPeriodEnd: string | null;
  createdAt: string | null;
  subscriptionUpdatedAt: string | null;
};

const MEMBER_COLUMNS = `
  u.id as "userId", u.email, u.name, u.phone, u.tier, u."stripeCustomerId",
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
  const fresh = memberCache && Date.now() - memberCache.loadedAt < MEMBER_CACHE_MS;
  if (memberCache && fresh) return memberCache.members;

  if (!memberRequest) {
    memberRequest = queryWithRetry<SiteMember>(
      "listAllMembers",
      // One row per member: pick only that member's latest subscription instead
      // of joining every historical row and paying for the duplicates.
      `select ${MEMBER_COLUMNS}
       from users u
       left join lateral (
         select status, plan, "currentPeriodEnd", "updatedAt"
         from subscriptions
         where "userId" = u.id
         order by "updatedAt" desc nulls last
         limit 1
       ) s on true
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
  }

  // Stale cache: hand it back now and let the refresh above finish in the background.
  if (memberCache) {
    void memberRequest.catch(() => undefined);
    return memberCache.members;
  }

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
  // The read-only role may not be allowed to read listings. Once that's clear,
  // stop asking on every page load — it only costs time and log noise.
  if (unlistedUnavailable) return [];
  try {
    return await queryWithRetry<SiteMember>(
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
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "42501") {
      unlistedUnavailable = true;
      console.error(
        "[site-db] the read-only role can't read marketplace_listings — the 'not yet listed' audience is off until it's granted SELECT.",
      );
      return [];
    }
    throw error;
  }
}
