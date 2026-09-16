import type { MemberRow } from "@/lib/members.functions";

export type Tier = MemberRow["tier"];

/** Membership segments shared by the pipeline selector and the broadcast page. */
/** Marketplace members who are paying for seller access but have no listing yet. */
export const UNLISTED_AUDIENCE = "unlisted" as const;

export const TIER_AUDIENCES: Array<{ key: Tier | "lead" | typeof UNLISTED_AUDIENCE; label: string }> = [
  { key: "lead", label: "Leads only" },
  { key: "FREE", label: "Free tier" },
  { key: "VIP", label: "VIP" },
  { key: "MARKETPLACE", label: "Marketplace" },
  { key: "MARKETPLACE_PLUS", label: "Marketplace+" },
  { key: UNLISTED_AUDIENCE, label: "Marketplace, not yet listed" },
];

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** email → tier, for deciding which segment a lead or contact belongs to. */
export function tierByEmail(members: MemberRow[]): Map<string, Tier> {
  const map = new Map<string, Tier>();
  for (const member of members) {
    const email = normalizeEmail(member.email);
    if (email && !map.has(email)) map.set(email, member.tier);
  }
  return map;
}
