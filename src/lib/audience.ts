import type { MemberRow } from "@/lib/members.functions";

export type Tier = MemberRow["tier"];

/** Membership segments shared by the pipeline selector and the broadcast page. */
export const TIER_AUDIENCES: Array<{ key: Tier | "lead"; label: string }> = [
  { key: "lead", label: "Leads only" },
  { key: "FREE", label: "Free tier" },
  { key: "VIP", label: "VIP" },
  { key: "MARKETPLACE", label: "Marketplace" },
  { key: "MARKETPLACE_PLUS", label: "Marketplace+" },
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
