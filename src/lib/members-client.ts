import {
  listMembers,
  listUnactivatedSellers,
  type MemberRow,
} from "@/lib/members.functions";

export interface MembersResult {
  members: MemberRow[];
  error: string | null;
}

const MEMBER_FETCH_TIMEOUT_MS = 20_000;

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

/** Fetch all site members, never hanging the page — resolves with an error string instead. */
export async function fetchMembersSafe(): Promise<MembersResult> {
  return withTimeout(
    listMembers().catch((error: unknown) => ({
      members: [] as MemberRow[],
      error: error instanceof Error ? error.message : "Couldn't load membership records.",
    })),
    MEMBER_FETCH_TIMEOUT_MS,
    () => ({ members: [] as MemberRow[], error: TIMEOUT_ERROR }),
  );
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
