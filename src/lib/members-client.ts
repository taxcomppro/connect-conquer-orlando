import {
  listMembers,
  listUnactivatedSellers,
  type MemberRow,
} from "@/lib/members.functions";

export interface MembersResult {
  members: MemberRow[];
  error: string | null;
}

// The database connection retries once, so this must outlast two 12-second
// connection attempts instead of hiding a successful retry from the page.
const MEMBER_FETCH_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback()), ms);
    }),
  ]);
}

const TIMEOUT_ERROR =
  "Membership records took too long to respond. Refresh to try again.";

const CACHE_KEY = "fieldhub:members-cache";

/** Members already loaded this session, so revisiting a page paints instantly. */
export function cachedMembers(): MemberRow[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemberRow[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function storeMembers(members: MemberRow[]) {
  if (typeof sessionStorage === "undefined" || members.length === 0) return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(members));
  } catch {
    /* quota or private mode — caching is optional */
  }
}

/** Fetch all site members, never hanging the page — resolves with an error string instead. */
export async function fetchMembersSafe(): Promise<MembersResult> {
  const result = await withTimeout(
    listMembers().catch((error: unknown) => ({
      members: [] as MemberRow[],
      error: error instanceof Error ? error.message : "Couldn't load membership records.",
    })),
    MEMBER_FETCH_TIMEOUT_MS,
    () => ({ members: [] as MemberRow[], error: TIMEOUT_ERROR }),
  );
  if (result.members.length > 0) {
    storeMembers(result.members);
    return result;
  }
  // Fall back to whatever this session already loaded rather than an empty board.
  const cached = cachedMembers();
  if (cached) return { members: cached, error: null };
  return result;
}

/** Fetch unactivated sellers, silently empty on failure. */
export async function fetchUnlistedSafe(): Promise<MemberRow[]> {
  const result = await withTimeout(
    listUnactivatedSellers().catch(() => ({ members: [] as MemberRow[], error: null })),
    MEMBER_FETCH_TIMEOUT_MS,
    () => ({ members: [] as MemberRow[], error: null }),
  );
  return result.members;
}
